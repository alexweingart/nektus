import React, { useState, useRef } from "react";
import {
  View,
  Animated,
  PanResponder,
  StyleSheet,
  Dimensions,
} from "react-native";
// TODO: Uncomment after rebuild - import { BlurView } from "@react-native-community/blur";
import Svg, { Path } from "react-native-svg";
import { Avatar } from "../elements/Avatar";
import { Heading, BodyText } from "../elements/Typography";
import { ProfileViewSelector } from "../controls/ProfileViewSelector";
import { SocialIconsList } from "./SocialIconsList";
import type { UserProfile } from "../../../../app/context/ProfileContext";
import type { Session } from "../../../../app/providers/SessionProvider";

type ViewMode = "personal" | "work";

interface ProfileInfoProps {
  profile: UserProfile | null;
  session: Session | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = 50;
const CONTAINER_PADDING = 24; // paddingHorizontal from container
const CARD_WIDTH = SCREEN_WIDTH - (CONTAINER_PADDING * 2); // Account for padding

export function ProfileInfo({ profile, session }: ProfileInfoProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("personal");
  const translateX = useRef(new Animated.Value(0)).current;

  // Get the name from profile or session
  const name =
    profile?.contactEntries?.find((e) => e.fieldType === "name")?.value ||
    session?.user?.name ||
    "User";

  // Get bio (with placeholder fallback like web)
  const profileBio = profile?.contactEntries?.find(
    (e) => e.fieldType === "bio" && e.isVisible
  )?.value;
  const bio = profileBio || "My bio is going to be awesome once I create it.";

  // Filter contact entries by section
  const getFilteredEntries = (mode: ViewMode) => {
    if (!profile?.contactEntries) return [];
    return profile.contactEntries.filter(
      (e) => e.section === mode || e.section === "universal"
    );
  };

  // Get locations from profile
  const personalLocation = profile?.locations?.find(loc => loc.section === "personal");
  const workLocation = profile?.locations?.find(loc => loc.section === "work");

  // Filter entries by section
  const personalEntries = getFilteredEntries("personal");
  const workEntries = getFilteredEntries("work");

  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Limit the swipe distance
        const limitedDx = Math.max(
          Math.min(gestureState.dx, CARD_WIDTH / 2),
          -CARD_WIDTH / 2
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

  return (
    <View style={styles.container}>
      {/* 1. Avatar - OUTSIDE the box, centered */}
      <View style={styles.avatarWrapper}>
        <View style={styles.avatarContainer}>
          <Avatar
            src={profile?.profileImage}
            alt={name}
            size="lg"
            isLoading={!profile}
          />
        </View>
      </View>

      {/* 2. Frosted glass box */}
      <View style={styles.cardContainer}>
        {/* TODO: Uncomment BlurView after rebuild */}
        {/* <BlurView
          style={StyleSheet.absoluteFill}
          blurType="dark"
          blurAmount={10}
          reducedTransparencyFallbackColor="rgba(0, 0, 0, 0.6)"
        /> */}

        {/* Swipeable content with PanResponder */}
        <Animated.View
          style={[
            styles.swipeableContent,
            {
              transform: [{ translateX }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Personal View */}
          <View style={styles.viewContent}>
            {/* Name */}
            <Heading style={styles.name}>{name}</Heading>

            {/* Location with SVG pin icon */}
            {personalLocation && (
              <View style={styles.locationRow}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={2}>
                  <Path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <Path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </Svg>
                <BodyText style={styles.locationText}>
                  {personalLocation.city}, {personalLocation.region}
                </BodyText>
              </View>
            )}

            {/* Bio (always shown with placeholder fallback) */}
            <BodyText style={styles.bio}>{bio}</BodyText>

            {/* Social Icons */}
            <SocialIconsList contactEntries={personalEntries} />
          </View>

          {/* Work View */}
          <View style={styles.viewContent}>
            {/* Name */}
            <Heading style={styles.name}>{name}</Heading>

            {/* Location with SVG pin icon */}
            {workLocation && (
              <View style={styles.locationRow}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={2}>
                  <Path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <Path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </Svg>
                <BodyText style={styles.locationText}>
                  {workLocation.city}, {workLocation.region}
                </BodyText>
              </View>
            )}

            {/* Bio (always shown with placeholder fallback) */}
            <BodyText style={styles.bio}>{bio}</BodyText>

            {/* Social Icons */}
            <SocialIconsList contactEntries={workEntries} />
          </View>
        </Animated.View>

        {/* View Selector - AT BOTTOM, INSIDE BOX */}
        <View style={styles.selectorWrapper}>
          <ProfileViewSelector
            selected={viewMode}
            onSelect={setViewMode}
            tintColor={profile?.backgroundColors?.[2]} // Use accent2 color (matches web)
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: 24,
    width: "100%",
  },
  avatarWrapper: {
    marginBottom: 16,
    alignItems: "center",
    width: "100%",
  },
  avatarContainer: {
    alignSelf: "center",
    borderWidth: 4,
    borderColor: "#ffffff",
    borderRadius: 68,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardContainer: {
    width: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.6)", // Fallback
    borderRadius: 16, // rounded-2xl
    overflow: "hidden",
    paddingBottom: 16,
  },
  swipeableContent: {
    flexDirection: "row",
    width: CARD_WIDTH * 2, // Two views side by side (accounting for container padding)
  },
  viewContent: {
    width: CARD_WIDTH, // Each view takes card width (not full screen)
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: "center",
  },
  name: {
    textAlign: "center",
    marginBottom: 12,
    width: "100%", // Ensure full width for proper centering
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  locationText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
  },
  bio: {
    textAlign: "center",
    marginBottom: 16, // mb-4 (match web)
    paddingHorizontal: 16,
    color: "#ffffff",
    fontSize: 14, // text-sm (match web variant="small")
    lineHeight: 22, // leading-relaxed (~1.57)
  },
  selectorWrapper: {
    alignItems: "center",
    paddingHorizontal: 24,
    marginTop: 16,
  },
});

export default ProfileInfo;
