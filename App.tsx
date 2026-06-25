import React, { useEffect, useRef, useState } from 'react';
import { ChatHistoryContent, Message, QuickReply } from './types';
import { generateBotResponse } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import UserInput from './components/UserInput';
import Spinner from './components/Spinner';

type TutorMode = 'solve' | 'generate' | 'practice' | 'review' | 'guide';

const modeQuickReplies: QuickReply[] = [
  { label: '🧠 Resolver pregunta', value: 'Resolver una pregunta' },
  { label: '📝 Generar ejercicios ICFES', value: 'Generar ejercicios tipo ICFES' },
  { label: '🎯 Practicar por tema', value: 'Practicar por tema' },
  { label: '🔍 Revisar error', value: 'Revisar mi error' },
  { label: '📚 Crear guía de clase', value: 'Crear una guía para clase' },
];

const modeLabels: Record<TutorMode, string> = {
  solve: 'Resolver pregunta',
  generate: 'Generar ejercicios ICFES',
  practice: 'Practicar por tema',
  review: 'Revisar error',
  guide: 'Crear guía de clase',
};

const modePrompts: Record<TutorMode, string> = {
  solve: 'Listo, profe 🧠. Pega el enunciado o escribe la pregunta y te la resuelvo con tema, idea clave, pasos y truco PREICFES.',
  generate: 'De una 📝. Dime tema, cantidad y dificultad. Ej: "5 preguntas de funciones, dificultad media, con soluciones".',
  practice: 'Hagámosle 🎯. Dime el tema que quieres practicar: álgebra, funciones, geometría, estadística, probabilidad, etc.',
  review: 'Vamos a revisar ese error con lupa 🔍. Pega el enunciado, tu respuesta y la respuesta correcta si la tienes.',
  guide: 'Perfecto, armemos material de clase 📚. Dime tema, nivel, duración y si quieres guía, taller, quiz o solución.',
};

const initialBotMessage: Message = {
  id: 'initial-bot-message',
  text:
    '¡Hola, profe! Soy tu asistente de matemáticas para PREU y PREICFES. Puedo ayudarte a resolver preguntas, crear ejercicios tipo ICFES, practicar por tema, revisar errores o preparar guías de clase.\n\n¿Qué quieres hacer hoy?',
  sender: 'bot',
  quickReplies: modeQuickReplies,
};

const normalizeText = (input: string) =>
  input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const detectMode = (input: string): TutorMode | null => {
  const normalized = normalizeText(input);

  if (/resolver|resuelve|solucionar|calcula|hallar|halla|factoriza|simplifica|pregunta|ejercicio puntual|enunciado|cuanto es/.test(normalized)) return 'solve';
  if (/generar|crear ejercicios|ejercicios tipo icfes|preguntas tipo icfes|banco/.test(normalized)) return 'generate';
  if (/practicar|practica|tema|entrenar|repasar/.test(normalized)) return 'practice';
  if (/revisar|error|me equivoque|respuesta incorrecta|por que/.test(normalized)) return 'review';
  if (/guia|clase|taller|quiz|evaluacion|material/.test(normalized)) return 'guide';

  return null;
};

const isTechnicalMessage = (message: Message) => {
  if (message.sender !== 'bot') return false;

  return [
    'Error del Profe-Servidor:',
    '¡Uy, profe! Algo falló',
    'Estoy con mucho tráfico',
  ].some(prefix => message.text.startsWith(prefix));
};

const buildModeContext = (mode: TutorMode | null) => {
  if (!mode) {
    return {
      mode: 'menu',
      instruction:
        'El usuario aún no ha elegido modo. Ayúdalo a escoger entre resolver pregunta, generar ejercicios, practicar por tema, revisar error o crear guía.',
    };
  }

  return {
    mode,
    modeLabel: modeLabels[mode],
    instruction: modePrompts[mode],
  };
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([initialBotMessage]);
  const [activeMode, setActiveMode] = useState<TutorMode | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.localStorage.removeItem('asesor-ia-chat-state');
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addBotMessage = (text: string, quickReplies: QuickReply[] = modeQuickReplies) => {
    const botMessage: Message = {
      id: `${Date.now()}-bot`,
      text,
      sender: 'bot',
      quickReplies,
    };
    setMessages(prev => [...prev, botMessage]);
  };

  const handleUserInput = async (userInput: string) => {
    if (!userInput.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: userInput,
      sender: 'user',
    };
    setMessages(prev => [...prev, userMessage]);

    const requestedMode = detectMode(userInput);
    if (requestedMode) {
      setActiveMode(requestedMode);
      addBotMessage(modePrompts[requestedMode]);
      return;
    }

    setIsLoading(true);

    try {
      const history: ChatHistoryContent[] = messages
        .filter(msg => !isTechnicalMessage(msg))
        .map(msg => ({
          role: msg.sender === 'bot' ? 'model' : 'user',
          parts: [{ text: msg.text }],
        }));

      const response = await generateBotResponse(history, userInput, buildModeContext(activeMode));

      if (!response) {
        throw new Error('Invalid response from API');
      }

      const botMessage: Message = {
        id: `${Date.now()}-bot`,
        text: response.responseText,
        sender: 'bot',
        quickReplies: modeQuickReplies,
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      addBotMessage('¡Uy, profe! Algo falló al generar la respuesta. Intenta otra vez en unos segundos, porfa.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-100 p-4 font-sans">
      <header className="mx-auto mb-4 w-full max-w-4xl">
        <h1 className="text-3xl font-bold text-slate-900">Profe IA Matemáticas PREICFES</h1>
        <p className="text-slate-600">Tutor y generador de material para PREU, PREICFES e ICFES Saber 11.</p>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col space-y-4 overflow-y-auto rounded-lg bg-white p-4 shadow-xl">
        {messages.map(msg => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onQuickReply={handleUserInput}
            quickRepliesDisabled={isLoading}
          />
        ))}
        {isLoading && <Spinner />}
        <div ref={chatEndRef} />
      </main>

      <footer className="mx-auto mt-4 w-full max-w-4xl">
        <UserInput onSubmit={handleUserInput} isLoading={isLoading} />
      </footer>
    </div>
  );
};

export default App;
