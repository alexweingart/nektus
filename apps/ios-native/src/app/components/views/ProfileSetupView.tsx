import React, { useState, useCallback, useRef } from "react";
import {
  View,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Keyboard,
} from "react-native";
import { Heading, BodyText } from "../ui/Typography";
import { Button } from "../ui/buttons/Button";
import { DropdownPhoneInput } from "../ui/inputs/DropdownPhoneInput";
import { SecondaryButton } from "../ui/buttons/SecondaryButton";
import { InlineAddLink, InlineAddLinkRef } from "../ui/modules/InlineAddLink";
import { useSession } from "../../../app/providers/SessionProvider";
import { useProfile, UserProfile } from "../../../app/context/ProfileContext";
import { formatPhoneNumber } from "@nektus/shared-client";
import { PullToRefresh } from "../ui/layout/PullToRefresh";
import AdminBanner, { useAdminModeActivator } from "../ui/banners/AdminBanner";
import type { ContactEntry } from "@nektus/shared-types";

// Helper to get field value from contact entries
const getFieldValue = (contactEntries: any[] | undefined, fieldType: string): string => {
  if (!contactEntries) return '';
  const entry = contactEntries.find(e => e.fieldType === fieldType);
  return entry?.value || '';
};

export function ProfileSetupView() {
  const { data: session } = useSession();
  const { saveProfile, isSaving, profile } = useProfile();
  const adminModeProps = useAdminModeActivator();
  const inlineAddLinkRef = useRef<InlineAddLinkRef>(null);

  const [phoneDigits, setPhoneDigits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showAddLink, setShowAddLink] = useState(false);
  const [addedLinks, setAddedLinks] = useState<ContactEntry[]>([]);

  // Get user's first name from profile or session
  const userName = getFieldValue(profile?.contactEntries, 'name') || session?.user?.name;
  const firstName = userName?.split(" ")[0] || "there";

  // Handle link added - duplicate to both personal and work sections
  const handleLinkAdded = useCallback((entries: ContactEntry[]) => {
    // For setup, we want links in both sections like we do with phone
    const duplicatedEntries: ContactEntry[] = [];
    entries.forEach(entry => {
      // Add to personal
      duplicatedEntries.push({ ...entry, section: 'personal' });
      // Add to work
      duplicatedEntries.push({ ...entry, section: 'work' });
    });
    setAddedLinks(duplicatedEntries);
    setShowAddLink(false);
  }, []);

  // Handle cancel add link
  const handleCancelAddLink = useCallback(() => {
    setShowAddLink(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (isSaving) return;

    // Validate phone FIRST, before touching InlineAddLink state
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

    // Phone is valid - now save InlineAddLink content if open
    let newLinks: ContactEntry[] = [];
    if (showAddLink && inlineAddLinkRef.current) {
      const savedEntries = inlineAddLinkRef.current.save();
      if (savedEntries) {
        newLinks = savedEntries;
      }
    }

    try {
      // Combine previously added links with any new links from InlineAddLink
      const allLinks = [...addedLinks, ...newLinks];

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
          ...allLinks, // Add all links (previously added + newly saved)
        ],
      };

      await saveProfile(phoneUpdateData);
      console.log("[ProfileSetupView] Profile saved successfully");
    } catch (err) {
      console.error("[ProfileSetupView] Save failed:", err);
      setError("Failed to save. Please try again.");
    }
  }, [phoneDigits, isSaving, saveProfile, profile?.contactEntries, addedLinks, showAddLink]);

  const isButtonDisabled =
    isSaving || phoneDigits.replace(/\D/g, "").length < 10;

  // No-op refresh for setup screen (gesture still works for consistency)
  const handleRefresh = useCallback(async () => {
    // Nothing to refresh on setup screen
  }, []);

  return (
    <>
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

            {/* Inline Add Link - appears above Save button when active */}
            {showAddLink && (
              <>
                {/* Backdrop to dismiss when tapping outside */}
                <Pressable
                  style={styles.addLinkBackdrop}
                  onPress={() => {
                    Keyboard.dismiss();
                    handleCancelAddLink();
                  }}
                />
                <InlineAddLink
                  ref={inlineAddLinkRef}
                  section="personal"
                  onLinkAdded={handleLinkAdded}
                  nextOrder={1}
                  onCancel={handleCancelAddLink}
                  showDuplicateToggle={false}
                />
              </>
            )}

            {/* Save Button - higher zIndex when InlineAddLink is showing */}
            <View style={showAddLink ? styles.saveButtonAboveBackdrop : undefined}>
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

            {/* Add Socials CTA - appears below Save when not in add mode */}
            {!showAddLink && addedLinks.length === 0 && (
              <View style={styles.addSocialsContainer}>
                <SecondaryButton onPress={() => setShowAddLink(true)}>
                  Add Socials
                </SecondaryButton>
              </View>
            )}
          </View>
        </PullToRefresh>
      </KeyboardAvoidingView>

      {/* Admin Banner - appears when admin mode is activated */}
      <AdminBanner />
    </>
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
  addLinkBackdrop: {
    position: "absolute",
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: 40,
  },
  saveButtonAboveBackdrop: {
    zIndex: 60, // Above backdrop (40) and InlineAddLink (50)
  },
});

export default ProfileSetupView;
