import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LayoutBackground } from "../ui/layout/LayoutBackground";
import { PullToRefresh } from "../ui/layout/PullToRefresh";

export function TermsView() {
  const navigation = useNavigation();

  // No-op refresh for static content (gesture still works for consistency)
  const handleRefresh = useCallback(async () => {
    // Static content - nothing to refresh
  }, []);

  return (
    <LayoutBackground particleContext="signed-out">
      <PullToRefresh
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
      >
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.title}>Terms of Use</Text>

        {/* Content */}
        <View style={styles.content}>
          {/* Effective Date */}
          <View style={styles.section}>
            <Text style={styles.effectiveDate}>
              <Text style={styles.bold}>Effective Date:</Text> December 8, 2024
            </Text>
            <Text style={styles.paragraph}>
              Welcome to Nekt! These Terms of Use ("Terms") govern your use of
              our mobile web application and services. By accessing or using
              Nekt, you agree to be bound by these Terms.
            </Text>
          </View>

          {/* Acceptance of Terms */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Acceptance of Terms</Text>
            <Text style={styles.paragraph}>
              By using Nekt, you confirm that you:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• Are at least 13 years old</Text>
              <Text style={styles.listItem}>• Have the legal capacity to enter into these Terms</Text>
              <Text style={styles.listItem}>• Will comply with all applicable laws and regulations</Text>
              <Text style={styles.listItem}>• Agree to these Terms and our Privacy Policy</Text>
            </View>
          </View>

          {/* Description of Service */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description of Service</Text>
            <Text style={styles.paragraph}>
              Nekt is a contact-sharing application that allows users to
              exchange contact information and social media profiles through
              device proximity (Bluetooth) connections. The service includes
              profile creation, AI-generated content, and contact management
              features.
            </Text>
          </View>

          {/* User Accounts and Responsibilities */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>User Accounts and Responsibilities</Text>
            <Text style={styles.subheading}>Account Creation</Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• You must provide accurate and current information</Text>
              <Text style={styles.listItem}>• You are responsible for maintaining the security of your account</Text>
              <Text style={styles.listItem}>• You must notify us immediately of any unauthorized use</Text>
            </View>
            <Text style={styles.subheading}>Acceptable Use</Text>
            <Text style={styles.paragraph}>You agree not to:</Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• Use the service for any illegal or unauthorized purpose</Text>
              <Text style={styles.listItem}>• Share false, misleading, or inappropriate content</Text>
              <Text style={styles.listItem}>• Harass, abuse, or harm other users</Text>
              <Text style={styles.listItem}>• Attempt to access other users' accounts without permission</Text>
              <Text style={styles.listItem}>• Use automated systems to access the service</Text>
              <Text style={styles.listItem}>• Reverse engineer or attempt to extract the source code</Text>
            </View>
          </View>

          {/* Content and Privacy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Content and Privacy</Text>
            <Text style={styles.subheading}>User Content</Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• You retain ownership of the content you create and share</Text>
              <Text style={styles.listItem}>• You grant us a license to use your content to provide our services</Text>
              <Text style={styles.listItem}>• You are responsible for the accuracy and legality of your content</Text>
            </View>
            <Text style={styles.subheading}>AI-Generated Content</Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• AI-generated profiles, bios, and images are provided as-is</Text>
              <Text style={styles.listItem}>• You may edit or remove AI-generated content at any time</Text>
              <Text style={styles.listItem}>• We are not responsible for the accuracy of AI-generated content</Text>
            </View>
          </View>

          {/* Data Sharing and Connections */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Sharing and Connections</Text>
            <Text style={styles.paragraph}>
              When you use Nekt to connect with other users:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• You choose what information to share with each connection</Text>
              <Text style={styles.listItem}>• Shared information becomes accessible to the recipient</Text>
              <Text style={styles.listItem}>• You are responsible for what you choose to share</Text>
              <Text style={styles.listItem}>• We facilitate connections but do not control how others use shared information</Text>
            </View>
          </View>

          {/* Service Availability */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Availability</Text>
            <Text style={styles.paragraph}>
              We strive to maintain service availability but do not guarantee
              uninterrupted access. We may modify, suspend, or discontinue any
              part of the service at any time with or without notice.
            </Text>
          </View>

          {/* Intellectual Property */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Intellectual Property</Text>
            <Text style={styles.paragraph}>
              The Nekt service, including its design, functionality, and
              underlying technology, is protected by intellectual property laws.
              You may not copy, modify, or distribute our proprietary technology
              without permission.
            </Text>
          </View>

          {/* Disclaimers and Limitations */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Disclaimers and Limitations</Text>
            <Text style={styles.subheading}>Service Disclaimer</Text>
            <Text style={styles.paragraph}>
              The service is provided "as is" without warranties of any kind. We
              do not guarantee that the service will be error-free, secure, or
              available at all times.
            </Text>
            <Text style={styles.subheading}>Limitation of Liability</Text>
            <Text style={styles.paragraph}>
              To the maximum extent permitted by law, we shall not be liable for
              any indirect, incidental, special, or consequential damages
              arising from your use of the service.
            </Text>
          </View>

          {/* Termination */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Termination</Text>
            <Text style={styles.paragraph}>
              Either party may terminate your account:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• You may delete your account at any time through the app</Text>
              <Text style={styles.listItem}>• We may suspend or terminate accounts that violate these Terms</Text>
              <Text style={styles.listItem}>• Upon termination, your right to use the service ceases immediately</Text>
              <Text style={styles.listItem}>• We will handle your data according to our Privacy Policy</Text>
            </View>
          </View>

          {/* Changes to Terms */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Changes to Terms</Text>
            <Text style={styles.paragraph}>
              We may modify these Terms at any time. We will notify users of
              significant changes by updating the effective date. Continued use
              of the service after changes constitutes acceptance of the new
              Terms.
            </Text>
          </View>

          {/* Governing Law */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Governing Law</Text>
            <Text style={styles.paragraph}>
              These Terms are governed by the laws of the jurisdiction where
              Nekt operates, without regard to conflict of law principles.
            </Text>
          </View>

          {/* Contact Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <Text style={styles.paragraph}>
              If you have questions about these Terms, please contact us through
              our app or visit our website at nekt.us.
            </Text>
          </View>

          {/* Acknowledgment */}
          <View style={[styles.section, styles.acknowledgment]}>
            <Text style={styles.acknowledgmentText}>
              By using Nekt, you acknowledge that you have read, understood, and
              agree to be bound by these Terms of Use.
            </Text>
          </View>
        </View>
      </PullToRefresh>
    </LayoutBackground>
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
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
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
    fontSize: 14,
    marginBottom: 8,
  },
  bold: {
    fontWeight: "600",
    color: "#ffffff",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    fontWeight: "500",
    color: "#ffffff",
    marginTop: 8,
    marginBottom: 4,
  },
  paragraph: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    lineHeight: 22,
  },
  list: {
    gap: 4,
    paddingLeft: 8,
  },
  listItem: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    lineHeight: 22,
  },
  acknowledgment: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.2)",
    paddingTop: 16,
    marginTop: 8,
  },
  acknowledgmentText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});

export default TermsView;
