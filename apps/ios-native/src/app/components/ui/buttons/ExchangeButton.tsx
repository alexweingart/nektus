/**
 * ExchangeButton component for iOS
 * Handles the "Nekt" button with exchange states, motion detection, and QR code display
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Text, View, ActivityIndicator, StyleSheet, Animated, Easing } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Button } from "./Button";
import type { ExchangeStatus, ContactExchangeState, ContactExchangeMatch, UserProfile } from "@nektus/shared-types";
import { getApiBaseUrl } from "@nektus/shared-client";
import {
  RealTimeContactExchangeService,
  generateSessionId,
  exchangeEvents,
} from "../../../../client/contacts/exchange/service";
import { MotionDetector } from "../../../../client/contacts/motion";
import type { RootStackParamList } from "../../../../../App";
import {
  emitStartFloating,
  emitStopFloating,
  emitBumpDetected,
  emitMatchFound,
} from "../../../utils/animationEvents";

type SharingCategory = "Personal" | "Work";

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
  const [status, setStatus] = useState<ExchangeStatus>("idle");
  const [exchangeService, setExchangeService] = useState<RealTimeContactExchangeService | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SharingCategory>("Personal");
  const [qrToken, setQrToken] = useState<string | null>(null);
  const apiBaseUrl = getApiBaseUrl();
  const prevStatusRef = useRef<ExchangeStatus>("idle");

  // Pulse animation for "Match Found!" state
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Start/stop pulse animation based on status
  useEffect(() => {
    if (status === "qr-scan-matched") {
      // Start pulsing glow animation
      pulseAnimationRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false, // Shadow needs non-native driver
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      );
      pulseAnimationRef.current.start();
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
    if (status === "waiting-for-bump" && prevStatus !== "waiting-for-bump") {
      // Started waiting for bump - start floating animation
      console.log("[ExchangeButton] Emitting start-floating");
      emitStartFloating();
    } else if (status === "processing" && prevStatus === "waiting-for-bump") {
      // Bump detected - trigger wind-up animation
      console.log("[ExchangeButton] Emitting bump-detected");
      emitBumpDetected();
    } else if (["idle", "error", "timeout"].includes(status) && ["waiting-for-bump", "processing", "qr-scan-pending"].includes(prevStatus)) {
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

  // Load selected category from AsyncStorage on mount
  useEffect(() => {
    const loadCategory = async () => {
      try {
        const savedCategory = await AsyncStorage.getItem("nekt-sharing-category");
        if (savedCategory && ["Personal", "Work"].includes(savedCategory)) {
          setSelectedCategory(savedCategory as SharingCategory);
        }
      } catch (error) {
        console.warn("[iOS] Failed to load sharing category:", error);
      }
    };
    loadCategory();
  }, []);

  // Listen for exchange initiated events (for QR code display)
  useEffect(() => {
    const unsubscribe = exchangeEvents.onExchangeInitiated(({ token }) => {
      console.log("🎫 [iOS] Exchange initiated with token:", token.substring(0, 8) + "...");
      setQrToken(token);
    });
    return unsubscribe;
  }, []);

  // Initialize exchange service
  const initializeService = useCallback(async () => {
    try {
      const sessionId = generateSessionId();
      const service = new RealTimeContactExchangeService(
        sessionId,
        async (state: ContactExchangeState) => {
          console.log("🎯 [iOS] ExchangeButton received state change:", state.status);
          setStatus(state.status);

          // Save QR token for qr-scan-matched state
          if (state.qrToken) {
            setQrToken(state.qrToken);
          }

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
  }, []);

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
      // Clean up any existing service first
      if (exchangeService) {
        await exchangeService.disconnect();
      }
      setExchangeService(null);

      const service = await initializeService();
      if (!service) return;

      // Start the exchange process with the selected sharing category
      await service.startExchange(permissionGranted, selectedCategory);
    } catch (error) {
      console.error("[iOS] Failed to start exchange:", error);
      setStatus("error");
    }
  }, [status, exchangeService, initializeService, selectedCategory]);

  const handleButtonPress = useCallback(async () => {
    // Handle QR scan matched state - fetch profile and notify parent
    if (status === "qr-scan-matched" && qrToken) {
      console.log("🎯 [iOS] QR scan match - fetching profile...");
      try {
        const response = await fetch(`${apiBaseUrl}/api/exchange/pair/${qrToken}`);
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
    };
  }, [exchangeService]);

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
        return (
          <View style={styles.contentRow}>
            <View style={styles.pulsingDot} />
            <Text style={styles.text}>Waiting for Bump or Scan...</Text>
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
        return <Text style={styles.matchText}>Match Found!</Text>;

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
  ].includes(status);

  // Interpolate pulse animation for shadow
  const animatedShadowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });
  const animatedShadowRadius = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 20],
  });

  // For qr-scan-matched, wrap in animated view with pulsing shadow
  if (status === "qr-scan-matched") {
    return (
      <Animated.View
        style={[
          styles.pulseContainer,
          {
            shadowOpacity: animatedShadowOpacity,
            shadowRadius: animatedShadowRadius,
          },
        ]}
      >
        <Button
          variant={getButtonVariant()}
          size="xl"
          onPress={handleButtonPress}
          disabled={false} // Match Found is clickable
          style={styles.button}
        >
          {getButtonContent()}
        </Button>
      </Animated.View>
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
    borderRadius: 9999,
    shadowColor: "#10B981", // Emerald/green glow color matching theme
    shadowOffset: { width: 0, height: 0 },
    // shadowOpacity and shadowRadius are animated
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
