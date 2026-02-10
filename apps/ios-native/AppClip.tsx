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

import { AnonContactView } from "./src/app/components/views/AnonContactView";
import { ContactView } from "./src/app/components/views/ContactView";
import { Button } from "./src/app/components/ui/buttons/Button";
import { PhoneEntryModal } from "./src/app/components/ui/modals/PhoneEntryModal";
import { ParticleNetworkLite } from "./src/app/components/ui/layout/ParticleNetworkLite";
import type { ParticleNetworkProps } from "./src/app/components/ui/layout/ParticleNetworkLite";
import type { UserProfile, ContactEntry } from "@nektus/shared-types";
import { fetchProfilePreview } from "./src/client/contacts/preview";
import {
  signInWithApple,
  exchangeAppleTokenForFirebase,
  isAppleAuthAvailable,
} from "./src/client/auth/apple";
import { storeSessionForHandoff } from "./src/client/auth/session-handoff";
import { getApiBaseUrl, getIdToken, signInWithToken } from "./src/client/auth/firebase";
import { formatPhoneNumber } from "@nektus/shared-client";

// Background colors matching main app's LayoutBackground
const THEME_DARK = '#0a0f1a';
const THEME_GREEN = '#145835';

// Default particle colors (matches main app's signed-out/connect theme)
const DEFAULT_PARTICLE_COLORS: NonNullable<ParticleNetworkProps['colors']> = {
  gradientStart: THEME_GREEN,
  gradientEnd: THEME_DARK,
  particle: 'rgba(200, 255, 200, 0.6)',
  connection: 'rgba(34, 197, 94, 0.15)',
};

// Convert profile backgroundColors to particle colors matching main app's LayoutBackground
function convertToParticleColors(backgroundColors: string[]): NonNullable<ParticleNetworkProps['colors']> {
  const [dominant, accent1, accent2] = backgroundColors;
  const hexToRgba = (hex: string, alpha: number) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  return {
    gradientStart: hexToRgba(accent1, 0.4),
    gradientEnd: dominant,
    particle: hexToRgba(accent2, 0.8),
    connection: hexToRgba(accent2, 0.4),
  };
}

// Session context for App Clip (simplified, no full Firebase SDK)
interface AppClipSession {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  firebaseToken: string;
}

// Error boundary to catch render errors and show them visually (no red screen in production)
class AppClipErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message || "Unknown error" };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[AppClip] Error boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorBoundaryStyles.container}>
          <Text style={errorBoundaryStyles.title}>App Clip Error</Text>
          <Text style={errorBoundaryStyles.message}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorBoundaryStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_DARK,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#ef4444",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  message: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    textAlign: "center",
  },
});

