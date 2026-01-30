
import { getClerkClient } from './_auth.js';

/**
 * Checks if a user has access to a specific project.
 * Supports: Owner check, Legacy Team array check, and Organization membership check.
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
    if (owner_id === user.id || owner_id === user.userId) return true;

    // 2. Legacy Team Access (Array in JSON)
    // Checks if user.id (Legacy ID) is in the team list
    if (projectTeam && Array.isArray(projectTeam)) {
        if (projectTeam.some(m => m.id === user.id)) return true;
    }

    // 3. Organization Access
    if (org_id) {
        try {
            const clerk = getClerkClient();
            // Fetch user's organizations from Clerk
            // Note: This adds latency. In high-load scenarios, consider caching or passing memberships if available.
            const memberships = await clerk.users.getOrganizationMembershipList({ userId: user.userId });
            const userOrgIds = memberships.data.map(m => m.organization.id);
            
            if (userOrgIds.includes(org_id)) return true;
        } catch (e) {
            console.error("ACL: Org permission check failed", e.message);
        }
    }

    return false;
}
