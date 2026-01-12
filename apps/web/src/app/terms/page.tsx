'use client';

import { Heading, Text } from '../components/ui/Typography';

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Heading as="h1" className="text-3xl mb-8 text-center">Terms of Use</Heading>

      <div className="space-y-6 leading-relaxed">
        <section>
          <Text className="mb-6">
            <strong>Effective Date:</strong> December 8, 2024
          </Text>

          <Text className="mb-4">
            Welcome to Nekt! These Terms of Use (&quot;Terms&quot;) govern your use of our mobile web application and services. By accessing or using Nekt, you agree to be bound by these Terms.
          </Text>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Acceptance of Terms</Heading>
          <Text className="mb-3">
            By using Nekt, you confirm that you:
          </Text>
          <ul className="list-disc list-inside space-y-1">
            <Text as="span"><li>Are at least 13 years old</li></Text>
            <Text as="span"><li>Have the legal capacity to enter into these Terms</li></Text>
            <Text as="span"><li>Will comply with all applicable laws and regulations</li></Text>
            <Text as="span"><li>Agree to these Terms and our Privacy Policy</li></Text>
          </ul>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Description of Service</Heading>
          <Text>
            Nekt is a contact-sharing application that allows users to exchange contact information and social media profiles through device proximity (Bluetooth) connections. The service includes profile creation, AI-generated content, and contact management features.
          </Text>
        </section>

        <section>
          <Heading as="h2" className="mb-4">User Accounts and Responsibilities</Heading>
          <div className="space-y-3">
            <div>
              <Heading as="h3" className="mb-2">Account Creation</Heading>
              <ul className="list-disc list-inside space-y-1">
                <Text as="span"><li>You must provide accurate and current information</li></Text>
                <Text as="span"><li>You are responsible for maintaining the security of your account</li></Text>
                <Text as="span"><li>You must notify us immediately of any unauthorized use</li></Text>
              </ul>
            </div>

            <div>
              <Heading as="h3" className="mb-2">Acceptable Use</Heading>
              <Text className="mb-2">You agree not to:</Text>
              <ul className="list-disc list-inside space-y-1">
                <Text as="span"><li>Use the service for any illegal or unauthorized purpose</li></Text>
                <Text as="span"><li>Share false, misleading, or inappropriate content</li></Text>
                <Text as="span"><li>Harass, abuse, or harm other users</li></Text>
                <Text as="span"><li>Attempt to access other users&apos; accounts without permission</li></Text>
                <Text as="span"><li>Use automated systems to access the service</li></Text>
                <Text as="span"><li>Reverse engineer or attempt to extract the source code</li></Text>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Content and Privacy</Heading>
          <div className="space-y-3">
            <div>
              <Heading as="h3" className="mb-2">User Content</Heading>
              <ul className="list-disc list-inside space-y-1">
                <Text as="span"><li>You retain ownership of the content you create and share</li></Text>
                <Text as="span"><li>You grant us a license to use your content to provide our services</li></Text>
                <Text as="span"><li>You are responsible for the accuracy and legality of your content</li></Text>
              </ul>
            </div>

            <div>
              <Heading as="h3" className="mb-2">AI-Generated Content</Heading>
              <ul className="list-disc list-inside space-y-1">
                <Text as="span"><li>AI-generated profiles, bios, and images are provided as-is</li></Text>
                <Text as="span"><li>You may edit or remove AI-generated content at any time</li></Text>
                <Text as="span"><li>We are not responsible for the accuracy of AI-generated content</li></Text>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Data Sharing and Connections</Heading>
          <Text className="mb-3">
            When you use Nekt to connect with other users:
          </Text>
          <ul className="list-disc list-inside space-y-2">
            <Text as="span"><li>You choose what information to share with each connection</li></Text>
            <Text as="span"><li>Shared information becomes accessible to the recipient</li></Text>
            <Text as="span"><li>You are responsible for what you choose to share</li></Text>
            <Text as="span"><li>We facilitate connections but do not control how others use shared information</li></Text>
          </ul>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Service Availability</Heading>
          <Text>
            We strive to maintain service availability but do not guarantee uninterrupted access. We may modify, suspend, or discontinue any part of the service at any time with or without notice.
          </Text>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Intellectual Property</Heading>
          <Text>
            The Nekt service, including its design, functionality, and underlying technology, is protected by intellectual property laws. You may not copy, modify, or distribute our proprietary technology without permission.
          </Text>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Disclaimers and Limitations</Heading>
          <div className="space-y-3">
            <div>
              <Heading as="h3" className="mb-2">Service Disclaimer</Heading>
              <Text>
                The service is provided &quot;as is&quot; without warranties of any kind. We do not guarantee that the service will be error-free, secure, or available at all times.
              </Text>
            </div>

            <div>
              <Heading as="h3" className="mb-2">Limitation of Liability</Heading>
              <Text>
                To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service.
              </Text>
            </div>
          </div>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Termination</Heading>
          <Text className="mb-3">
            Either party may terminate your account:
          </Text>
          <ul className="list-disc list-inside space-y-1">
            <Text as="span"><li>You may delete your account at any time through the app</li></Text>
            <Text as="span"><li>We may suspend or terminate accounts that violate these Terms</li></Text>
            <Text as="span"><li>Upon termination, your right to use the service ceases immediately</li></Text>
            <Text as="span"><li>We will handle your data according to our Privacy Policy</li></Text>
          </ul>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Changes to Terms</Heading>
          <Text>
            We may modify these Terms at any time. We will notify users of significant changes by updating the effective date. Continued use of the service after changes constitutes acceptance of the new Terms.
          </Text>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Governing Law</Heading>
          <Text>
            These Terms are governed by the laws of the jurisdiction where Nekt operates, without regard to conflict of law principles.
          </Text>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Contact Information</Heading>
          <Text>
            If you have questions about these Terms, please contact us through our app or visit our website at <a href="https://nekt.us" className="underline hover:text-gray-300 transition-colors">nekt.us</a>.
          </Text>
        </section>

        <section className="pt-4 border-t border-gray-600">
          <Text variant="small" className="text-center opacity-70">
            By using Nekt, you acknowledge that you have read, understood, and agree to be bound by these Terms of Use.
          </Text>
        </section>
      </div>
    </div>
  );
}
