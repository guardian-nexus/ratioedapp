import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

import { supabase, validateInviteCode, useInviteCode, generateInviteCodes, deleteAccount as deleteUserAccount } from '@/services/supabase';
// RevenueCat and Analytics disabled until properly configured
// import { initializePurchases, loginUser, logoutUser } from '@/services/revenuecat';
// import { identify, reset as resetAnalytics, track, Events } from '@/services/analytics';

const initializePurchases = async (_userId: string) => {};
const loginUser = async (_userId: string) => {};
const logoutUser = async () => {};
const identify = (_userId: string, _traits?: Record<string, unknown>) => {};
const resetAnalytics = () => {};
const track = (_event: string, _props?: Record<string, unknown>) => {};
const Events = {
  SIGN_IN: 'sign_in',
  SIGN_UP: 'sign_up',
  SIGN_OUT: 'sign_out',
  ACCOUNT_DELETED: 'account_deleted',
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, inviteCode: string) => Promise<void>;
  signInWithApple: (inviteCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  isAppleAuthAvailable: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);

  // Check Apple auth availability
  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setIsAppleAuthAvailable);
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Initialize services for returning user
        initializePurchases(session.user.id);
        loginUser(session.user.id);
        identify(session.user.id, { email: session.user.email });
      }

      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_IN' && session?.user) {
          await initializePurchases(session.user.id);
          await loginUser(session.user.id);
          identify(session.user.id, { email: session.user.email });
        }

        if (event === 'SIGNED_OUT') {
          await logoutUser();
          resetAnalytics();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Sign in with email/password
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    track(Events.SIGN_IN, { method: 'email' });
  }, []);

  // Sign up with email/password and invite code
  const signUp = useCallback(async (email: string, password: string, inviteCode: string) => {
    // Validate invite code first
    const isValid = await validateInviteCode(inviteCode);
    if (!isValid) {
      throw new Error('Invalid or already used invite code');
    }

    // Create account
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;

    if (data.user) {
      // Mark invite code as used
      await useInviteCode(inviteCode);

      // Generate invite codes for new user
      await generateInviteCodes();

      track(Events.SIGN_UP, { method: 'email' });
    }
  }, []);

  // Sign in with Apple
  const signInWithApple = useCallback(async (inviteCode?: string) => {
    if (!isAppleAuthAvailable) {
      throw new Error('Apple Sign In is not available');
    }

    // Get Apple credential
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('No identity token received from Apple');
    }

    // Check if this is a new user (needs invite code)
    const { data: existingUser } = await supabase.auth.getUser();

    if (!existingUser.user && inviteCode) {
      // New user - validate invite code
      const isValid = await validateInviteCode(inviteCode);
      if (!isValid) {
        throw new Error('Invalid or already used invite code');
      }
    }

    // Sign in with Supabase using Apple credential
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) throw error;

    // If new user with invite code, complete setup
    if (data.user && inviteCode) {
      await useInviteCode(inviteCode);
      await generateInviteCodes();
      track(Events.SIGN_UP, { method: 'apple' });
    } else {
      track(Events.SIGN_IN, { method: 'apple' });
    }
  }, [isAppleAuthAvailable]);

  // Sign out
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    track(Events.SIGN_OUT);
  }, []);

  // Delete account
  const deleteAccount = useCallback(async () => {
    await deleteUserAccount();
    await logoutUser();
    resetAnalytics();
    track(Events.ACCOUNT_DELETED);
  }, []);

  return React.createElement(
    AuthContext.Provider,
    {
      value: {
        user,
        session,
        loading,
        signIn,
        signUp,
        signInWithApple,
        signOut,
        deleteAccount,
        isAppleAuthAvailable,
      },
    },
    children
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
