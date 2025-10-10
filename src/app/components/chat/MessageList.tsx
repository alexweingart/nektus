import ReactMarkdown from 'react-markdown';
import EventCard from '@/app/components/chat/EventCard';
import type { Event } from '@/types/profile';
import type { ChatMessage } from '@/app/hooks/useStreamingAI';

interface MessageListProps {
  messages: ChatMessage[];
  onCreateEvent: (event: Event) => void;
}

export default function MessageList({ messages, onCreateEvent }: MessageListProps) {
  return (
    <>
      {messages.map((message) => (
        <div
          key={message.id}
          className={`rounded-lg p-3 ${
            message.type === 'user'
              ? 'max-w-[80%] bg-gradient-to-r from-emerald-400 to-teal-500 text-white ml-auto'
              : message.isProcessing && message.content === ''
                ? 'w-auto inline-block bg-white border border-gray-200'
                : 'max-w-[80%] bg-white border border-gray-200'
          }`}
        >
          {/* Typing indicator (3 dots) */}
          {message.type === 'ai' && message.isProcessing && message.content === '' ? (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          ) : message.type === 'ai' ? (
            <>
              {message.isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-500">{message.greyStatusText || message.content}</span>
                </div>
              ) : (
                <div className="text-gray-900 prose prose-sm max-w-none flex-1">
                  <ReactMarkdown
                    components={{
                      p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({children}) => <ul className="list-disc list-outside ml-5 mb-2 space-y-2">{children}</ul>,
                      ol: ({children}) => <ol className="list-decimal list-outside ml-5 mb-2 space-y-2">{children}</ol>,
                      li: ({children}) => <li className="pl-1">{children}</li>,
                      strong: ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
                      em: ({children}) => <em className="italic text-gray-700">{children}</em>,
                      code: ({children}) => <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-gray-800">{children}</code>,
                      h1: ({children}) => <h1 className="text-lg font-semibold mb-2 text-gray-900">{children}</h1>,
                      h2: ({children}) => <h2 className="text-base font-semibold mb-2 text-gray-900">{children}</h2>,
                      h3: ({children}) => <h3 className="text-sm font-semibold mb-1 text-gray-900">{children}</h3>,
                      a: ({href, children}) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 font-semibold hover:text-emerald-500 transition-colors"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}
            </>
          ) : (
            <p className="text-white whitespace-pre-line">
              {message.content}
            </p>
          )}

          {/* Display Event details if available */}
          {message.event && (
            <EventCard
              event={message.event}
              showCreateButton={message.showCreateButton}
              onCreateEvent={onCreateEvent}
            />
          )}
        </div>
      ))}
    </>
  );
}
