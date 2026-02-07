'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getEventTemplate, getEventTimeFromSlotWithBuffer } from '@/server/calendar/event-templates';
import { getSuggestedTimes } from '@/server/calendar/scheduling';
import { composeAndOpenCalendarEvent } from '@/server/calendar/events';
import { formatSmartDay } from '@/server/calendar/time';
import { fetchPlacesForChips } from '@/server/places/helpers';
import type { UserProfile, TimeSlot, SuggestionChip } from '@/types/profile';
import type { Place } from '@/types/places';
import { ItemChip } from '@/app/components/ui/modules/ItemChip';
import { Button } from '@/app/components/ui/buttons/Button';
import { useProfile } from '@/app/context/ProfileContext';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import { auth } from '@/client/config/firebase';

const PERSONAL_SUGGESTION_CHIPS: SuggestionChip[] = [
  { id: 'chip-1', eventId: 'video-30', icon: 'telephone-classic' },
  { id: 'chip-2', eventId: 'coffee-30', icon: 'coffee-simple' },
  { id: 'chip-3', eventId: 'lunch-60', icon: 'burger' },
  { id: 'chip-4', eventId: 'dinner-60', icon: 'utensils' },
  { id: 'chip-5', eventId: 'drinks-60', icon: 'drinks' },
];

const WORK_SUGGESTION_CHIPS: SuggestionChip[] = [
  { id: 'chip-1', eventId: 'quick-sync-30', icon: 'lightning-charge' },
  { id: 'chip-2', eventId: 'coffee-30', icon: 'coffee-simple' },
  { id: 'chip-3', eventId: 'deep-dive-60', icon: 'search' },
  { id: 'chip-4', eventId: 'live-working-session-60', icon: 'people' },
  { id: 'chip-5', eventId: 'lunch-60', icon: 'burger' },
];

