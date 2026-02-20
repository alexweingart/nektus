/**
 * useStreamingAI hook for iOS
 * Adapted from: apps/web/src/client/hooks/use-streaming-ai.ts
 *
 * Changes from web:
 * - Replaced window.open with Linking.openURL
 * - Imports from shared-types instead of local types
 * - Uses getApiBaseUrl for API calls
 * - Firebase auth import adjusted for iOS
 */

import { Linking, Platform } from 'react-native';
import type { Event } from '@nektus/shared-types';
import { getApiBaseUrl, getIdToken } from '../auth/firebase';

// Re-export for use by other components
export interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  event?: Event;
  showCreateButton?: boolean;
  askForConfirmation?: boolean;
  isProcessing?: boolean;
  processingId?: string;
  isLoading?: boolean;
  greyStatusText?: string;
}

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface UseStreamingAIProps {
  onUpdateMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  onUpdateConversationHistory: (updater: (prev: AIMessage[]) => AIMessage[]) => void;
}

export function useStreamingAI({
  onUpdateMessages,
  onUpdateConversationHistory,
}: UseStreamingAIProps) {
  const apiBaseUrl = getApiBaseUrl();

  const processSSELine = (
    line: string,
    state: {
      acknowledgmentMessageId: string;
      contentMessageId: string;
      currentContentMessage: string;
      finalMessageContent: string;
      currentEvent?: Event;
    },
    generateMessageId: (offset?: number) => string
  ) => {
    if (!line.startsWith('data: ')) return;

    try {
      const data = JSON.parse(line.slice(6));

      switch (data.type) {
        case 'acknowledgment':
          onUpdateMessages(prev => {
            const withoutTyping = prev.filter(msg => !(msg.isProcessing && msg.content === ''));
            return [...withoutTyping, {
              id: state.acknowledgmentMessageId,
              type: 'ai',
              content: data.text,
            }];
          });
          break;

        case 'progress':
          if (!state.currentContentMessage) {
            state.currentContentMessage = data.text;
            onUpdateMessages(prev => [...prev, {
              id: state.contentMessageId,
              type: 'ai',
              content: state.currentContentMessage,
              isLoading: data.isLoading,
            }]);
          } else {
            state.currentContentMessage = data.text;
            onUpdateMessages(prev => prev.map(msg =>
              msg.id === state.contentMessageId
                ? { ...msg, content: state.currentContentMessage, isLoading: data.isLoading }
                : msg
            ));
          }
          break;

        case 'content':
          if (data.text) {
            state.finalMessageContent = data.text;
            onUpdateMessages(prev => prev.map(msg =>
              msg.id === state.contentMessageId
                ? { ...msg, content: state.finalMessageContent, isLoading: false }
                : msg
            ));
          }
          break;

        case 'event':
          state.currentEvent = data.event;
          onUpdateMessages(prev => prev.map(msg =>
            msg.id === state.contentMessageId
              ? {
                  ...msg,
                  event: state.currentEvent,
                  showCreateButton: true,
                  askForConfirmation: true
                }
              : msg
          ));
          break;

        case 'clear_loading':
          onUpdateMessages(prev => prev.map(msg =>
            msg.id === state.contentMessageId
              ? { ...msg, isLoading: false }
              : msg
          ).filter(msg => !(msg.isLoading && msg.content === 'Thinking...')));
          break;

        case 'enhancement_pending':
          console.log('🔄 Enhancement pending, will poll:', data.processingId);
          pollForEnhancement(data.processingId, generateMessageId);
          break;

        case 'navigate_to_calendar':
          if (data.calendarUrl) {
            console.log('🔗 Auto-opening calendar:', data.calendarUrl);
            Linking.openURL(data.calendarUrl);
          }
          break;

        case 'error':
          console.error('Streaming error from backend:', data.message);
          onUpdateMessages(prev => prev.map(msg =>
            msg.isLoading
              ? { ...msg, isLoading: false, content: `Sorry, something went wrong: ${data.message || 'Unknown error'}` }
              : msg
          ));
          return;

        default:
          console.warn('Unknown stream event type:', data.type);
      }
    } catch (parseError) {
      // Ignore parse errors for incomplete lines
    }
  };

  /**
   * Send a request and stream SSE events via XHR onprogress (native) or
   * ReadableStream (web). Processes events in real-time as they arrive.
   */
  const sendStreamingRequest = (
    url: string,
    options: { method: string; headers: Record<string, string>; body: string },
    userAIMessage: AIMessage,
    generateMessageId: (offset?: number) => string
  ): Promise<void> => {
    const state = {
      acknowledgmentMessageId: generateMessageId(1),
      contentMessageId: generateMessageId(2),
      currentContentMessage: '',
      finalMessageContent: '',
      currentEvent: undefined as Event | undefined,
    };

    const finalizeConversation = () => {
      onUpdateConversationHistory(prev => [
        ...prev,
        userAIMessage,
        {
          role: 'assistant',
          content: state.finalMessageContent || state.currentContentMessage,
          timestamp: new Date(),
        },
      ]);
    };

    // Native: use XMLHttpRequest with onprogress for real-time SSE streaming
    if (Platform.OS !== 'web') {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let lastIndex = 0;
        let buffer = '';

        xhr.onprogress = () => {
          const newText = xhr.responseText.substring(lastIndex);
          lastIndex = xhr.responseText.length;
          buffer += newText;

          // Split by newlines, keep last (possibly incomplete) line in buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            processSSELine(line, state, generateMessageId);
          }
        };

        xhr.onloadend = () => {
          // Process any remaining buffered text
          if (buffer) {
            processSSELine(buffer, state, generateMessageId);
            buffer = '';
          }
          finalizeConversation();
          resolve();
        };

        xhr.onerror = () => {
          reject(new Error(`XHR streaming request failed`));
        };

        xhr.open(options.method, url);
        Object.entries(options.headers).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });
        xhr.send(options.body);
      });
    }

    // Web: use fetch + ReadableStream
    return (async () => {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`AI scheduling failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const text = await response.text();
        const lines = text.split('\n');
        for (const line of lines) {
          processSSELine(line, state, generateMessageId);
        }
        finalizeConversation();
        return;
      }

      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            processSSELine(line, state, generateMessageId);
          }
        }
        finalizeConversation();
      } finally {
        reader.releaseLock();
      }
    })();
  };

  const pollForEnhancement = async (processingId: string, generateMessageId: (offset?: number) => string) => {
    console.log(`📡 Polling for enhancement: ${processingId}`);

    const idToken = await getIdToken();

    const loadingMessageId = `enhancement-loading-${generateMessageId()}`;
    const loadingMessage: ChatMessage = {
      id: loadingMessageId,
      type: 'ai',
      content: '',
      isLoading: true,
      greyStatusText: 'Searching for special events...',
    };
    onUpdateMessages(prev => [...prev, loadingMessage]);

    for (let i = 0; i < 240; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        const response = await fetch(`${apiBaseUrl}/api/scheduling/processing/${processingId}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          console.log(`⚠️ Enhancement status check failed: ${response.status}`);
          onUpdateMessages(prev => prev.filter(m => m.id !== loadingMessageId));
          break;
        }

        const data = await response.json();

        if (data.status === 'processing') {
          onUpdateMessages(prev => prev.map(m =>
            m.id === loadingMessageId
              ? {
                  ...m,
                  greyStatusText: data.progressMessage || 'Searching for special events...',
                  content: data.result?.message || m.content,
                  isLoading: !data.result?.message
                }
              : m
          ));
        }

        if (data.status === 'completed' && data.result) {
          console.log('✅ Enhancement ready!', data.result);
          onUpdateMessages(prev => prev.map(m =>
            m.id === loadingMessageId
              ? {
                  ...m,
                  content: data.result.message,
                  isLoading: false,
                  greyStatusText: undefined,
                }
              : m
          ));
          break;
        } else if (data.status === 'error') {
          console.log('❌ Enhancement failed:', data.error);
          onUpdateMessages(prev => prev.filter(m => m.id !== loadingMessageId));
          break;
        }
      } catch (error) {
        console.error('Error polling for enhancement:', error);
        onUpdateMessages(prev => prev.filter(m => m.id !== loadingMessageId));
        break;
      }
    }
  };

  return {
    sendStreamingRequest,
  };
}

export default useStreamingAI;
