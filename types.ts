export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  quickReplies?: QuickReply[];
}

export interface QuickReply {
  label: string;
  value: string;
}

export interface GeminiResponse {
  responseText: string;
  action: 'RESPOND' | 'UPDATE_DATA' | 'END';
}

export interface ChatHistoryContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}
