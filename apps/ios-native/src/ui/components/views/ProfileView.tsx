import React, { useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { ProfileInfo } from "../ui/modules/ProfileInfo";
import { Button } from "../ui/inputs/Button";
import { useSession } from "../../../modules/providers/SessionProvider";
import { useProfile } from "../../../modules/context/ProfileContext";
import { LayoutBackground } from "../ui/layout/LayoutBackground";
import { PullToRefresh } from "../ui/layout/PullToRefresh";

export function ProfileView() {
  const { data: session, signOut } = useSession();
  const { profile, refreshProfile } = useProfile();

  const handleSignOut = async () => {
    try {
      await signOut();
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
    <LayoutBackground showParticles={false} backgroundColor="#004D40">
      <PullToRefresh
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
      >
        {/* Profile Info with carousel */}
        <ProfileInfo profile={profile} session={session} />

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
  footer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: "center",
  },
});

export default ProfileView;
