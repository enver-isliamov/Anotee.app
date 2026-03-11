import { useState, useEffect, useCallback } from 'react';
import { RoadmapPost, RoadmapPostStatus, RoadmapPostType, RoadmapComment } from '../types';
import { generateId } from '../services/utils';

// Mock data for initial state
const MOCK_POSTS: RoadmapPost[] = [
  {
    id: '1',
    title: 'Webhook Notifications',
    description: 'Configure custom webhooks to receive extension alerts and events in any external system. Include payload customization and retry logic.',
    type: 'feature',
    status: 'planned',
    authorId: 'user1',
    createdAt: new Date(Date.now() - 10000000).toISOString(),
    voterIds: Array(87).fill('voter'),
    comments: []
  },
  {
    id: '2',
    title: 'Browser Extension for Quick Analysis',
    description: 'A companion browser extension that allows security teams to quickly analyze any extension directly from the Chrome Web Store with a single click.',
    type: 'feature',
    status: 'planned',
    authorId: 'user2',
    createdAt: new Date(Date.now() - 20000000).toISOString(),
    voterIds: Array(98).fill('voter'),
    comments: []
  },
  {
    id: '3',
    title: 'Dashboard Slow with Large Extension Lists',
    description: 'The dashboard becomes noticeably slow when viewing accounts with more than 500 monitored extensions. Page load times exceed 10 seconds and scrolling is laggy.',
    type: 'bug',
    status: 'in_progress',
    authorId: 'user3',
    createdAt: new Date(Date.now() - 30000000).toISOString(),
    voterIds: Array(34).fill('voter'),
    comments: []
  },
  {
    id: '4',
    title: 'Advanced Filtering on Extensions List',
    description: 'Add more filter options on the extensions list: filter by risk score range, permission type, last update date, manifest version, and publisher verification status.',
    type: 'improvement',
    status: 'in_progress',
    authorId: 'user4',
    createdAt: new Date(Date.now() - 40000000).toISOString(),
    voterIds: Array(76).fill('voter'),
    comments: []
  },
  {
    id: '5',
    title: 'Extension Screenshots Not Loading',
    description: 'Extension screenshots from the Chrome Web Store sometimes fail to load, showing broken image placeholders. Appears to be related to certain image URLs.',
    type: 'bug',
    status: 'completed',
    authorId: 'user5',
    createdAt: new Date(Date.now() - 50000000).toISOString(),
    voterIds: Array(15).fill('voter'),
    comments: []
  },
  {
    id: '6',
    title: 'Browser Fingerprinting Detection',
    description: 'Detect if extensions are collecting browser fingerprinting data that could be used for tracking users across websites. Flag privacy-invasive data collection practices.',
    type: 'feature',
    status: 'closed',
    authorId: 'user6',
    createdAt: new Date(Date.now() - 60000000).toISOString(),
    voterIds: Array(67).fill('voter'),
    comments: []
  },
  {
    id: '7',
    title: 'Extension Dependency Analysis',
    description: 'Analyze third-party libraries and dependencies bundled within extensions to identify known vulnerabilities (similar to SCA for regular software).',
    type: 'feature',
    status: 'planned',
    authorId: 'user7',
    createdAt: new Date(Date.now() - 70000000).toISOString(),
    voterIds: Array(54).fill('voter'),
    comments: []
  }
];

export const useRoadmap = (currentUserId?: string) => {
  const [posts, setPosts] = useState<RoadmapPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    // Simulate API call
    const loadData = async () => {
      setIsLoading(true);
      try {
        // In a real app, this would fetch from an API
        // const response = await fetch('/api/roadmap');
        // const data = await response.json();
        
        // For now, use local storage or mock data
        const stored = localStorage.getItem('anotee_roadmap_posts');
        if (stored) {
          setPosts(JSON.parse(stored));
        } else {
          setPosts(MOCK_POSTS);
          localStorage.setItem('anotee_roadmap_posts', JSON.stringify(MOCK_POSTS));
        }
      } catch (error) {
        console.error('Failed to load roadmap posts', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Save to local storage whenever posts change (for mock persistence)
  useEffect(() => {
    if (!isLoading && posts.length > 0) {
      localStorage.setItem('anotee_roadmap_posts', JSON.stringify(posts));
    }
  }, [posts, isLoading]);

  const createPost = useCallback(async (data: { title: string; description: string; type: RoadmapPostType }) => {
    if (!currentUserId) throw new Error('Must be logged in to create a post');
    
    const newPost: RoadmapPost = {
      id: generateId(),
      title: data.title,
      description: data.description,
      type: data.type,
      status: 'under_review',
      authorId: currentUserId,
      createdAt: new Date().toISOString(),
      voterIds: [currentUserId], // Auto-vote for own post
      comments: []
    };

    setPosts(prev => [newPost, ...prev]);
    return newPost;
  }, [currentUserId]);

  const toggleVote = useCallback(async (postId: string) => {
    if (!currentUserId) throw new Error('Must be logged in to vote');

    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const hasVoted = post.voterIds.includes(currentUserId);
        const newVoterIds = hasVoted 
          ? post.voterIds.filter(id => id !== currentUserId)
          : [...post.voterIds, currentUserId];
        
        return { ...post, voterIds: newVoterIds };
      }
      return post;
    }));
  }, [currentUserId]);

  const addComment = useCallback(async (postId: string, content: string, authorName: string, authorAvatar?: string) => {
    if (!currentUserId) throw new Error('Must be logged in to comment');

    const newComment: RoadmapComment = {
      id: generateId(),
      authorId: currentUserId,
      authorName,
      authorAvatar,
      content,
      createdAt: new Date().toISOString()
    };

    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        return { ...post, comments: [...post.comments, newComment] };
      }
      return post;
    }));
    
    return newComment;
  }, [currentUserId]);

  // Admin functions
  const updatePostStatus = useCallback(async (postId: string, newStatus: RoadmapPostStatus) => {
    setPosts(prev => prev.map(post => 
      post.id === postId ? { ...post, status: newStatus } : post
    ));
  }, []);

  const updatePost = useCallback(async (postId: string, data: Partial<RoadmapPost>) => {
    setPosts(prev => prev.map(post => 
      post.id === postId ? { ...post, ...data } : post
    ));
  }, []);

  const deletePost = useCallback(async (postId: string) => {
    setPosts(prev => prev.filter(post => post.id !== postId));
  }, []);

  return {
    posts,
    isLoading,
    createPost,
    toggleVote,
    addComment,
    updatePostStatus,
    updatePost,
    deletePost
  };
};
