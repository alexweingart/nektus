import React, { useState, useRef } from "react";
import {
  View,
  Animated,
  PanResponder,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Avatar } from "../elements/Avatar";
import { Heading, BodyText } from "../elements/Typography";
import { ProfileViewSelector } from "../controls/ProfileViewSelector";
import { SocialIconsList } from "./SocialIconsList";
import type { UserProfile } from "../../../../modules/context/ProfileContext";
import type { Session } from "../../../../modules/providers/SessionProvider";

type ViewMode = "personal" | "work";

interface ProfileInfoProps {
  profile: UserProfile | null;
  session: Session | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = 50;

export function ProfileInfo({ profile, session }: ProfileInfoProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("personal");
  const translateX = useRef(new Animated.Value(0)).current;

  // Get the name from profile or session
  const name =
    profile?.contactEntries?.find((e) => e.fieldType === "name")?.value ||
    session?.user?.name ||
    "User";

  // Get bio
  const bio = profile?.contactEntries?.find(
    (e) => e.fieldType === "bio"
  )?.value;

  // Filter contact entries by section
  const getFilteredEntries = (mode: ViewMode) => {
    if (!profile?.contactEntries) return [];
    return profile.contactEntries.filter(
      (e) => e.section === mode || e.section === "universal"
    );
  };

  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Limit the swipe distance
        const limitedDx = Math.max(
          Math.min(gestureState.dx, SCREEN_WIDTH / 2),
          -SCREEN_WIDTH / 2
        );
        translateX.setValue(limitedDx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD && viewMode === "personal") {
          // Swipe left: go to work
          setViewMode("work");
        } else if (gestureState.dx > SWIPE_THRESHOLD && viewMode === "work") {
          // Swipe right: go to personal
          setViewMode("personal");
        }
        // Animate back to center
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 9,
        }).start();
      },
    })
  ).current;

  const filteredEntries = getFilteredEntries(viewMode);

  return (
    <View style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Avatar
            src={profile?.profileImage}
            alt={name}
            size="lg"
            isLoading={!profile}
          />
        </View>
        <Heading>{name}</Heading>
        {bio && <BodyText style={styles.bio}>{bio}</BodyText>}
      </View>

      {/* View Mode Selector */}
      <ProfileViewSelector selected={viewMode} onSelect={setViewMode} />

      {/* Swipeable Content */}
      <Animated.View
        style={[
          styles.content,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <SocialIconsList contactEntries={filteredEntries} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatarContainer: {
    borderWidth: 4,
    borderColor: "#ffffff",
    borderRadius: 68,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 16,
  },
  bio: {
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 16,
    color: "#aaa",
  },
  content: {
    flex: 1,
    width: "100%",
  },
});

export default ProfileInfo;
