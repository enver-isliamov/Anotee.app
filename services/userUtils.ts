
import { User } from '../types';

/**
 * Maps a Clerk Organization Membership object to the application's User interface.
 * Handles missing names/avatars gracefully.
 */
export const mapClerkUserToAppUser = (clerkMember: any): User => {
    const userData = clerkMember.publicUserData;
    return {
        id: userData.userId,
        name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.identifier,
        avatar: userData.imageUrl,
    };
};

/**
 * Checks if a user has admin privileges within an organization membership list.
 */
export const isOrgAdmin = (userId: string, memberships: any[]): boolean => {
    const member = memberships.find(m => m.publicUserData.userId === userId);
    return member?.role === 'org:admin';
};
