/**
 * Exchange Flow Animation Hooks
 *
 * Centralized animation logic for the entire exchange flow:
 * - useProfileAnimations: Profile card transitions (idle, floating, wind-up, exit, enter)
 * - usePulseAnimation: Pulsing glow effect on the ExchangeButton during "Match Found!" state
 * - useContactEnterAnimation: Contact card entrance/exit animations after a successful match
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { Animated, Easing } from 'react-native';
import { ANIMATION } from '@nektus/shared-client';
import { animationEvents, floatAnimationStart } from '../../app/utils/animationEvents';

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
// Tiers: Cinematic=1000ms, Navigation=500ms, UI=300ms, Micro=100ms
const FLOAT_DURATION = 1500; // Half cycle of 3s (ambient exception)
const WIND_UP_DURATION = ANIMATION.UI_MS;
const EXIT_DURATION = ANIMATION.NAVIGATION_MS;
const ENTER_DURATION = ANIMATION.NAVIGATION_MS;
const BUTTON_FADE_DURATION = ANIMATION.UI_MS;
const ACTION_BUTTONS_DURATION = ANIMATION.UI_MS;
const ACTION_BUTTONS_DELAY = ANIMATION.MICRO_MS;

// Easing presets
const EASE_EXIT = Easing.bezier(0.4, 0, 1, 1);
const EASE_ENTER = Easing.bezier(0, 0, 0.2, 1);

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
        easing: EASE_EXIT,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues.profileScale, {
        toValue: 0.6,
        duration: EXIT_DURATION,
        easing: EASE_EXIT,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues.profileOpacity, {
        toValue: 0,
        duration: EXIT_DURATION,
        easing: EASE_EXIT,
        useNativeDriver: true,
      }),

      // Top buttons: fade and blur up
      Animated.timing(animatedValues.topButtonsOpacity, {
        toValue: 0,
        duration: 350,
        easing: EASE_EXIT,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues.topButtonsTranslateY, {
        toValue: -40,
        duration: 350,
        easing: EASE_EXIT,
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
        easing: EASE_ENTER,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues.profileScale, {
        toValue: 1,
        duration: ENTER_DURATION,
        easing: EASE_ENTER,
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
        easing: EASE_ENTER,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues.topButtonsTranslateY, {
        toValue: 0,
        duration: ENTER_DURATION,
        easing: EASE_ENTER,
        useNativeDriver: true,
      }),

      // Action buttons: scale up and fade in (with slight delay)
      Animated.sequence([
        Animated.delay(ACTION_BUTTONS_DELAY),
        Animated.parallel([
          Animated.timing(animatedValues.actionButtonsScale, {
            toValue: 1,
            duration: ACTION_BUTTONS_DURATION,
            easing: EASE_ENTER,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValues.actionButtonsOpacity, {
            toValue: 1,
            duration: ACTION_BUTTONS_DURATION,
            easing: EASE_ENTER,
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
    shouldStopFloatingRef.current = false;
    setAnimationPhase('floating');
    setIsExchanging(true);
    startFloatAnimation();
  }, [startFloatAnimation]);

  const handleStopFloating = useCallback(() => {
    shouldStopFloatingRef.current = true;
    setIsExchanging(false);
  }, []);

  const handleBumpDetected = useCallback(() => {
    setAnimationPhase('wind-up');
    startWindUpAnimation();
  }, [startWindUpAnimation]);

  const handleMatchFound = useCallback(() => {
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

/**
 * usePulseAnimation
 *
 * Manages a pulsing glow animation for the ExchangeButton "Match Found!" state.
 * Syncs with the float animation cycle and loops continuously while matched.
 */
