
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
  onQuickReply?: (value: string) => void;
  quickRepliesDisabled?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onQuickReply, quickRepliesDisabled }) => {
  const isBot = message.sender === 'bot';

  const containerClasses = `flex items-start gap-3 ${isBot ? '' : 'flex-row-reverse'}`;
  const bubbleClasses = `max-w-md rounded-2xl p-4 text-white ${isBot ? 'bg-gradient-to-br from-green-500 to-emerald-600 rounded-bl-none' : 'bg-blue-500 rounded-br-none'}`;

  return (
    <div className={containerClasses}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-2xl ${isBot ? 'bg-green-200' : 'bg-blue-200'}`}>
        {isBot ? '🐷' : '😎'}
      </div>
      <div className={bubbleClasses}>
         <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                table: ({node, ...props}) => <table className="table-auto w-full bg-white text-black rounded-lg my-2" {...props} />,
                thead: ({node, ...props}) => <thead className="bg-gray-200" {...props} />,
                th: ({node, ...props}) => <th className="p-2 text-left font-bold" {...props} />,
                td: ({node, ...props}) => <td className="p-2 border-t border-gray-200" {...props} />,
                strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
            }}
         >
            {message.text}
        </ReactMarkdown>
        {message.quickReplies?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.quickReplies.map(reply => (
              <button
                key={reply.value}
                type="button"
                disabled={quickRepliesDisabled}
                onClick={() => onQuickReply?.(reply.value)}
                className="rounded-full bg-white/95 px-3 py-2 text-sm font-semibold text-green-700 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reply.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ChatMessage;
