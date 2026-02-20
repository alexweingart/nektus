/**
 * ScreenTransition - Wrapper component for sequential fade transitions
 *
 * Provides:
 * - Fade-in animation on mount (200ms)
 * - Fade-out animation before navigation via useNavigateWithFade hook
 *
 * This creates a sequential fade effect where:
 * 1. Current screen fades out (200ms)
 * 2. Navigation happens instantly
 * 3. New screen fades in (200ms)
 *
 * The background/particle network remains visible throughout,
 * only the screen content fades.
 */

import React, { useEffect, useRef, createContext, useContext, useCallback, useState } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { ANIMATION } from '@nektus/shared-client';
import type { RootStackParamList } from '../../../../../App';

// Navigation-tier transition
const FADE_DURATION = ANIMATION.NAVIGATION_MS;

// Context for triggering fade-out from anywhere in the screen
interface ScreenTransitionContextType {
  fadeOut: () => Promise<void>;
  opacity: Animated.Value;
}

const ScreenTransitionContext = createContext<ScreenTransitionContextType | null>(null);

interface ScreenTransitionProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Wrap screen content with this component to get fade transitions
 */
export function ScreenTransition({ children, style }: ScreenTransitionProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [isExiting, setIsExiting] = useState(false);

  // Fade in on mount
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_DURATION,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  // Fade out function - returns a promise that resolves when animation completes
  const fadeOut = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      setIsExiting(true);
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          resolve();
        }
      });
    });
  }, [opacity]);

  return (
    <ScreenTransitionContext.Provider value={{ fadeOut, opacity }}>
      <Animated.View style={[styles.container, { opacity }, style]}>
        {children}
      </Animated.View>
    </ScreenTransitionContext.Provider>
  );
}

/**
 * Hook to navigate with fade-out animation
 *
 * Usage:
 * const navigateWithFade = useNavigateWithFade();
 * navigateWithFade('Profile'); // Fades out, then navigates
 */
export function useNavigateWithFade() {
  const context = useContext(ScreenTransitionContext);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const navigateWithFade = useCallback(async <T extends keyof RootStackParamList>(
    screen: T,
    params?: RootStackParamList[T]
  ) => {
    // If we have the context (wrapped in ScreenTransition), fade out first
    if (context) {
      await context.fadeOut();
    }
    // Navigate after fade completes (or immediately if no context)
    if (params !== undefined) {
      navigation.navigate(screen as any, params as any);
    } else {
      navigation.navigate(screen as any);
    }
  }, [context, navigation]);

  return navigateWithFade;
}

/**
 * Hook to go back with fade-out animation
 */
export function useGoBackWithFade() {
  const context = useContext(ScreenTransitionContext);
  const navigation = useNavigation();

  const goBackWithFade = useCallback(async () => {
    if (context) {
      await context.fadeOut();
    }
    navigation.goBack();
  }, [context, navigation]);

  return goBackWithFade;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
