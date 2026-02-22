/**
 * AppClip.tsx - App Clip Entry Point
 *
 * Flow:
 * 1. Parse exchange token from invocation URL: https://nekt.us/x/{token}
 * 2. If no token → show error state
 * 3. Show AnonContactView with preview profile
 * 4. After sign-in → buttons swap in-place (no reload/animation)
 *
 * Note: No ProfileSetupView in connect flow (matches web behavior).
 * Phone collection happens when user sets up their own profile to share.
 */

import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Clipboard } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Linking from "expo-linking";

import { AnonContactView } from "./src/app/components/views/AnonContactView";
import { Button } from "./src/app/components/ui/buttons/Button";
import { PostSignUpModal } from "./src/app/components/ui/modals/PostSignUpModal";
import { StandardModal } from "./src/app/components/ui/modals/StandardModal";
import { generateMessageText } from "./src/client/contacts/messaging";
import { ParticleNetwork } from "./src/app/components/ui/layout/ParticleNetwork";
import type { ParticleNetworkProps } from "./src/app/components/ui/layout/ParticleNetwork";
import type { UserProfile, ContactEntry } from "@nektus/shared-types";
import { fetchProfilePreview } from "./src/client/contacts/preview";
import {
  signInWithApple,
  exchangeAppleTokenForFirebase,
  isAppleAuthAvailable,
} from "./src/client/auth/apple";
import { storeSessionForHandoff } from "./src/client/auth/session-handoff";
import { getApiBaseUrl, getIdToken, signInWithToken } from "./src/client/auth/firebase";
import { ClientProfileService } from "./src/client/firebase/firebase-save";
import { formatPhoneNumber, getFieldValue } from "@nektus/shared-client";
import { showAppStoreOverlay } from "./src/client/native/SKOverlayWrapper";
import { THEME_DARK, convertToParticleColors, DEFAULT_SIGNED_OUT_COLORS } from "./src/app/utils/colors";
import { useFonts } from "expo-font";
import { SORA_FONT_MAP } from "./src/shared/fonts";
import { fontStyles, textSizes } from "./src/app/components/ui/Typography";

// Session context for App Clip (simplified, no full Firebase SDK)
interface AppClipSession {
  userId: string;
  userName: string | null;
  userEmail: string | null;
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
    ...textSizes.xl,
    ...fontStyles.bold,
    marginBottom: 12,
  },
  message: {
    color: "rgba(255, 255, 255, 0.7)",
    ...fontStyles.regular,
    ...textSizes.sm,
    textAlign: "center",
  },
});

/** Get particle colors from a profile, falling back to defaults */
function getParticleColors(profile: UserProfile | null): NonNullable<ParticleNetworkProps['colors']> {
  if (profile?.backgroundColors?.length && profile.backgroundColors.length >= 2) {
    return convertToParticleColors(profile.backgroundColors);
  }
  return DEFAULT_SIGNED_OUT_COLORS;
}

