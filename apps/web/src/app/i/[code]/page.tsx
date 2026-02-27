'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/client/config/firebase';
import { auth } from '@/client/config/firebase';
import { Button } from '@/app/components/ui/buttons/Button';
import { SecondaryButton } from '@/app/components/ui/buttons/SecondaryButton';
import { Heading, Text } from '@/app/components/ui/Typography';
import { AddCalendarModal } from '@/app/components/ui/modals/AddCalendarModal';
import { useProfile } from '@/app/context/ProfileContext';

interface InviteData {
  calendarEventId: string;
  calendarProvider: string;
  organizerId: string;
  attendeeId: string;
  eventDetails: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    location: string;
    locationAddress: string;
    timeZone: string;
  };
  addedToRecipient: boolean;
  createdAt: unknown;
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const { data: session, status: sessionStatus } = useSession();
  const { profile } = useProfile();

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [addingEmail, setAddingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [patching, setPatching] = useState(false);

  // Load invite data
  useEffect(() => {
    async function loadInvite() {
      try {
        const inviteDoc = await getDoc(doc(db!, 'invites', code));
        if (!inviteDoc.exists()) {
          setError('Invite not found');
          setLoading(false);
          return;
        }
        setInvite(inviteDoc.data() as InviteData);
      } catch (err) {
        console.error('[InvitePage] Failed to load invite:', err);
        setError('Failed to load invite');
      } finally {
        setLoading(false);
      }
    }

    if (code) loadInvite();
  }, [code]);

  const isSignedIn = sessionStatus === 'authenticated' && session?.user;

  // PATCH organizer's event to add attendee email
  const patchEventWithEmail = async (email: string) => {
    setPatching(true);
    try {
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated');

      const response = await fetch('/api/scheduling/invite-accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          inviteCode: code,
          attendeeEmail: email,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add you to the event');
      }

      // Refresh invite data
      const inviteDoc = await getDoc(doc(db!, 'invites', code));
      if (inviteDoc.exists()) {
        setInvite(inviteDoc.data() as InviteData);
      }
    } catch (err) {
      console.error('[InvitePage] Patch failed:', err);
    } finally {
      setPatching(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-white/50">Loading...</div>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <Heading as="h2">{error || 'Invite not found'}</Heading>
          <div className="mt-4">
            <SecondaryButton onClick={() => router.push('/')}>Go Home</SecondaryButton>
          </div>
        </div>
      </div>
    );
  }

  const { eventDetails, addedToRecipient } = invite;
  const startDate = new Date(eventDetails.startTime);
  const endDate = new Date(eventDetails.endTime);

  const dateStr = startDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: eventDetails.timeZone,
  });
  const startTimeStr = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: eventDetails.timeZone,
  });
  const endTimeStr = endDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: eventDetails.timeZone,
  });

  // Signed out: minimal info
  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-6">
          <Heading as="h1">{eventDetails.title}</Heading>
          <Text variant="small" className="text-gray-400">
            You&apos;ve been invited to an event. Sign in to see the details and accept.
          </Text>
          <Button
            variant="white"
            size="xl"
            className="w-full"
            onClick={() => router.push(`/auth/signin?callbackUrl=/i/${code}`)}
          >
            Sign in to see details
          </Button>
        </div>
      </div>
    );
  }

  // Signed in: full experience
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Event Details Card */}
        <div className="p-6 bg-black/60 border border-white/10 rounded-2xl glass-tinted space-y-4">
          <Heading as="h2">{eventDetails.title}</Heading>

          <div className="space-y-2">
            <Text variant="small" className="text-gray-300">
              {dateStr}
            </Text>
            <Text variant="small" className="text-gray-300">
              {startTimeStr} - {endTimeStr}
            </Text>
            {eventDetails.location && (
              <Text variant="small" className="text-gray-300">
                {eventDetails.location}
              </Text>
            )}
          </div>
        </div>

        {/* Actions */}
        {addedToRecipient ? (
          // Path A: native invite already sent
          <div className="space-y-3">
            <Text variant="small" className="text-center text-gray-400">
              A calendar invite has been sent to your email.
            </Text>
            {!profile?.calendars?.length && (
              <Button
                variant="white"
                size="xl"
                className="w-full"
                onClick={() => setShowCalendarModal(true)}
              >
                Link Calendar
              </Button>
            )}
          </div>
        ) : (
          // Path B: organizer-only event, need to add attendee
          <div className="space-y-3">
            <Button
              variant="white"
              size="xl"
              className="w-full"
              onClick={() => setShowCalendarModal(true)}
            >
              Link Calendar
            </Button>
            <Text variant="small" className="text-center text-gray-500">or</Text>
            {!addingEmail ? (
              <SecondaryButton
                variant="subtle"
                onClick={() => setAddingEmail(true)}
                className="w-full"
              >
                Add Email Instead
              </SecondaryButton>
            ) : (
              <div className="space-y-2">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
                />
                <Button
                  variant="white"
                  size="md"
                  className="w-full"
                  disabled={!emailInput || patching}
                  onClick={() => patchEventWithEmail(emailInput)}
                >
                  {patching ? 'Adding...' : 'Add to Event'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Calendar Link Modal */}
        {showCalendarModal && (
          <AddCalendarModal
            isOpen={showCalendarModal}
            onClose={() => setShowCalendarModal(false)}
            onCalendarAdded={() => setShowCalendarModal(false)}
            userEmail={session.user.email || ''}
            section="personal"
            redirectTo={`/i/${code}`}
          />
        )}

        {/* Nekt branding */}
        <div className="text-center">
          <Text variant="small" className="text-gray-600">
            Scheduled via <a href="https://nekt.us" className="text-[#71E454] hover:underline">Nekt</a>
          </Text>
        </div>
      </div>
    </div>
  );
}
