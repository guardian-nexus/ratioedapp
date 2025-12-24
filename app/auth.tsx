import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';

import Logo from '@/components/Logo';
import GradientButton from '@/components/GradientButton';
import { useAuth } from '@/services/auth';
import { joinWaitlist } from '@/services/supabase';
import { useColors } from '@/hooks/useColors';
import { colors as defaultColors, spacing, typography, borderRadius } from '@/theme';

type AuthMode = 'signin' | 'signup' | 'waitlist';

export default function Auth() {
  const colors = useColors();
  const { signIn, signUp, signInWithApple, isAppleAuthAvailable, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailAuth = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (mode === 'signup' && !inviteCode) {
      setError('Invite code is required to sign up');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password, inviteCode);
      }
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleAuth = async () => {
    if (mode === 'signup' && !inviteCode) {
      setError('Invite code is required to sign up');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await signInWithApple(mode === 'signup' ? inviteCode : undefined);
      router.replace('/(tabs)');
    } catch (err) {
      if (err instanceof Error && err.message.includes('cancelled')) {
        // User cancelled, ignore
        setLoading(false);
        return;
      }
      setError(err instanceof Error ? err.message : 'Apple Sign In failed');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await joinWaitlist(email);
      Alert.alert(
        'You\'re on the list!',
        'We\'ll send you an invite code when it\'s your turn.',
        [{ text: 'OK', onPress: () => setMode('signin') }]
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join waitlist');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'waitlist') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Logo size={80} showText />

          <Text style={[styles.title, { color: colors.text }]}>Join the Waitlist</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            We're launching invite-only. Drop your email and we'll send you a code.
          </Text>

          <View style={styles.form}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <GradientButton
              title="Join Waitlist"
              onPress={handleJoinWaitlist}
              loading={loading}
              style={styles.button}
            />
          </View>

          <TouchableOpacity onPress={() => setMode('signin')}>
            <Text style={[styles.linkText, { color: colors.textSecondary }]}>
              Already have an invite?{' '}
              <Text style={styles.link}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Logo size={80} showText />

        <Text style={[styles.title, { color: colors.text }]}>
          {mode === 'signin' ? 'Welcome back' : 'Create Account'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {mode === 'signin'
            ? 'Sign in to continue'
            : 'Enter your invite code to get started'}
        </Text>

        {/* Invite Code (signup only) */}
        {mode === 'signup' && (
          <View style={styles.inviteCodeContainer}>
            <TextInput
              style={[styles.input, styles.inviteInput, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="INVITE CODE"
              placeholderTextColor={colors.textMuted}
              value={inviteCode}
              onChangeText={(text) => setInviteCode(text.toUpperCase())}
              autoCapitalize="characters"
              maxLength={8}
            />
          </View>
        )}

        {/* Apple Sign In */}
        {isAppleAuthAvailable && Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={borderRadius.md}
            style={styles.appleButton}
            onPress={handleAppleAuth}
          />
        )}

        {/* Email option */}
        <TouchableOpacity
          onPress={() => setShowEmailForm(!showEmailForm)}
          style={styles.emailToggle}
        >
          <Text style={[styles.emailToggleText, { color: colors.textSecondary }]}>
            {showEmailForm ? 'Hide email form' : 'Or continue with email'}
          </Text>
        </TouchableOpacity>

        {/* Email Form */}
        {showEmailForm && (
          <View style={styles.form}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <GradientButton
              title={mode === 'signin' ? 'Sign In' : 'Create Account'}
              onPress={handleEmailAuth}
              loading={loading}
              style={styles.button}
            />
          </View>
        )}

        {/* Toggle mode */}
        <TouchableOpacity
          onPress={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
          }}
        >
          <Text style={[styles.linkText, { color: colors.textSecondary }]}>
            {mode === 'signin' ? (
              <>
                Don't have an account?{' '}
                <Text style={styles.link}>Sign up</Text>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Text style={styles.link}>Sign in</Text>
              </>
            )}
          </Text>
        </TouchableOpacity>

        {/* Waitlist option */}
        {mode === 'signup' && (
          <TouchableOpacity onPress={() => setMode('waitlist')}>
            <Text style={[styles.linkText, { marginTop: spacing.md, color: colors.textSecondary }]}>
              No invite code?{' '}
              <Text style={styles.link}>Join the waitlist</Text>
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultColors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  title: {
    color: defaultColors.text,
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: defaultColors.textSecondary,
    fontSize: typography.md,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  inviteCodeContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  inviteInput: {
    textAlign: 'center',
    fontSize: typography.xl,
    letterSpacing: 4,
    fontWeight: typography.bold,
  },
  appleButton: {
    width: '100%',
    height: 50,
    marginBottom: spacing.md,
  },
  emailToggle: {
    marginVertical: spacing.md,
  },
  emailToggleText: {
    color: defaultColors.textSecondary,
    fontSize: typography.sm,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: defaultColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: defaultColors.text,
    fontSize: typography.md,
    marginBottom: spacing.md,
  },
  button: {
    marginTop: spacing.sm,
  },
  error: {
    color: defaultColors.error,
    fontSize: typography.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  linkText: {
    color: defaultColors.textSecondary,
    fontSize: typography.sm,
    marginTop: spacing.lg,
  },
  link: {
    color: defaultColors.gradientStart,
    fontWeight: typography.medium,
  },
});
