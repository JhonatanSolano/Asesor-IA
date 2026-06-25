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
      let errorMessage = `No pude conectar con el modelo en este momento. Intenta enviar tu mensaje otra vez en unos segundos.`;
      try {
        // Intentar parsear el mensaje de error del backend para más contexto
        const errorData = await response.json();
        console.error("Error from backend:", errorData);
        if (response.status === 503) {
          errorMessage = [
            'Estoy con mucho tráfico por un momento, estudiante. Intenta enviar tu mensaje otra vez en unos segundos.',
            '',
            'Mientras tanto, puedes escribirlo así para que lo resolvamos más rápido:',
            '- Tema:',
            '- Enunciado:',
            '- Qué necesitas: resolver, practicar o revisar error.',
          ].join('\n');
        } else if (errorData.error) {
          // Usar el mensaje de error específico de nuestra API
          errorMessage = `No pude generar la respuesta ahora mismo. Intenta reenviar tu pregunta en unos segundos.`;
        }
      } catch (e) {
        console.error("No se pudo parsear el JSON de error del backend.", e);
        // Fallback si la respuesta no es JSON
        errorMessage = `Algo falló en la comunicación con el servidor. Intenta otra vez en unos segundos.`;
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
      responseText: "No pude conectar con el tutor en este momento. Revisa tu conexión e intenta enviar tu pregunta otra vez.",
      action: "RESPOND",
    };
  }
};
