/**
 * MessageList component for iOS
 * Adapted from: apps/web/src/app/components/ui/chat/MessageList.tsx
 *
 * Changes from web:
 * - Replaced ReactMarkdown with react-native-markdown-display
 * - Replaced div/className with View/StyleSheet
 * - Replaced CSS animations with React Native Animated
 * - Added inline TypingIndicator (matching web pattern)
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import Markdown from 'react-native-markdown-display';
import { EventCard } from './EventCard';
import type { Event } from '@nektus/shared-types';
import type { ChatMessage } from '../../../../client/hooks/use-streaming-ai';
import { ANIMATION } from '@nektus/shared-client';
import { DEFAULT_ACCENT_GREEN } from '../../../../shared/colors';
import { textSizes, fontStyles } from '../Typography';

interface MessageListProps {
  messages: ChatMessage[];
  onCreateEvent: (event: Event) => void;
  dominantColor?: string;
}

/**
 * Typing indicator with bouncing dots (inline, matching web pattern)
 */
function TypingIndicator() {
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createBounceAnimation = (animValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: -6,
            duration: ANIMATION.UI_MS,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: ANIMATION.UI_MS,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(600 - delay),
        ])
      );
    };

    const anim1 = createBounceAnimation(dot1Anim, 0);
    const anim2 = createBounceAnimation(dot2Anim, 150);
    const anim3 = createBounceAnimation(dot3Anim, 300);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1Anim, dot2Anim, dot3Anim]);

  return (
    <View style={styles.typingContainer}>
      <Animated.View style={[styles.dot, { transform: [{ translateY: dot1Anim }] }]} />
      <Animated.View style={[styles.dot, { transform: [{ translateY: dot2Anim }] }]} />
      <Animated.View style={[styles.dot, { transform: [{ translateY: dot3Anim }] }]} />
    </View>
  );
}

export function MessageList({ messages, onCreateEvent, dominantColor = DEFAULT_ACCENT_GREEN }: MessageListProps) {
  // Markdown styles matching web
  const markdownStyles = {
    body: {
      color: '#111827',
      ...textSizes.sm,
      ...fontStyles.regular,
    },
    paragraph: {
      marginBottom: 8,
      marginTop: 0,
    },
    strong: {
      ...fontStyles.bold,
      color: '#111827',
    },
    em: {
      fontStyle: 'italic' as const,
      color: '#374151',
      ...fontStyles.regular,
    },
    bullet_list: {
      marginLeft: 0,
      marginBottom: 8,
    },
    ordered_list: {
      marginLeft: 0,
      marginBottom: 8,
    },
    list_item: {
      marginBottom: 8,
    },
    link: {
      color: dominantColor,
      ...fontStyles.bold,
    },
    heading1: {
      ...textSizes.lg,
      ...fontStyles.bold,
      marginBottom: 8,
      color: '#111827',
    },
    heading2: {
      ...textSizes.base,
      ...fontStyles.bold,
      marginBottom: 8,
      color: '#111827',
    },
    heading3: {
      ...textSizes.sm,
      ...fontStyles.bold,
      marginBottom: 4,
      color: '#111827',
    },
    code_inline: {
      backgroundColor: '#f3f4f6',
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      ...textSizes.sm,
      fontFamily: 'monospace',
      color: '#1f2937',
    },
  };

  return (
    <>
      {messages.map((message) => (
        <View
          key={message.id}
          style={[
            styles.messageContainer,
            message.type === 'user' ? styles.userMessage : styles.aiMessage,
            message.isProcessing && message.content === '' ? styles.typingMessage : null,
          ]}
        >
          {/* Backdrop blur */}
          <BlurView
            style={StyleSheet.absoluteFillObject}
            tint={message.type === 'user' ? 'dark' : 'light'}
            intensity={50}
          />

          <View style={styles.messageContent}>
            {/* Typing indicator (3 dots) */}
            {message.type === 'ai' && message.isProcessing && message.content === '' ? (
              <TypingIndicator />
            ) : message.type === 'ai' ? (
              <>
                {message.isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={dominantColor} />
                    <Text style={styles.loadingText}>
                      {message.greyStatusText || message.content}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.markdownWrapper}>
                    <Markdown style={markdownStyles}>
                      {message.content}
                    </Markdown>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.userText}>{message.content}</Text>
            )}

            {/* Display Event details if available */}
            {message.event && (
              <EventCard
                event={message.event}
                showCreateButton={message.showCreateButton}
                onCreateEvent={onCreateEvent}
              />
            )}
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  messageContent: {
    padding: 16,
  },
  userMessage: {
    maxWidth: '80%',
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  aiMessage: {
    maxWidth: '80%',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 1)',
  },
  typingMessage: {
    alignSelf: 'flex-start',
    maxWidth: undefined,
  },
  userText: {
    color: '#ffffff',
    ...textSizes.sm,
    ...fontStyles.regular,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markdownWrapper: {
    marginBottom: -8, // Cancel last paragraph's marginBottom so bubble padding is symmetric
  },
  loadingText: {
    ...textSizes.sm,
    ...fontStyles.regular,
    color: '#6B7280',
  },
});

export default MessageList;
