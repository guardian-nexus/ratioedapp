import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

import { getTokenBalance, deductTokens, addTokens } from '@/services/supabase';
// import { checkSubscriptionStatus } from '@/services/revenuecat';
import { useAuth } from '@/services/auth';
// import { track, Events } from '@/services/analytics';

const checkSubscriptionStatus = async (): Promise<boolean> => false;
const track = (_event: string, _props?: Record<string, unknown>) => {};
const Events = { CREDITS_DEPLETED: 'credits_depleted' };

interface CreditsContextType {
  credits: number;
  isSubscribed: boolean;
  loading: boolean;
  hasCredits: boolean;
  canScan: boolean;
  canCompare: boolean;
  refreshCredits: () => Promise<void>;
  deductCredit: (amount?: number) => Promise<boolean>;
  addCredits: (amount: number) => Promise<void>;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function CreditsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [credits, setCredits] = useState(5); // Default free credits
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Computed values
  const hasCredits = credits > 0 || isSubscribed;
  const canScan = credits >= 1 || isSubscribed;
  const canCompare = credits >= 2 || isSubscribed;

  // Refresh credits when user changes
  useEffect(() => {
    if (user) {
      refreshCredits();
    } else {
      setCredits(0);
      setIsSubscribed(false);
      setLoading(false);
    }
  }, [user]);

  const refreshCredits = useCallback(async () => {
    setLoading(true);
    try {
      const [userCredits, subscribed] = await Promise.all([
        getTokenBalance(),
        checkSubscriptionStatus(),
      ]);
      setCredits(userCredits);
      setIsSubscribed(subscribed);
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to refresh credits:', error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const deductCredit = useCallback(async (amount: number = 1): Promise<boolean> => {
    // Unlimited subscribers don't deduct
    if (isSubscribed) return true;

    // Check if user has enough credits
    if (credits < amount) {
      track(Events.CREDITS_DEPLETED);
      return false;
    }

    try {
      const success = await deductTokens(amount);
      if (success) {
        // Optimistically update local state
        setCredits((prev) => Math.max(0, prev - amount));
      }
      return success;
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to deduct credits:', error);
      }
      return false;
    }
  }, [isSubscribed, credits]);

  const addCreditsHandler = useCallback(async (amount: number) => {
    try {
      const success = await addTokens(amount);
      if (success) {
        // Optimistically update local state
        setCredits((prev) => prev + amount);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to add credits:', error);
      }
      throw error;
    }
  }, []);

  return React.createElement(
    CreditsContext.Provider,
    {
      value: {
        credits,
        isSubscribed,
        loading,
        hasCredits,
        canScan,
        canCompare,
        refreshCredits,
        deductCredit,
        addCredits: addCreditsHandler,
      },
    },
    children
  );
}

export function useCredits() {
  const context = useContext(CreditsContext);
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
}
