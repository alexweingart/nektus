import React, { useCallback, useMemo, useState } from "react";
import { View, Animated, StyleSheet, Alert, TouchableOpacity } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import type { ExchangeStatus } from "@nektus/shared-types";
import { ProfileInfo } from "../ui/modules/ProfileInfo";
import { Button } from "../ui/buttons/Button";
import { SecondaryButton } from "../ui/buttons/SecondaryButton";
import { ExchangeButton, MatchResult } from "../ui/buttons/ExchangeButton";
import AdminBanner, { useAdminModeActivator } from "../ui/banners/AdminBanner";
import { useSession } from "../../../app/providers/SessionProvider";
import { useProfile } from "../../../app/context/ProfileContext";
import { PullToRefresh } from "../ui/layout/PullToRefresh";
import { useProfileAnimations } from "../../../client/hooks/use-profile-animations";
import { emitCancelExchange } from "../../utils/animationEvents";

type ProfileViewNavigationProp = NativeStackNavigationProp<RootStackParamList, "Profile">;

/**
 * Get a field value from ContactEntry array by fieldType
 */
const getFieldValue = (contactEntries: any[] | undefined, fieldType: string): string => {
  if (!contactEntries) return '';
  const entry = contactEntries.find(e => e.fieldType === fieldType);
  return entry?.value || '';
};

