import type { Event } from '@/types/profile';
import type { Message as AIMessage } from '@/types/ai-scheduling';
import { auth } from '@/client/config/firebase';

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

interface UseStreamingAIProps {
  onUpdateMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  onUpdateConversationHistory: (updater: (prev: AIMessage[]) => AIMessage[]) => void;
}

export function useStreamingAI({
  onUpdateMessages,
  onUpdateConversationHistory,
}: UseStreamingAIProps) {

  const handleStreamingResponse = async (
    response: Response,
    userAIMessage: AIMessage,
    generateMessageId: (offset?: number) => string
  ) => {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    const acknowledgmentMessageId = generateMessageId(1);
    const contentMessageId = generateMessageId(2);

    let currentContentMessage = '';
    let currentEvent: Event | undefined;
    let finalMessageContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'acknowledgment':
                  // Remove typing indicator and create standalone acknowledgment message
                  onUpdateMessages(prev => {
                    // Remove the typing indicator (isProcessing: true, content: '')
                    const withoutTyping = prev.filter(msg => !(msg.isProcessing && msg.content === ''));
                    // Add acknowledgment message
                    return [...withoutTyping, {
                      id: acknowledgmentMessageId,
                      type: 'ai',
                      content: data.text,
                    }];
                  });
                  break;

                case 'progress':
                  // Progress update - create new message or update existing one
                  if (!currentContentMessage) {
                    // First progress message - create new message
                    currentContentMessage = data.text;
                    onUpdateMessages(prev => [...prev, {
                      id: contentMessageId,
                      type: 'ai',
                      content: currentContentMessage,
                      isLoading: data.isLoading,
                    }]);
                  } else {
                    // Subsequent progress - REPLACE (not append)
                    currentContentMessage = data.text;
                    onUpdateMessages(prev => prev.map(msg =>
                      msg.id === contentMessageId
                        ? { ...msg, content: currentContentMessage, isLoading: data.isLoading }
                        : msg
                    ));
                  }
                  break;

                case 'content':
                  // Final content - replace content message
                  if (data.text) {
                    finalMessageContent = data.text;
                    onUpdateMessages(prev => prev.map(msg =>
                      msg.id === contentMessageId
                        ? { ...msg, content: finalMessageContent, isLoading: false }
                        : msg
                    ));
                  }
                  break;

                case 'event':
                  // Event data - add to content message
                  currentEvent = data.event;
                  onUpdateMessages(prev => prev.map(msg =>
                    msg.id === contentMessageId
                      ? {
                          ...msg,
                          event: currentEvent,
                          showCreateButton: true,
                          askForConfirmation: true
                        }
                      : msg
                  ));
                  break;

                case 'clear_loading':
                  // Clear any loading indicators
                  onUpdateMessages(prev => prev.map(msg =>
                    msg.id === contentMessageId
                      ? { ...msg, isLoading: false }
                      : msg
                  ).filter(msg => !(msg.isLoading && msg.content === 'Thinking...')));
                  break;

                case 'enhancement_pending':
                  // Web search enhancement will arrive later
                  console.log('🔄 Enhancement pending, will poll:', data.processingId);
                  // Start polling in background
                  pollForEnhancement(data.processingId, generateMessageId);
                  break;

                case 'navigate_to_calendar':
                  // Auto-open calendar URL
                  if (data.calendarUrl) {
                    console.log('🔗 Auto-opening calendar:', data.calendarUrl);
                    window.location.href = data.calendarUrl;
                  }
                  break;

                case 'error':
                  console.error('Streaming error from backend:', data.message);
                  // Show error message to user instead of throwing
                  onUpdateMessages(prev => prev.map(msg =>
                    msg.isLoading
                      ? { ...msg, isLoading: false, content: `Sorry, something went wrong: ${data.message || 'Unknown error'}` }
                      : msg
                  ));
                  return; // Exit the stream processing

                default:
                  console.warn('Unknown stream event type:', data.type);
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
            }
          }
        }
      }

      // Update conversation history when done
      onUpdateConversationHistory(prev => [
        ...prev,
        userAIMessage,
        {
          role: 'assistant',
          content: finalMessageContent || currentContentMessage,
          timestamp: new Date(),
        },
      ]);

    } finally {
      reader.releaseLock();
    }
  };

  const pollForEnhancement = async (processingId: string, generateMessageId: (offset?: number) => string) => {
    console.log(`📡 Polling for enhancement: ${processingId}`);

    // Get Firebase auth token
    const idToken = await auth?.currentUser?.getIdToken();

    // Add loading message immediately
    const loadingMessageId = `enhancement-loading-${generateMessageId()}`;
    const loadingMessage: ChatMessage = {
      id: loadingMessageId,
      type: 'ai',
      content: '',
      isLoading: true,
      greyStatusText: 'Searching for special events...',
    };
    onUpdateMessages(prev => [...prev, loadingMessage]);

    // Poll every 500ms for up to 120s for smooth streaming (web search can take time with GPT-5)
    for (let i = 0; i < 240; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        const response = await fetch(`/api/scheduling/processing/${processingId}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          console.log(`⚠️ Enhancement status check failed: ${response.status}`);
          // Remove loading message
          onUpdateMessages(prev => prev.filter(m => m.id !== loadingMessageId));
          break;
        }

        const data = await response.json();

        // Update loading message with progress and partial results
        if (data.status === 'processing') {
          onUpdateMessages(prev => prev.map(m =>
            m.id === loadingMessageId
              ? {
                  ...m,
                  greyStatusText: data.progressMessage || 'Searching for special events...',
                  content: data.result?.message || m.content,
                  isLoading: !data.result?.message // Remove loading if we have content
                }
              : m
          ));
        }

        if (data.status === 'completed' && data.result) {
          console.log('✅ Enhancement ready!', data.result);

          // Replace loading message with actual content
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
          // Remove loading message
          onUpdateMessages(prev => prev.filter(m => m.id !== loadingMessageId));
          break;
        }
      } catch (error) {
        console.error('Error polling for enhancement:', error);
        // Remove loading message
        onUpdateMessages(prev => prev.filter(m => m.id !== loadingMessageId));
        break;
      }
    }
  };

  return {
    handleStreamingResponse,
  };
}
