
// Service to handle Google Drive API interactions
// Powered by Clerk for Authentication

const APP_FOLDER_NAME = 'SmoTree.App';

// We rely on the app to inject a method to get a fresh token from Clerk/Server
let tokenGetter: (() => Promise<string | null>) | null = null;

export const GoogleDriveService = {
  
  /**
   * Initialize with a function that returns a valid Google Access Token.
   * This allows us to use Clerk (or any auth provider) to manage the session.
   */
  setTokenProvider: (getTokenFn: () => Promise<string | null>) => {
      tokenGetter = getTokenFn;
  },

  /**
   * Gets a fresh token using the provider.
   */
  getToken: async (): Promise<string | null> => {
      if (!tokenGetter) return null;
      try {
          return await tokenGetter();
      } catch (e) {
          console.error("Failed to get token from provider", e);
          return null;
      }
  },

  /**
   * Checks if we have a valid configuration to attempt API calls.
   * Note: This doesn't guarantee the token is valid, just that we can try to get one.
   */
  isAuthenticated: (): boolean => {
    return !!tokenGetter;
  },
  
  // Legacy stub - can be removed, keeping for safety if called elsewhere temporarily
  init: (clientId: string) => { /* No-op */ },

  /**
   * Check if a file exists and is not trashed.
   */
  checkFileStatus: async (fileId: string): Promise<'ok' | 'trashed' | 'missing'> => {
      const accessToken = await GoogleDriveService.getToken();
      if (!accessToken) return 'ok'; // Cannot check without token

      try {
          const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=trashed,explicitlyTrashed`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          
          if (res.status === 404) return 'missing';
          if (!res.ok) {
              return 'ok'; // Fallback on error
          }

          const data = await res.json();
          if (data.trashed || data.explicitlyTrashed) return 'trashed';
          return 'ok';
      } catch (e) {
          console.error("Check status failed", e);
          return 'ok';
      }
  },

  /**
   * Renames a project folder (finds it by old name inside App folder).
   */
  renameProjectFolder: async (oldName: string, newName: string): Promise<boolean> => {
      const accessToken = await GoogleDriveService.getToken();
      if (!accessToken) return false;

      try {
          const appFolderId = await GoogleDriveService.ensureAppFolder();
          
          // Escape single quotes for the query
          const safeOldName = oldName.replace(/'/g, "\\'");
          
          const query = `mimeType='application/vnd.google-apps.folder' and name='${safeOldName}' and '${appFolderId}' in parents and trashed=false`;
          
          const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          const data = await searchRes.json();

          if (data.files && data.files.length > 0) {
              const folderId = data.files[0].id;
              
              const patchRes = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
                  method: 'PATCH',
                  headers: {
                      'Authorization': `Bearer ${accessToken}`,
                      'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ name: newName })
              });
              
              return patchRes.ok;
          }
          return false;
      } catch (e) {
          console.error("Rename folder failed exception", e);
          return false;
      }
  },

  /**
   * Helper to find or create a folder inside a parent folder.
   */
  ensureFolder: async (folderName: string, parentId?: string): Promise<string> => {
      const accessToken = await GoogleDriveService.getToken();
      if (!accessToken) throw new Error("No access token");

      const safeName = folderName.replace(/'/g, "\\'");
      let query = `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and trashed=false`;
      if (parentId) {
          query += ` and '${parentId}' in parents`;
      }

      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await searchRes.json();

      if (data.files && data.files.length > 0) {
          return data.files[0].id;
      }

      const metadata: any = {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder'
      };
      if (parentId) {
          metadata.parents = [parentId];
      }

      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(metadata)
      });
      const createData = await createRes.json();
      return createData.id;
  },

  /**
   * Finds the SmoTree.App folder or creates it.
   */
  ensureAppFolder: async (): Promise<string> => {
    return GoogleDriveService.ensureFolder(APP_FOLDER_NAME);
  },

  /**
   * Deletes (trashes) a file from Google Drive.
   */
  deleteFile: async (fileId: string): Promise<void> => {
      const accessToken = await GoogleDriveService.getToken();
      if (!accessToken) return;
      
      try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
              method: 'PATCH',
              headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({ trashed: true })
          });
      } catch (e) {
          console.error("Failed to delete Drive file", e);
      }
  },

  /**
   * Uploads a file using the Resumable Upload protocol.
   */
  uploadFile: async (file: File, folderId: string, onProgress?: (percent: number) => void, customName?: string): Promise<{ id: string, name: string }> => {
     const accessToken = await GoogleDriveService.getToken();
     if (!accessToken) throw new Error("No access token");

     const metadata = {
         name: customName || file.name,
         parents: [folderId]
     };

     const initResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
         method: 'POST',
         headers: {
             'Authorization': `Bearer ${accessToken}`,
             'Content-Type': 'application/json',
             'X-Upload-Content-Type': file.type || 'application/octet-stream',
             'X-Upload-Content-Length': file.size.toString()
         },
         body: JSON.stringify(metadata)
     });

     if (!initResponse.ok) {
         throw new Error(`Drive Init Failed: ${initResponse.status}`);
     }

     const sessionUri = initResponse.headers.get('Location');
     if (!sessionUri) throw new Error("No session URI");

     return new Promise((resolve, reject) => {
         const xhr = new XMLHttpRequest();
         xhr.open('PUT', sessionUri);
         
         if (onProgress) {
             xhr.upload.onprogress = (e) => {
                 if (e.lengthComputable) {
                     onProgress(Math.round((e.loaded / e.total) * 100));
                 }
             };
         }

         xhr.onload = async () => {
             if (xhr.status === 200 || xhr.status === 201) {
                 try {
                     const response = JSON.parse(xhr.responseText);
                     
                     // Make public for guests (optional)
                     try {
                        await fetch(`https://www.googleapis.com/drive/v3/files/${response.id}/permissions`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ role: 'reader', type: 'anyone' })
                        });
                     } catch (e) {}

                     resolve(response);
                 } catch (e) {
                     reject(new Error("Invalid JSON"));
                 }
             } else {
                 reject(new Error(`Upload failed: ${xhr.status}`));
             }
         };
         xhr.onerror = () => reject(new Error("Network error"));
         xhr.send(file);
     });
  },

  /**
   * Returns a streaming URL for the file.
   */
  getVideoStreamUrl: (fileId: string): string => {
      // Prioritize API key for unauthenticated stream if available (better performance usually)
      const env = (import.meta as any).env || {};
      const apiKey = env.VITE_GOOGLE_API_KEY;
      if (apiKey) {
         return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
      }

      // Fallback to simple export link (often redirects to a temp link)
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
};