export function usePulseAnimation(status: string): Animated.Value {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (status === "qr-scan-matched" || status === "ble-matched") {
      const animationDuration = 3000; // 3s cycle to match float
      const halfDuration = 1500;

      // Calculate starting position to sync with float animation
      let startValue = 0;
      let startGoingUp = true; // Whether we're in the 0->1 phase

      if (floatAnimationStart) {
        const elapsed = Date.now() - floatAnimationStart;
        const positionInCycle = elapsed % animationDuration;

        if (positionInCycle < halfDuration) {
          // In first half (0->1), calculate value
          startValue = positionInCycle / halfDuration;
          startGoingUp = true;
        } else {
          // In second half (1->0), calculate value
          startValue = 1 - (positionInCycle - halfDuration) / halfDuration;
          startGoingUp = false;
        }
      }

      pulseAnim.setValue(startValue);

      // Create animation sequence starting from current phase
      const createFullCycle = () => Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: halfDuration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: halfDuration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]);

      // First, complete the current phase, then loop
      const remainingDuration = startGoingUp
        ? halfDuration * (1 - startValue) // Time to reach 1
        : halfDuration * startValue; // Time to reach 0

      const firstAnimation = Animated.timing(pulseAnim, {
        toValue: startGoingUp ? 1 : 0,
        duration: remainingDuration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      });

      // If starting going up, after reaching 1 we need to go back to 0 then loop
      // If starting going down, after reaching 0 we loop from 0
      if (startGoingUp) {
        pulseAnimationRef.current = Animated.sequence([
          firstAnimation,
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: halfDuration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]);
        pulseAnimationRef.current.start(() => {
          // After first partial cycle, start the full loop
          pulseAnimationRef.current = Animated.loop(createFullCycle());
          pulseAnimationRef.current.start();
        });
      } else {
        firstAnimation.start(() => {
          // After reaching 0, start the full loop
          pulseAnimationRef.current = Animated.loop(createFullCycle());
          pulseAnimationRef.current.start();
        });
      }
    } else {
      // Stop animation and reset
      pulseAnimationRef.current?.stop();
      pulseAnim.setValue(0);
    }

    return () => {
      pulseAnimationRef.current?.stop();
    };
  }, [status, pulseAnim]);

  return pulseAnim;
}

/**
 * useContactEnterAnimation
 *
 * Manages the enter/exit animations for the ContactView screen.
 * Card slides down from top with scale and fade, buttons fade in with delay.
 */
interface ContactEnterAnimationReturn {
  cardTranslateY: Animated.Value;
  cardScale: Animated.Value;
  cardOpacity: Animated.Value;
  buttonsTranslateY: Animated.Value;
  buttonsOpacity: Animated.Value;
  exitOpacity: Animated.Value;
  playExitAnimation: (onComplete: () => void) => void;
}

export function useContactEnterAnimation(isHistoricalMode: boolean): ContactEnterAnimationReturn {
  const cardTranslateY = useRef(new Animated.Value(-200)).current;
  const cardScale = useRef(new Animated.Value(0.6)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslateY = useRef(new Animated.Value(10)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  // Enter animation - runs on mount with 500ms delay (matches web's profile exit duration)
  useEffect(() => {
    // Skip animation for historical mode (like web)
    if (isHistoricalMode) {
      cardTranslateY.setValue(0);
      cardScale.setValue(1);
      cardOpacity.setValue(1);
      buttonsTranslateY.setValue(0);
      buttonsOpacity.setValue(1);
      return;
    }

    // Delay animation start to let ProfileView exit animation complete
    const enterTimer = setTimeout(() => {
      // Card animation: translateY(-200 -> 0), scale(0.6 -> 1), opacity(0 -> 1)
      Animated.parallel([
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: EXIT_DURATION,
          easing: EASE_ENTER,
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 1,
          duration: EXIT_DURATION,
          easing: EASE_ENTER,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: EXIT_DURATION,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      // Buttons animation with delay: translateY(10 -> 0), opacity(0 -> 1)
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(buttonsTranslateY, {
            toValue: 0,
            duration: ACTION_BUTTONS_DURATION,
            easing: EASE_ENTER,
            useNativeDriver: true,
          }),
          Animated.timing(buttonsOpacity, {
            toValue: 1,
            duration: ACTION_BUTTONS_DURATION,
            easing: EASE_ENTER,
            useNativeDriver: true,
          }),
        ]).start();
      }, ENTER_DURATION);
    }, EXIT_DURATION);

    return () => clearTimeout(enterTimer);
  }, [isHistoricalMode, cardTranslateY, cardScale, cardOpacity, buttonsTranslateY, buttonsOpacity]);

  // Exit animation - simple fade out (matches web's crossfadeExit)
  const playExitAnimation = useCallback((onComplete: () => void) => {
    Animated.timing(exitOpacity, {
      toValue: 0,
      duration: BUTTON_FADE_DURATION,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onComplete();
      }
    });
  }, [exitOpacity]);

  return {
    cardTranslateY,
    cardScale,
    cardOpacity,
    buttonsTranslateY,
    buttonsOpacity,
    exitOpacity,
    playExitAnimation,
  };
}
