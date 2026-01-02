/**
 * useProfileAnimations Hook
 *
 * Manages animation state and animated values for the profile exchange flow.
 * Handles transitions between: idle → floating → wind-up → exiting → entering
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { Animated, Easing } from 'react-native';
import { animationEvents } from '../../app/utils/animationEvents';

export type AnimationPhase = 'idle' | 'floating' | 'wind-up' | 'exiting' | 'entering';

interface ProfileAnimationValues {
  // Profile card animations
  profileScale: Animated.Value;
  profileTranslateY: Animated.Value;
  profileOpacity: Animated.Value;
  profileRotation: Animated.Value;

  // Top buttons animations
  topButtonsOpacity: Animated.Value;
  topButtonsTranslateY: Animated.Value;

  // Action buttons animations
  actionButtonsScale: Animated.Value;
  actionButtonsOpacity: Animated.Value;
}

interface UseProfileAnimationsReturn {
  animationPhase: AnimationPhase;
  isExchanging: boolean;
  animatedValues: ProfileAnimationValues;
  resetAnimations: () => void;
  triggerEnterAnimation: () => void;
}

// Animation timing constants (matching web)
const FLOAT_DURATION = 1500; // Half cycle of 3s
const WIND_UP_DURATION = 300;
const EXIT_DURATION = 500;
const ENTER_DURATION = 300;
const BUTTON_FADE_DURATION = 300;

export function useProfileAnimations(): UseProfileAnimationsReturn {
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');
  const [isExchanging, setIsExchanging] = useState(false);
  const shouldStopFloatingRef = useRef(false);
  const floatAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Initialize animated values
  const animatedValues = useRef<ProfileAnimationValues>({
    profileScale: new Animated.Value(1),
    profileTranslateY: new Animated.Value(0),
    profileOpacity: new Animated.Value(1),
    profileRotation: new Animated.Value(0),
    topButtonsOpacity: new Animated.Value(1),
    topButtonsTranslateY: new Animated.Value(0),
    actionButtonsScale: new Animated.Value(1),
    actionButtonsOpacity: new Animated.Value(1),
  }).current;

  // Reset all animations to idle state
  const resetAnimations = useCallback(() => {
    floatAnimationRef.current?.stop();
    floatAnimationRef.current = null;

    animatedValues.profileScale.setValue(1);
    animatedValues.profileTranslateY.setValue(0);
    animatedValues.profileOpacity.setValue(1);
    animatedValues.profileRotation.setValue(0);
    animatedValues.topButtonsOpacity.setValue(1);
    animatedValues.topButtonsTranslateY.setValue(0);
    animatedValues.actionButtonsScale.setValue(1);
    animatedValues.actionButtonsOpacity.setValue(1);

    setAnimationPhase('idle');
    setIsExchanging(false);
    shouldStopFloatingRef.current = false;
  }, [animatedValues]);

  // Float animation (breathing effect while waiting)
  const startFloatAnimation = useCallback(() => {
    const runFloatCycle = () => {
      if (shouldStopFloatingRef.current) {
        // Gracefully return to idle
        Animated.timing(animatedValues.profileScale, {
          toValue: 1,
          duration: FLOAT_DURATION / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start(() => {
          if (shouldStopFloatingRef.current) {
            resetAnimations();
          }
        });
        return;
      }

      floatAnimationRef.current = Animated.sequence([
        Animated.timing(animatedValues.profileScale, {
          toValue: 1.03,
          duration: FLOAT_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animatedValues.profileScale, {
          toValue: 1,
          duration: FLOAT_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

      floatAnimationRef.current.start(({ finished }) => {
        if (finished && !shouldStopFloatingRef.current) {
          runFloatCycle();
        }
      });
    };

    runFloatCycle();
  }, [animatedValues, resetAnimations]);

  // Wind-up animation (compression wobble on bump)
  const startWindUpAnimation = useCallback(() => {
    floatAnimationRef.current?.stop();

    Animated.sequence([
      Animated.parallel([
        Animated.timing(animatedValues.profileScale, {
          toValue: 0.95,
          duration: WIND_UP_DURATION * 0.3,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(animatedValues.profileRotation, {
          toValue: -1,
          duration: WIND_UP_DURATION * 0.3,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(animatedValues.profileScale, {
          toValue: 0.95,
          duration: WIND_UP_DURATION * 0.3,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValues.profileRotation, {
          toValue: 1,
          duration: WIND_UP_DURATION * 0.3,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(animatedValues.profileScale, {
          toValue: 0.96,
          duration: WIND_UP_DURATION * 0.4,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValues.profileRotation, {
          toValue: 0,
          duration: WIND_UP_DURATION * 0.4,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [animatedValues]);

  // Exit animation (profile flies up and fades)
  const startExitAnimation = useCallback((onComplete?: () => void) => {
    floatAnimationRef.current?.stop();

    Animated.parallel([
      // Profile card: fly up, shrink, fade
      Animated.timing(animatedValues.profileTranslateY, {
        toValue: -200,
        duration: EXIT_DURATION,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues.profileScale, {
        toValue: 0.6,
        duration: EXIT_DURATION,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues.profileOpacity, {
        toValue: 0,
        duration: EXIT_DURATION,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: true,
      }),

      // Top buttons: fade and blur up
      Animated.timing(animatedValues.topButtonsOpacity, {
        toValue: 0,
        duration: 350,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues.topButtonsTranslateY, {
        toValue: -40,
        duration: 350,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: true,
      }),

      // Action buttons: scale down and fade
      Animated.timing(animatedValues.actionButtonsScale, {
        toValue: 0.8,
        duration: BUTTON_FADE_DURATION,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues.actionButtonsOpacity, {
        toValue: 0,
        duration: BUTTON_FADE_DURATION,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && onComplete) {
        onComplete();
      }
    });
  }, [animatedValues]);

  // Enter animation (return from contact view)
  const triggerEnterAnimation = useCallback(() => {
    // Start from exit state
    animatedValues.profileTranslateY.setValue(-200);
    animatedValues.profileScale.setValue(0.6);
    animatedValues.profileOpacity.setValue(0);
    animatedValues.topButtonsOpacity.setValue(0);
    animatedValues.topButtonsTranslateY.setValue(-40);
    animatedValues.actionButtonsScale.setValue(0.8);
    animatedValues.actionButtonsOpacity.setValue(0);

    setAnimationPhase('entering');

    Animated.parallel([
      // Profile card: slide down, grow, fade in
      Animated.timing(animatedValues.profileTranslateY, {
        toValue: 0,
        duration: ENTER_DURATION,
        easing: Easing.bezier(0, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues.profileScale, {
        toValue: 1,
        duration: ENTER_DURATION,
        easing: Easing.bezier(0, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues.profileOpacity, {
        toValue: 1,
        duration: ENTER_DURATION,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),

      // Top buttons: fade in and slide down
      Animated.timing(animatedValues.topButtonsOpacity, {
        toValue: 1,
        duration: ENTER_DURATION,
        easing: Easing.bezier(0, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues.topButtonsTranslateY, {
        toValue: 0,
        duration: ENTER_DURATION,
        easing: Easing.bezier(0, 0, 0.2, 1),
        useNativeDriver: true,
      }),

      // Action buttons: scale up and fade in (with slight delay)
      Animated.sequence([
        Animated.delay(100),
        Animated.parallel([
          Animated.timing(animatedValues.actionButtonsScale, {
            toValue: 1,
            duration: 200,
            easing: Easing.bezier(0, 0, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.timing(animatedValues.actionButtonsOpacity, {
            toValue: 1,
            duration: 200,
            easing: Easing.bezier(0, 0, 0.2, 1),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start(() => {
      setAnimationPhase('idle');
      setIsExchanging(false);
    });
  }, [animatedValues]);

  // Event handlers
  const handleStartFloating = useCallback(() => {
    console.log('[useProfileAnimations] Starting floating animation');
    shouldStopFloatingRef.current = false;
    setAnimationPhase('floating');
    setIsExchanging(true);
    startFloatAnimation();
  }, [startFloatAnimation]);

  const handleStopFloating = useCallback(() => {
    console.log('[useProfileAnimations] Stopping floating animation');
    shouldStopFloatingRef.current = true;
    setIsExchanging(false);
  }, []);

  const handleBumpDetected = useCallback(() => {
    console.log('[useProfileAnimations] Bump detected, starting wind-up');
    setAnimationPhase('wind-up');
    startWindUpAnimation();
  }, [startWindUpAnimation]);

  const handleMatchFound = useCallback(() => {
    console.log('[useProfileAnimations] Match found, starting exit animation');
    setAnimationPhase('exiting');
    startExitAnimation();
  }, [startExitAnimation]);

  // Subscribe to animation events
  useEffect(() => {
    const unsubscribeStart = animationEvents.on('start-floating', handleStartFloating);
    const unsubscribeStop = animationEvents.on('stop-floating', handleStopFloating);
    const unsubscribeBump = animationEvents.on('bump-detected', handleBumpDetected);
    const unsubscribeMatch = animationEvents.on('match-found', handleMatchFound);

    return () => {
      unsubscribeStart();
      unsubscribeStop();
      unsubscribeBump();
      unsubscribeMatch();
      floatAnimationRef.current?.stop();
    };
  }, [handleStartFloating, handleStopFloating, handleBumpDetected, handleMatchFound]);

  return {
    animationPhase,
    isExchanging,
    animatedValues,
    resetAnimations,
    triggerEnterAnimation,
  };
}
