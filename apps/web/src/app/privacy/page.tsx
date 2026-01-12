'use client';

import { Heading, Text } from '../components/ui/Typography';

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Heading as="h1" className="text-3xl mb-8 text-center">Privacy Policy</Heading>

      <div className="space-y-6 leading-relaxed">
        <section>
          <Text className="mb-6">
            <strong>Effective Date:</strong> December 8, 2024
          </Text>

          <Text className="mb-4">
            Nekt ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile web application.
          </Text>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Information We Collect</Heading>
          <div className="space-y-3">
            <div>
              <Heading as="h3" className="mb-2">Personal Information</Heading>
              <ul className="list-disc list-inside space-y-1">
                <Text as="span"><li>Name and profile information</li></Text>
                <Text as="span"><li>Phone number</li></Text>
                <Text as="span"><li>Email address (for authentication)</li></Text>
                <Text as="span"><li>Social media usernames you choose to share</li></Text>
                <Text as="span"><li>Profile photos and background images</li></Text>
              </ul>
            </div>

            <div>
              <Heading as="h3" className="mb-2">Technical Information</Heading>
              <ul className="list-disc list-inside space-y-1">
                <Text as="span"><li>Device information and browser type</li></Text>
                <Text as="span"><li>Usage data and app interactions</li></Text>
                <Text as="span"><li>Bluetooth connection data (for contact sharing)</li></Text>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <Heading as="h2" className="mb-4">How We Use Your Information</Heading>
          <ul className="list-disc list-inside space-y-2">
            <Text as="span"><li>To provide and maintain our contact-sharing service</li></Text>
            <Text as="span"><li>To enable you to connect and share information with other users</li></Text>
            <Text as="span"><li>To personalize your profile with AI-generated content</li></Text>
            <Text as="span"><li>To improve our services and user experience</li></Text>
            <Text as="span"><li>To communicate with you about service updates</li></Text>
          </ul>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Information Sharing</Heading>
          <Text className="mb-3">We do not sell, trade, or rent your personal information. We may share information only in these circumstances:</Text>
          <ul className="list-disc list-inside space-y-2">
            <Text as="span"><li>With other users when you choose to share your profile through our app</li></Text>
            <Text as="span"><li>With service providers who help us operate our app (like Firebase/Google)</li></Text>
            <Text as="span"><li>When required by law or to protect our rights and users' safety</li></Text>
            <Text as="span"><li>With your explicit consent</li></Text>
          </ul>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Data Security</Heading>
          <Text>
            We implement appropriate security measures to protect your information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.
          </Text>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Your Rights</Heading>
          <Text className="mb-3">You have the right to:</Text>
          <ul className="list-disc list-inside space-y-2">
            <Text as="span"><li>Access and update your personal information</li></Text>
            <Text as="span"><li>Delete your account and associated data</li></Text>
            <Text as="span"><li>Control what information you share with other users</li></Text>
            <Text as="span"><li>Opt out of non-essential communications</li></Text>
          </ul>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Third-Party Services</Heading>
          <Text className="mb-3">
            Our app uses third-party services including:
          </Text>
          <ul className="list-disc list-inside space-y-1">
            <Text as="span"><li>Google Firebase (data storage and authentication)</li></Text>
            <Text as="span"><li>OpenAI (AI-generated content)</li></Text>
            <Text as="span"><li>NextAuth.js (authentication)</li></Text>
          </ul>
          <Text className="mt-3">
            These services have their own privacy policies that govern their use of your information.
          </Text>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Children's Privacy</Heading>
          <Text>
            Our service is not intended for children under 13. We do not knowingly collect personal information from children under 13.
          </Text>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Changes to This Policy</Heading>
          <Text>
            We may update this Privacy Policy from time to time. We will notify you of any changes by updating the effective date at the top of this policy.
          </Text>
        </section>

        <section>
          <Heading as="h2" className="mb-4">Contact Us</Heading>
          <Text>
            If you have any questions about this Privacy Policy, please contact us through our app or visit our website at <a href="https://nekt.us" className="underline hover:text-gray-300 transition-colors">nekt.us</a>.
          </Text>
        </section>
      </div>
    </div>
  );
}
