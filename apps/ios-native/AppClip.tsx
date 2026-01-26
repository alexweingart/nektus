/**
 * AppClip.tsx - App Clip Entry Point
 *
 * New flow (matches web connect page):
 * 1. Parse exchange token from invocation URL: https://nekt.us/connect?token=xxx
 * 2. If no token → show error state
 * 3. If not authenticated → show AnonContactView
 * 4. If authenticated → show ContactView
 *
 * Note: No ProfileSetupView in connect flow (matches web behavior).
 * Phone collection happens when user sets up their own profile to share.
 */

import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";

import { AnonContactView } from "./src/app/components/views/AnonContactView";
import { ContactView } from "./src/app/components/views/ContactView";
import { Button } from "./src/app/components/ui/buttons/Button";
import type { UserProfile } from "@nektus/shared-types";
import { fetchProfilePreview } from "./src/client/contacts/preview";
import {
  signInWithApple,
  exchangeAppleTokenForFirebase,
  isAppleAuthAvailable,
} from "./src/client/auth/apple";
import { storeSessionForHandoff } from "./src/client/auth/session-handoff";
import { getApiBaseUrl, getIdToken } from "./src/client/auth/firebase";

// Session context for App Clip (simplified, no full Firebase SDK)
interface AppClipSession {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  firebaseToken: string;
}

