
import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { Message } from '../types';
import 'katex/dist/katex.min.css';

interface ChatMessageProps {
  message: Message;
  onQuickReply?: (value: string) => void;
  quickRepliesDisabled?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onQuickReply, quickRepliesDisabled }) => {
  const isBot = message.sender === 'bot';

  const containerClasses = `flex items-start gap-3 ${isBot ? '' : 'flex-row-reverse'}`;
  const bubbleClasses = `max-w-[85%] rounded-2xl p-4 shadow-sm ${isBot ? 'rounded-bl-none bg-white text-slate-900 border border-slate-200' : 'rounded-br-none bg-emerald-600 text-white'}`;

  return (
    <div className={containerClasses}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-black ${isBot ? 'bg-slate-900 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
        {isBot ? '∑' : 'Tú'}
      </div>
      <div className={bubbleClasses}>
         <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
                table: ({node, ...props}) => <table className="table-auto w-full bg-white text-black rounded-lg my-2" {...props} />,
                thead: ({node, ...props}) => <thead className="bg-gray-200" {...props} />,
                th: ({node, ...props}) => <th className="p-2 text-left font-bold" {...props} />,
                td: ({node, ...props}) => <td className="p-2 border-t border-gray-200" {...props} />,
                strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                ol: ({node, ...props}) => <ol className="ml-5 list-decimal space-y-1" {...props} />,
                ul: ({node, ...props}) => <ul className="ml-5 list-disc space-y-1" {...props} />,
                code: ({node, ...props}) => <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm text-slate-900" {...props} />,
                pre: ({node, ...props}) => <pre className="my-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-sm text-white" {...props} />,
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
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-emerald-500 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