/** Get particle colors from a profile, falling back to defaults */
function getParticleColors(profile: UserProfile | null): NonNullable<ParticleNetworkProps['colors']> {
  if (profile?.backgroundColors?.length && profile.backgroundColors.length >= 2) {
    return convertToParticleColors(profile.backgroundColors);
  }
  return DEFAULT_PARTICLE_COLORS;
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
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneEntryComplete, setPhoneEntryComplete] = useState(false);
  const [isPhoneSaving, setIsPhoneSaving] = useState(false);

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
    setError(null);

    try {
      const available = await isAppleAuthAvailable();
      if (!available) {
        setError("Sign in with Apple is not available on this device");
        return;
      }

      const result = await signInWithApple();

      if (!result.success) {
        // User cancelled — just dismiss, no error
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

      // Sign into Firebase with the custom token (needed for authenticated API calls)
      await signInWithToken(tokenResponse.firebaseToken, tokenResponse.userId);

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

      // If new user, show phone entry modal
      if (tokenResponse.needsSetup) {
        setNeedsSetup(true);
        setShowPhoneModal(true);
      }

      console.log("[AppClip] Sign in successful, userId:", tokenResponse.userId, "needsSetup:", tokenResponse.needsSetup);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[AppClip] Sign in error:", message);
      setError(`Sign-in failed: ${message}`);
    }
  }, []);

  // Handle phone modal save
  const handlePhoneSave = useCallback(async (phone: string, socials: ContactEntry[]) => {
    setIsPhoneSaving(true);
    try {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No auth token");

      // Format phone number for storage
      const { internationalPhone } = formatPhoneNumber(phone);

      // Build contact entries to save
      const entries: ContactEntry[] = [
        {
          fieldType: 'phone',
          value: internationalPhone || phone,
          order: 0,
          isVisible: true,
          confirmed: true,
          linkType: 'default',
          icon: '/icons/default/phone.svg',
          section: 'personal',
        },
        {
          fieldType: 'phone',
          value: internationalPhone || phone,
          order: 0,
          isVisible: true,
          confirmed: true,
          linkType: 'default',
          icon: '/icons/default/phone.svg',
          section: 'work',
        },
        ...socials,
      ];

      const response = await fetch(`${apiBaseUrl}/api/profile/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ contactEntries: entries }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      console.log("[AppClip] Phone saved successfully");
      setShowPhoneModal(false);
      setPhoneEntryComplete(true);
    } catch (err) {
      console.error("[AppClip] Phone save error:", err);
      throw err; // Re-throw so modal shows error
    } finally {
      setIsPhoneSaving(false);
    }
  }, [apiBaseUrl]);

  // Determine particle colors based on current state
  const particleColors = getParticleColors(fullProfile || previewProfile);
  const particleContext = session ? "contact" : "connect";

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ParticleNetworkLite colors={DEFAULT_PARTICLE_COLORS} context="connect" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Error state (only show if no profile to display behind it)
  if (error && !previewProfile && !fullProfile) {
    return (
      <View style={styles.container}>
        <ParticleNetworkLite colors={DEFAULT_PARTICLE_COLORS} context="connect" />
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
      </View>
    );
  }

  // Authenticated - show ContactView (or phone modal if setup needed)
  if (session && fullProfile && token && (phoneEntryComplete || !needsSetup)) {
    return (
      <View style={styles.container}>
        <ParticleNetworkLite colors={particleColors} context="contact" />
        <ContactView
          profile={fullProfile}
          token={token}
          sessionUserName={session.userName}
        />
      </View>
    );
  }

  // Authenticated but needs phone setup — show loading bg with modal overlay
  if (session && showPhoneModal) {
    return (
      <View style={styles.container}>
        <ParticleNetworkLite colors={particleColors} context="contact" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
        <PhoneEntryModal
          isOpen={showPhoneModal}
          userName={session.userName || ''}
          isSaving={isPhoneSaving}
          onSave={handlePhoneSave}
        />
      </View>
    );
  }

  // Not authenticated - show AnonContactView (persists behind sign-in and errors)
  if (previewProfile && token) {
    return (
      <View style={styles.container}>
        <ParticleNetworkLite colors={particleColors} context="connect" />
        <AnonContactView
          profile={previewProfile}
          socialIconTypes={socialIconTypes}
          token={token}
          onSignIn={handleSignIn}
        />
        {/* Show error overlay on the card if sign-in failed */}
        {error && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorOverlayText}>{error}</Text>
          </View>
        )}
      </View>
    );
  }

  // Fallback - should not reach here
  return (
    <View style={styles.container}>
      <ParticleNetworkLite colors={DEFAULT_PARTICLE_COLORS} context="connect" />
      <View style={styles.centered}>
        <Text style={styles.errorText}>Something went wrong</Text>
      </View>
    </View>
  );
}

export default function AppClip() {
  return (
    <AppClipErrorBoundary>
      <SafeAreaProvider>
        <AppClipContent />
      </SafeAreaProvider>
    </AppClipErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_DARK,
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
  errorOverlay: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  errorOverlayText: {
    color: "#ef4444",
    fontSize: 14,
    textAlign: "center",
  },
});
