/**
 * EventCard component for iOS
 * Adapted from: apps/web/src/app/components/ui/chat/EventCard.tsx
 *
 * Changes from web:
 * - Replaced 'use client' with React Native imports
 * - Replaced div/className with View/StyleSheet
 * - Replaced web Button with iOS Button component
 * - Replaced Tailwind classes with StyleSheet
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Button } from '../buttons/Button';
import type { Event } from '@nektus/shared-types';
import { formatSmartDay } from '@nektus/shared-client';

interface EventCardProps {
  event: Event;
  showCreateButton?: boolean;
  onCreateEvent: (event: Event) => void;
}

const formatEventSubtitle = (event: Event): string => {
  if (!event.startTime || !event.endTime) return '';

  const start = new Date(event.startTime);
  const end = new Date(event.endTime);

  const displayStart = start;
  const duration = event.duration || Math.round((end.getTime() - start.getTime()) / (1000 * 60));

  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
  const startTime = displayStart.toLocaleTimeString('en-US', timeOptions);
  const dayString = formatSmartDay(displayStart);

  return `${dayString} • ${startTime} (${duration} min)`;
};

export function EventCard({ event, showCreateButton = false, onCreateEvent }: EventCardProps) {
  return (
    <View style={styles.container}>
      <BlurView
        style={StyleSheet.absoluteFillObject}
        tint="dark"
        intensity={50}
      />
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.subtitle}>{formatEventSubtitle(event)}</Text>
        </View>

        {showCreateButton && (
          <Button
            variant="white"
            size="md"
            onPress={() => onCreateEvent(event)}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Create Event</Text>
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  content: {
    padding: 16,
  },
  textContainer: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  button: {
    width: '100%',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
});

export default EventCard;
