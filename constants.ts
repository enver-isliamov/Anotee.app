
import { Project, UserRole, CommentStatus, User } from './types';

// Internal mocks for initial project data, but not exported for Login UI anymore
const INTERNAL_MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Andrey (Creator)',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=faces',
    role: UserRole.CREATOR
  },
  {
    id: 'u2',
    name: 'Olga (Guest)',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=50&h=50&fit=crop&crop=faces',
    role: UserRole.GUEST
  },
  {
    id: 'u3',
    name: 'Mike (Producer)',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=50&h=50&fit=crop&crop=faces',
    role: UserRole.ADMIN
  }
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'SmoTree – Commercial Spot X',
    description: '30s TV spot for the new product launch. Needs energetic cuts.',
    client: 'TechCorp Inc.',
    createdAt: Date.now() - 172800000, // 2 days ago
    updatedAt: '2 hours ago',
    ownerId: 'u1',
    team: [INTERNAL_MOCK_USERS[0], INTERNAL_MOCK_USERS[1]],
    assets: [
      {
        id: 'a1',
        title: 'Main_Commercial_Cut',
        thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&q=80',
        currentVersionIndex: 1,
        versions: [
          {
            id: 'v1',
            versionNumber: 1,
            filename: 'Main_Commercial_v1.mp4',
            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            uploadedAt: '2 days ago',
            comments: [
              {
                id: 'c1',
                userId: 'u2',
                timestamp: 12.5,
                text: 'Make this transition faster.',
                status: CommentStatus.RESOLVED,
                createdAt: '2 days ago'
              }
            ]
          },
          {
            id: 'v2',
            versionNumber: 2,
            filename: 'Main_Commercial_v2.mp4',
            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            uploadedAt: 'Today',
            comments: [
              {
                id: 'c2',
                userId: 'u2',
                timestamp: 45.2,
                text: 'The color grading here feels too cold. Can we warm up the skin tones?',
                status: CommentStatus.OPEN,
                createdAt: '1 hour ago'
              }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'p3',
    name: 'Social Reels (Vertical)',
    description: '9:16 Vertical content for TikTok and Instagram Reels campaign.',
    client: 'Fashion Week',
    createdAt: Date.now() - 7200000, // 2 hours ago
    updatedAt: '30 mins ago',
    ownerId: 'u1',
    team: [INTERNAL_MOCK_USERS[0], INTERNAL_MOCK_USERS[2]],
    assets: [
      {
        id: 'a_vert_1',
        title: 'Model_Runway_Edit_v3',
        thumbnail: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=338&q=80', // Vertical crop
        currentVersionIndex: 0,
        versions: [
          {
            id: 'v_vert_1',
            versionNumber: 1,
            filename: 'Runway_v1_9x16.mp4',
            // Public domain vertical video sample
            url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-1232-large.mp4',
            uploadedAt: 'Just now',
            comments: []
          }
        ]
      }
    ]
  }
];