function AppClipContent() {
  const insets = useSafeAreaInsets();
  const apiBaseUrl = getApiBaseUrl();

  // State
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<AppClipSession | null>(null);
  const [previewProfile, setPreviewProfile] = useState<UserProfile | null>(null);
  const [fullProfile, setFullProfile] = useState<UserProfile | null>(null);
  const [socialIconTypes, setSocialIconTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse token from invocation URL (now from path: /x/{token})
  useEffect(() => {
    const getToken = async () => {
      try {
        // Get the URL that launched the App Clip
        const url = await Linking.getInitialURL();
        console.log("[AppClip] Initial URL:", url);

        if (url) {
          const parsed = Linking.parse(url);
          console.log("[AppClip] Parsed URL:", parsed);

          // Extract token from path: /x/{token}
          const pathParts = parsed.path?.split('/').filter(Boolean) || [];
          if (pathParts[0] === 'x' && pathParts[1]) {
            setToken(pathParts[1]);
            return;
          }

          // Fallback: try query params for backwards compatibility during transition
          const tokenParam = parsed.queryParams?.token as string | undefined;
          if (tokenParam) {
            setToken(tokenParam);
            return;
          }
        }

        // No token found
        setError("Invalid link - no contact token found");
      } catch (err) {
        console.error("[AppClip] Failed to parse URL:", err);
        setError("Failed to process link");
      } finally {
        setIsLoading(false);
      }
    };

    getToken();
  }, []);

  // Fetch preview when token is available and not authenticated
  useEffect(() => {
    if (!token || session) return;

    const fetchPreview = async () => {
      setIsLoading(true);
      try {
        const result = await fetchProfilePreview(token);
        if (result.success && result.profile) {
          setPreviewProfile(result.profile);
          setSocialIconTypes(result.socialIconTypes || []);
        } else {
          setError(result.error || "Failed to load contact preview");
        }
      } catch (err) {
        console.error("[AppClip] Failed to fetch preview:", err);
        setError("Failed to load contact");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreview();
  }, [token, session]);

  // Fetch full profile when authenticated
  useEffect(() => {
    if (!token || !session) return;

    const fetchFullProfile = async () => {
      setIsLoading(true);
      try {
        const idToken = await getIdToken();
        const response = await fetch(`${apiBaseUrl}/api/exchange/pair/${token}`, {
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        });

        if (!response.ok) {
          throw new Error("Failed to fetch contact profile");
        }

        const result = await response.json();
        if (result.success && result.profile) {
          setFullProfile(result.profile);
        } else if (result.profile) {
          setFullProfile(result.profile);
        } else {
          setError("Invalid profile response");
        }
      } catch (err) {
        console.error("[AppClip] Failed to fetch full profile:", err);
        setError("Failed to load contact");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFullProfile();
  }, [token, session, apiBaseUrl]);

  // Handle Sign in with Apple
  const handleSignIn = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      const available = await isAppleAuthAvailable();
      if (!available) {
        setError("Sign in with Apple is not available on this device");
        return;
      }

      const result = await signInWithApple();

      if (!result.success) {
        setError(result.error || "Sign-in failed");
        return;
      }

      if (!result.identityToken) {
        setError("No identity token received");
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

      // Set session state
      setSession({
        userId: tokenResponse.userId,
        userName: tokenResponse.user.name,
        userEmail: tokenResponse.user.email,
        firebaseToken: tokenResponse.firebaseToken,
      });

      console.log("[AppClip] Sign in successful, userId:", tokenResponse.userId);
    } catch (err) {
      console.error("[AppClip] Sign in error:", err);
      setError("Sign-in failed. Please try again.");
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <LinearGradient
        colors={["rgba(34, 197, 94, 0.3)", "rgba(34, 197, 94, 0.12)", "#0a0f1a"]}
        locations={[0, 0.3, 1]}
        style={[styles.container, { paddingTop: insets.top + 24 }]}
      >
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </LinearGradient>
    );
  }

  // Error state
  if (error) {
    return (
      <LinearGradient
        colors={["rgba(239, 68, 68, 0.3)", "rgba(239, 68, 68, 0.12)", "#0a0f1a"]}
        locations={[0, 0.3, 1]}
        style={[styles.container, { paddingTop: insets.top + 24 }]}
      >
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            variant="primary"
            onPress={() => {
              setError(null);
              setIsLoading(true);
              // Re-try loading
              Linking.getInitialURL().then((url: string | null) => {
                if (url) {
                  const parsed = Linking.parse(url);
                  // Extract token from path: /x/{token}
                  const pathParts = parsed.path?.split('/').filter(Boolean) || [];
                  if (pathParts[0] === 'x' && pathParts[1]) {
                    setToken(pathParts[1]);
                  } else {
                    // Fallback: try query params
                    const tokenParam = parsed.queryParams?.token as string | undefined;
                    if (tokenParam) {
                      setToken(tokenParam);
                    }
                  }
                }
                setIsLoading(false);
              });
            }}
          >
            Try Again
          </Button>
        </View>
      </LinearGradient>
    );
  }

  // Authenticating state
  if (isAuthenticating) {
    return (
      <LinearGradient
        colors={["rgba(34, 197, 94, 0.3)", "rgba(34, 197, 94, 0.12)", "#0a0f1a"]}
        locations={[0, 0.3, 1]}
        style={[styles.container, { paddingTop: insets.top + 24 }]}
      >
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Signing in...</Text>
        </View>
      </LinearGradient>
    );
  }

  // Authenticated - show ContactView
  if (session && fullProfile && token) {
    return (
      <LinearGradient
        colors={
          fullProfile.backgroundColors?.length && fullProfile.backgroundColors.length >= 2
            ? (fullProfile.backgroundColors as [string, string, ...string[]])
            : ["rgba(34, 197, 94, 0.3)", "rgba(34, 197, 94, 0.12)", "#0a0f1a"]
        }
        locations={[0, 0.3, 1]}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        <ContactView
          profile={fullProfile}
          token={token}
          sessionUserName={session.userName}
        />
      </LinearGradient>
    );
  }

  // Not authenticated - show AnonContactView
  if (previewProfile && token) {
    return (
      <LinearGradient
        colors={
          previewProfile.backgroundColors?.length && previewProfile.backgroundColors.length >= 2
            ? (previewProfile.backgroundColors as [string, string, ...string[]])
            : ["rgba(34, 197, 94, 0.3)", "rgba(34, 197, 94, 0.12)", "#0a0f1a"]
        }
        locations={[0, 0.3, 1]}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        <AnonContactView
          profile={previewProfile}
          socialIconTypes={socialIconTypes}
          token={token}
          onSignIn={handleSignIn}
        />
      </LinearGradient>
    );
  }

  // Fallback - should not reach here
  return (
    <LinearGradient
      colors={["rgba(34, 197, 94, 0.3)", "rgba(34, 197, 94, 0.12)", "#0a0f1a"]}
      locations={[0, 0.3, 1]}
      style={[styles.container, { paddingTop: insets.top + 24 }]}
    >
      <View style={styles.centered}>
        <Text style={styles.errorText}>Something went wrong</Text>
      </View>
    </LinearGradient>
  );
}

export default function AppClip() {
  return (
    <SafeAreaProvider>
      <AppClipContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
});
