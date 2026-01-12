'use client';

import { Heading, Text } from '../components/ui/Typography';
import { Smartphone, CalendarCheck, Users, Sparkles, ArrowRightLeft, LucideIcon } from 'lucide-react';

// Large decorative icon for section breaks
const SectionIcon = ({ icon: Icon }: { icon: LucideIcon }) => (
  <div className="flex justify-center mb-6">
    <div className="p-6 rounded-full bg-white/10 backdrop-blur-sm">
      <Icon className="w-12 h-12 text-white" strokeWidth={1.5} />
    </div>
  </div>
);

// Custom icon showing two phones exchanging info (inline version for cards)
const PhoneExchangeIconInline = () => (
  <div className="flex items-center gap-1">
    <Smartphone className="w-9 h-9 text-white -rotate-12" strokeWidth={2} />
    <ArrowRightLeft className="w-5 h-5 text-white" strokeWidth={2} />
    <Smartphone className="w-9 h-9 text-white rotate-12" strokeWidth={2} />
  </div>
);

// Large section icon showing two phones exchanging info
const PhoneExchangeIcon = () => (
  <div className="flex justify-center mb-6">
    <div className="px-8 py-6 rounded-full bg-white/10 backdrop-blur-sm flex items-center gap-3">
      <Smartphone className="w-10 h-10 text-white -rotate-12" strokeWidth={1.5} />
      <ArrowRightLeft className="w-6 h-6 text-white/70" strokeWidth={2} />
      <Smartphone className="w-10 h-10 text-white rotate-12" strokeWidth={1.5} />
    </div>
  </div>
);

// Feature card component for "How It Works"
const FeatureCard = ({ icon: Icon, customIcon, title, children }: { icon?: LucideIcon; customIcon?: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 p-6 text-center">
    <div className="h-12 flex items-center justify-center mb-4">
      {customIcon ? customIcon : Icon && <Icon className="w-10 h-10 text-white" />}
    </div>
    <Heading as="h3" className="mb-3">{title}</Heading>
    <Text variant="small">{children}</Text>
  </div>
);

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Heading as="h1" className="text-3xl mb-2 text-center">About Nekt</Heading>

      <div className="space-y-10 leading-relaxed">
        <section>
          <Text className="text-lg mb-6 text-center font-medium">
            Turning Conversations into Friendships
          </Text>
          <Text className="mb-4">
            Nekt is all about fostering <strong>real, in-person human connection</strong>. Meeting new people in the modern age is hard—and technology often keeps us in our own worlds instead of bringing us together. Nekt helps you build friendships and professional connections by focusing on two key moments: <strong>exchanging contacts</strong> and <strong>finding time to meet</strong>.
          </Text>
        </section>

        <section>
          <PhoneExchangeIcon />
          <Heading as="h2" className="mb-4 text-center">The Perfect End to a Great First Meeting</Heading>
          <Text className="mb-4">
            You&apos;ve just had an amazing conversation with someone new. You want to keep in touch, but what happens next is often awkward: fumbling with phone numbers, hoping you both have iPhones to bump, searching for their Snapchat, or scanning their LinkedIn QR code. It&apos;s clunky. It kills the moment.
          </Text>
          <Text className="mb-4">
            What if it was easy and fun? What if the end of a great first meeting made you <em>excited</em> to ask them to keep in touch?
          </Text>
          <Text>
            That&apos;s what Nekt does. Simply <strong>bump phones or scan a QR code</strong> to instantly exchange contact information and social profiles—whether personal or professional. <strong>One action, both people connected.</strong>
          </Text>
        </section>

        <section>
          <SectionIcon icon={CalendarCheck} />
          <Heading as="h2" className="mb-4 text-center">From Contact to Connection</Heading>
          <Text className="mb-4">
            Getting someone&apos;s contact information isn&apos;t enough. True friendships and meaningful professional relationships require spending time together. But finding a time and place to meet is surprisingly hard—there&apos;s usually endless back-and-forth to find a good time, and then you need to figure out what to do together.
          </Text>
          <Text className="mb-4">
            What if you could do that instantly?
          </Text>
          <Text>
            Nekt automatically suggests common activities—lunch, dinner, drinks—and finds an <strong>optimal time based on your calendar</strong> and an optimal place based on your location. Want something more specific, like &quot;tennis this weekend&quot;? Just tell Nektbot. Our AI understands exactly what you mean and creates the event for both of you. It will even help you plan something when you don&apos;t have a clear idea of what you want to do.
          </Text>
        </section>

        <section>
          <Heading as="h2" className="mb-6 text-center">How It Works</Heading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              customIcon={<PhoneExchangeIconInline />}
              title="Exchange in Seconds"
            >
              Tap the Nekt button and <strong>bump phones</strong>. Motion sensors detect the bump and <strong>instantly exchange</strong> your contact info and social profiles. No typing, no searching, no awkwardness.
            </FeatureCard>
            <FeatureCard
              icon={CalendarCheck}
              title="Smart Scheduling"
            >
              Connect your calendar and let Nekt find the <strong>perfect time to meet</strong>. Our AI analyzes both schedules to suggest optimal meeting times—no more endless back-and-forth.
            </FeatureCard>
            <FeatureCard
              icon={Users}
              title="Personal & Professional"
            >
              Keep your connections organized. Choose to share personal contact info, professional details, or both—<strong>you&apos;re always in control</strong> of what you share.
            </FeatureCard>
          </div>
        </section>

        <section>
          <SectionIcon icon={Sparkles} />
          <Heading as="h2" className="mb-4 text-center">Our Mission</Heading>
          <Text className="text-center">
            Nekt is about bringing people together and turning promising first conversations into amazing friendships. In a world where our phones often keep us apart, we&apos;re using technology to do what it should: make real human connection easier and just more <strong>fun</strong>.
          </Text>
        </section>

        <section>
          <Heading as="h2" className="mb-4 text-center">Contact Us</Heading>
          <Text className="text-center">
            Have questions or feedback? We&apos;d love to hear from you. Reach out to <a href="mailto:alex@nekt.us" className="underline hover:text-gray-300 transition-colors">alex@nekt.us</a>.
          </Text>
        </section>
      </div>
    </div>
  );
}
