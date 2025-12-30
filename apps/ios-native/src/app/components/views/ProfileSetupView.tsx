import React, { useState, useRef, useCallback } from "react";
import {
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import Avatar from "../ui/elements/Avatar";
import { Heading } from "../ui/Typography";
import { Button } from "../ui/buttons/Button";
import { Input } from "../ui/inputs/Input";
import { useSession } from "../../../app/providers/SessionProvider";
import { useProfile, UserProfile } from "../../../app/context/ProfileContext";
import { formatPhoneNumber } from "@nektus/shared-lib";
import { LayoutBackground } from "../ui/layout/LayoutBackground";
import { PullToRefresh } from "../ui/layout/PullToRefresh";

export function ProfileSetupView() {
  const { data: session } = useSession();
  const { saveProfile, isSaving, profile } = useProfile();

  const [phoneDigits, setPhoneDigits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const phoneInputRef = useRef<TextInput>(null);

  // Format phone number as user types (for display)
  const formatDisplayPhone = (digits: string): string => {
    const cleaned = digits.replace(/\D/g, "");
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const handlePhoneChange = (text: string) => {
    // Only keep digits
    const digits = text.replace(/\D/g, "");
    setPhoneDigits(digits.slice(0, 10)); // Limit to 10 digits
    setError(null);
  };

  const handleSave = useCallback(async () => {
    if (isSaving) return;

    const cleanDigits = phoneDigits.replace(/\D/g, "");
    if (cleanDigits.length < 10) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }

    try {
      const { internationalPhone, isValid } = formatPhoneNumber(
        cleanDigits,
        "US"
      );

      if (!isValid || !internationalPhone) {
        setError("Please enter a valid phone number");
        return;
      }

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
        ],
      };

      await saveProfile(phoneUpdateData);
      console.log("[ProfileSetupView] Profile saved successfully");
    } catch (err) {
      console.error("[ProfileSetupView] Save failed:", err);
      setError("Failed to save. Please try again.");
    }
  }, [phoneDigits, isSaving, saveProfile, profile?.contactEntries]);

  const isButtonDisabled =
    isSaving || phoneDigits.replace(/\D/g, "").length < 10;

  // No-op refresh for setup screen (gesture still works for consistency)
  const handleRefresh = useCallback(async () => {
    // Nothing to refresh on setup screen
  }, []);

  return (
    <LayoutBackground showParticles={false} backgroundColor="#004D40">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <PullToRefresh
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onRefresh={handleRefresh}
        >
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <Avatar
              src={session?.user?.image || profile?.profileImage}
              alt={session?.user?.name || "User"}
              size="lg"
            />
          </View>

          {/* Name */}
          <Heading>{session?.user?.name || "Welcome"}</Heading>

          {/* Phone Input */}
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
              onSubmitEditing={handleSave}
            />
          </View>

          {/* Save Button */}
          <Button
            onPress={handleSave}
            loading={isSaving}
            disabled={isButtonDisabled}
            variant="primary"
          >
            Save
          </Button>
        </PullToRefresh>
      </KeyboardAvoidingView>
    </LayoutBackground>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 24, // Reduced - safe area handled by LayoutBackground
  },
  avatarContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 16,
  },
  inputContainer: {
    width: "100%",
    maxWidth: 320,
    marginTop: 24,
    marginBottom: 16,
  },
});

export default ProfileSetupView;
