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
      let errorMessage = `¡Uy, profe! El servidor respondió con un error ${response.status}.`;
      try {
        // Intentar parsear el mensaje de error del backend para más contexto
        const errorData = await response.json();
        console.error("Error from backend:", errorData);
        if (response.status === 503) {
          errorMessage = "Estoy con mucho tráfico por un momento. Intenta enviar tu mensaje otra vez en unos segundos, profe.";
        } else if (errorData.error) {
          // Usar el mensaje de error específico de nuestra API
          errorMessage = `Error del Profe-Servidor: ${errorData.error}`;
        }
      } catch (e) {
        console.error("No se pudo parsear el JSON de error del backend.", e);
        // Fallback si la respuesta no es JSON
        errorMessage = `¡Uy, parce! Algo falló en la comunicación con el servidor (${response.statusText}).`;
      }
      return {
        responseText: errorMessage,
        action: "RESPOND",
      };
    }

    const parsedResponse: GeminiResponse = await response.json();
    return parsedResponse;

  } catch (error) {
    console.error("Error llamando a la API del backend:", error);
    return {
      responseText: "¡Uy, profe! 😬 Parece que algo se rompió en la comunicación. Revisa tu conexión a internet y vuelve a intentarlo, porfa.",
      action: "RESPOND",
    };
  }
};
