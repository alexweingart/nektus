import type { Event } from '@/types/profile';
import type { Message as AIMessage } from '@/types/ai-scheduling';

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

  return {
    handleStreamingResponse,
  };
}
