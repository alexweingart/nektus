/**
 * Messaging service for iOS
 * Adapted from: apps/web/src/client/contacts/messaging.ts
 *
 * Changes from web:
 * - Replaced window.navigator/document with React Native Linking
 * - Simplified platform detection (always iOS)
 * - Uses Share API for copying messages
 */

import { Linking, Alert, Platform, Share } from 'react-native';

/**
 * Generates the message text template
 */
export function generateMessageText(
  contactFirstName: string,
  senderFirstName: string,
  meetingDate: Date = new Date(),
  senderShortCode?: string
): string {
  const dateStr = meetingDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });

  const baseMessage = contactFirstName
    ? `Hey ${contactFirstName}, it's ${senderFirstName}!`
    : `Hey, it's ${senderFirstName}!`;

  if (senderShortCode) {
    return `${baseMessage} Find time to hang: nekt.us/c/${senderShortCode}`;
  }

  return baseMessage;
}

/**
 * Opens the SMS app with pre-populated text
 */
export async function openMessagingApp(
  messageText: string,
  phoneNumber?: string
): Promise<void> {
  const encodedMessage = encodeURIComponent(messageText);

  try {
    let smsUrl: string;

    if (phoneNumber) {
      const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
      // iOS uses & for body parameter
      smsUrl = Platform.OS === 'ios'
        ? `sms:${cleanPhone}&body=${encodedMessage}`
        : `sms:${cleanPhone}?body=${encodedMessage}`;
    } else {
      smsUrl = Platform.OS === 'ios'
        ? `sms:&body=${encodedMessage}`
        : `sms:?body=${encodedMessage}`;
    }

    const canOpen = await Linking.canOpenURL(smsUrl);

    if (canOpen) {
      await Linking.openURL(smsUrl);
    } else {
      // Fallback: copy to clipboard
      await copyMessageToClipboard(messageText);
    }
  } catch (error) {
    console.error('Failed to open messaging app:', error);
    // Fallback to copying text
    await copyMessageToClipboard(messageText);
  }
}

/**
 * Share message using native share sheet
 * Allows user to copy, share via iMessage, or other apps
 */
async function copyMessageToClipboard(text: string): Promise<void> {
  try {
    await Share.share({
      message: text,
    });
  } catch (error) {
    console.error('Failed to share text:', error);
    Alert.alert('Error', 'Failed to share message. Please try again.');
  }
}

/**
 * Opens the messaging app with pre-populated text only (no vCard)
 * Used for direct "Say hi" functionality
 */
export async function openMessagingAppDirectly(
  messageText: string,
  phoneNumber?: string
): Promise<void> {
  console.log('📱 Opening messaging app directly with text only');
  await openMessagingApp(messageText, phoneNumber);
}
