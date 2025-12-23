import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import Logo from '@/components/Logo';
import GradientButton from '@/components/GradientButton';
import CreditBadge from '@/components/CreditBadge';
import { useCredits } from '@/hooks/useCredits';
import { useColors } from '@/hooks/useColors';
import {
  getProducts,
  purchaseProduct,
  restorePurchases,
  PRODUCTS,
} from '@/services/revenuecat';
import { validatePromoCode, redeemPromoCode } from '@/services/supabase';
import { track, Events } from '@/services/analytics';
import { colors as defaultColors, spacing, typography, borderRadius } from '@/theme';

interface ProductOption {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  tokens: number | 'unlimited';
  bestValue?: boolean;
}

const PRODUCT_OPTIONS: ProductOption[] = [
  {
    id: PRODUCTS.SCANS_10,
    title: '10 Scans',
    subtitle: 'Great for trying it out',
    price: '$4.99',
    tokens: 10,
  },
  {
    id: PRODUCTS.SCANS_30,
    title: '30 Scans',
    subtitle: 'Most popular choice',
    price: '$9.99',
    tokens: 30,
    bestValue: true,
  },
  {
    id: PRODUCTS.SCANS_100,
    title: '100 Scans',
    subtitle: 'For the serial analyzers',
    price: '$24.99',
    tokens: 100,
  },
  {
    id: PRODUCTS.UNLIMITED,
    title: 'Unlimited',
    subtitle: 'Scan as much as you want',
    price: '$14.99/mo',
    tokens: 'unlimited',
  },
];

