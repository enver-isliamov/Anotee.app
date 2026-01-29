
// Service to handle Google Drive API interactions
// Powered by Clerk for Authentication

const APP_FOLDER_NAME = 'SmoTree.App';

// We rely on the app to inject a method to get a fresh token from Clerk/Server
let tokenGetter: (() => Promise<string | null>) | null = null;

export const GoogleDriveService = {
  
  /**
   * Initialize with a function that returns a valid Google Access Token.
   */
  setTokenProvider: (getTokenFn: () => Promise<string | null>) => {
      tokenGetter = getTokenFn;
  },

  /**
   * Gets a fresh token using the provider.
   */
  getToken: async (): Promise<string | null> => {
      if (!tokenGetter) {
          console.warn("DriveService: No token provider set.");
          return null;
      }
      try {
          const t = await tokenGetter();
          if (!t) console.warn("DriveService: Token provider returned null.");
          return t;
      } catch (e) {
          console.error("DriveService: Failed to get token", e);
          return null;
      }
  },

  isAuthenticated: (): boolean => {
    return !!tokenGetter;
  },

  checkFileStatus: async (fileId: string): Promise<'ok' | 'trashed' | 'missing'> => {
      const accessToken = await GoogleDriveService.getToken();
      if (!accessToken) return 'ok'; 

      try {
          const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=trashed,explicitlyTrashed`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          
          if (res.status === 404) return 'missing';
          if (!res.ok) return 'ok'; 

          const data = await res.json();
          if (data.trashed || data.explicitlyTrashed) return 'trashed';
          return 'ok';
      } catch (e) {
          return 'ok';
      }
  },

  renameProjectFolder: async (oldName: string, newName: string): Promise<boolean> => {
      const accessToken = await GoogleDriveService.getToken();
      if (!accessToken) return false;

      try {
          const appFolderId = await GoogleDriveService.ensureAppFolder();
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
          console.error("Rename folder failed", e);
          return false;
      }
  },

  ensureFolder: async (folderName: string, parentId?: string): Promise<string> => {
      const accessToken = await GoogleDriveService.getToken();
      
      // CRITICAL: Explicit check
      if (!accessToken) {
          throw new Error("Google Drive Access Token is missing. Please reconnect Drive in Profile.");
      }

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
      
      if (!createRes.ok) {
          throw new Error(`Failed to create folder: ${createRes.statusText}`);
      }
      
      const createData = await createRes.json();
      return createData.id;
  },

  ensureAppFolder: async (): Promise<string> => {
    return GoogleDriveService.ensureFolder(APP_FOLDER_NAME);
  },

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

  uploadFile: async (file: File, folderId: string, onProgress?: (percent: number) => void, customName?: string): Promise<{ id: string, name: string }> => {
     const accessToken = await GoogleDriveService.getToken();
     if (!accessToken) throw new Error("Google Drive Access Token is missing. Please reconnect Drive in Profile.");

     const metadata = {
         name: customName || file.name,
         parents: [folderId]
     };

     const initResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
         method: 'POST',
         headers: {
             'Authorization': `Bearer ${accessToken}`,
             'Content-Type': 'application/json',
             'X-Upload-Content-Type': file.type || 'application/octet-stream'
         },
         body: JSON.stringify(metadata)
     });

     if (!initResponse.ok) {
         throw new Error(`Drive Init Failed: ${initResponse.status} ${initResponse.statusText}`);
     }

     const sessionUri = initResponse.headers.get('Location');
     if (!sessionUri) throw new Error("No session URI received from Google.");

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
                     // Set public permission
                     try {
                        await fetch(`https://www.googleapis.com/drive/v3/files/${response.id}/permissions`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ role: 'reader', type: 'anyone' })
                        });
                     } catch (e) {
                         console.warn("Failed to set public permission", e);
                     }
                     resolve(response);
                 } catch (e) {
                     reject(new Error("Invalid JSON response from Drive"));
                 }
             } else {
                 reject(new Error(`Upload failed with status: ${xhr.status}`));
             }
         };
         xhr.onerror = () => reject(new Error("Network error during upload"));
         xhr.send(file);
     });
  },

  getVideoStreamUrl: (fileId: string): string => {
      const env = (import.meta as any).env || {};
      const apiKey = env.VITE_GOOGLE_API_KEY;
      if (apiKey) {
         return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
      }
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
};
