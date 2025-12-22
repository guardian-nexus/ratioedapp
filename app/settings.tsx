import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Share,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';

import Logo from '@/components/Logo';
import CreditBadge from '@/components/CreditBadge';
import { useAuth } from '@/services/auth';
import { useCredits } from '@/hooks/useCredits';
import { useTheme } from '@/contexts/ThemeContext';
import { useColors } from '@/hooks/useColors';
import { getInviteCodes, deleteAllScans, redeemPromoCode } from '@/services/supabase';
import { restorePurchases } from '@/services/revenuecat';
import { track, Events } from '@/services/analytics';
import { spacing, typography, borderRadius, colors as defaultColors } from '@/theme';

interface InviteCode {
  id: string;
  code: string;
  usedBy: string | null;
  usedAt: string | null;
}

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { user, signOut, deleteAccount } = useAuth();
  const { credits, isSubscribed, refreshCredits } = useCredits();
  const { mode, setMode } = useTheme();
  const colors = useColors();

  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [promoModalVisible, setPromoModalVisible] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [redeemingPromo, setRedeemingPromo] = useState(false);

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const themeModeLabel = mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark';

  // App Store ID - replace with your actual App Store ID when available
  const APP_STORE_ID = 'YOUR_APP_STORE_ID';

  useEffect(() => {
    loadInviteCodes();
  }, []);

  const loadInviteCodes = async () => {
    try {
      const codes = await getInviteCodes();
      setInviteCodes(codes);
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to load invite codes:', error);
      }
    } finally {
      setLoadingCodes(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This will permanently delete all your data and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Final Confirmation',
              'This action is irreversible. All your scans, credits, and account data will be permanently deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteAccount();
                      router.replace('/');
                    } catch (error) {
                      Alert.alert('Error', 'Failed to delete account. Please try again.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear All History',
      'Are you sure you want to delete all your scans? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAllScans();
              Alert.alert('Cleared', 'All scan history has been deleted.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear history.');
            }
          },
        },
      ]
    );
  };

  const handleRestorePurchases = async () => {
    setRestoring(true);

    try {
      const restored = await restorePurchases();
      await refreshCredits();

      if (restored) {
        Alert.alert('Restored', 'Your purchases have been restored!');
      } else {
        Alert.alert('No Purchases', 'No previous purchases found to restore.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases.');
    } finally {
      setRestoring(false);
    }
  };

  const handleShareInviteCode = async (code: string) => {
    track(Events.INVITE_CODE_SHARED);

    try {
      await Share.share({
        message: `Join me on Ratioed and find out who's really putting in effort in your convos! Use my invite code: ${code}\n\nDownload: https://ratioed.app`,
      });
    } catch (error) {
      // User cancelled
    }
  };

  const handleOpenLink = (url: string) => {
    Linking.openURL(url);
  };

  const handleRedeemPromoCode = async () => {
    const trimmedCode = promoCode.trim().toUpperCase();
    if (!trimmedCode) {
      Alert.alert('Error', 'Please enter a promo code');
      return;
    }

    setRedeemingPromo(true);

    try {
      const result = await redeemPromoCode(trimmedCode);

      if (result.success) {
        track(Events.PROMO_CODE_REDEEMED, { code: trimmedCode, credits: result.credits });
        await refreshCredits();
        setPromoModalVisible(false);
        setPromoCode('');
        Alert.alert('Success', `You received ${result.credits} scan credits!`);
      } else {
        Alert.alert('Error', result.error || 'Invalid promo code');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to redeem promo code');
    } finally {
      setRedeemingPromo(false);
    }
  };

  const handleRateApp = () => {
    const storeUrl = Platform.select({
      ios: `itms-apps://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review`,
      android: `market://details?id=app.ratioed`,
    });

    if (storeUrl) {
      Linking.openURL(storeUrl).catch(() => {
        // Fallback to web URL if store link fails
        const webUrl = Platform.select({
          ios: `https://apps.apple.com/app/id${APP_STORE_ID}`,
          android: 'https://play.google.com/store/apps/details?id=app.ratioed',
        });
        if (webUrl) Linking.openURL(webUrl);
      });
    }
  };

  const handleSupport = () => {
    Linking.openURL('mailto:support@ratioed.app?subject=Ratioed Support');
  };

  const handleThemeChange = () => {
    Alert.alert(
      'Appearance',
      'Choose your preferred theme',
      [
        { text: 'Light', onPress: () => setMode('light') },
        { text: 'Dark', onPress: () => setMode('dark') },
        { text: 'System', onPress: () => setMode('system') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const renderSettingsRow = (
    icon: string,
    title: string,
    onPress: () => void,
    options?: {
      color?: string;
      showArrow?: boolean;
      loading?: boolean;
      rightText?: string;
    }
  ) => (
    <TouchableOpacity
      style={[styles.settingsRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
      disabled={options?.loading}
    >
      <View style={styles.settingsRowLeft}>
        <Ionicons
          name={icon as any}
          size={20}
          color={options?.color || colors.text}
        />
        <Text style={[styles.settingsRowText, { color: options?.color || colors.text }]}>
          {title}
        </Text>
      </View>
      {options?.loading ? (
        <ActivityIndicator size="small" color={colors.textSecondary} />
      ) : options?.rightText ? (
        <Text style={[styles.settingsRowRight, { color: colors.textSecondary }]}>{options.rightText}</Text>
      ) : options?.showArrow !== false ? (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Logo size={24} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Card */}
        <View style={[styles.accountCard, { backgroundColor: colors.surface }]}>
          <LinearGradient
            colors={[colors.gradientStart + '20', colors.gradientEnd + '10']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.accountGradient}
          />
          <View style={styles.accountInfo}>
            <Text style={[styles.accountEmail, { color: colors.text }]}>{user?.email || 'No email'}</Text>
            <View style={styles.accountBadge}>
              <CreditBadge credits={credits} isSubscribed={isSubscribed} />
            </View>
          </View>
          {isSubscribed && (
            <View style={styles.subscriptionBadge}>
              <Ionicons name="infinite" size={14} color={colors.gradientStart} />
              <Text style={styles.subscriptionText}>Unlimited</Text>
            </View>
          )}
        </View>

        {/* Get More Scans */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.getMoreButton}
            onPress={() => router.push('/store/tokens')}
          >
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.getMoreGradient}
            >
              <Ionicons name="diamond" size={20} color={colors.text} />
              <Text style={styles.getMoreText}>Get More Scans</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Invite Friends Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>INVITE FRIENDS</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.inviteInfo, { color: colors.textSecondary }]}>
              Share your invite codes with friends. When they sign up, you both get 5 free scans!
            </Text>

            {loadingCodes ? (
              <ActivityIndicator size="small" color={colors.textSecondary} style={{ marginTop: spacing.md }} />
            ) : inviteCodes.length > 0 ? (
              <View style={styles.inviteCodesContainer}>
                {inviteCodes.map((invite) => (
                  <TouchableOpacity
                    key={invite.id}
                    style={[
                      styles.inviteCodeRow,
                      { backgroundColor: colors.background },
                      invite.usedBy && styles.inviteCodeUsed,
                    ]}
                    onPress={() => !invite.usedBy && handleShareInviteCode(invite.code)}
                    disabled={!!invite.usedBy}
                  >
                    <Text style={[
                      styles.inviteCode,
                      { color: colors.text },
                      invite.usedBy && styles.inviteCodeTextUsed,
                    ]}>
                      {invite.code}
                    </Text>
                    {invite.usedBy ? (
                      <Text style={[styles.inviteCodeStatus, { color: colors.textMuted }]}>Used</Text>
                    ) : (
                      <Ionicons name="share-outline" size={18} color={colors.gradientStart} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={[styles.noCodesText, { color: colors.textMuted }]}>No invite codes available</Text>
            )}
          </View>
        </View>

        {/* Purchases Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PURCHASES</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderSettingsRow(
              'refresh',
              'Restore Purchases',
              handleRestorePurchases,
              { loading: restoring, showArrow: false }
            )}
            {renderSettingsRow(
              'pricetag-outline',
              'Have a Promo Code?',
              () => setPromoModalVisible(true)
            )}
          </View>
        </View>

        {/* Data Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>DATA</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderSettingsRow(
              'trash-outline',
              'Clear All History',
              handleClearHistory,
              { color: defaultColors.error, showArrow: false }
            )}
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>APPEARANCE</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderSettingsRow(
              'contrast-outline',
              'Theme',
              handleThemeChange,
              { rightText: themeModeLabel }
            )}
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>SUPPORT</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderSettingsRow(
              'star-outline',
              'Rate the App',
              handleRateApp
            )}
            {renderSettingsRow(
              'mail-outline',
              'Contact Support',
              handleSupport
            )}
            {renderSettingsRow(
              'document-text-outline',
              'Privacy Policy',
              () => handleOpenLink('https://ratioed.app/privacy')
            )}
            {renderSettingsRow(
              'shield-checkmark-outline',
              'Terms of Service',
              () => handleOpenLink('https://ratioed.app/terms')
            )}
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ACCOUNT</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderSettingsRow(
              'log-out-outline',
              'Sign Out',
              handleSignOut,
              { showArrow: false }
            )}
            {renderSettingsRow(
              'person-remove-outline',
              'Delete Account',
              handleDeleteAccount,
              { color: defaultColors.error, showArrow: false }
            )}
          </View>
        </View>

        {/* Version */}
        <View style={styles.versionContainer}>
          <Logo size={24} />
          <Text style={[styles.versionText, { color: colors.textMuted }]}>Version {appVersion}</Text>
        </View>
      </ScrollView>

      {/* Promo Code Modal */}
      <Modal
        visible={promoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPromoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Enter Promo Code</Text>
              <TouchableOpacity onPress={() => setPromoModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.promoInput, { backgroundColor: colors.background, color: colors.text }]}
              placeholder="Enter code"
              placeholderTextColor={colors.textMuted}
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.redeemButton, redeemingPromo && styles.redeemButtonDisabled]}
              onPress={handleRedeemPromoCode}
              disabled={redeemingPromo}
            >
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.redeemButtonGradient}
              >
                {redeemingPromo ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Text style={styles.redeemButtonText}>Redeem</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: '600',
    color: defaultColors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  accountCard: {
    backgroundColor: defaultColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  accountGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  accountInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountEmail: {
    fontSize: typography.md,
    color: defaultColors.text,
    flex: 1,
  },
  accountBadge: {
    marginLeft: spacing.md,
  },
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  subscriptionText: {
    fontSize: typography.sm,
    color: defaultColors.gradientStart,
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.xs,
    color: defaultColors.textMuted,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    paddingLeft: spacing.sm,
  },
  sectionCard: {
    backgroundColor: defaultColors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: defaultColors.border,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingsRowText: {
    fontSize: typography.md,
    color: defaultColors.text,
  },
  settingsRowRight: {
    fontSize: typography.sm,
    color: defaultColors.textSecondary,
  },
  getMoreButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  getMoreGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  getMoreText: {
    fontSize: typography.md,
    fontWeight: '600',
    color: defaultColors.text,
    flex: 1,
    marginLeft: spacing.sm,
  },
  inviteInfo: {
    fontSize: typography.sm,
    color: defaultColors.textSecondary,
    lineHeight: 20,
    padding: spacing.md,
    paddingBottom: 0,
  },
  inviteCodesContainer: {
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: defaultColors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  inviteCodeUsed: {
    opacity: 0.5,
  },
  inviteCode: {
    fontSize: typography.md,
    fontWeight: '600',
    color: defaultColors.text,
    letterSpacing: 2,
  },
  inviteCodeTextUsed: {
    textDecorationLine: 'line-through',
  },
  inviteCodeStatus: {
    fontSize: typography.sm,
    color: defaultColors.textMuted,
  },
  noCodesText: {
    fontSize: typography.sm,
    color: defaultColors.textMuted,
    textAlign: 'center',
    padding: spacing.md,
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  versionText: {
    fontSize: typography.sm,
    color: defaultColors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: defaultColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 340,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.lg,
    fontWeight: '600',
    color: defaultColors.text,
  },
  promoInput: {
    backgroundColor: defaultColors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.md,
    color: defaultColors.text,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: spacing.lg,
  },
  redeemButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  redeemButtonDisabled: {
    opacity: 0.6,
  },
  redeemButtonGradient: {
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemButtonText: {
    fontSize: typography.md,
    fontWeight: '600',
    color: defaultColors.text,
  },
});
