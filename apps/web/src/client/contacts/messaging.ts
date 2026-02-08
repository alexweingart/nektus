/**
 * Service for handling deep links to native messaging apps
 */

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
    day: 'numeric'
  });

  const baseMessage = `👋 Hi ${contactFirstName}, this is ${senderFirstName}. We nekt'd on ${dateStr}. It was great meeting you - let's hang out soon!`;

  if (senderShortCode) {
    return `${baseMessage} Here's my profile: https://nekt.us/c/${senderShortCode}`;
  }

  return baseMessage;
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
 * Navigate to a protocol scheme URL (e.g. sms:)
 * Uses window.location.href which works across all iOS browsers (Safari, Chrome, Edge)
 */
function navigateToProtocolScheme(url: string): void {
  window.location.href = url;
}

/**
 * Opens the appropriate messaging app with pre-populated text
 */
export function openMessagingApp(messageText: string, phoneNumber?: string): void {
  const platform = detectPlatform();
  const encodedMessage = encodeURIComponent(messageText);
  
  try {
    if (platform === 'ios') {
      // Use Messages app on iOS - programmatic anchor avoids "about:blank" popup
      if (phoneNumber) {
        // If we have a phone number, open Messages with specific contact
        const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
        navigateToProtocolScheme(`sms:${cleanPhone}?&body=${encodedMessage}`);
      } else {
        // Open Messages app to compose new message
        navigateToProtocolScheme(`sms:?&body=${encodedMessage}`);
      }
    } else if (platform === 'android') {
      // Use SMS app on Android - consistent approach with iOS
      if (phoneNumber) {
        const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
        navigateToProtocolScheme(`sms:${cleanPhone}?body=${encodedMessage}`);
      } else {
        navigateToProtocolScheme(`sms:?body=${encodedMessage}`);
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
 * Opens the messaging app with pre-populated text only (no vCard)
 * Used for direct "Say hi" functionality without attachment step
 */
export function openMessagingAppDirectly(
  messageText: string,
  phoneNumber?: string
): void {
  console.log('📱 Opening messaging app directly with text only');
  openMessagingApp(messageText, phoneNumber);
}
