/**
 * AppClipOnboardingView - Minimal onboarding for App Clip only
 *
 * This is a stripped-down version for the App Clip that:
 * - Does NOT import Firebase SDK (uses REST API only)
 * - Does NOT import expo-contacts (not needed in App Clip)
 * - Only handles Steps 1 and 2
 *
 * Step 3 (Contact Sharing) happens in the full app after handoff.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { Button } from "../ui/buttons/Button";
import { Heading, Body } from "../ui/Typography";
import {
  signInWithApple,
  exchangeAppleTokenForFirebase,
  isAppleAuthAvailable,
} from "../../../client/auth/apple";
import { storeSessionForHandoff } from "../../../client/auth/session-handoff";
import { showAppStoreOverlay } from "../../../client/native/SKOverlayWrapper";

function NektLogo() {
  return <Text style={styles.logoText}>nekt</Text>;
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
    description: "in full app",
  },
];

interface StepIndicatorProps {
  step: OnboardingStep;
  isCurrent: boolean;
  isCompleted: boolean;
}

function StepIndicator({ step, isCurrent, isCompleted }: StepIndicatorProps) {
  const isStep3 = step.number === 3;

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
            isStep3 && styles.stepTitleDisabled,
          ]}
        >
          {step.title}
          {isStep3 && " - in full app"}
        </Text>
        {isCurrent && !isStep3 && (
          <Text style={styles.stepDescription}>{step.description}</Text>
        )}
      </View>
    </View>
  );
}

interface AppClipOnboardingViewProps {
  onComplete?: () => void;
}

export function AppClipOnboardingView({
  onComplete,
}: AppClipOnboardingViewProps) {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasTriggeredSIWA = useRef(false);

  const markStepComplete = useCallback(
    (step: number) => {
      setCompletedSteps((prev) => new Set([...prev, step]));
      if (step === 1) {
        setCurrentStep(2);
      } else if (step === 2) {
        onComplete?.();
      }
    },
    [onComplete]
  );

  // Step 1: Auto-trigger Sign in with Apple
  useEffect(() => {
    if (hasTriggeredSIWA.current) return;
    hasTriggeredSIWA.current = true;

    const autoSignIn = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const available = await isAppleAuthAvailable();
        if (!available) {
          setError("Sign in with Apple is not available on this device");
          setIsLoading(false);
          return;
        }

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

        // Exchange token with backend (REST API, no Firebase SDK)
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

        // Advance to step 2
        markStepComplete(1);

        // Show SKOverlay after a short delay
        setTimeout(() => {
          showAppStoreOverlay();
        }, 500);
      } catch (err) {
        console.error("[AppClipOnboarding] SIWA error:", err);
        setError("Sign-in failed. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(autoSignIn, 300);
    return () => clearTimeout(timer);
  }, [markStepComplete]);

  const handleRetrySIWA = useCallback(() => {
    hasTriggeredSIWA.current = false;
    setError(null);
    setCurrentStep(1);
  }, []);

  const handleContinue = useCallback(() => {
    markStepComplete(2);
  }, [markStepComplete]);

  return (
    <LinearGradient
      colors={["rgba(34, 197, 94, 0.3)", "rgba(34, 197, 94, 0.12)", "#0a0f1a"]}
      locations={[0, 0.3, 1]}
      style={[styles.container, { paddingTop: insets.top + 24 }]}
    >
      <View style={styles.logoContainer}>
        <NektLogo />
      </View>

      <View style={styles.stepsContainer}>
        {STEPS.map((step) => (
          <StepIndicator
            key={step.number}
            step={step}
            isCurrent={currentStep === step.number}
            isCompleted={completedSteps.has(step.number)}
          />
        ))}
      </View>

      <View style={styles.contentContainer}>
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

        {currentStep === 2 && (
          <View style={styles.stepContent}>
            <Heading>Get the Full Experience</Heading>
            <Body style={styles.stepBody}>
              Install the Nekt app for the best experience with all features
              including contact sync, history, and more.
            </Body>
            <Button variant="primary" onPress={handleContinue}>
              Continue
            </Button>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
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
  stepTitleDisabled: {
    color: "rgba(255, 255, 255, 0.3)",
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
});

export default AppClipOnboardingView;