export function ProfileView() {
  const { data: session } = useSession();
  const {
    profile,
    refreshProfile,
    streamingProfileImage,
    isGoogleInitials,
    isCheckingGoogleImage,
  } = useProfile();
  const navigation = useNavigation<ProfileViewNavigationProp>();
  const adminModeProps = useAdminModeActivator();

  // Animation state
  const {
    animationPhase,
    isExchanging: isAnimationExchanging,
    animatedValues,
    resetAnimations,
    triggerEnterAnimation,
  } = useProfileAnimations();

  // Exchange state
  const [exchangeStatus, setExchangeStatus] = useState<ExchangeStatus>("idle");
  const [matchToken, setMatchToken] = useState<string | null>(null);

  // Determine if we're in an active exchange state (includes BLE states)
  const isExchanging = [
    "waiting-for-bump",
    "processing",
    "qr-scan-pending",
    "ble-scanning",
    "ble-discovered",
    "ble-connecting",
    "ble-exchanging",
  ].includes(exchangeStatus);

  // Determine if QR code should be shown (keep showing during match found state)
  const showQRCode = (isExchanging || exchangeStatus === "qr-scan-matched" || exchangeStatus === "ble-matched") && matchToken !== null;

  // Handle exchange status changes from ExchangeButton
  const handleExchangeStatusChange = useCallback((status: ExchangeStatus) => {
    console.log("[ProfileView] Exchange status changed:", status);
    setExchangeStatus(status);

    // Clear QR token when exchange ends (but keep it during match found state so QR remains visible)
    if (["idle", "error", "timeout", "matched"].includes(status)) {
      setMatchToken(null);
    }
  }, []);

  // Handle match token changes (for QR code display)
  const handleMatchTokenChange = useCallback((token: string | null) => {
    console.log("[ProfileView] Match token changed:", token ? token.substring(0, 8) + "..." : null);
    setMatchToken(token);
  }, []);

  // Handle successful match - navigate directly to Contact view (like web)
  const handleMatch = useCallback((match: MatchResult) => {
    const matchName = getFieldValue(match.profile.contactEntries, 'name') || 'New Contact';
    console.log("[ProfileView] Match received:", matchName, "via", match.matchType);
    // Navigate directly to Contact view instead of showing modal
    navigation.navigate("Contact", {
      userId: match.profile.userId,
      token: match.token,
      isHistoricalMode: false,
    });
  }, [navigation]);

  // Handle cancel exchange
  const handleCancelExchange = useCallback(() => {
    console.log("[ProfileView] Cancel exchange requested");
    // Emit cancel event for ExchangeButton to handle (stops services)
    emitCancelExchange();
    // Reset local state
    setExchangeStatus("idle");
    setMatchToken(null);
  }, []);

  const handleRefresh = useCallback(async () => {
    console.log("[ProfileView] Refreshing profile...");
    if (refreshProfile) {
      await refreshProfile();
    }
  }, [refreshProfile]);

  // Extract bio content with fallback
  const bioContent = useMemo(() => {
    const profileBio = getFieldValue(profile?.contactEntries, 'bio');
    return profileBio || 'My bio is going to be awesome once I create it.';
  }, [profile?.contactEntries]);

  // Get profile image source - prioritize streaming image for immediate feedback
  const profileImageSrc = useMemo(() => {
    // Use streaming image if available (during generation)
    if (streamingProfileImage) {
      console.log('[ProfileView] Using streaming image');
      return streamingProfileImage;
    }
    // Hide Google image while checking or if confirmed as initials
    const baseImageUrl = profile?.profileImage || session?.user?.image;
    console.log('[ProfileView] Profile image URL:', baseImageUrl?.substring(0, 100), { isGoogleInitials, isCheckingGoogleImage });
    const isGoogleUrl = baseImageUrl?.includes('googleusercontent.com');
    if (isGoogleInitials || (isCheckingGoogleImage && isGoogleUrl)) {
      return undefined;
    }
    return baseImageUrl || undefined;
  }, [profile?.profileImage, session?.user?.image, streamingProfileImage, isGoogleInitials, isCheckingGoogleImage]);

  // Calculate if we should show initials - true for confirmed Google initials or while checking
  const shouldShowInitials = useMemo(() => {
    const baseImageUrl = streamingProfileImage || profile?.profileImage || session?.user?.image;
    const isGoogleUrl = baseImageUrl?.includes('googleusercontent.com');
    return isGoogleInitials || (isCheckingGoogleImage && isGoogleUrl);
  }, [streamingProfileImage, profile?.profileImage, session?.user?.image, isGoogleInitials, isCheckingGoogleImage]);

  // Reset animations when screen gains focus (e.g., returning from ContactView)
  useFocusEffect(
    useCallback(() => {
      // Reset animations to ensure elements are visible
      // This handles the case where exit animation played before navigation
      resetAnimations();
    }, [resetAnimations])
  );

  // If no profile, show nothing (let loading state handle it)
  if (!profile) {
    return <View style={styles.scrollContent} />;
  }

  return (
    <>
      <PullToRefresh
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
      >
        {/* Top Navigation Buttons - Animated */}
        <Animated.View
          style={[
            styles.headerButtons,
            {
              opacity: animatedValues.topButtonsOpacity,
              transform: [{ translateY: animatedValues.topButtonsTranslateY }],
            },
          ]}
        >
          {/* History Button (Clock Icon) */}
          <Button
            variant="circle"
            size="icon"
            onPress={() => navigation.navigate("History")}
          >
            <Svg width={20} height={20} viewBox="0 0 20 20" fill="#374151">
              <Path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              />
            </Svg>
          </Button>

          {/* Edit Button (Pencil Icon) */}
          <Button
            variant="circle"
            size="icon"
            onPress={() => navigation.navigate("EditProfile")}
          >
            <Svg width={20} height={20} viewBox="0 0 20 20" fill="#374151">
              <Path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </Svg>
          </Button>
        </Animated.View>

        {/* Profile Info with carousel - shows QR code during exchange */}
        {/* Double-tap on profile area activates admin mode */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={adminModeProps.onPress}
        >
          <ProfileInfo
            profile={profile}
            profileImageSrc={profileImageSrc}
            bioContent={bioContent}
            isLoadingProfile={false}
            isGoogleInitials={shouldShowInitials}
            showQRCode={showQRCode}
            matchToken={matchToken || undefined}
            animatedValues={{
              scale: animatedValues.profileScale,
              translateY: animatedValues.profileTranslateY,
              opacity: animatedValues.profileOpacity,
              rotation: animatedValues.profileRotation,
            }}
          />
        </TouchableOpacity>

        {/* Action Buttons - Animated */}
        <Animated.View
          style={[
            styles.actionButtonsContainer,
            {
              opacity: animatedValues.actionButtonsOpacity,
              transform: [{ scale: animatedValues.actionButtonsScale }],
            },
          ]}
        >
          {/* Nekt Button */}
          <ExchangeButton
            onStateChange={handleExchangeStatusChange}
            onMatchTokenChange={handleMatchTokenChange}
            onMatch={handleMatch}
          />

          {/* Cancel Button - shows during exchange */}
          {isExchanging && (
            <View style={styles.cancelButtonContainer}>
              <SecondaryButton onPress={handleCancelExchange}>
                Cancel
              </SecondaryButton>
            </View>
          )}
        </Animated.View>
      </PullToRefresh>

      {/* Admin Banner - appears when admin mode is activated */}
      <AdminBanner />
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16, // Match web px-4 (applies to all children)
    paddingBottom: 32,
  },
  headerButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 16,
    width: "100%",
    // No horizontal padding - comes from scrollContent
  },
  actionButtonsContainer: {
    paddingTop: 16,
    width: "100%",
    gap: 12,
  },
  cancelButtonContainer: {
    alignItems: "center",
  },
});

export default ProfileView;
