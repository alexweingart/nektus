import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSession } from "../../../app/providers/SessionProvider";
import { NektLogo } from "../ui/elements/NektLogo";
import { LayoutBackground } from "../ui/layout/LayoutBackground";
import { Button } from "../ui/buttons/Button";
import AdminBanner, { useAdminModeActivator } from "../ui/banners/AdminBanner";
import type { RootStackParamList } from "../../../../App";

type HomePageNavigationProp = NativeStackNavigationProp<RootStackParamList, "Home">;

// Apple icon (dark logo for white button to match app style)
// Larger than Google (24 vs 18) to account for stem whitespace
const AppleIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="#111827">
    <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </Svg>
);

// Footer component
const HomeFooter = () => {
  const navigation = useNavigation<HomePageNavigationProp>();

  return (
    <View style={styles.footer}>
      <View style={styles.footerLinks}>
        <TouchableOpacity onPress={() => navigation.navigate("Privacy")}>
          <Text style={styles.footerLink}>Privacy</Text>
        </TouchableOpacity>
        <Text style={styles.footerDivider}>|</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Terms")}>
          <Text style={styles.footerLink}>Terms</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.copyright}>© 2025 Nekt, Inc. All rights reserved.</Text>
    </View>
  );
};

export function HomePage() {
  const { signIn, isSigningIn } = useSession();
  const { height } = useWindowDimensions();
  const adminModeProps = useAdminModeActivator();

  // 10vh spacing matching web's pt-[10vh]
  const topSpacing = height * 0.1;

  return (
    <LayoutBackground particleContext="signed-out">
      {/* Main content */}
      <View style={[styles.content, { paddingTop: topSpacing }]}>
        {/* Logo - double-tap to activate admin mode */}
        <TouchableOpacity
          style={styles.logoContainer}
          activeOpacity={1}
          onPress={adminModeProps.onPress}
        >
          <NektLogo width={320} />
        </TouchableOpacity>

        {/* Heading */}
        <Text style={styles.heading}>Conversations → Friendships</Text>

        {/* Subheading */}
        <Text style={styles.subheading}>
          Exchange contacts & socials and schedule meetings in seconds
        </Text>

        {/* Sign in button - white style to match app design */}
        <View style={styles.buttonContainer}>
          <Button
            variant="white"
            size="xl"
            onPress={signIn}
            loading={isSigningIn}
            loadingText="Signing in..."
            disabled={isSigningIn}
            icon={<AppleIcon />}
            style={styles.button}
          >
            Sign in with Apple
          </Button>
        </View>

        {/* Subtext */}
        <Text style={styles.subtext}>to start nekt'ing</Text>
      </View>

      {/* Footer */}
      <HomeFooter />

      {/* Admin Banner - appears when admin mode is activated */}
      <AdminBanner />
    </LayoutBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
  },
  logoContainer: {
    width: "100%",
    maxWidth: 448,
    alignItems: "center",
    marginBottom: 10,
  },
  heading: {
    fontSize: 24,
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 12,
  },
  subheading: {
    fontSize: 18,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 16,
    lineHeight: 26,
  },
  buttonContainer: {
    width: "100%",
    maxWidth: 448,
    marginBottom: 8,
  },
  button: {
    width: "100%",
  },
  subtext: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 4,
    marginBottom: 20,
  },
  footer: {
    paddingBottom: 32,
    alignItems: "center",
  },
  footerLinks: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  footerDivider: {
    fontSize: 14,
    color: "#ffffff",
    marginHorizontal: 12,
  },
  copyright: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
  },
});

export default HomePage;
