import { useEffect, useCallback } from 'react';
import { useShareIntent, ShareIntent } from 'expo-share-intent';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { supabase } from '@/services/supabase';

const MAX_IMAGES = 8;

export function useShareIntentHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntent();

  const handleShareIntent = useCallback(async (intent: ShareIntent) => {
    // Only handle image shares
    if (!intent.files || intent.files.length === 0) {
      if (__DEV__) {
        console.log('No files in share intent');
      }
      resetShareIntent();
      return;
    }

    // Filter to only images
    const imageFiles = intent.files.filter((file) =>
      file.mimeType?.startsWith('image/')
    );

    if (imageFiles.length === 0) {
      Alert.alert('Invalid Content', 'Please share image files only.');
      resetShareIntent();
      return;
    }

    // Limit to MAX_IMAGES
    const limitedImages = imageFiles.slice(0, MAX_IMAGES);
    const imageUris = limitedImages.map((file) => file.path);

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Store intent for after auth and redirect to auth screen
      // We'll pass the images as params after auth
      Alert.alert(
        'Sign In Required',
        'Please sign in to analyze your screenshots.',
        [
          {
            text: 'Sign In',
            onPress: () => {
              // Store images temporarily and navigate to auth
              // After auth, user will need to manually upload
              router.replace('/auth');
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
      resetShareIntent();
      return;
    }

    // User is authenticated - navigate to upload with images
    router.push({
      pathname: '/scan/upload',
      params: {
        sharedImages: JSON.stringify(imageUris),
      },
    });

    // Reset the share intent after handling
    resetShareIntent();
  }, [resetShareIntent]);

  useEffect(() => {
    if (hasShareIntent && shareIntent) {
      handleShareIntent(shareIntent);
    }
  }, [hasShareIntent, shareIntent, handleShareIntent]);

  useEffect(() => {
    if (error) {
      if (__DEV__) {
        console.error('Share intent error:', error);
      }
      Alert.alert('Error', 'Failed to process shared content.');
      resetShareIntent();
    }
  }, [error, resetShareIntent]);

  return {
    hasShareIntent,
    resetShareIntent,
  };
}
