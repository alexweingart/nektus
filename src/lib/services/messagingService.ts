/**
 * Service for handling deep links to native messaging apps
 */

import { UserProfile } from '@/types/profile';

/**
 * Generates the message text template
 */
export function generateMessageText(
  contactFirstName: string, 
  senderFirstName: string, 
  meetingDate: Date = new Date()
): string {
  const dateStr = meetingDate.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric' 
  });
  
  return `👋 Hi ${contactFirstName}, this is ${senderFirstName}. We nekt'd on ${dateStr}. It was great meeting you - let's hang out soon!`;
}

/**
 * Detects the user's platform
 */
function detectPlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') {
    return 'web';
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'ios';
  } else if (/android/.test(userAgent)) {
    return 'android';
  } else {
    return 'web';
  }
}

/**
 * Opens the appropriate messaging app with pre-populated text
 */
export function openMessagingApp(messageText: string, phoneNumber?: string): void {
  const platform = detectPlatform();
  const encodedMessage = encodeURIComponent(messageText);
  
  try {
    if (platform === 'ios') {
      // Use Messages app on iOS
      if (phoneNumber) {
        // If we have a phone number, open Messages with specific contact
        const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
        window.open(`sms:${cleanPhone}&body=${encodedMessage}`, '_blank');
      } else {
        // Open Messages app to compose new message
        window.open(`sms:&body=${encodedMessage}`, '_blank');
      }
    } else if (platform === 'android') {
      // Use SMS app on Android
      if (phoneNumber) {
        const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
        window.open(`sms:${cleanPhone}?body=${encodedMessage}`, '_blank');
      } else {
        window.open(`sms:?body=${encodedMessage}`, '_blank');
      }
    } else {
      // Web fallback - copy to clipboard and show instructions
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(messageText).then(() => {
          alert('Message copied to clipboard! Paste it in your messaging app.');
        }).catch(() => {
          fallbackCopyText(messageText);
        });
      } else {
        fallbackCopyText(messageText);
      }
    }
  } catch (error) {
    console.error('Failed to open messaging app:', error);
    // Fallback to copying text
    fallbackCopyText(messageText);
  }
}

/**
 * Fallback function to copy text when clipboard API is not available
 */
function fallbackCopyText(text: string): void {
  try {
    // Create a temporary textarea element
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert('Message copied to clipboard! Paste it in your messaging app.');
  } catch (error) {
    console.error('Failed to copy text:', error);
    // Last resort - show the text to user
    prompt('Copy this message and paste it in your messaging app:', text);
  }
}

/**
 * Opens the appropriate messaging app with pre-populated text and vCard attachment
 * Used for the "Say hi" functionality in success modals
 */
export function openMessagingAppWithVCard(
  messageText: string, 
  senderProfile: UserProfile,
  phoneNumber?: string
): void {
  // Import vCard generation dynamically to avoid circular dependencies
  import('./vCardService').then(({ generateVCard }) => {
    const vCardData = generateVCard(senderProfile);
    
    // For platforms that support file attachments, we'd attach the vCard
    // For now, we'll include it in the message text as a fallback
    const messageWithVCard = `${messageText}\n\n--- Contact Card ---\n${vCardData}`;
    
    openMessagingApp(messageWithVCard, phoneNumber);
  }).catch(error => {
    console.error('Failed to generate vCard:', error);
    // Fallback to regular message
    openMessagingApp(messageText, phoneNumber);
  });
}
