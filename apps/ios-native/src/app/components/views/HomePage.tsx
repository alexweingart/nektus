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
import { Button } from "../ui/buttons/Button";
import { textSizes, fontStyles } from "../ui/Typography";
import { ScreenTransition, useNavigateWithFade } from "../ui/layout/ScreenTransition";
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
const HomeFooter = ({ navigateWithFade }: { navigateWithFade: (screen: keyof RootStackParamList) => void }) => {
  return (
    <View style={styles.footer}>
      <View style={styles.footerLinks}>
        <TouchableOpacity onPress={() => navigateWithFade("Privacy")}>
          <Text style={styles.footerLink}>Privacy</Text>
        </TouchableOpacity>
        <Text style={styles.footerDivider}>|</Text>
        <TouchableOpacity onPress={() => navigateWithFade("Terms")}>
          <Text style={styles.footerLink}>Terms</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.copyright}>© 2026 Nekt, Inc.</Text>
    </View>
  );
};

export function HomePage() {
  const { signIn, isSigningIn } = useSession();
  const navigateWithFade = useNavigateWithFade();
  const { width, height } = useWindowDimensions();

  // 10vh spacing matching web's pt-[10vh]
  const topSpacing = height * 0.1;

  // Calculate logo width to match button width (full width minus padding, capped at 448)
  const logoWidth = Math.min(width - 32, 448);

  return (
    <ScreenTransition>
      {/* Main content */}
      <View style={[styles.content, { paddingTop: topSpacing }]}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <NektLogo width={logoWidth} />
        </View>

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
      <HomeFooter navigateWithFade={navigateWithFade} />
    </ScreenTransition>
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
    ...textSizes.xxl,
    ...fontStyles.bold,
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 12,
  },
  subheading: {
    ...textSizes.lg,
    ...fontStyles.regular,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 16,
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
    ...textSizes.sm,
    ...fontStyles.regular,
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
    ...textSizes.sm,
    ...fontStyles.bold,
    color: "#ffffff",
  },
  footerDivider: {
    ...textSizes.sm,
    ...fontStyles.regular,
    color: "#ffffff",
    marginHorizontal: 12,
  },
  copyright: {
    ...textSizes.xs,
    ...fontStyles.regular,
    color: "rgba(255, 255, 255, 0.6)",
  },
});

export default HomePage;
