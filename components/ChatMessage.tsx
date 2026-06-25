
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

  const containerClasses = `flex items-start gap-2 sm:gap-3 ${isBot ? '' : 'flex-row-reverse'}`;
  const bubbleClasses = `min-w-0 max-w-[calc(100%-3rem)] overflow-x-auto rounded-2xl p-3 text-sm leading-6 shadow-sm sm:max-w-[85%] sm:p-4 sm:text-base ${isBot ? 'rounded-bl-none border border-slate-200 bg-white text-slate-900' : 'rounded-br-none bg-emerald-600 text-white'}`;

  return (
    <div className={containerClasses}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black sm:h-10 sm:w-10 sm:text-lg ${isBot ? 'bg-slate-900 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
        {isBot ? '∑' : 'Tú'}
      </div>
      <div className={bubbleClasses}>
         <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
                table: ({node, ...props}) => <table className="my-2 w-full min-w-[24rem] table-auto rounded-lg bg-white text-black sm:min-w-[28rem]" {...props} />,
                thead: ({node, ...props}) => <thead className="bg-gray-200" {...props} />,
                th: ({node, ...props}) => <th className="p-2 text-left text-sm font-bold" {...props} />,
                td: ({node, ...props}) => <td className="border-t border-gray-200 p-2 text-sm" {...props} />,
                strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                p: ({node, ...props}) => <p className="mb-2 break-words last:mb-0" {...props} />,
                ol: ({node, ...props}) => <ol className="ml-5 list-decimal space-y-1 break-words" {...props} />,
                ul: ({node, ...props}) => <ul className="ml-5 list-disc space-y-1 break-words" {...props} />,
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
                className="max-w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800 shadow-sm transition hover:border-emerald-500 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
