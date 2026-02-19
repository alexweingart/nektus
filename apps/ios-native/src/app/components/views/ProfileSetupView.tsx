import React, { useState, useCallback } from "react";
import {
  View,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Heading, BodyText } from "../ui/Typography";
import { Button } from "../ui/buttons/Button";
import { DropdownPhoneInput } from "../ui/inputs/DropdownPhoneInput";
import { SecondaryButton } from "../ui/buttons/SecondaryButton";
import { CustomSocialInputAdd } from "../ui/inputs/CustomSocialInputAdd";
import { ToggleSetting } from "../ui/controls/ToggleSetting";
import { scrapeBio } from "../../../client/profile/scrape-bio";
import { useSession } from "../../../app/providers/SessionProvider";
import { useProfile, UserProfile } from "../../../app/context/ProfileContext";
import { formatPhoneNumber, getFieldValue } from "@nektus/shared-client";
import { PullToRefresh } from "../ui/layout/PullToRefresh";
import { ScreenTransition } from "../ui/layout/ScreenTransition";
import AdminBanner, { useAdminModeActivator } from "../ui/banners/AdminBanner";
import type { ContactEntry } from "@nektus/shared-types";

export function ProfileSetupView() {
  const { data: session } = useSession();
  const { saveProfile, isSaving, profile } = useProfile();
  const adminModeProps = useAdminModeActivator();

  const [phoneDigits, setPhoneDigits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [socialInputs, setSocialInputs] = useState<Array<{platform: string, username: string}>>([]);
  const [useForBio, setUseForBio] = useState(true);

  // Get user's first name from profile or session
  const userName = getFieldValue(profile?.contactEntries, 'name') || session?.user?.name;
  const firstName = userName?.split(" ")[0] || "there";

  const handleSave = useCallback(async () => {
    if (isSaving) return;

    // Validate phone FIRST
    const cleanDigits = phoneDigits.replace(/\D/g, "");
    if (cleanDigits.length < 10) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }

    const { internationalPhone, isValid } = formatPhoneNumber(
      cleanDigits,
      "US"
    );

    if (!isValid || !internationalPhone) {
      setError("Please enter a valid phone number");
      return;
    }

    // Collect all social inputs with non-empty usernames
    const finalLinks: ContactEntry[] = socialInputs
      .filter(input => input.username.trim())
      .flatMap((input, idx) => {
        const baseEntry = {
          fieldType: input.platform,
          value: input.username.trim(),
          order: idx + 1,
          isVisible: true,
          confirmed: true,
          linkType: 'default' as const,
          icon: `/icons/default/${input.platform}.svg`,
        };
        return [
          { ...baseEntry, section: 'personal' as const },
          { ...baseEntry, section: 'work' as const },
        ];
      });

    try {
      const phoneUpdateData: Partial<UserProfile> = {
        contactEntries: [
          ...(profile?.contactEntries?.filter(
            (e) => e.fieldType !== "phone"
          ) || []),
          {
            fieldType: "phone",
            section: "personal",
            value: internationalPhone,
            order: 0,
            isVisible: true,
            confirmed: true,
          },
          {
            fieldType: "phone",
            section: "work",
            value: internationalPhone,
            order: 0,
            isVisible: true,
            confirmed: true,
          },
          ...finalLinks,
        ],
      };

      await saveProfile(phoneUpdateData);
      console.log("[ProfileSetupView] Profile saved successfully");

      // Fire-and-forget bio scrape if toggle is on
      if (useForBio && socialInputs[0]?.username.trim() &&
          ['instagram', 'linkedin'].includes(socialInputs[0].platform)) {
        scrapeBio(
          socialInputs[0].platform as 'instagram' | 'linkedin',
          socialInputs[0].username.trim()
        ).catch(console.error);
      }
    } catch (err) {
      console.error("[ProfileSetupView] Save failed:", err);
      setError("Failed to save. Please try again.");
    }
  }, [phoneDigits, isSaving, saveProfile, profile?.contactEntries, socialInputs, useForBio]);

  const isButtonDisabled =
    isSaving || phoneDigits.replace(/\D/g, "").length < 10;

  // No-op refresh for setup screen (gesture still works for consistency)
  const handleRefresh = useCallback(async () => {
    // Nothing to refresh on setup screen
  }, []);

  return (
    <ScreenTransition>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <PullToRefresh
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onRefresh={handleRefresh}
        >
          {/* Welcome Section - matches web layout */}
          <View style={styles.welcomeSection}>
            {/* Name - double-tap to activate admin mode */}
            <TouchableOpacity activeOpacity={1} onPress={adminModeProps.onPress}>
              <Heading style={styles.welcomeHeading}>
                Welcome, {firstName}!
              </Heading>
            </TouchableOpacity>
            <BodyText style={styles.subtitle}>
              Your new friends will want your number
            </BodyText>
          </View>

          {/* Phone Input Section - matches web layout */}
          <View style={styles.formSection}>
            <DropdownPhoneInput
              value={phoneDigits}
              onChange={(digits) => {
                setPhoneDigits(digits);
                setError(null);
              }}
              autoFocus
            />

            {error && <BodyText style={styles.errorText}>{error}</BodyText>}

            {/* Social Inputs - each button tap adds a new persistent row */}
            {socialInputs.map((input, index) => (
              <CustomSocialInputAdd
                key={index}
                platform={input.platform}
                username={input.username}
                onPlatformChange={(platform) =>
                  setSocialInputs(prev => prev.map((s, i) => i === index ? { ...s, platform } : s))
                }
                onUsernameChange={(username) =>
                  setSocialInputs(prev => prev.map((s, i) => i === index ? { ...s, username } : s))
                }
                autoFocus={index === socialInputs.length - 1}
              />
            ))}

            {/* Use for bio toggle */}
            {socialInputs.length > 0 && ['instagram', 'linkedin'].includes(socialInputs[0].platform) && (
              <ToggleSetting
                label={`Use ${socialInputs[0].platform === 'linkedin' ? 'LinkedIn' : 'Instagram'} for bio`}
                enabled={useForBio}
                onChange={setUseForBio}
              />
            )}

            {/* Save Button */}
            <View>
              <Button
                onPress={handleSave}
                loading={isSaving}
                disabled={isButtonDisabled}
                variant="white"
                size="xl"
              >
                Save
              </Button>
            </View>

            {/* Add Socials CTA - always visible */}
            <View style={styles.addSocialsContainer}>
              <SecondaryButton onPress={() => {
                setSocialInputs(prev => [
                  ...prev,
                  { platform: prev.length === 0 ? 'instagram' : 'facebook', username: '' }
                ]);
              }}>
                {socialInputs.length > 0 ? 'Add Socials' : 'Add Instagram'}
              </SecondaryButton>
            </View>
          </View>
        </PullToRefresh>
      </KeyboardAvoidingView>

      {/* Admin Banner - appears when admin mode is activated */}
      <AdminBanner />
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    // Content starts from top, not centered (matches web)
    paddingHorizontal: 16,
    paddingTop: 8, // py-2 on web
    paddingBottom: 24,
  },
  welcomeSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  welcomeHeading: {
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
  },
  formSection: {
    width: "100%",
    maxWidth: 448, // Match web's --max-content-width
    gap: 16,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 14,
    textAlign: "center",
    marginTop: -8,
  },
  addSocialsContainer: {
    alignItems: "center",
    marginTop: 8,
  },
});

export default ProfileSetupView;
