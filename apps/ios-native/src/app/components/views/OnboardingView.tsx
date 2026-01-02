/**
 * OnboardingView - Progressive onboarding for App Clip and Full App
 *
 * This component handles all 3 steps of onboarding:
 * - Step 1: Sign in with Apple (App Clip) - auto-triggers on mount
 * - Step 2: Install Native App (App Clip) - shows SKOverlay
 * - Step 3: Enable Contact Sharing (Full App) - requests permission, extracts Me card
 *
 * The component takes an `initialStep` prop to start at the appropriate step:
 * - App Clip starts at step 1
 * - Full App (after handoff) starts at step 3
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Contacts from "expo-contacts";
import { LinearGradient } from "expo-linear-gradient";

import { Button } from "../ui/buttons/Button";
import { Input } from "../ui/inputs/Input";
import { Heading, Body } from "../ui/Typography";
import {
  signInWithApple,
  exchangeAppleTokenForFirebase,
  isAppleAuthAvailable,
} from "../../../client/auth/apple";
import { storeSessionForHandoff, isAppClip } from "../../../client/auth/session-handoff";
import { showAppStoreOverlay } from "../../../client/native/SKOverlayWrapper";
import { getMeCard, getMeCardImage } from "../../../client/native/MeCardWrapper";
import { signInWithToken } from "../../../client/auth/firebase";
import { formatPhoneNumber } from "@nektus/shared-client";

// Logo component (simple text for now, can be replaced with actual logo)
function NektLogo() {
  return (
    <Text style={styles.logoText}>nekt</Text>
  );
}

interface OnboardingStep {
  number: 1 | 2 | 3;
  title: string;
  description: string;
}

const STEPS: OnboardingStep[] = [
  {
    number: 1,
    title: "Sign in with Apple",
    description: "Quick, secure sign-in with your Apple ID",
  },
  {
    number: 2,
    title: "Install Native App",
    description: "Get the full app for best experience",
  },
  {
    number: 3,
    title: "Enable Contact Sharing",
    description: "Auto-fill your phone and save new connections",
  },
];

interface StepIndicatorProps {
  step: OnboardingStep;
  isCurrent: boolean;
  isCompleted: boolean;
  isInFullApp: boolean;
}

function StepIndicator({ step, isCurrent, isCompleted, isInFullApp }: StepIndicatorProps) {
  // In App Clip, step 3 shows as "in full app"
  const isStep3InClip = step.number === 3 && isAppClip();

  return (
    <View style={styles.stepRow}>
      <View
        style={[
          styles.stepCircle,
          isCurrent && styles.stepCircleCurrent,
          isCompleted && styles.stepCircleCompleted,
        ]}
      >
        {isCompleted ? (
          <Text style={styles.checkmark}>✓</Text>
        ) : (
          <Text
            style={[styles.stepNumber, isCurrent && styles.stepNumberCurrent]}
          >
            {step.number}
          </Text>
        )}
      </View>
      <View style={styles.stepTextContainer}>
        <Text
          style={[
            styles.stepTitle,
            isCurrent && styles.stepTitleCurrent,
            isCompleted && styles.stepTitleCompleted,
          ]}
        >
          {step.title}
          {isStep3InClip && " - in full app"}
        </Text>
        {isCurrent && (
          <Text style={styles.stepDescription}>{step.description}</Text>
        )}
      </View>
    </View>
  );
}

interface OnboardingViewProps {
  /**
   * Initial step to start at
   * - 1: Start from Sign in with Apple (App Clip default)
   * - 3: Start from Contact Sharing (Full App after handoff)
   */
  initialStep?: 1 | 3;

  /**
   * Callback when onboarding is complete
   */
  onComplete?: () => void;

  /**
   * Callback to save phone and optionally image to profile
   */
  onSaveProfile?: (phone: string, imageBase64?: string) => Promise<void>;
}

