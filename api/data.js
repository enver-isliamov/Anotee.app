
import { sql } from '@vercel/postgres';
import { del } from '@vercel/blob';
import { verifyUser, getClerkClient } from './_auth.js';
import { checkProjectAccess } from './_permissions.js';

const isDbConnectionError = (err) => {
    return err.message && (
        err.message.includes('HTTP status 404') || 
        err.message.includes('does not exist') ||
        err.code === 'ENOTFOUND'
    );
};

// Helper: Securely filter project data for a specific user based on their permissions
function sanitizeProjectForUser(projectData, user, isGuest = false) {
    if (!projectData) return null;
    
    const team = projectData.team || [];
    
    // If Guest (Public Link Access), hide Team completely for privacy
    if (isGuest) {
        return {
            ...projectData,
            team: [], // Hide team emails from public viewers
            isGuestView: true
        };
    }

    const memberRecord = team.find(m => m.id === user.id);
    const isOwner = projectData.ownerId === user.id;

    // If Owner or explicitly unrestricted member -> Return Full
    if (isOwner) return projectData;
    
    // Check for restriction in DB
    const restrictedAssetId = memberRecord?.restrictedAssetId;

    if (restrictedAssetId) {
        // FILTERING LOGIC:
        // 1. Filter Assets: Keep only the restricted one.
        const allowedAssets = projectData.assets.filter(a => a.id === restrictedAssetId);
        
        // 2. Hide Team: Privacy protection (Reviewers shouldn't see full team list)
        // Keep only Owner and Self
        const safeTeam = team.filter(m => m.id === user.id || m.id === projectData.ownerId);

        return {
            ...projectData,
            assets: allowedAssets,
            team: safeTeam,
            isRestrictedView: true // Flag for UI
        };
    }

    return projectData;
}

