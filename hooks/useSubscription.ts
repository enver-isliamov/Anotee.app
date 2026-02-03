
import { useUser } from '@clerk/clerk-react';

export const useSubscription = () => {
  const { user, isLoaded, isSignedIn } = useUser();
  
  if (!isLoaded || !isSignedIn) {
      return { isPro: false, plan: 'free', expiresAt: null, isLoading: true, checkStatus: async () => {} };
  }

  const meta = user.publicMetadata as any;
  const plan = meta?.plan || 'free';
  const expiresAt = meta?.expiresAt ? new Date(meta.expiresAt) : null;
  
  // Check if plan is pro AND not expired (with 1 day grace period logic if needed)
  const isPro = plan === 'pro' && expiresAt && expiresAt.getTime() > Date.now();

  const checkStatus = async () => {
      await user.reload();
  };

  return { 
      isPro, 
      plan: isPro ? 'pro' : 'free', 
      expiresAt, 
      isLoading: false,
      checkStatus
  };
};