export function OnboardingView({
  initialStep = 1,
  onComplete,
  onSaveProfile,
}: OnboardingViewProps) {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(initialStep);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    // If starting at step 3, steps 1 and 2 are already complete
    initialStep === 3 ? new Set([1, 2]) : new Set()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 3: Phone input state
  const [phoneDigits, setPhoneDigits] = useState("");
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const phoneInputRef = useRef<TextInput>(null);

  const hasTriggeredSIWA = useRef(false);

  // Mark a step as complete and advance
  const markStepComplete = useCallback((step: number) => {
    setCompletedSteps((prev) => new Set([...prev, step]));
    if (step < 3) {
      setCurrentStep((step + 1) as 1 | 2 | 3);
    } else {
      // All steps complete
      onComplete?.();
    }
  }, [onComplete]);

  // Step 1: Auto-trigger Sign in with Apple
  useEffect(() => {
    if (initialStep !== 1 || hasTriggeredSIWA.current) return;
    hasTriggeredSIWA.current = true;

    const autoSignIn = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Check if SIWA is available
        const available = await isAppleAuthAvailable();
        if (!available) {
          setError("Sign in with Apple is not available on this device");
          setIsLoading(false);
          return;
        }

        // Trigger SIWA
        const result = await signInWithApple();

        if (!result.success) {
          setError(result.error || "Sign-in failed");
          setIsLoading(false);
          return;
        }

        if (!result.identityToken) {
          setError("No identity token received");
          setIsLoading(false);
          return;
        }

        // Exchange token with backend
        const tokenResponse = await exchangeAppleTokenForFirebase(
          result.identityToken,
          result.fullName,
          result.email
        );

        // Store session for handoff to full app
        await storeSessionForHandoff({
          firebaseToken: tokenResponse.firebaseToken,
          userId: tokenResponse.userId,
          userName: tokenResponse.user.name,
          userEmail: tokenResponse.user.email,
          phone: null,
        });

        // If in full app (not clip), also sign in to Firebase
        if (!isAppClip()) {
          await signInWithToken(tokenResponse.firebaseToken, tokenResponse.userId);
        }

        // Advance to step 2
        markStepComplete(1);

        // Show SKOverlay after a short delay
        setTimeout(() => {
          showAppStoreOverlay();
        }, 500);
      } catch (err) {
        console.error("[OnboardingView] SIWA error:", err);
        setError("Sign-in failed. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    // Small delay before triggering SIWA
    const timer = setTimeout(autoSignIn, 300);
    return () => clearTimeout(timer);
  }, [initialStep, markStepComplete]);

  // Step 2: Continue button handler
  const handleContinueToStep3 = useCallback(() => {
    markStepComplete(2);
  }, [markStepComplete]);

  // Step 3: Request contacts permission
  const handleRequestContacts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { status } = await Contacts.requestPermissionsAsync();

      if (status !== "granted") {
        // Permission denied, show manual phone input
        setShowPhoneInput(true);
        setIsLoading(false);
        return;
      }

      // Try to get Me card
      const meCard = await getMeCard();

      if (meCard && meCard.phoneNumbers.length > 0) {
        // Found a phone number in Me card
        const phone = meCard.phoneNumbers[0];

        // Get Me card image if available
        let imageBase64: string | undefined;
        if (meCard.hasImage) {
          const image = await getMeCardImage();
          if (image) {
            imageBase64 = image;
          }
        }

        // Save to profile
        if (onSaveProfile) {
          await onSaveProfile(phone, imageBase64);
        }

        markStepComplete(3);
      } else {
        // No Me card or no phone, show manual input
        setShowPhoneInput(true);
      }
    } catch (err) {
      console.error("[OnboardingView] Contacts error:", err);
      setShowPhoneInput(true);
    } finally {
      setIsLoading(false);
    }
  }, [markStepComplete, onSaveProfile]);

  // Step 3: Phone input handlers
  const formatDisplayPhone = (digits: string): string => {
    const cleaned = digits.replace(/\D/g, "");
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6)
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, "");
    setPhoneDigits(digits.slice(0, 10));
    setError(null);
  };

  const handleSavePhone = useCallback(async () => {
    const cleanDigits = phoneDigits.replace(/\D/g, "");
    if (cleanDigits.length < 10) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }

    const { internationalPhone, isValid } = formatPhoneNumber(cleanDigits, "US");

    if (!isValid || !internationalPhone) {
      setError("Please enter a valid phone number");
      return;
    }

    setIsLoading(true);
    try {
      if (onSaveProfile) {
        await onSaveProfile(internationalPhone);
      }
      markStepComplete(3);
    } catch (err) {
      console.error("[OnboardingView] Save phone error:", err);
      setError("Failed to save. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [phoneDigits, markStepComplete, onSaveProfile]);

  // Retry SIWA button handler
  const handleRetrySIWA = useCallback(() => {
    hasTriggeredSIWA.current = false;
    setError(null);
    // Re-trigger the effect
    setCurrentStep(1);
  }, []);

  return (
    <LinearGradient
      colors={["rgba(34, 197, 94, 0.3)", "rgba(34, 197, 94, 0.12)", "#0a0f1a"]}
      locations={[0, 0.3, 1]}
      style={[styles.container, { paddingTop: insets.top + 24 }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <NektLogo />
        </View>

        {/* Progress Steps */}
        <View style={styles.stepsContainer}>
          {STEPS.map((step) => (
            <StepIndicator
              key={step.number}
              step={step}
              isCurrent={currentStep === step.number}
              isCompleted={completedSteps.has(step.number)}
              isInFullApp={!isAppClip()}
            />
          ))}
        </View>

        {/* Content Area */}
        <View style={styles.contentContainer}>
          {/* Step 1: Sign in with Apple */}
          {currentStep === 1 && (
            <View style={styles.stepContent}>
              {isLoading ? (
                <>
                  <ActivityIndicator size="large" color="#22c55e" />
                  <Text style={styles.loadingText}>Signing in...</Text>
                </>
              ) : error ? (
                <>
                  <Text style={styles.errorText}>{error}</Text>
                  <Button variant="primary" onPress={handleRetrySIWA}>
                    Try Again
                  </Button>
                </>
              ) : null}
            </View>
          )}

          {/* Step 2: Install Native App */}
          {currentStep === 2 && (
            <View style={styles.stepContent}>
              <Heading>Get the Full Experience</Heading>
              <Body style={styles.stepBody}>
                Install the Nekt app for the best experience with all features
                including contact sync, history, and more.
              </Body>
              <Button variant="primary" onPress={handleContinueToStep3}>
                Continue
              </Button>
            </View>
          )}

          {/* Step 3: Enable Contact Sharing */}
          {currentStep === 3 && (
            <View style={styles.stepContent}>
              {!showPhoneInput ? (
                <>
                  <Heading>Quick Setup</Heading>
                  <Body style={styles.stepBody}>
                    Allow contacts access to auto-fill your phone number and
                    save new connections directly to your contacts.
                  </Body>
                  {isLoading ? (
                    <ActivityIndicator size="large" color="#22c55e" />
                  ) : (
                    <>
                      <Button
                        variant="primary"
                        onPress={handleRequestContacts}
                        disabled={isLoading}
                      >
                        Enable Contact Sharing
                      </Button>
                      <Button
                        variant="theme"
                        onPress={() => setShowPhoneInput(true)}
                        style={styles.skipButton}
                      >
                        Enter Manually
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Heading>Enter Your Phone</Heading>
                  <View style={styles.inputContainer}>
                    <Input
                      ref={phoneInputRef}
                      value={formatDisplayPhone(phoneDigits)}
                      onChangeText={handlePhoneChange}
                      placeholder="(555) 123-4567"
                      keyboardType="phone-pad"
                      autoFocus
                      error={error || undefined}
                      returnKeyType="done"
                      onSubmitEditing={handleSavePhone}
                    />
                  </View>
                  <Button
                    variant="primary"
                    onPress={handleSavePhone}
                    loading={isLoading}
                    disabled={isLoading || phoneDigits.length < 10}
                  >
                    Continue
                  </Button>
                </>
              )}
              {error && !showPhoneInput && (
                <Text style={styles.errorText}>{error}</Text>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  keyboardView: {
    flex: 1,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoText: {
    fontSize: 48,
    fontWeight: "700",
    color: "#22c55e",
    letterSpacing: -1,
  },
  stepsContainer: {
    marginBottom: 40,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stepCircleCurrent: {
    borderColor: "#22c55e",
    backgroundColor: "rgba(34, 197, 94, 0.2)",
  },
  stepCircleCompleted: {
    borderColor: "#22c55e",
    backgroundColor: "#22c55e",
  },
  stepNumber: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 14,
    fontWeight: "600",
  },
  stepNumberCurrent: {
    color: "#22c55e",
  },
  checkmark: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  stepTextContainer: {
    flex: 1,
  },
  stepTitle: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 16,
  },
  stepTitleCurrent: {
    color: "#ffffff",
    fontWeight: "700",
  },
  stepTitleCompleted: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  stepDescription: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 14,
    marginTop: 4,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
  },
  stepContent: {
    alignItems: "center",
  },
  stepBody: {
    textAlign: "center",
    marginBottom: 24,
    color: "rgba(255, 255, 255, 0.7)",
  },
  loadingText: {
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: "#ef4444",
    marginBottom: 16,
    textAlign: "center",
  },
  skipButton: {
    marginTop: 12,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 16,
  },
});

export default OnboardingView;