export default async function handler(req, res) {
  try {
      // FORCE EMAIL FETCH: Required for "Shared with Me" personal invites to work.
      const requireEmail = true; 
      const user = await verifyUser(req, requireEmail);
      
      if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
      }

      const { action } = req.query;

      // ==========================================
      // MERGED ROUTE: DRIVE TOKEN (from driveToken.js)
      // ==========================================
      if (req.method === 'GET' && action === 'drive_token') {
          if (!user.isVerified) return res.status(403).json({ error: "Guest accounts cannot access Google Drive." });

          const clerk = getClerkClient();
          let tokenData = null;
          
          try {
              const response = await clerk.users.getUserOauthAccessToken(user.userId, 'oauth_google');
              const tokens = response.data || response || [];
              if (Array.isArray(tokens) && tokens.length > 0) tokenData = tokens[0];
          } catch(e) {
              // Try legacy provider
              try {
                  const response = await clerk.users.getUserOauthAccessToken(user.userId, 'google');
                  const tokens = response.data || response || [];
                  if (Array.isArray(tokens) && tokens.length > 0) tokenData = tokens[0];
              } catch(legacyErr) {}
          }

          if (tokenData && tokenData.token) {
              return res.status(200).json({ token: tokenData.token });
          }
          return res.status(404).json({ error: "No Drive Token Found" });
      }

      // ==========================================
      // MERGED ROUTE: CHECK UPDATES (from check-updates.js)
      // ==========================================
      if (req.method === 'GET' && action === 'check_updates') {
          const targetOrgId = req.query.orgId;
          // 1. Fetch Org Memberships to verify access
          let userOrgIds = [];
          if (user.isVerified && user.userId) {
              try {
                  const clerk = getClerkClient();
                  const memberships = await clerk.users.getOrganizationMembershipList({ userId: user.userId });
                  userOrgIds = memberships.data.map(m => m.organization.id);
              } catch (e) {
                  // non-critical
              }
          }

          let query;
          if (targetOrgId) {
              if (!userOrgIds.includes(targetOrgId)) return res.status(403).json({ error: "Forbidden" });
              query = sql`SELECT MAX(updated_at) as last_modified FROM projects WHERE org_id = ${targetOrgId}`;
          } else {
              query = sql`
                  SELECT MAX(updated_at) as last_modified 
                  FROM projects 
                  WHERE (org_id IS NULL OR org_id = '') 
                  AND (
                      owner_id = ${user.id} 
                      OR 
                      data->'team' @> ${JSON.stringify([{id: user.id}])}::jsonb
                  )
              `;
          }
          const { rows } = await query;
          return res.status(200).json({ lastModified: Number(rows[0]?.last_modified || 0) });
      }

      // ==========================================
      // MERGED ROUTE: COMMENTS (from comment.js)
      // ==========================================
      if (req.method === 'POST' && action === 'comment') {
          let body = req.body;
          if (typeof body === 'string') try { body = JSON.parse(body); } catch(e) {}
          
          const { projectId, assetId, versionId, action: commentAction, payload } = body || {};
          if (!projectId || !assetId || !versionId || !commentAction) return res.status(400).json({ error: "Missing required fields" });

          const result = await sql`SELECT data, owner_id, org_id FROM projects WHERE id = ${projectId};`;
          if (result.rows.length === 0) return res.status(404).json({ error: "Project not found" });

          const projectRow = result.rows[0];
          let projectData = projectRow.data;
          const currentVersion = projectData._version || 0;

          const hasAccess = await checkProjectAccess(user, projectRow);
          if (!hasAccess) return res.status(403).json({ error: "Access denied" });

          const asset = projectData.assets.find(a => a.id === assetId);
          if (!asset) return res.status(404).json({ error: "Asset not found" });

          const version = asset.versions.find(v => v.id === versionId);
          if (!version) return res.status(404).json({ error: "Version not found" });
          if (!version.comments) version.comments = [];

          switch (commentAction) {
              case 'create':
                  version.comments.push({ ...payload, userId: user.id, createdAt: 'Just now' });
                  break;
              case 'update':
                  const uIdx = version.comments.findIndex(c => c.id === payload.id);
                  if (uIdx !== -1) {
                      const isCommentOwner = version.comments[uIdx].userId === user.id;
                      const isProjectOwner = projectRow.owner_id === user.id;
                      if (!isCommentOwner && !isProjectOwner) return res.status(403).json({ error: "Forbidden" });
                      version.comments[uIdx] = { ...version.comments[uIdx], ...payload };
                  }
                  break;
              case 'delete':
                  const dIdx = version.comments.findIndex(c => c.id === payload.id);
                  if (dIdx !== -1) {
                      const isCommentOwner = version.comments[dIdx].userId === user.id;
                      const isProjectOwner = projectRow.owner_id === user.id;
                      if (!isCommentOwner && !isProjectOwner) return res.status(403).json({ error: "Forbidden" });
                      version.comments.splice(dIdx, 1);
                  }
                  break;
          }

          const newVersion = currentVersion + 1;
          projectData._version = newVersion;

          const updateResult = await sql`
              UPDATE projects 
              SET data = ${JSON.stringify(projectData)}::jsonb, updated_at = ${Date.now()}
              WHERE id = ${projectId} 
              AND ((data->>'_version')::int = ${currentVersion} OR data->>'_version' IS NULL);
          `;

          if (updateResult.rowCount === 0) return res.status(409).json({ error: "Conflict" });
          return res.status(200).json({ success: true, _version: newVersion });
      }

      // ==========================================
      // MERGED ROUTE: DELETE ASSETS (from delete.js)
      // ==========================================
      if (req.method === 'POST' && action === 'delete_assets') {
          if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(500).json({ error: "Blob Token missing" });
          
          const { urls, projectId } = req.body;
          if (!urls || !projectId) return res.status(400).json({ error: "Missing data" });

          const { rows } = await sql`SELECT owner_id, org_id, data FROM projects WHERE id = ${projectId}`;
          if (rows.length === 0) return res.status(404).json({ error: "Project not found" });

          const projectRow = rows[0];
          const hasAccess = await checkProjectAccess(user, projectRow);
          if (!hasAccess) return res.status(403).json({ error: "Forbidden" });

          let canDelete = false;
          if (projectRow.owner_id === user.id) canDelete = true;
          else if (projectRow.org_id) {
              try {
                  const clerk = getClerkClient();
                  const memberships = await clerk.users.getOrganizationMembershipList({ userId: user.userId, limit: 100 });
                  const targetOrg = memberships.data.find(m => m.organization.id === projectRow.org_id);
                  if (targetOrg && (targetOrg.role === 'org:admin' || targetOrg.role === 'org:member')) canDelete = true;
              } catch (e) { console.error("Org check failed", e); }
          }

          if (!canDelete) return res.status(403).json({ error: "Forbidden: Delete assets restricted" });
          
          await del(urls);
          return res.status(200).json({ success: true });
      }

      // ==========================================
      // ORIGINAL DATA LOGIC (Project CRUD)
      // ==========================================

      // --- DELETE: Remove Project Row ---
      if (req.method === 'DELETE') {
          const { projectId } = req.query;
          if (!projectId) return res.status(400).json({ error: "Missing projectId" });

          const { rows } = await sql`SELECT owner_id, org_id, data FROM projects WHERE id = ${projectId}`;
          if (rows.length === 0) return res.status(404).json({ error: "Project not found" });

          const projectRow = rows[0];
          
          let canDelete = false;
          
          if (projectRow.owner_id === user.id || (user.email && projectRow.owner_id === user.email)) {
              canDelete = true;
          }
          else if (projectRow.org_id) {
              try {
                  const clerk = getClerkClient();
                  const memberships = await clerk.users.getOrganizationMembershipList({ userId: user.userId });
                  const membership = memberships.data.find(m => m.organization.id === projectRow.org_id);
                  if (membership && membership.role === 'org:admin') canDelete = true;
              } catch(e) {
                  console.warn("Org check failed during delete", e);
              }
          }

          if (!canDelete) return res.status(403).json({ error: "Forbidden: Only Owner or Org Admin can delete projects." });

          await sql`DELETE FROM projects WHERE id = ${projectId}`;
          return res.status(200).json({ success: true });
      }

      // --- GET: Retrieve Projects ---
      if (req.method === 'GET') {
        try {
          const targetOrgId = req.query.orgId;
          const specificProjectId = req.query.projectId;
          const specificAssetId = req.query.assetId; // Passed from URL for Review Link
          const isInviteLink = req.query.invite === 'true'; // New Flag for Full Access Invite

          let query;

          if (specificProjectId) {
              // --- SINGLE PROJECT FETCH ---
              const { rows } = await sql`SELECT data, owner_id, org_id FROM projects WHERE id = ${specificProjectId}`;
              
              if (rows.length > 0) {
                  const projectRow = rows[0];
                  let projectData = projectRow.data;
                  
                  // 1. Initial Access Check (Owner or Existing Member)
                  let hasAccess = await checkProjectAccess(user, projectRow);
                  
                  // 2. Team Join Logic (Only if strictly needed)
                  if (!projectRow.org_id) {
                      const currentTeam = projectData.team || [];
                      const memberIndex = currentTeam.findIndex(m => m.id === user.id);
                      let shouldUpdate = false;
                      let newTeam = [...currentTeam];

                      // Scenario A: Upgrade Restricted User to Full Member (via Invite Link)
                      if (memberIndex !== -1 && isInviteLink && newTeam[memberIndex].restrictedAssetId) {
                          newTeam[memberIndex] = {
                              ...newTeam[memberIndex],
                              restrictedAssetId: undefined // Remove restriction
                          };
                          shouldUpdate = true;
                          hasAccess = true;
                      }
                      // Scenario B: User NOT in team.
                      else if (memberIndex === -1) {
                          // B1. INVITE LINK -> Full Access (Write to DB)
                          if (isInviteLink) {
                              newTeam.push({
                                  id: user.id,
                                  name: user.name,
                                  avatar: user.avatar,
                                  email: user.email,
                                  role: 'viewer'
                              });
                              shouldUpdate = true;
                              hasAccess = true;
                          }
                          // B2. REVIEW LINK -> Restricted Access (Write to DB)
                          else if (specificAssetId) {
                              newTeam.push({
                                  id: user.id,
                                  name: user.name,
                                  avatar: user.avatar,
                                  email: user.email,
                                  role: 'viewer',
                                  restrictedAssetId: specificAssetId
                              });
                              shouldUpdate = true;
                              hasAccess = true;
                          }
                      }

                      if (shouldUpdate) {
                          projectData = { ...projectData, team: newTeam };
                          sql`
                              UPDATE projects 
                              SET data = ${JSON.stringify(projectData)}::jsonb 
                              WHERE id = ${specificProjectId}
                          `.catch(err => console.error("Auto-join update failed", err));
                      }
                  }

                  if (hasAccess) {
                      // Member Access
                      const sanitizedData = sanitizeProjectForUser(projectData, user);
                      query = [{ ...projectRow, data: sanitizedData }];
                  } else if (projectData.publicAccess === 'view') {
                      // Guest Access (Read Only, No DB Write)
                      const sanitizedData = sanitizeProjectForUser(projectData, user, true); // true = isGuest
                      query = [{ ...projectRow, data: sanitizedData }];
                  } else {
                      return res.status(403).json({ error: "Access Denied. Project is private." });
                  }
              } else {
                  return res.status(404).json({ error: "Project not found" });
              }

          } else if (targetOrgId) {
              // --- ORG LIST ---
              const { rows } = await sql`
                SELECT data, org_id FROM projects 
                WHERE org_id = ${targetOrgId}
                ORDER BY updated_at DESC
              `;
              query = rows;
          } else {
              // --- DASHBOARD LIST (PERSONAL + SHARED) ---
              const userEmail = user.email || null;
              
              const { rows } = await sql`
                SELECT data, org_id, owner_id FROM projects 
                WHERE (org_id IS NULL OR org_id = '') 
                AND (
                    owner_id = ${user.id} 
                    OR 
                    data->'team' @> ${JSON.stringify([{id: user.id}])}::jsonb
                    OR (
                        ${userEmail}::text IS NOT NULL 
                        AND EXISTS (
                            SELECT 1 FROM jsonb_array_elements(data->'team') AS member 
                            WHERE member->>'email' = ${userEmail}
                        )
                    )
                )
                ORDER BY updated_at DESC
              `;
              
              // Apply Sandboxing to List Items too!
              query = rows.map(row => ({
                  ...row,
                  data: sanitizeProjectForUser(row.data, user)
              }));
          }

          const projects = query.map(r => {
              const p = r.data;
              if (r.org_id && !p.orgId) p.orgId = r.org_id;
              // Ensure we return ownerId for permissions check on frontend
              if (r.owner_id && !p.ownerId) p.ownerId = r.owner_id;
              return p;
          });
          
          return res.status(200).json(projects);

        } catch (dbError) {
           if (isDbConnectionError(dbError)) return res.status(503).json({ error: "DB Offline", code: "DB_OFFLINE" });
           if (dbError.code === '42P01') return res.status(200).json([]); 
           console.error("DB GET Error:", dbError); 
           return res.status(500).json({ error: "Database error", code: dbError.code });
        }
      } 
      
      // --- PATCH ---
      if (req.method === 'PATCH') {
          const { projectId, updates, _version } = req.body;
          if (!projectId || !updates) return res.status(400).json({ error: "Missing projectId" });

          const { rows } = await sql`SELECT data, owner_id, org_id FROM projects WHERE id = ${projectId}`;
          if (rows.length === 0) return res.status(404).json({ error: "Project not found" });
          
          // Check access
          const hasAccess = await checkProjectAccess(user, rows[0]);
          if (!hasAccess) return res.status(403).json({ error: "Forbidden" });

          // Extra check: Restricted users cannot edit project settings (name, description, team)
          const projectData = rows[0].data;
          const member = projectData.team?.find(m => m.id === user.id);
          if (member?.restrictedAssetId && (updates.name || updates.team || updates.publicAccess)) {
               return res.status(403).json({ error: "Restricted users cannot modify project settings." });
          }

          const currentDbData = rows[0].data;
          const currentVer = currentDbData._version || 0;
          
          if (_version !== undefined && currentVer !== _version) {
              return res.status(409).json({ error: "Conflict", serverVersion: currentVer, clientVersion: _version });
          }

          const newData = {
              ...currentDbData,
              ...updates,
              _version: currentVer + 1, 
              updatedAt: 'Just now'
          };

          await sql`
            UPDATE projects 
            SET data = ${JSON.stringify(newData)}::jsonb, updated_at = ${Date.now()}
            WHERE id = ${projectId}
          `;

          return res.status(200).json({ success: true, project: newData });
      }

      // --- POST (SYNC) ---
      if (req.method === 'POST') {
        let projectsToSync = req.body;
        if (typeof projectsToSync === 'string') try { projectsToSync = JSON.parse(projectsToSync); } catch(e) {}
        if (!Array.isArray(projectsToSync)) projectsToSync = [projectsToSync]; 

        const updatesResults = [];

        for (const project of projectsToSync) {
            if (!project.id) continue;

            const clientVersion = project._version || 0;
            const newVersion = clientVersion + 1;
            project._version = newVersion; 

            const projectJson = JSON.stringify(project);
            const orgId = project.orgId || null;
            
            try {
                const checkExists = await sql`SELECT owner_id, org_id, data FROM projects WHERE id = ${project.id}`;
                
                if (checkExists.rowCount > 0) {
                    const hasAccess = await checkProjectAccess(user, checkExists.rows[0]);
                    if (!hasAccess) continue; 
                    
                    const existingData = checkExists.rows[0].data;
                    const member = existingData.team?.find(m => m.id === user.id);
                    if (member?.restrictedAssetId) continue; 

                    await sql`
                        UPDATE projects 
                        SET data = ${projectJson}::jsonb, org_id = ${orgId}, updated_at = ${Date.now()}
                        WHERE id = ${project.id}
                        AND ((data->>'_version')::int = ${clientVersion} OR data->>'_version' IS NULL);
                    `;
                    updatesResults.push({ id: project.id, _version: newVersion, status: 'updated' });
                } else {
                    await sql`
                        INSERT INTO projects (id, owner_id, org_id, data, updated_at, created_at)
                        VALUES (${project.id}, ${user.id}, ${orgId}, ${projectJson}::jsonb, ${Date.now()}, ${project.createdAt || Date.now()});
                    `;
                    updatesResults.push({ id: project.id, _version: newVersion, status: 'created' });
                }
            } catch (dbError) {
                if (isDbConnectionError(dbError)) return res.status(503).json({ error: "DB Offline" });
                console.error("DB Sync Error", dbError);
                throw dbError;
            }
        }
        
        return res.status(200).json({ success: true, updates: updatesResults });
      }

      return res.status(405).send("Method not allowed");

  } catch (globalError) {
      console.error("API Fatal Error:", globalError);
      return res.status(500).json({ error: "Server Error" });
  }
}
