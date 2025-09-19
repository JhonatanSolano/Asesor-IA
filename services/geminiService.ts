import { GeminiResponse, ChatHistoryContent } from '../types';

export const generateBotResponse = async (
  history: ChatHistoryContent[],
  currentUserInput: string,
  currentData: object
): Promise<GeminiResponse | null> => {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ history, currentUserInput, currentData }),
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        console.error("Error from backend:", errorData);
        return errorData as GeminiResponse;
      } catch {
        throw new Error(`API request failed with status ${response.status}`);
      }
    }

    const parsedResponse: GeminiResponse = await response.json();
    return parsedResponse;

  } catch (error) {
    console.error("Error calling backend API:", error);
    return {
      responseText: "¡Uy, parce! 😬 Parece que algo se rompió en la comunicación. Dame un chance y vuelve a intentarlo más tarde, porfa.",
      action: "UPDATE_DATA",
    };
  }
};
