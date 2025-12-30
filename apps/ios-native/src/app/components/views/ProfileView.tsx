import React, { useCallback, useMemo } from "react";
import { View, StyleSheet, Alert } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useNavigation, CommonActions } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { ProfileInfo } from "../ui/modules/ProfileInfo";
import { Button } from "../ui/buttons/Button";
import { SecondaryButton } from "../ui/buttons/SecondaryButton";
import { ExchangeButton } from "../ui/buttons/ExchangeButton";
import { useSession } from "../../../app/providers/SessionProvider";
import { useProfile } from "../../../app/context/ProfileContext";
import { LayoutBackground } from "../ui/layout/LayoutBackground";
import { PullToRefresh } from "../ui/layout/PullToRefresh";

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
  const { data: session, signOut } = useSession();
  const { profile, refreshProfile } = useProfile();
  const navigation = useNavigation<ProfileViewNavigationProp>();

  const handleSignOut = async () => {
    try {
      await signOut();
      // Reset navigation stack to Home screen after successful sign out
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Home" }],
        })
      );
    } catch (error) {
      console.error("[ProfileView] Sign out failed:", error);
    }
  };

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

  // Get profile image source
  const profileImageSrc = useMemo(() => {
    return profile?.profileImage || session?.user?.image || undefined;
  }, [profile?.profileImage, session?.user?.image]);

  // If no profile, show nothing (let loading state handle it)
  if (!profile) {
    return (
      <LayoutBackground showParticles={false} backgroundColor="#004D40">
        <View style={styles.scrollContent} />
      </LayoutBackground>
    );
  }

  return (
    <LayoutBackground
      showParticles={true}
      particleContext="profile"
    >
      <PullToRefresh
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
      >
        {/* Top Navigation Buttons */}
        <View style={styles.headerButtons}>
          {/* History Button (Clock Icon) */}
          <Button
            variant="circle"
            size="icon"
            onPress={() => Alert.alert("History", "Navigation coming soon!")}
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
            onPress={() => Alert.alert("Edit Profile", "Navigation coming soon!")}
          >
            <Svg width={20} height={20} viewBox="0 0 20 20" fill="#374151">
              <Path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </Svg>
          </Button>
        </View>

        {/* Profile Info with carousel */}
        <ProfileInfo
          profile={profile}
          profileImageSrc={profileImageSrc}
          bioContent={bioContent}
          isLoadingProfile={false}
        />

        {/* Nekt Button */}
        <View style={styles.nektButtonContainer}>
          <ExchangeButton />
        </View>

        {/* Sign Out Button */}
        <View style={styles.footer}>
          <SecondaryButton variant="destructive" onPress={handleSignOut}>
            Sign Out
          </SecondaryButton>
        </View>
      </PullToRefresh>
    </LayoutBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16, // Match web px-4 (applies to all children)
    paddingTop: 16, // Additional spacing after safe area
    paddingBottom: 32,
  },
  headerButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 16,
    width: "100%",
    // No horizontal padding - comes from scrollContent
  },
  nektButtonContainer: {
    paddingTop: 16,
    width: "100%",
    // No horizontal padding - comes from scrollContent
  },
  footer: {
    paddingTop: 24,
    alignItems: "center",
    // No horizontal padding - comes from scrollContent
  },
});

export default ProfileView;
