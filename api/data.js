
import { sql } from '@vercel/postgres';
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
function sanitizeProjectForUser(projectData, user) {
    if (!projectData) return null;
    
    const team = projectData.team || [];
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
          const specificAssetId = req.query.assetId; // Passed from URL for Auto-Join

          let query;

          if (specificProjectId) {
              // --- SINGLE PROJECT FETCH ---
              const { rows } = await sql`SELECT data, owner_id, org_id FROM projects WHERE id = ${specificProjectId}`;
              
              if (rows.length > 0) {
                  const projectRow = rows[0];
                  let projectData = projectRow.data;
                  
                  // Access Check
                  let hasAccess = false;
                  if (projectData.publicAccess === 'view') {
                      hasAccess = true;
                  } else {
                      hasAccess = await checkProjectAccess(user, projectRow);
                  }

                  if (hasAccess) {
                      // --- AUTO-JOIN & PERMISSION UPGRADE LOGIC ---
                      if (!projectRow.org_id) {
                          const currentTeam = projectData.team || [];
                          const memberIndex = currentTeam.findIndex(m => m.id === user.id);
                          
                          let shouldUpdate = false;
                          let newTeam = [...currentTeam];

                          // CASE A: User is NEW.
                          if (memberIndex === -1 && projectData.publicAccess === 'view') {
                              // If accessed via Review Link (has assetId) -> RESTRICTED Viewer
                              // If accessed via Invite Link (no assetId) -> FULL Viewer
                              newTeam.push({
                                  id: user.id,
                                  name: user.name,
                                  avatar: user.avatar,
                                  email: user.email,
                                  role: 'viewer',
                                  restrictedAssetId: specificAssetId || undefined // Persist restriction
                              });
                              shouldUpdate = true;
                          } 
                          // CASE B: User IS Member but Restricted.
                          // If they now access via Invite Link (no assetId), UPGRADE to Full.
                          else if (memberIndex !== -1 && newTeam[memberIndex].restrictedAssetId && !specificAssetId) {
                              newTeam[memberIndex] = {
                                  ...newTeam[memberIndex],
                                  restrictedAssetId: undefined // Remove restriction
                              };
                              shouldUpdate = true;
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

                      // --- SANDBOXING (CRITICAL) ---
                      // Filter data based on DB permissions, NOT just URL params.
                      // Even if URL has no assetId, if DB says "restricted", we restrict.
                      const sanitizedData = sanitizeProjectForUser(projectData, user);
                      query = [{ ...projectRow, data: sanitizedData }];

                  } else {
                      query = [];
                  }
              } else {
                  query = [];
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
              // Modified query to ensure we fetch shared projects where user is in team
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
              // This ensures Dashboard tiles don't leak info (e.g. asset count)
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
          // They can only comment (which goes via comment API).
          // Allow limited patches? No, restricted users are viewers usually.
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
                    
                    // Restricted users cannot overwrite project data via Sync
                    const existingData = checkExists.rows[0].data;
                    const member = existingData.team?.find(m => m.id === user.id);
                    if (member?.restrictedAssetId) {
                        continue; // Skip silently or error? Skip to prevent data corruption.
                    }

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
