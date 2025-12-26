import React, { useCallback } from "react";
import { View, StyleSheet, Alert, TouchableOpacity } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useNavigation, CommonActions } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { ProfileInfo } from "../ui/modules/ProfileInfo";
import { Button } from "../ui/inputs/Button";
import { ExchangeButton } from "../ui/buttons/ExchangeButton";
import { useSession } from "../../../modules/providers/SessionProvider";
import { useProfile } from "../../../modules/context/ProfileContext";
import { LayoutBackground } from "../ui/layout/LayoutBackground";
import { PullToRefresh } from "../ui/layout/PullToRefresh";

type ProfileViewNavigationProp = NativeStackNavigationProp<RootStackParamList, "Profile">;

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

  return (
    <LayoutBackground
      showParticles={true}
      particleContext="profile"
      backgroundColor="#004D40"
    >
      <PullToRefresh
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
      >
        {/* Top Navigation Buttons */}
        <View style={styles.headerButtons}>
          {/* History Button (Clock Icon) */}
          <TouchableOpacity
            onPress={() => Alert.alert("History", "Navigation coming soon!")}
            style={styles.iconButton}
            activeOpacity={0.8}
          >
            <Svg width={20} height={20} viewBox="0 0 20 20" fill="#374151">
              <Path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              />
            </Svg>
          </TouchableOpacity>

          {/* Edit Button (Pencil Icon) */}
          <TouchableOpacity
            onPress={() => Alert.alert("Edit Profile", "Navigation coming soon!")}
            style={styles.iconButton}
            activeOpacity={0.8}
          >
            <Svg width={20} height={20} viewBox="0 0 20 20" fill="#374151">
              <Path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Profile Info with carousel */}
        <ProfileInfo profile={profile} session={session} />

        {/* Nekt Button */}
        <View style={styles.nektButtonContainer}>
          <ExchangeButton />
        </View>

        {/* Sign Out Button */}
        <View style={styles.footer}>
          <Button variant="ghost" onPress={handleSignOut}>
            Sign Out
          </Button>
        </View>
      </PullToRefresh>
    </LayoutBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingTop: 16, // Additional spacing after safe area
    paddingBottom: 32,
  },
  headerButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    width: "100%",
  },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 28, // Perfect circle (56/2 = 28)
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb", // gray-200
    // Shadow matching web shadow-md
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  nektButtonContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    width: "100%",
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: "center",
  },
});

export default ProfileView;
