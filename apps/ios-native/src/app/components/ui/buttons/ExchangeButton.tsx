/**
 * ExchangeButton component for iOS
 * Handles the "Nekt" button with exchange states, motion detection, QR code display,
 * and BLE proximity matching (hybrid mode: BLE + server simultaneously)
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Text, View, ActivityIndicator, StyleSheet, Animated, DeviceEventEmitter } from "react-native";
import { fontStyles } from "../Typography";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Button } from "./Button";
import type { ExchangeStatus, ContactExchangeState, UserProfile } from "@nektus/shared-types";
import { getApiBaseUrl } from "@nektus/shared-client";
import {
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
} from "../../../utils/animationEvents";
import { usePulseAnimation } from "../../../../client/hooks/use-exchange-animations";
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
  const [hybridService, setHybridService] = useState<HybridExchangeService | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [bleAvailable, setBleAvailable] = useState<boolean | null>(null);
  const apiBaseUrl = getApiBaseUrl();
  const prevStatusRef = useRef<ExchangeStatus>("idle");

  // Pulse animation for "Match Found!" state
  const pulseAnim = usePulseAnimation(status);

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
      emitStartFloating();
    } else if (status === "processing" && wasWaitingStatus) {
      // Bump detected - trigger wind-up animation
      emitBumpDetected();
    } else if (status === "ble-connecting" && (prevStatus === "ble-discovered" || prevStatus === "ble-scanning")) {
      // BLE peer found - trigger wind-up animation (like bump detected)
      emitBumpDetected();
    } else if (["idle", "error", "timeout", "ble-unavailable"].includes(status) &&
               ["waiting-for-bump", "processing", "qr-scan-pending", "ble-scanning", "ble-discovered", "ble-connecting", "ble-exchanging"].includes(prevStatus)) {
      // Exchange ended without match - stop floating
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
      setQrToken(token);
    });
    return unsubscribe;
  }, []);

  // Initialize hybrid exchange service (BLE + server simultaneously)
  const initializeHybridService = useCallback(async () => {
    try {
      const service = createHybridExchangeService({
        onStateChange: (state: ContactExchangeState) => {
          // Save QR token for qr-scan-matched state
          if (state.qrToken) {
            setQrToken(state.qrToken);
          }

          // Handle timeout
          if (state.status === "timeout") {
            setTimeout(() => {
              setStatus("idle");
              setHybridService(null);
            }, 1000);
          }

          // Handle error
          if (state.status === "error") {
            setTimeout(() => {
              setStatus("idle");
              setHybridService(null);
            }, 2000);
          }
        },
        onStatusChange: (newStatus) => {
          setStatus(newStatus);
        },
        onMatchTokenChange: (token) => {
          setQrToken(token);
        },
        onMatch: (match: HybridMatchResult) => {
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

  const handleExchangeStart = useCallback(async () => {
    // Don't allow new exchange if in timeout or error state
    if (status === "timeout" || status === "error") {
      return;
    }

    // Force reset to idle if we're in any non-idle state
    if (status !== "idle") {
      setStatus("idle");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Use sharing category from Context (both ProfileInfo and ExchangeButton
    // share the same Context value, so it's always in sync)
    const currentCategory = sharingCategory;

    let permissionGranted = false;

    // Request motion permission - gracefully handle simulator/no accelerometer
    try {
      setStatus("requesting-permission");
      const permissionResult = await MotionDetector.requestPermission();

      if (!permissionResult.success) {
        // In simulator or device without accelerometer, just skip motion detection
        // and use QR code only mode
        permissionGranted = false; // Will skip motion detection
      } else {
        permissionGranted = true;
      }
    } catch (error) {
      permissionGranted = false; // Will skip motion detection
    }

    try {
      // Clean up any existing service first
      if (hybridService) {
        await hybridService.stop();
      }
      setHybridService(null);

      if (!profile || !session?.user?.id) {
        console.error("[iOS] Cannot start exchange: missing profile or session");
        setStatus("error");
        setTimeout(() => setStatus("idle"), 2000);
        return;
      }

      const service = await initializeHybridService();
      if (!service) return;

      // Start the hybrid exchange process (BLE + server simultaneously)
      await service.start(
        session.user.id,
        profile,
        currentCategory,
        permissionGranted
      );
    } catch (error) {
      console.error("[iOS] Failed to start exchange:", error);
      setStatus("error");
    }
  }, [status, hybridService, initializeHybridService, profile, session?.user?.id, sharingCategory]);

  const handleButtonPress = useCallback(async () => {
    // Handle QR scan matched state - fetch profile and notify parent
    if (status === "qr-scan-matched" && qrToken) {
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
      return;
    }

    // Normal exchange start
    handleExchangeStart();
  }, [status, qrToken, apiBaseUrl, onMatch, handleExchangeStart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hybridService) {
        hybridService.stop();
      }
    };
  }, [hybridService]);

  // Listen for cancel event from ProfileView
  useEffect(() => {
    const unsubscribe = animationEvents.on('cancel-exchange', async () => {
      // Stop hybrid service (BLE + server)
      if (hybridService) {
        await hybridService.stop();
      }

      // Reset state
      setHybridService(null);
      setStatus('idle');
      setQrToken(null);

      // Emit stop-floating to exit animations
      emitStopFloating();
    });

    return unsubscribe;
  }, [hybridService]);

  // Listen for admin simulation trigger (matches web implementation)
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(ADMIN_SIMULATE_NEKT_EVENT, () => {
      // 1. Waiting for bump (floating animation)
      setStatus('waiting-for-bump');
      emitStartFloating();

      // 2. After 3 seconds, bump detected
      setTimeout(() => {
        setStatus('processing');
        emitBumpDetected();

        // 3. After 500ms, simulate match and trigger exit animation
        setTimeout(() => {
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

  // Button content config: icon type, label, and style variant per status
  const BUTTON_CONTENT: Record<string, { icon: 'spinner' | 'dot' | 'none'; text: string; error?: boolean; match?: boolean }> = {
    'requesting-permission': { icon: 'spinner', text: 'Getting Ready...' },
    'waiting-for-bump':     { icon: 'dot',     text: 'Waiting for Bump or Scan...' },
    'ble-scanning':         { icon: 'dot',     text: 'Waiting for Bump or Scan...' },
    'ble-discovered':       { icon: 'dot',     text: 'Found nearby device...' },
    'ble-connecting':       { icon: 'spinner', text: 'Connecting...' },
    'ble-exchanging':       { icon: 'spinner', text: 'Exchanging contacts...' },
    'processing':           { icon: 'spinner', text: 'Waiting for Match...' },
    'qr-scan-pending':      { icon: 'dot',     text: 'Waiting for Match...' },
    'qr-scan-matched':      { icon: 'none',    text: 'Match Found!', match: true },
    'ble-matched':          { icon: 'none',    text: 'Match Found!', match: true },
    'ble-unavailable':      { icon: 'dot',     text: 'Waiting for Bump or Scan...' },
    'timeout':              { icon: 'spinner', text: 'Timed out, try again!', error: true },
    'error':                { icon: 'spinner', text: 'Error - Cleaning up...', error: true },
  };

  const getButtonContent = () => {
    const config = BUTTON_CONTENT[status] || { icon: 'none' as const, text: 'Nekt' };
    const textStyle = config.error ? styles.errorText : config.match ? styles.matchText : styles.text;
    if (config.icon === 'none') return <Text style={textStyle}>{config.text}</Text>;
    return (
      <View style={styles.contentRow}>
        {config.icon === 'spinner'
          ? <ActivityIndicator size="small" color={config.error ? '#ffffff' : '#374151'} style={styles.spinner} />
          : <View style={styles.pulsingDot} />}
        <Text style={textStyle}>{config.text}</Text>
      </View>
    );
  };

  const getButtonVariant = () => {
    return (status === 'error' || status === 'timeout') ? 'destructive' as const : 'white' as const;
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
    ...fontStyles.semibold,
    fontSize: 20,
    letterSpacing: 0.2,
    color: "#374151",
  },
  matchText: {
    ...fontStyles.bold,
    fontSize: 20,
    letterSpacing: 0.2,
    color: "#374151",
  },
  errorText: {
    ...fontStyles.semibold,
    fontSize: 20,
    letterSpacing: 0.2,
    color: "#ffffff",
  },
});
