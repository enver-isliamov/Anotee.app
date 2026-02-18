
import { useUser } from '@clerk/clerk-react';
import { UserPlan } from '../services/entitlements';

export const useSubscription = () => {
  const { user, isLoaded, isSignedIn } = useUser();
  
  if (!isLoaded || !isSignedIn) {
      return { 
          plan: 'free' as UserPlan, 
          isPro: false, 
          isLifetime: false,
          isPaid: false,
          expiresAt: null, 
          isLoading: true, 
          checkStatus: async () => {} 
      };
  }

  const meta = user.publicMetadata as any;
  const rawPlan = (meta?.plan || 'free') as UserPlan;
  const expiresAt = meta?.expiresAt ? new Date(meta.expiresAt) : null;
  
  let effectivePlan: UserPlan = 'free';

  // 1. Lifetime check (no expiry check needed usually, or far future)
  if (rawPlan === 'lifetime') {
      effectivePlan = 'lifetime';
  } 
  // 2. Pro check (needs valid expiry)
  else if (rawPlan === 'pro') {
      const isNotExpired = expiresAt && expiresAt.getTime() > Date.now();
      if (isNotExpired) {
          effectivePlan = 'pro';
      } else {
          effectivePlan = 'free';
      }
  } else {
      effectivePlan = 'free';
  }

  const checkStatus = async () => {
      await user.reload();
  };

  return { 
      plan: effectivePlan, 
      isPro: effectivePlan === 'pro', 
      isLifetime: effectivePlan === 'lifetime',
      isPaid: effectivePlan === 'pro' || effectivePlan === 'lifetime',
      expiresAt, 
      isLoading: false,
      checkStatus
  };
};