function AppClipContent() {
  const [fontsLoaded] = useFonts(SORA_FONT_MAP);
  const apiBaseUrl = getApiBaseUrl();

  // State
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<AppClipSession | null>(null);
  const [previewProfile, setPreviewProfile] = useState<UserProfile | null>(null);
  const [socialIconTypes, setSocialIconTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [isPhoneSaving, setIsPhoneSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Parse token from invocation URL (now from path: /x/{token})
  useEffect(() => {
    const getToken = async () => {
      try {
        // Get the URL that launched the App Clip
        const url = await Linking.getInitialURL();

        if (url) {
          const parsed = Linking.parse(url);

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
      });

      // If new user, show phone entry modal (defer pair signal until after phone setup)
      if (tokenResponse.needsSetup) {
        setShowPhoneModal(true);
      } else {
        // Existing user — signal match to web user immediately
        await sendPairSignal();
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[AppClip] Sign in error:", message);
      setError(`Sign-in failed: ${message}`);
    }
  }, [token, apiBaseUrl]);

  // Signal match to web user by calling pair endpoint (also fetches full profile)
  const sendPairSignal = useCallback(async () => {
    if (!token) return;
    try {
      const pairIdToken = await getIdToken();
      if (pairIdToken) {
        const pairResponse = await fetch(`${apiBaseUrl}/api/exchange/pair/${token}`, {
          headers: { Authorization: `Bearer ${pairIdToken}` },
        });
        if (pairResponse.ok) {
          const pairResult = await pairResponse.json();
          if (pairResult.success && pairResult.profile) {
            setPreviewProfile(pairResult.profile);
          }
        }
      }
    } catch (pairErr) {
      console.error("[AppClip] Pair call failed:", pairErr);
    }
  }, [token, apiBaseUrl]);

  // Handle phone modal save — writes directly to Firestore (no REST endpoint needed)
  const handlePhoneSave = useCallback(async (phone: string, socials: ContactEntry[]) => {
    if (!session) throw new Error("No session");
    setIsPhoneSaving(true);
    try {
      // Format phone number for storage
      const { internationalPhone } = formatPhoneNumber(phone);

      // Build contact entries to save (phone added to both personal and work sections)
      const phoneValue = internationalPhone || phone;
      const entries: ContactEntry[] = [
        ...(['personal', 'work'] as const).map((section, i) => ({
          fieldType: 'phone' as const,
          value: phoneValue,
          order: i,
          isVisible: true,
          confirmed: true,
          linkType: 'default' as const,
          icon: '/icons/default/phone.svg',
          section,
        })),
        ...socials,
      ];

      // Save directly to Firestore via merge
      await ClientProfileService.updateProfile(session.userId, {
        contactEntries: entries,
      });

      setShowPhoneModal(false);

      // Now that profile is set up, signal match to web user
      await sendPairSignal();
    } catch (err) {
      console.error("[AppClip] Phone save error:", err);
      throw err; // Re-throw so modal shows error
    } finally {
      setIsPhoneSaving(false);
    }
  }, [session, sendPairSignal]);

  // Handle Save Contact — inline logic since save.ts depends on excluded expo-file-system
  const handleSaveContact = useCallback(async () => {
    if (isSaved || !previewProfile || !token) return;

    setIsSaving(true);
    try {
      // 1. Firebase save (fire-and-forget — don't block the contact form)
      const idToken = await getIdToken();
      if (idToken) {
        fetch(`${apiBaseUrl}/api/contacts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ token, skipGoogleContacts: true }),
        }).catch(err => console.error("[AppClip] Firebase save error:", err));
      }

      // 2. Open native "Add Contact" form (same end result as vCard on web)
      const name = getFieldValue(previewProfile.contactEntries, 'name') || '';
      const email = getFieldValue(previewProfile.contactEntries, 'email') || '';
      const phone = getFieldValue(previewProfile.contactEntries, 'phone') || '';
      const nameParts = name.split(' ');

      // Build URL addresses: Nekt link first, then social/custom links
      const urlAddresses: { url: string; label: string }[] = [];

      // Nekt homepage link (first)
      if (previewProfile.shortCode) {
        urlAddresses.push({
          url: `https://nekt.us/c/${previewProfile.shortCode}`,
          label: 'Nekt',
        });
      }

      // Social and custom link URLs from contact entries
      const SOCIAL_URLS: Record<string, { url: string; label: string }> = {
        instagram: { url: 'https://instagram.com/', label: 'Instagram' },
        x: { url: 'https://x.com/', label: 'X' },
        twitter: { url: 'https://twitter.com/', label: 'X' },
        linkedin: { url: 'https://linkedin.com/in/', label: 'LinkedIn' },
        facebook: { url: 'https://facebook.com/', label: 'Facebook' },
        tiktok: { url: 'https://tiktok.com/@', label: 'TikTok' },
        youtube: { url: 'https://youtube.com/@', label: 'YouTube' },
        snapchat: { url: 'https://snapchat.com/add/', label: 'Snapchat' },
        threads: { url: 'https://threads.net/@', label: 'Threads' },
        github: { url: 'https://github.com/', label: 'GitHub' },
        telegram: { url: 'https://t.me/', label: 'Telegram' },
        whatsapp: { url: 'https://wa.me/', label: 'WhatsApp' },
        wechat: { url: 'https://weixin.qq.com/r/', label: 'WeChat' },
      };

      if (previewProfile.contactEntries) {
        for (const entry of previewProfile.contactEntries) {
          if (!entry.value || !entry.isVisible) continue;
          if (['name', 'bio', 'phone', 'email'].includes(entry.fieldType)) continue;

          const social = SOCIAL_URLS[entry.fieldType.toLowerCase()];
          if (social) {
            urlAddresses.push({ url: `${social.url}${entry.value}`, label: social.label });
          } else if (entry.linkType === 'custom' && entry.value.startsWith('http')) {
            // Custom link — extract domain for label (e.g., "substack.com" → "Substack")
            try {
              const domain = new URL(entry.value).hostname.replace('www.', '');
              const domainLabel = domain.split('.')[0];
              urlAddresses.push({
                url: entry.value,
                label: domainLabel.charAt(0).toUpperCase() + domainLabel.slice(1),
              });
            } catch {
              urlAddresses.push({ url: entry.value, label: 'Website' });
            }
          }
        }
      }

      try {
        const Contacts = require('react-native-contacts').default;
        await Contacts.openContactForm({
          givenName: nameParts[0] || '',
          familyName: nameParts.slice(1).join(' ') || '',
          emailAddresses: email ? [{ label: 'home', email }] : [],
          phoneNumbers: phone ? [{ label: 'mobile', number: phone }] : [],
          urlAddresses,
          thumbnailPath: previewProfile.profileImage || '',
        });
      } catch (contactErr) {
        console.error("[AppClip] Contact form error:", contactErr);
      }

      // 3. Show success modal (upsell screen triggers when modal is dismissed)
      setShowSuccessModal(true);
    } catch (err) {
      console.error("[AppClip] Save contact error:", err);
      setError('Failed to save contact');
    } finally {
      setIsSaving(false);
    }
  }, [isSaved, previewProfile, token, apiBaseUrl]);

  // Handle "Say hi" from success modal — open SMS with pre-populated message
  const handleSayHi = useCallback(() => {
    if (!previewProfile) return;

    const phoneNumber = getFieldValue(previewProfile.contactEntries, 'phone');
    const contactName = getFieldValue(previewProfile.contactEntries, 'name') || '';
    const contactFirstName = contactName.split(' ')[0] || '';
    const senderFirstName = session?.userName?.split(' ')[0] || '';

    const message = generateMessageText(contactFirstName, senderFirstName);

    setShowSuccessModal(false);
    setIsSaved(true);

    if (phoneNumber) {
      const smsUrl = `sms:${phoneNumber}&body=${encodeURIComponent(message)}`;
      Linking.openURL(smsUrl).catch(() => {
        // Silently fail — contact is already saved
      });
    }
  }, [previewProfile, session]);

  // Handle dismiss of success modal — proceed to upsell screen
  const handleSuccessModalDismiss = useCallback(() => {
    setShowSuccessModal(false);
    setIsSaved(true);
  }, []);

  // Handle reject / dismiss — navigate to nekt.us (user is signed in, can see their profile)
  const handleReject = useCallback(() => {
    Linking.openURL('https://nekt.us').catch((err) => {
      console.error("[AppClip] Failed to open URL:", err);
    });
  }, []);

  // Auto-show SKOverlay when contact is saved (after contact form dismissed)
  useEffect(() => {
    if (!isSaved) return;
    const timer = setTimeout(() => {
      showAppStoreOverlay();
    }, 600);
    return () => clearTimeout(timer);
  }, [isSaved]);

  // Determine particle colors based on current state
  const particleColors = getParticleColors(previewProfile);

  // Wait for fonts + data
  if (!fontsLoaded || isLoading) {
    return (
      <View style={styles.container}>
        <ParticleNetwork colors={DEFAULT_SIGNED_OUT_COLORS} context="connect" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // No token state — show paste input for testing (e.g. launched from TestFlight at /x/)
  if (error && !previewProfile && !token) {
    return (
      <View style={styles.container}>
        <ParticleNetwork colors={DEFAULT_SIGNED_OUT_COLORS} context="connect" />
        <View style={styles.centered}>
          <Text style={styles.heading}>Paste Exchange Link</Text>
          <Text style={styles.subheading}>Scan a QR code in your browser, copy the URL, and paste it here</Text>
          <View style={styles.buttonContainer}>
            <TextInput
              style={styles.input}
              placeholder="https://nekt.us/x/..."
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={(e) => {
                const url = e.nativeEvent.text.trim();
                const match = url.match(/\/x\/([^/?]+)/);
                if (match?.[1]) {
                  setError(null);
                  setToken(match[1]);
                } else {
                  setError("No token found in URL");
                }
              }}
              returnKeyType="go"
            />
            <Button
              variant="white"
              size="lg"
              onPress={async () => {
                try {
                  const text = await Clipboard.getString();
                  const match = text.match(/\/x\/([^/?]+)/);
                  if (match?.[1]) {
                    setError(null);
                    setToken(match[1]);
                  } else {
                    setError("No exchange token found in clipboard");
                  }
                } catch {
                  setError("Failed to read clipboard");
                }
              }}
              style={styles.button}
            >
              Paste from Clipboard
            </Button>
          </View>
          {error !== "Invalid link - no contact token found" && (
            <Text style={styles.errorText}>{error}</Text>
          )}
        </View>
      </View>
    );
  }

  // Error state (only show if no profile to display behind it)
  if (error && !previewProfile) {
    return (
      <View style={styles.container}>
        <ParticleNetwork colors={DEFAULT_SIGNED_OUT_COLORS} context="connect" />
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  // Show AnonContactView — buttons swap seamlessly after sign-in (no reload)
  // PostSignUpModal overlays on top when new user needs phone setup
  if (previewProfile && token) {
    return (
      <View style={styles.container}>
        <ParticleNetwork colors={particleColors} context="connect" />
        <AnonContactView
          profile={previewProfile}
          socialIconTypes={socialIconTypes}
          token={token}
          onSignIn={handleSignIn}
          isAuthenticated={!!session}
          isDemo={token === 'demo'}
          onSaveContact={handleSaveContact}
          onReject={handleReject}
          onInstallApp={() => showAppStoreOverlay()}
          isSaving={isSaving}
          isSaved={isSaved}
        />
        {/* Show error overlay on the card if sign-in failed */}
        {error && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorOverlayText}>{error}</Text>
          </View>
        )}
        {/* Phone setup modal overlays on top of profile (like web) */}
        {session && showPhoneModal && (
          <PostSignUpModal
            isOpen={showPhoneModal}
            userName={session.userName || ''}
            isSaving={isPhoneSaving}
            onSave={handlePhoneSave}
          />
        )}
        {/* Success modal — shown after contact form, before upsell screen */}
        <StandardModal
          isOpen={showSuccessModal}
          onClose={handleSuccessModalDismiss}
          title="Contact Saved!"
          subtitle={`You and ${(getFieldValue(previewProfile.contactEntries, 'name') || '').split(' ')[0] || 'they'} are officially nekt'd!`}
          primaryButtonText="Say hi"
          onPrimaryButtonClick={handleSayHi}
          secondaryButtonText="Nah, they'll text me"
          onSecondaryButtonClick={handleSuccessModalDismiss}
          showCloseButton={false}
        />
      </View>
    );
  }

  // Fallback - should not reach here
  return (
    <View style={styles.container}>
      <ParticleNetwork colors={DEFAULT_SIGNED_OUT_COLORS} context="connect" />
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
    ...fontStyles.regular,
    ...textSizes.base,
    marginTop: 16,
  },
  errorText: {
    color: "#ef4444",
    ...fontStyles.regular,
    ...textSizes.sm,
    textAlign: "center",
    marginTop: 8,
  },
  heading: {
    ...textSizes.xxl,
    ...fontStyles.semibold,
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 12,
  },
  subheading: {
    ...textSizes.lg,
    ...fontStyles.regular,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 16,
  },
  buttonContainer: {
    width: "100%",
    maxWidth: 448,
    paddingHorizontal: 16,
    gap: 16,
  },
  input: {
    width: "100%",
    height: 56,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 9999,
    paddingHorizontal: 24,
    color: "#ffffff",
    ...fontStyles.regular,
    ...textSizes.base,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  button: {
    width: "100%",
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
    ...fontStyles.regular,
    ...textSizes.sm,
    textAlign: "center",
  },
});
