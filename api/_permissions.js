
import { getClerkClient } from './_auth.js';

/**
 * Checks if a user has access to a specific project.
 * Supports: Owner check, Organization membership check (priority), and Legacy Team array check (fallback).
 * 
 * @param {Object} user - The user object from verifyUser or compatible structure {id, userId}
 * @param {Object} projectRow - The DB row containing { owner_id, org_id, data }
 * @returns {Promise<boolean>}
 */
export async function checkProjectAccess(user, projectRow) {
    if (!user || !projectRow) return false;

    const { owner_id, org_id, data } = projectRow;
    const projectTeam = data?.team || [];

    // 1. Owner Access
    // Check against Legacy ID (email-based) AND Clerk User ID
    // Since we are standardizing on Clerk ID, user.id should match owner_id if migrated
    if (owner_id === user.id || owner_id === user.userId || owner_id === user.email) return true;

    // 2. Organization Access (Priority)
    // If a project belongs to an Org, we ONLY check Org Membership. 
    // We strictly IGNORE the local 'team' array to prevent "zombie permissions" 
    // (users removed from Org but remaining in legacy JSON).
    if (org_id) {
        try {
            const clerk = getClerkClient();
            // Fetch user's organizations from Clerk
            const memberships = await clerk.users.getOrganizationMembershipList({ userId: user.userId });
            const userOrgIds = memberships.data.map(m => m.organization.id);
            
            if (userOrgIds.includes(org_id)) return true;
        } catch (e) {
            console.error("ACL: Org permission check failed", e.message);
        }
        return false; // If org_id exists but user not in org, deny access. Do not fall through.
    }

    // 3. Legacy Team Access (Only if NO Organization)
    // Only used for personal workspace projects
    if (projectTeam && Array.isArray(projectTeam)) {
        // Check for ID match or Email match (legacy)
        if (projectTeam.some(m => m.id === user.id || m.id === user.email || m.email === user.email)) return true;
    }

    return false;
}