export default function Tokens() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { credits, isSubscribed, refreshCredits } = useCredits();

  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  const handlePurchase = async (productId: string, tokens: number | 'unlimited') => {
    setLoading(true);
    setSelectedProduct(productId);
    track(Events.PURCHASE_STARTED, { product_id: productId });

    try {
      const success = await purchaseProduct(productId);

      if (success) {
        // Add credits if not unlimited
        if (typeof tokens === 'number') {
          // Credits will be added server-side via webhook
          // For now, just refresh
        }

        await refreshCredits();
        track(Events.PURCHASE_COMPLETED, { product_id: productId });

        Alert.alert(
          'Purchase Complete',
          tokens === 'unlimited'
            ? 'You now have unlimited scans!'
            : `${tokens} scans have been added to your account!`,
          [{ text: 'Awesome', onPress: () => router.back() }]
        );
      } else {
        // Purchase returned false - likely package not found or not initialized
        Alert.alert(
          'Purchase Unavailable',
          'Unable to load purchase options. Please try again later or contact support.'
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      track(Events.PURCHASE_FAILED, {
        product_id: productId,
        error: errorMessage,
      });
      Alert.alert('Purchase Failed', `Error: ${errorMessage}`);
    } finally {
      setLoading(false);
      setSelectedProduct(null);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    track(Events.PURCHASE_STARTED, { product_id: 'restore' });

    try {
      const restored = await restorePurchases();
      await refreshCredits();

      if (restored) {
        Alert.alert('Restored', 'Your purchases have been restored!');
      } else {
        Alert.alert('No Purchases', 'No previous purchases found to restore.');
      }
    } catch (error) {
      Alert.alert('Restore Failed', 'Failed to restore purchases. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Debug function to check RevenueCat status
  const handleDebugCheck = async () => {
    try {
      const products = await getProducts();
      if (products.length === 0) {
        Alert.alert(
          'Debug: No Products',
          'RevenueCat returned 0 products. Check:\n\n1. Offering is set as Current\n2. Products are in the offering\n3. App Store Connect API key is configured'
        );
      } else {
        const productList = products.map(p => `${p.identifier}: ${p.product.priceString}`).join('\n');
        Alert.alert(
          'Debug: Products Found',
          `Found ${products.length} products:\n\n${productList}`
        );
      }
    } catch (error) {
      Alert.alert(
        'Debug: Error',
        `Failed to fetch products: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  };

  const handlePromoSubmit = async () => {
    if (!promoCode.trim()) return;

    setPromoLoading(true);

    try {
      // Validate promo code
      const validation = await validatePromoCode(promoCode.trim().toUpperCase());

      if (!validation.valid) {
        Alert.alert('Invalid Code', validation.error || 'This code is not valid.');
        return;
      }

      // Redeem promo code
      const result = await redeemPromoCode(promoCode.trim().toUpperCase());

      if (result.success) {
        await refreshCredits();
        track(Events.PROMO_CODE_REDEEMED, { code: promoCode, credits: result.credits });

        Alert.alert(
          'Code Redeemed',
          `${result.credits} scans have been added to your account!`,
          [{ text: 'Awesome' }]
        );
        setShowPromoModal(false);
        setPromoCode('');
      } else {
        Alert.alert('Error', result.error || 'Failed to redeem code.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to redeem promo code. Please try again.');
    } finally {
      setPromoLoading(false);
    }
  };

  const renderProductCard = (product: ProductOption) => {
    const isSelected = selectedProduct === product.id;
    const isUnlimited = product.tokens === 'unlimited';

    return (
      <TouchableOpacity
        key={product.id}
        style={[
          styles.productCard,
          { backgroundColor: colors.surface },
          product.bestValue && styles.productCardBestValue,
        ]}
        onPress={() => handlePurchase(product.id, product.tokens)}
        disabled={loading}
        activeOpacity={0.7}
      >
        {product.bestValue && (
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bestValueBadge}
          >
            <Text style={styles.bestValueText}>Best Value</Text>
          </LinearGradient>
        )}

        <View style={styles.productInfo}>
          <View style={styles.productHeader}>
            {isUnlimited ? (
              <Ionicons name="infinite" size={24} color={colors.gradientStart} />
            ) : (
              <View style={styles.tokenIcon}>
                <Ionicons name="diamond" size={20} color={colors.gradientStart} />
              </View>
            )}
            <Text style={[styles.productTitle, { color: colors.text }]}>{product.title}</Text>
          </View>
          <Text style={[styles.productSubtitle, { color: colors.textSecondary }]}>{product.subtitle}</Text>
        </View>

        <View style={styles.productPrice}>
          {isSelected && loading ? (
            <ActivityIndicator size="small" color={colors.gradientStart} />
          ) : (
            <Text style={styles.priceText}>{product.price}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Logo size={24} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Store</Text>
        </View>
        <CreditBadge credits={credits} isSubscribed={isSubscribed} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroIcon}
          >
            <Ionicons name="diamond" size={32} color={colors.text} />
          </LinearGradient>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Get More Scans</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Keep analyzing your conversations
          </Text>
        </View>

        {/* Product Options */}
        <View style={styles.productsContainer}>
          {PRODUCT_OPTIONS.map(renderProductCard)}
        </View>

        {/* Links */}
        <View style={styles.linksContainer}>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleRestore}
            disabled={loading}
          >
            <Ionicons name="refresh" size={16} color={colors.textSecondary} />
            <Text style={styles.linkText}>Restore Purchases</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => setShowPromoModal(true)}
            disabled={loading}
          >
            <Ionicons name="gift" size={16} color={colors.textSecondary} />
            <Text style={styles.linkText}>Have a promo code?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleDebugCheck}
            disabled={loading}
          >
            <Ionicons name="bug" size={16} color={colors.textSecondary} />
            <Text style={styles.linkText}>Debug: Check Products</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Promo Code Modal */}
      <Modal
        visible={showPromoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPromoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowPromoModal(false)}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>

            <Text style={[styles.modalTitle, { color: colors.text }]}>Enter Promo Code</Text>

            <TextInput
              style={[styles.promoInput, { backgroundColor: colors.background, color: colors.text }]}
              placeholder="PROMO123"
              placeholderTextColor={colors.textMuted}
              value={promoCode}
              onChangeText={(text) => setPromoCode(text.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
            />

            <GradientButton
              title="Redeem"
              onPress={handlePromoSubmit}
              loading={promoLoading}
              disabled={!promoCode.trim() || promoLoading}
            />
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: defaultColors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: defaultColors.text,
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontSize: typography.md,
    color: defaultColors.textSecondary,
  },
  productsContainer: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  productCard: {
    backgroundColor: defaultColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  productCardBestValue: {
    borderWidth: 2,
    borderColor: defaultColors.gradientStart,
  },
  bestValueBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomLeftRadius: borderRadius.md,
  },
  bestValueText: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: defaultColors.text,
  },
  productInfo: {
    flex: 1,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  tokenIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productTitle: {
    fontSize: typography.lg,
    fontWeight: '600',
    color: defaultColors.text,
  },
  productSubtitle: {
    fontSize: typography.sm,
    color: defaultColors.textSecondary,
    marginLeft: 32,
  },
  productPrice: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: defaultColors.gradientStart,
  },
  linksContainer: {
    alignItems: 'center',
    gap: spacing.md,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  linkText: {
    fontSize: typography.sm,
    color: defaultColors.textSecondary,
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
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  modalClose: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
  modalTitle: {
    fontSize: typography.lg,
    fontWeight: '600',
    color: defaultColors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  promoInput: {
    backgroundColor: defaultColors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.lg,
    color: defaultColors.text,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: spacing.lg,
  },
});
