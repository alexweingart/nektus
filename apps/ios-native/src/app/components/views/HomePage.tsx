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
import type { RootStackParamList } from "../../../../App";

type HomePageNavigationProp = NativeStackNavigationProp<RootStackParamList, "Home">;

// Google icon matching web version
const GoogleIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 48 48" fill="none">
    <Path
      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12 0-6.627 5.373-12 12-12 3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24c0 11.045 8.955 20 20 20 11.045 0 20-8.955 20-20 0-1.341-.138-2.65-.389-3.917z"
      fill="#FFC107"
    />
    <Path
      d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      fill="#FF3D00"
    />
    <Path
      d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      fill="#4CAF50"
    />
    <Path
      d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      fill="#1976D2"
    />
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

  // 10vh spacing matching web's pt-[10vh]
  const topSpacing = height * 0.1;

  return (
    <LayoutBackground particleContext="signed-out">
      {/* Main content */}
      <View style={[styles.content, { paddingTop: topSpacing }]}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <NektLogo width={320} />
        </View>

        {/* Heading */}
        <Text style={styles.heading}>Conversations → Friendships</Text>

        {/* Subheading */}
        <Text style={styles.subheading}>
          Exchange contacts & socials and schedule meetings in seconds
        </Text>

        {/* Sign in button - xl size matching web */}
        <View style={styles.buttonContainer}>
          <Button
            variant="white"
            size="xl"
            onPress={signIn}
            loading={isSigningIn}
            disabled={isSigningIn}
            icon={<GoogleIcon />}
            style={styles.button}
          >
            Sign in with Google
          </Button>
        </View>

        {/* Subtext */}
        <Text style={styles.subtext}>to start nekt'ing</Text>
      </View>

      {/* Footer */}
      <HomeFooter />
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
