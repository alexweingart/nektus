/**
 * ExchangeButton component for iOS
 * Handles the "Nekt" button with exchange states, motion detection, QR code display,
 * and BLE proximity matching (hybrid mode: BLE + server simultaneously)
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Text, View, ActivityIndicator, StyleSheet, Animated, Easing, DeviceEventEmitter } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Button } from "./Button";
import type { ExchangeStatus, ContactExchangeState, ContactExchangeMatch, UserProfile } from "@nektus/shared-types";
import { getApiBaseUrl } from "@nektus/shared-client";
import {
  RealTimeContactExchangeService,
  generateSessionId,
  exchangeEvents,
} from "../../../../client/contacts/exchange/service";
import {
  HybridExchangeService,
  createHybridExchangeService,
  type HybridMatchResult,
} from "../../../../client/contacts/exchange/hybrid-service";
import { MotionDetector } from "../../../../client/contacts/motion";
import type { RootStackParamList } from "../../../../../App";
import {
  animationEvents,
  emitStartFloating,
  emitStopFloating,
  emitBumpDetected,
  emitMatchFound,
  floatAnimationStart,
} from "../../../utils/animationEvents";
import { useSession } from "../../../providers/SessionProvider";
import { useProfile, type SharingCategory } from "../../../context/ProfileContext";
import { getIdToken } from "../../../../client/auth/firebase";
import { ADMIN_SIMULATE_NEKT_EVENT } from "../banners/AdminBanner";

export interface MatchResult {
  token: string;
  profile: UserProfile;
  matchType: 'bump' | 'qr-scan';
}

interface ExchangeButtonProps {
  onStateChange?: (status: ExchangeStatus) => void;
  onMatchTokenChange?: (token: string | null) => void;
  onMatch?: (match: MatchResult) => void;
}

export function ExchangeButton({ onStateChange, onMatchTokenChange, onMatch }: ExchangeButtonProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: session } = useSession();
  const { profile, sharingCategory } = useProfile();
  const [status, setStatus] = useState<ExchangeStatus>("idle");
  const [exchangeService, setExchangeService] = useState<RealTimeContactExchangeService | null>(null);
  const [hybridService, setHybridService] = useState<HybridExchangeService | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [bleAvailable, setBleAvailable] = useState<boolean | null>(null);
  const apiBaseUrl = getApiBaseUrl();
  const prevStatusRef = useRef<ExchangeStatus>("idle");

  // Pulse animation for "Match Found!" state
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Start/stop pulse animation based on status, synced with float animation
  useEffect(() => {
    if (status === "qr-scan-matched" || status === "ble-matched") {
      const animationDuration = 3000; // 3s cycle to match float
      const halfDuration = 1500;

      // Calculate starting position to sync with float animation
      let startValue = 0;
      let startGoingUp = true; // Whether we're in the 0→1 phase

      if (floatAnimationStart) {
        const elapsed = Date.now() - floatAnimationStart;
        const positionInCycle = elapsed % animationDuration;

        if (positionInCycle < halfDuration) {
          // In first half (0→1), calculate value
          startValue = positionInCycle / halfDuration;
          startGoingUp = true;
        } else {
          // In second half (1→0), calculate value
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

  // Notify parent of state changes and emit animation events
  useEffect(() => {
    onStateChange?.(status);

    const prevStatus = prevStatusRef.current;

    // Emit animation events based on status transitions
    // Include BLE scanning states as "waiting" states
    const isWaitingStatus = status === "waiting-for-bump" || status === "ble-scanning";
    const wasWaitingStatus = prevStatus === "waiting-for-bump" || prevStatus === "ble-scanning";

    if (isWaitingStatus && !wasWaitingStatus) {
      // Started waiting for bump/BLE - start floating animation
      console.log("[ExchangeButton] Emitting start-floating");
      emitStartFloating();
    } else if (status === "processing" && wasWaitingStatus) {
      // Bump detected - trigger wind-up animation
      console.log("[ExchangeButton] Emitting bump-detected");
      emitBumpDetected();
    } else if (status === "ble-connecting" && (prevStatus === "ble-discovered" || prevStatus === "ble-scanning")) {
      // BLE peer found - trigger wind-up animation (like bump detected)
      console.log("[ExchangeButton] Emitting bump-detected (BLE peer found)");
      emitBumpDetected();
    } else if (["idle", "error", "timeout", "ble-unavailable"].includes(status) &&
               ["waiting-for-bump", "processing", "qr-scan-pending", "ble-scanning", "ble-discovered", "ble-connecting", "ble-exchanging"].includes(prevStatus)) {
      // Exchange ended without match - stop floating
      console.log("[ExchangeButton] Emitting stop-floating");
      emitStopFloating();
    }

    prevStatusRef.current = status;
  }, [status, onStateChange]);

  // Notify parent of QR token changes
  useEffect(() => {
    onMatchTokenChange?.(qrToken);
  }, [qrToken, onMatchTokenChange]);

  // Listen for exchange initiated events (for QR code display)
  useEffect(() => {
    const unsubscribe = exchangeEvents.onExchangeInitiated(({ token }) => {
      console.log("🎫 [iOS] Exchange initiated with token:", token.substring(0, 8) + "...");
      setQrToken(token);
    });
    return unsubscribe;
  }, []);

  // Initialize hybrid exchange service (BLE + server simultaneously)
  const initializeHybridService = useCallback(async () => {
    try {
      const service = createHybridExchangeService({
        onStateChange: (state: ContactExchangeState) => {
          console.log("🎯 [iOS] ExchangeButton received state change:", state.status);

          // Save QR token for qr-scan-matched state
          if (state.qrToken) {
            setQrToken(state.qrToken);
          }

          // Handle QR scan match - show tappable button
          if (state.status === "qr-scan-matched") {
            console.log("🎯 [iOS] QR scan match - showing tappable button");
          }

          // Handle timeout
          if (state.status === "timeout") {
            console.log("🎯 [iOS] Exchange timed out");
            setTimeout(() => {
              setStatus("idle");
              setHybridService(null);
            }, 1000);
          }

          // Handle error
          if (state.status === "error") {
            console.log("🎯 [iOS] Exchange error");
            setTimeout(() => {
              setStatus("idle");
              setHybridService(null);
            }, 2000);
          }
        },
        onStatusChange: (newStatus) => {
          console.log("🎯 [iOS] ExchangeButton status change:", newStatus);
          setStatus(newStatus);
        },
        onMatchTokenChange: (token) => {
          console.log("🎯 [iOS] ExchangeButton token change:", token?.substring(0, 8) || null);
          setQrToken(token);
        },
        onMatch: (match: HybridMatchResult) => {
          console.log(`🎯 [iOS] ${match.matchType} match found!`);
          // Emit match-found animation event with contact's background colors
          emitMatchFound(match.profile.backgroundColors);

          const matchResult: MatchResult = {
            token: match.token,
            profile: match.profile,
            matchType: match.matchType === 'ble' ? 'bump' : match.matchType, // Map BLE to bump for existing UI
          };

          // Small delay to allow exit animation to play
          setTimeout(() => {
            onMatch?.(matchResult);
            setHybridService(null);
            setStatus("idle");
          }, 500);
        },
      });

      // Check BLE availability on first initialization
      if (bleAvailable === null) {
        const available = await service.checkBLEAvailability();
        setBleAvailable(available);
        console.log(`📶 [iOS] BLE available: ${available}`);
      }

      setHybridService(service);
      return service;
    } catch (error) {
      console.error("[iOS] Failed to initialize hybrid service:", error);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
      return null;
    }
  }, [onMatch, bleAvailable]);

  // Legacy: Initialize server-only exchange service (fallback)
  const initializeService = useCallback(async () => {
    try {
      const sessionId = generateSessionId();
      const service = new RealTimeContactExchangeService(
        sessionId,
        async (state: ContactExchangeState) => {
          console.log("🎯 [iOS] ExchangeButton received state change:", state.status);

          // Save QR token for qr-scan-matched state
          if (state.qrToken) {
            setQrToken(state.qrToken);
          }

          // Update status
          setStatus(state.status);

          // Handle bump match - notify parent and reset
          if (state.status === "matched" && state.match) {
            console.log("🎯 [iOS] Bump match found!");
            // Emit match-found animation event with contact's background colors
            emitMatchFound(state.match.profile.backgroundColors);
            const matchResult: MatchResult = {
              token: state.match.token,
              profile: state.match.profile,
              matchType: 'bump',
            };

            // Small delay to allow exit animation to play
            setTimeout(() => {
              onMatch?.(matchResult);
              setExchangeService(null);
              setStatus("idle");
            }, 500);
          }

          // Handle QR scan match - show tappable button
          if (state.status === "qr-scan-matched") {
            console.log("🎯 [iOS] QR scan match - showing tappable button");
          }

          // Handle timeout
          if (state.status === "timeout") {
            console.log("🎯 [iOS] Exchange timed out");
            setTimeout(() => {
              setStatus("idle");
              setExchangeService(null);
            }, 1000);
          }

          // Handle error
          if (state.status === "error") {
            console.log("🎯 [iOS] Exchange error");
            setTimeout(() => {
              setStatus("idle");
              setExchangeService(null);
            }, 2000);
          }
        }
      );
      setExchangeService(service);
      return service;
    } catch (error) {
      console.error("[iOS] Failed to initialize exchange service:", error);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
      return null;
    }
  }, [onMatch]);

  const handleExchangeStart = useCallback(async () => {
    // Don't allow new exchange if in timeout or error state
    if (status === "timeout" || status === "error") {
      return;
    }

    // Force reset to idle if we're in any non-idle state
    if (status !== "idle") {
      console.log(`⚠️ [iOS] Exchange button clicked in non-idle state: ${status}, forcing reset`);
      setStatus("idle");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Use sharing category from Context (both ProfileInfo and ExchangeButton
    // share the same Context value, so it's always in sync)
    const currentCategory = sharingCategory;
    console.log(`📋 [iOS] Using sharing category: ${currentCategory}`);

    let permissionGranted = false;

    // Request motion permission - gracefully handle simulator/no accelerometer
    try {
      setStatus("requesting-permission");
      const permissionResult = await MotionDetector.requestPermission();

      if (!permissionResult.success) {
        // In simulator or device without accelerometer, just skip motion detection
        // and use QR code only mode
        console.warn("⚠️ [iOS] Motion not available, using QR-only mode:", permissionResult.message);
        permissionGranted = false; // Will skip motion detection
      } else {
        permissionGranted = true;
      }
    } catch (error) {
      console.warn("⚠️ [iOS] Permission request failed, using QR-only mode:", error);
      permissionGranted = false; // Will skip motion detection
    }

    try {
      // Clean up any existing services first
      if (exchangeService) {
        await exchangeService.disconnect();
      }
      setExchangeService(null);

      if (hybridService) {
        await hybridService.stop();
      }
      setHybridService(null);

      // Use hybrid service if we have profile data for BLE exchange
      if (profile && session?.user?.id) {
        console.log("🔄 [iOS] Starting hybrid exchange (BLE + server)...");
        const service = await initializeHybridService();
        if (!service) return;

        // Start the hybrid exchange process (BLE + server simultaneously)
        await service.start(
          session.user.id,
          profile,
          currentCategory,
          permissionGranted
        );
      } else {
        // Fallback to server-only if no profile available
        console.log("🔄 [iOS] Starting server-only exchange (no profile for BLE)...");
        const service = await initializeService();
        if (!service) return;

        // Start the exchange process with the selected sharing category
        await service.startExchange(permissionGranted, currentCategory);
      }
    } catch (error) {
      console.error("[iOS] Failed to start exchange:", error);
      setStatus("error");
    }
  }, [status, exchangeService, hybridService, initializeService, initializeHybridService, profile, session?.user?.id, sharingCategory]);

  const handleButtonPress = useCallback(async () => {
    // Handle QR scan matched state - fetch profile and notify parent
    if (status === "qr-scan-matched" && qrToken) {
      console.log("🎯 [iOS] QR scan match - fetching profile...");
      try {
        const idToken = await getIdToken();
        const response = await fetch(`${apiBaseUrl}/api/exchange/pair/${qrToken}`, {
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        });
        if (!response.ok) {
          throw new Error('Failed to fetch matched profile');
        }
        const result = await response.json();
        if (result.success && result.profile) {
          console.log(`👤 [iOS] QR matched with: ${result.profile.name}`);
          // Emit match-found animation event with contact's background colors
          emitMatchFound(result.profile.backgroundColors);

          const matchResult: MatchResult = {
            token: qrToken,
            profile: result.profile,
            matchType: 'qr-scan',
          };

          // Small delay to allow exit animation to play
          await new Promise(resolve => setTimeout(resolve, 500));
          onMatch?.(matchResult);
        }
      } catch (error) {
        console.error("[iOS] Failed to fetch QR match profile:", error);
      }
      setStatus("idle");
      setQrToken(null);
      setExchangeService(null);
      return;
    }

    // Normal exchange start
    handleExchangeStart();
  }, [status, qrToken, apiBaseUrl, onMatch, handleExchangeStart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (exchangeService) {
        exchangeService.disconnect();
      }
      if (hybridService) {
        hybridService.stop();
      }
    };
  }, [exchangeService, hybridService]);

  // Listen for cancel event from ProfileView
  useEffect(() => {
    const unsubscribe = animationEvents.on('cancel-exchange', async () => {
      console.log('🚫 [iOS] ExchangeButton: Cancel exchange requested');

      // Stop hybrid service (BLE + server)
      if (hybridService) {
        await hybridService.stop();
      }

      // Stop server-only service (fallback)
      if (exchangeService) {
        await exchangeService.disconnect();
      }

      // Reset state
      setHybridService(null);
      setExchangeService(null);
      setStatus('idle');
      setQrToken(null);

      // Emit stop-floating to exit animations
      console.log('🚫 [iOS] ExchangeButton: Emitting stop-floating event');
      emitStopFloating();
    });

    return unsubscribe;
  }, [hybridService, exchangeService]);

  // Listen for admin simulation trigger (matches web implementation)
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(ADMIN_SIMULATE_NEKT_EVENT, () => {
      console.log('🧪 [iOS] ExchangeButton: Starting admin simulation');

      // 1. Waiting for bump (floating animation)
      setStatus('waiting-for-bump');
      emitStartFloating();

      // 2. After 3 seconds, bump detected
      setTimeout(() => {
        console.log('🧪 [iOS] ExchangeButton: Simulating bump detected');
        setStatus('processing');
        emitBumpDetected();

        // 3. After 500ms, simulate match and trigger exit animation
        setTimeout(() => {
          console.log('🧪 [iOS] ExchangeButton: Simulating match - triggering exit animation');
          setStatus('matched');

          // Trigger exit animation on ProfileView with demo contact colors
          const demoColors = ['#FF6F61', '#FFB6C1', '#FF1493']; // Demo coral/pink colors
          emitMatchFound(demoColors);

          // Wait for exit animation to complete (500ms), then navigate
          setTimeout(() => {
            // Navigate to Contact view with test data
            navigation.navigate('Contact', {
              userId: 'test-user',
              token: 'test-animation-token',
              isHistoricalMode: false,
            });

            // Reset state after navigation
            setStatus('idle');
          }, 500);
        }, 500);
      }, 3000);
    });

    return () => subscription.remove();
  }, [navigation]);

  // Get button content based on status
  const getButtonContent = () => {
    switch (status) {
      case "requesting-permission":
        return (
          <View style={styles.contentRow}>
            <ActivityIndicator size="small" color="#374151" style={styles.spinner} />
            <Text style={styles.text}>Getting Ready...</Text>
          </View>
        );

      case "waiting-for-bump":
      case "ble-scanning":
        return (
          <View style={styles.contentRow}>
            <View style={styles.pulsingDot} />
            <Text style={styles.text}>Waiting for Bump or Scan...</Text>
          </View>
        );

      case "ble-discovered":
        return (
          <View style={styles.contentRow}>
            <View style={styles.pulsingDot} />
            <Text style={styles.text}>Found nearby device...</Text>
          </View>
        );

      case "ble-connecting":
        return (
          <View style={styles.contentRow}>
            <ActivityIndicator size="small" color="#374151" style={styles.spinner} />
            <Text style={styles.text}>Connecting...</Text>
          </View>
        );

      case "ble-exchanging":
        return (
          <View style={styles.contentRow}>
            <ActivityIndicator size="small" color="#374151" style={styles.spinner} />
            <Text style={styles.text}>Exchanging contacts...</Text>
          </View>
        );

      case "processing":
        return (
          <View style={styles.contentRow}>
            <ActivityIndicator size="small" color="#374151" style={styles.spinner} />
            <Text style={styles.text}>Waiting for Match...</Text>
          </View>
        );

      case "qr-scan-pending":
        return (
          <View style={styles.contentRow}>
            <View style={styles.pulsingDot} />
            <Text style={styles.text}>Waiting for Match...</Text>
          </View>
        );

      case "qr-scan-matched":
      case "ble-matched":
        return <Text style={styles.matchText}>Match Found!</Text>;

      case "ble-unavailable":
        // BLE not available, but server fallback should kick in
        return (
          <View style={styles.contentRow}>
            <View style={styles.pulsingDot} />
            <Text style={styles.text}>Waiting for Bump or Scan...</Text>
          </View>
        );

      case "timeout":
        return (
          <View style={styles.contentRow}>
            <ActivityIndicator size="small" color="#ffffff" style={styles.spinner} />
            <Text style={styles.errorText}>Timed out, try again!</Text>
          </View>
        );

      case "error":
        return (
          <View style={styles.contentRow}>
            <ActivityIndicator size="small" color="#ffffff" style={styles.spinner} />
            <Text style={styles.errorText}>Error - Cleaning up...</Text>
          </View>
        );

      default:
        return <Text style={styles.nektText}>Nekt</Text>;
    }
  };

  // Get button variant based on status
  const getButtonVariant = () => {
    switch (status) {
      case "error":
      case "timeout":
        return "destructive" as const;
      default:
        return "white" as const;
    }
  };

  // Determine if button should be disabled
  const isDisabled = [
    "requesting-permission",
    "waiting-for-bump",
    "processing",
    "qr-scan-pending",
    "timeout",
    "error",
    // BLE-specific statuses
    "ble-scanning",
    "ble-discovered",
    "ble-connecting",
    "ble-exchanging",
    "ble-unavailable",
  ].includes(status);

  // Interpolate pulse animation for white glow effect using RN 0.76+ boxShadow
  // Animate opacity of glow layers (0 = no glow, 1 = full glow)
  const glowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.95],
  });

  // For qr-scan-matched or ble-matched, render with pulsing white glow
  // Using RN 0.76+ boxShadow with multiple layers for proper glow effect
  if (status === "qr-scan-matched" || status === "ble-matched") {
    return (
      <View style={styles.pulseContainer}>
        {/* Animated glow layer using boxShadow - positioned behind button */}
        <Animated.View
          style={[
            styles.glowLayer,
            {
              opacity: glowOpacity,
            },
          ]}
        />
        <Button
          variant={getButtonVariant()}
          size="xl"
          onPress={handleButtonPress}
          disabled={false} // Match Found is clickable
          style={styles.button}
        >
          {getButtonContent()}
        </Button>
      </View>
    );
  }

  return (
    <Button
      variant={getButtonVariant()}
      size="xl"
      onPress={handleButtonPress}
      disabled={isDisabled}
      style={styles.button}
    >
      {getButtonContent()}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
  },
  pulseContainer: {
    width: "100%",
    position: "relative",
  },
  glowLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 9999,
    backgroundColor: "transparent",
    // RN 0.76+ boxShadow with multiple layers for proper glow effect
    // Matches web's: box-shadow: 0 0 50px 20px rgba(255, 255, 255, 0.95)
    boxShadow: "0 0 20px 5px rgba(255, 255, 255, 1), 0 0 40px 15px rgba(255, 255, 255, 0.8), 0 0 60px 25px rgba(255, 255, 255, 0.5)",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  spinner: {
    marginRight: 8,
  },
  pulsingDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#374151",
    marginRight: 8,
    opacity: 0.7,
  },
  // Typography matching web's xl button: text-xl font-semibold (20px, 600)
  text: {
    fontFamily: "System",
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: 0.2,
    color: "#374151",
  },
  nektText: {
    fontFamily: "System",
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: 0.2,
    color: "#374151",
  },
  matchText: {
    fontFamily: "System",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.2,
    color: "#374151",
  },
  errorText: {
    fontFamily: "System",
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: 0.2,
    color: "#ffffff",
  },
});

export default ExchangeButton;
