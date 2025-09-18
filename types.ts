
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
}

export interface UserData {
  name?: string;
  income?: number;
  expenses?: number;
}

export interface SavingsGoal {
  goalName?: string;
  goalAmount?: number;
  goalTimeline?: string;
  goalStartDate?: string;
  goalTimelineInMonths?: number;
}

export interface Analysis {
  isViable: boolean;
  ahorroMensual: number;
  progresoPorcentaje: number;
  sugerencias: string[];
}

export interface GeminiResponse {
  responseText: string;
  action: "UPDATE_DATA" | "END";
  updatedData?: UserData & SavingsGoal;
  analysis?: Analysis;
}