export default function SmartScheduleView() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { profile: currentUserProfile, getContact, getContacts, loadContacts } = useProfile();
  const [contactProfile, setContactProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<'personal' | 'work'>('personal');

  // Get 'from' query parameter to determine where to navigate back to
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const fromParam = searchParams.get('from');

  // Determine which chips to use based on section
  const SUGGESTION_CHIPS = section === 'work' ? WORK_SUGGESTION_CHIPS : PERSONAL_SUGGESTION_CHIPS;

  // State
  const [suggestedTimes, setSuggestedTimes] = useState<Record<string, TimeSlot | null>>({});
  const [chipPlaces, setChipPlaces] = useState<Record<string, Place | null>>({});
  const [loadingTimes, setLoadingTimes] = useState(false);

  // Handle background crossfade when entering from HistoryView
  useEffect(() => {
    const isEnteringFromHistory = sessionStorage.getItem('entering-from-history-to-schedule');
    const historyBackground = sessionStorage.getItem('history-background-url');

    if (isEnteringFromHistory === 'true') {
      console.log('🎯 SmartScheduleView: Detected entrance from HistoryView, setting up background crossfade');

      // Clear the flag
      sessionStorage.removeItem('entering-from-history-to-schedule');

      // If we have a history background and contact background, set up crossfade
      if (historyBackground && contactProfile?.backgroundImage) {
        console.log('🎯 SmartScheduleView: Setting up background crossfade');

        // Create style for history background that will fade out
        const historyBgStyle = document.createElement('style');
        historyBgStyle.id = 'history-background-fadeout';
        historyBgStyle.textContent = `
          body::after {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: url('${historyBackground}');
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            z-index: 10000;
            opacity: 1;
            transition: opacity 300ms ease-out;
            pointer-events: none;
          }
          body.fade-out-history-bg::after {
            opacity: 0;
          }
        `;
        document.head.appendChild(historyBgStyle);

        // Trigger fade out
        requestAnimationFrame(() => {
          document.body.classList.add('fade-out-history-bg');
        });

        // Clean up after animation
        setTimeout(() => {
          document.body.classList.remove('fade-out-history-bg');
          const style = document.getElementById('history-background-fadeout');
          if (style) {
            style.remove();
          }
          sessionStorage.removeItem('history-background-url');
        }, 300);
      } else {
        sessionStorage.removeItem('history-background-url');
      }
    }
  }, [contactProfile?.backgroundImage]);

  // Load contact profile
  useEffect(() => {
    async function loadContact() {
      const code = params.code as string;
      if (!session?.user?.id || !code) return;

      try {
        console.log('🔍 [SmartScheduleView] Loading contact:', code);

        // Get contact from cache - try by userId first, then by shortCode
        let savedContact = getContact(code);

        // If not found by userId, search by shortCode
        if (!savedContact) {
          const allContacts = getContacts();
          savedContact = allContacts.find(c => c.shortCode === code) || null;
        }

        // If not found in cache, load contacts from server
        if (!savedContact) {
          console.log('📦 [SmartScheduleView] Contact not in cache, loading from server...');
          const loadedContacts = await loadContacts(session.user.id);
          savedContact = loadedContacts.find(c => c.shortCode === code || c.userId === code) || null;
        }

        if (savedContact) {
          console.log('📦 [SmartScheduleView] Using contact');
          setSection(savedContact.contactType);
          setContactProfile(savedContact);

          // Dispatch match-found event for background colors (safe areas)
          if (savedContact.backgroundColors) {
            window.dispatchEvent(new CustomEvent('match-found', {
              detail: { backgroundColors: savedContact.backgroundColors }
            }));
          }
        } else {
          // Contact still not found after loading - redirect to history
          console.log('📦 [SmartScheduleView] Contact not found, redirecting to history');
          router.push('/history');
        }
      } catch (error) {
        console.error('Error loading contact:', error);
        router.push('/');
      } finally {
        setLoading(false);
      }
    }

    loadContact();
  }, [session, params.code, router, getContact, getContacts, loadContacts]);

  // Fetch suggested times
  const fetchSuggestedTimes = useCallback(async () => {
    if (!session?.user?.id || !contactProfile || !currentUserProfile || !auth?.currentUser) return;

    setLoadingTimes(true);

    try {
      const eventTemplateIds = SUGGESTION_CHIPS.map(chip => chip.eventId);

      const suggestedTimesResult = await getSuggestedTimes({
        user1Id: session.user.id,
        user2Id: contactProfile.userId,
        calendarType: section,
        eventTemplateIds
      }, auth.currentUser);

      // Map event template IDs back to chip IDs
      const times: Record<string, TimeSlot | null> = {};
      SUGGESTION_CHIPS.forEach(chip => {
        times[chip.id] = suggestedTimesResult[chip.eventId] || null;
      });

      setSuggestedTimes(times);
    } catch (error) {
      console.error('Error fetching suggested times:', error);
      // Set all to null on error
      const errorTimes: Record<string, TimeSlot | null> = {};
      SUGGESTION_CHIPS.forEach(chip => {
        errorTimes[chip.id] = null;
      });
      setSuggestedTimes(errorTimes);
    } finally {
      setLoadingTimes(false);
    }
  }, [session, contactProfile, currentUserProfile, section, SUGGESTION_CHIPS]);

  // Fetch places for in-person meetings
  const fetchPlaces = useCallback(async () => {
    if (!currentUserProfile || !contactProfile) return;

    // Only fetch places for in-person events with available time slots
    const inPersonChips = SUGGESTION_CHIPS.filter(chip => {
      const eventTemplate = getEventTemplate(chip.eventId);
      const isInPerson = eventTemplate?.eventType === 'in-person';
      const timeSlot = suggestedTimes[chip.id];
      const hasAvailableTime = timeSlot !== null && timeSlot !== undefined;

      return isInPerson && hasAvailableTime;
    });

    if (inPersonChips.length === 0) {
      return;
    }

    try {
      const places = await fetchPlacesForChips(
        currentUserProfile,
        contactProfile,
        section,
        inPersonChips.map(chip => chip.id),
        inPersonChips.map(chip => chip.eventId)
      );

      setChipPlaces(places);
    } catch (error) {
      console.error('Error fetching places:', error);
    }
  }, [currentUserProfile, contactProfile, section, suggestedTimes, SUGGESTION_CHIPS]);

  // Effects
  useEffect(() => {
    if (currentUserProfile && contactProfile) {
      fetchSuggestedTimes();
    }
  }, [currentUserProfile, contactProfile, fetchSuggestedTimes]);

  useEffect(() => {
    if (Object.keys(suggestedTimes).length > 0) {
      fetchPlaces();
    }
  }, [suggestedTimes, fetchPlaces]);

  // Handle chip click
  const handleChipClick = async (chip: SuggestionChip) => {
    if (!currentUserProfile || !contactProfile || !session?.user) return;

    const eventTemplate = getEventTemplate(chip.eventId);
    if (!eventTemplate) return;

    const existingTime = suggestedTimes[chip.id];
    const hasCheckedChip = chip.id in suggestedTimes;

    if (hasCheckedChip) {
      if (existingTime) {
        composeAndOpenCalendarEvent({
          slot: existingTime,
          eventTemplate,
          place: chipPlaces[chip.id] || null,
          currentUserProfile,
          contactProfile,
          section,
          currentUserId: session.user.id
        });
      } else {
        alert('No available time slots found in the next 14 days');
      }
    } else {
      alert('Please wait for scheduling data to load');
    }
  };

  // Loading state
  if (loading || !contactProfile) {
    return null;
  }

  return (
    <div className="relative z-[1001]">
      {/* Header */}
      <div className="px-6 pt-2">
        <div className="max-w-[var(--max-content-width,448px)] mx-auto">
          <PageHeader
            onBack={() => {
              // Navigate back to history if user came from there, otherwise go to contact profile
              if (fromParam === 'history') {
                // Mark that we're returning to history for crossfade animation
                sessionStorage.setItem('returning-to-history', 'true');

                // Store contact background for crossfade
                if (contactProfile?.backgroundImage) {
                  sessionStorage.setItem('contact-background-url', contactProfile.backgroundImage);
                }

                router.push('/history');
              } else {
                router.push(`/c/${contactProfile?.shortCode}`);
              }
            }}
            title="Meet Up"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-6">
        <div className="max-w-[var(--max-content-width,448px)] mx-auto">
          {/* Suggestion Chips */}
          <div className="space-y-3 mb-6">
            {SUGGESTION_CHIPS.map((chip) => {
              const hasCheckedChip = chip.id in suggestedTimes;
              const suggestedTime = suggestedTimes[chip.id];
              const isUnavailable = hasCheckedChip && !suggestedTime;
              const eventTemplate = getEventTemplate(chip.eventId);
              const place = chipPlaces[chip.id];

              // Build subtitle with time information like CalConnect
              const subtitle = loadingTimes
                ? 'Finding times...'
                : suggestedTime && eventTemplate
                ? (() => {
                    const slotStart = new Date(suggestedTime.start);
                    const eventTimes = getEventTimeFromSlotWithBuffer(
                      slotStart,
                      eventTemplate.duration,
                      eventTemplate.travelBuffer
                    );
                    const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
                    const startTime = eventTimes.start.toLocaleTimeString('en-US', timeOptions);
                    const dayString = formatSmartDay(eventTimes.start);
                    return `${dayString} • ${startTime} (${eventTemplate.duration} min)`;
                  })()
                : isUnavailable
                ? 'No times in next 2 weeks'
                : 'Finding times...';

              // Format title - for in-person events with place, use "@Location" format
              const title = eventTemplate?.eventType === 'in-person' && place
                ? `${eventTemplate.title} @${place.name}`
                : eventTemplate?.title || 'Meeting';

              return (
                <ItemChip
                  key={chip.id}
                  icon={
                    <Image src={`/icons/${chip.icon}.svg`} width={24} height={24} className="w-6 h-6 text-white" alt="" style={{ filter: 'brightness(0) invert(1)' }} />
                  }
                  title={title}
                  subtitle={subtitle}
                  onClick={() => !isUnavailable && !loadingTimes && handleChipClick(chip)}
                  truncateTitle={true}
                  className={isUnavailable ? 'opacity-50 pointer-events-none' : ''}
                />
              );
            })}
          </div>

          {/* Custom Time & Place Button */}
          <Button
            variant="white"
            size="xl"
            className="w-full"
            onClick={() => {
              // Preserve the 'from' parameter when navigating to AI schedule
              const queryString = fromParam ? `?from=${fromParam}` : '';
              router.push(`/c/${contactProfile?.shortCode}/ai-schedule${queryString}`);
            }}
          >
            Find Custom Time & Place
          </Button>
        </div>
      </div>
    </div>
  );
}
