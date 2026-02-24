import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { PullToRefresh } from "../ui/layout/PullToRefresh";
import { textSizes, fontStyles } from "../ui/Typography";
import { ScreenTransition, useGoBackWithFade } from "../ui/layout/ScreenTransition";

export function PrivacyView() {
  const navigation = useNavigation();
  const goBackWithFade = useGoBackWithFade();

  // No-op refresh for static content (gesture still works for consistency)
  const handleRefresh = useCallback(async () => {
    // Static content - nothing to refresh
  }, []);

  return (
    <ScreenTransition>
      <PullToRefresh
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
      >
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBackWithFade()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.title}>Privacy Policy</Text>

        {/* Content */}
        <View style={styles.content}>
          {/* Effective Date */}
          <View style={styles.section}>
            <Text style={styles.effectiveDate}>
              <Text style={styles.bold}>Effective Date:</Text> December 8, 2024
            </Text>
            <Text style={styles.paragraph}>
              Nekt ("we," "our," or "us") is committed to protecting your
              privacy. This Privacy Policy explains how we collect, use, and
              safeguard your information when you use our mobile web
              application.
            </Text>
          </View>

          {/* Information We Collect */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Information We Collect</Text>
            <Text style={styles.subheading}>Personal Information</Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• Name and profile information</Text>
              <Text style={styles.listItem}>• Phone number</Text>
              <Text style={styles.listItem}>• Email address (for authentication)</Text>
              <Text style={styles.listItem}>• Social media usernames you choose to share</Text>
              <Text style={styles.listItem}>• Profile photos and background images</Text>
            </View>
            <Text style={styles.subheading}>Technical Information</Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• Device information and browser type</Text>
              <Text style={styles.listItem}>• Usage data and app interactions</Text>
              <Text style={styles.listItem}>• Bluetooth connection data (for contact sharing)</Text>
            </View>
          </View>

          {/* How We Use Your Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How We Use Your Information</Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• To provide and maintain our contact-sharing service</Text>
              <Text style={styles.listItem}>• To enable you to connect and share information with other users</Text>
              <Text style={styles.listItem}>• To personalize your profile with AI-generated content</Text>
              <Text style={styles.listItem}>• To improve our services and user experience</Text>
              <Text style={styles.listItem}>• To communicate with you about service updates</Text>
            </View>
          </View>

          {/* Information Sharing */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Information Sharing</Text>
            <Text style={styles.paragraph}>
              We do not sell, trade, or rent your personal information. We may
              share information only in these circumstances:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• With other users when you choose to share your profile through our app</Text>
              <Text style={styles.listItem}>• With service providers who help us operate our app (like Firebase/Google)</Text>
              <Text style={styles.listItem}>• When required by law or to protect our rights and users' safety</Text>
              <Text style={styles.listItem}>• With your explicit consent</Text>
            </View>
          </View>

          {/* Data Security */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Security</Text>
            <Text style={styles.paragraph}>
              We implement appropriate security measures to protect your
              information against unauthorized access, alteration, disclosure,
              or destruction. However, no method of transmission over the
              internet is 100% secure.
            </Text>
          </View>

          {/* Your Rights */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Rights</Text>
            <Text style={styles.paragraph}>You have the right to:</Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• Access and update your personal information</Text>
              <Text style={styles.listItem}>• Delete your account and associated data</Text>
              <Text style={styles.listItem}>• Control what information you share with other users</Text>
              <Text style={styles.listItem}>• Opt out of non-essential communications</Text>
            </View>
          </View>

          {/* Third-Party Services */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Third-Party Services</Text>
            <Text style={styles.paragraph}>
              Our app uses third-party services including:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• Google Firebase (data storage and authentication)</Text>
              <Text style={styles.listItem}>• OpenAI (AI-generated content)</Text>
              <Text style={styles.listItem}>• NextAuth.js (authentication)</Text>
            </View>
            <Text style={styles.paragraph}>
              These services have their own privacy policies that govern their
              use of your information.
            </Text>
          </View>

          {/* Children's Privacy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Children's Privacy</Text>
            <Text style={styles.paragraph}>
              Our service is not intended for children under 13. We do not
              knowingly collect personal information from children under 13.
            </Text>
          </View>

          {/* Changes to This Policy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Changes to This Policy</Text>
            <Text style={styles.paragraph}>
              We may update this Privacy Policy from time to time. We will
              notify you of any changes by updating the effective date at the
              top of this policy.
            </Text>
          </View>

          {/* Contact Us */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Us</Text>
            <Text style={styles.paragraph}>
              If you have any questions about this Privacy Policy, please
              contact us through our app or visit our website at nekt.us.
            </Text>
          </View>
        </View>
      </PullToRefresh>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    color: "#ffffff",
    ...textSizes.base,
    ...fontStyles.bold,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    ...fontStyles.bold,
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 24,
  },
  content: {
    gap: 20,
  },
  section: {
    gap: 8,
  },
  effectiveDate: {
    color: "rgba(255, 255, 255, 0.7)",
    ...textSizes.sm,
    ...fontStyles.regular,
    marginBottom: 8,
  },
  bold: {
    ...fontStyles.bold,
    color: "#ffffff",
  },
  sectionTitle: {
    ...textSizes.lg,
    ...fontStyles.bold,
    color: "#ffffff",
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    lineHeight: 24,
    ...fontStyles.regular,
    color: "#ffffff",
    marginTop: 8,
    marginBottom: 4,
  },
  paragraph: {
    color: "rgba(255, 255, 255, 0.7)",
    ...textSizes.sm,
    ...fontStyles.regular,
  },
  list: {
    gap: 4,
    paddingLeft: 8,
  },
  listItem: {
    color: "rgba(255, 255, 255, 0.7)",
    ...textSizes.sm,
    ...fontStyles.regular,
  },
});

export default PrivacyView;
