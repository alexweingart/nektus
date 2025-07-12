import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy - Nekt.Us',
  description: 'Privacy Policy for Nekt.Us - How we protect your data',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8 text-center">Privacy Policy</h1>
        
        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <p className="text-gray-300 mb-6">
              <strong>Effective Date:</strong> December 8, 2024
            </p>
            
            <p className="mb-4">
              Nekt.Us ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile web application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Information We Collect</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-medium mb-2">Personal Information</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-300">
                  <li>Name and profile information</li>
                  <li>Phone number</li>
                  <li>Email address (for authentication)</li>
                  <li>Social media usernames you choose to share</li>
                  <li>Profile photos and background images</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Technical Information</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-300">
                  <li>Device information and browser type</li>
                  <li>Usage data and app interactions</li>
                  <li>Bluetooth connection data (for contact sharing)</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>To provide and maintain our contact-sharing service</li>
              <li>To enable you to connect and share information with other users</li>
              <li>To personalize your profile with AI-generated content</li>
              <li>To improve our services and user experience</li>
              <li>To communicate with you about service updates</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Information Sharing</h2>
            <p className="mb-3">We do not sell, trade, or rent your personal information. We may share information only in these circumstances:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>With other users when you choose to share your profile through our app</li>
              <li>With service providers who help us operate our app (like Firebase/Google)</li>
              <li>When required by law or to protect our rights and users' safety</li>
              <li>With your explicit consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Data Security</h2>
            <p className="text-gray-300">
              We implement appropriate security measures to protect your information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>Access and update your personal information</li>
              <li>Delete your account and associated data</li>
              <li>Control what information you share with other users</li>
              <li>Opt out of non-essential communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Third-Party Services</h2>
            <p className="text-gray-300 mb-3">
              Our app uses third-party services including:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              <li>Google Firebase (data storage and authentication)</li>
              <li>OpenAI (AI-generated content)</li>
              <li>NextAuth.js (authentication)</li>
            </ul>
            <p className="text-gray-300 mt-3">
              These services have their own privacy policies that govern their use of your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Children's Privacy</h2>
            <p className="text-gray-300">
              Our service is not intended for children under 13. We do not knowingly collect personal information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Changes to This Policy</h2>
            <p className="text-gray-300">
              We may update this Privacy Policy from time to time. We will notify you of any changes by updating the effective date at the top of this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Contact Us</h2>
            <p className="text-gray-300">
              If you have any questions about this Privacy Policy, please contact us through our app or visit our website at nekt.us.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
