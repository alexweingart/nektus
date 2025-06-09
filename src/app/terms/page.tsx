import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Use - Nekt.Us',
  description: 'Terms of Use for Nekt.Us - Rules and guidelines for using our service',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8 text-center">Terms of Use</h1>
        
        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <p className="text-gray-300 mb-6">
              <strong>Effective Date:</strong> December 8, 2024
            </p>
            
            <p className="mb-4">
              Welcome to Nekt.Us! These Terms of Use ("Terms") govern your use of our mobile web application and services. By accessing or using Nekt.Us, you agree to be bound by these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Acceptance of Terms</h2>
            <p className="text-gray-300 mb-3">
              By using Nekt.Us, you confirm that you:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              <li>Are at least 13 years old</li>
              <li>Have the legal capacity to enter into these Terms</li>
              <li>Will comply with all applicable laws and regulations</li>
              <li>Agree to these Terms and our Privacy Policy</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Description of Service</h2>
            <p className="text-gray-300">
              Nekt.Us is a contact-sharing application that allows users to exchange contact information and social media profiles through device proximity (Bluetooth) connections. The service includes profile creation, AI-generated content, and contact management features.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">User Accounts and Responsibilities</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-medium mb-2">Account Creation</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-300">
                  <li>You must provide accurate and current information</li>
                  <li>You are responsible for maintaining the security of your account</li>
                  <li>You must notify us immediately of any unauthorized use</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Acceptable Use</h3>
                <p className="text-gray-300 mb-2">You agree not to:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-300">
                  <li>Use the service for any illegal or unauthorized purpose</li>
                  <li>Share false, misleading, or inappropriate content</li>
                  <li>Harass, abuse, or harm other users</li>
                  <li>Attempt to access other users' accounts without permission</li>
                  <li>Use automated systems to access the service</li>
                  <li>Reverse engineer or attempt to extract the source code</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Content and Privacy</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-medium mb-2">User Content</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-300">
                  <li>You retain ownership of the content you create and share</li>
                  <li>You grant us a license to use your content to provide our services</li>
                  <li>You are responsible for the accuracy and legality of your content</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">AI-Generated Content</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-300">
                  <li>AI-generated profiles, bios, and images are provided as-is</li>
                  <li>You may edit or remove AI-generated content at any time</li>
                  <li>We are not responsible for the accuracy of AI-generated content</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Data Sharing and Connections</h2>
            <p className="text-gray-300 mb-3">
              When you use Nekt.Us to connect with other users:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>You choose what information to share with each connection</li>
              <li>Shared information becomes accessible to the recipient</li>
              <li>You are responsible for what you choose to share</li>
              <li>We facilitate connections but do not control how others use shared information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Service Availability</h2>
            <p className="text-gray-300">
              We strive to maintain service availability but do not guarantee uninterrupted access. We may modify, suspend, or discontinue any part of the service at any time with or without notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Intellectual Property</h2>
            <p className="text-gray-300">
              The Nekt.Us service, including its design, functionality, and underlying technology, is protected by intellectual property laws. You may not copy, modify, or distribute our proprietary technology without permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Disclaimers and Limitations</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-medium mb-2">Service Disclaimer</h3>
                <p className="text-gray-300">
                  The service is provided "as is" without warranties of any kind. We do not guarantee that the service will be error-free, secure, or available at all times.
                </p>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Limitation of Liability</h3>
                <p className="text-gray-300">
                  To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Termination</h2>
            <p className="text-gray-300 mb-3">
              Either party may terminate your account:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              <li>You may delete your account at any time through the app</li>
              <li>We may suspend or terminate accounts that violate these Terms</li>
              <li>Upon termination, your right to use the service ceases immediately</li>
              <li>We will handle your data according to our Privacy Policy</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Changes to Terms</h2>
            <p className="text-gray-300">
              We may modify these Terms at any time. We will notify users of significant changes by updating the effective date. Continued use of the service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Governing Law</h2>
            <p className="text-gray-300">
              These Terms are governed by the laws of the jurisdiction where Nekt.Us operates, without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
            <p className="text-gray-300">
              If you have questions about these Terms, please contact us through our app or visit our website at nekt.us.
            </p>
          </section>
          
          <section className="pt-4 border-t border-gray-600">
            <p className="text-gray-400 text-xs text-center">
              By using Nekt.Us, you acknowledge that you have read, understood, and agree to be bound by these Terms of Use.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
