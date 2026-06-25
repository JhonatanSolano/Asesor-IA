import React, { useEffect, useRef, useState } from 'react';
import { ChatHistoryContent, Message, QuickReply } from './types';
import { generateBotResponse } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import UserInput from './components/UserInput';
import Spinner from './components/Spinner';

type TutorMode = 'solve' | 'generate' | 'practice' | 'review' | 'guide';

const modeQuickReplies: QuickReply[] = [
  { label: 'Resolver pregunta', value: 'Resolver una pregunta' },
  { label: 'Ejercicios tipo examen', value: 'Generar ejercicios tipo examen' },
  { label: 'Practicar por tema', value: 'Practicar por tema' },
  { label: 'Revisar error', value: 'Revisar mi error' },
  { label: 'Plan de estudio', value: 'Crear plan de estudio' },
];

const modeLabels: Record<TutorMode, string> = {
  solve: 'Resolver pregunta',
  generate: 'Ejercicios tipo examen',
  practice: 'Practicar por tema',
  review: 'Revisar error',
  guide: 'Plan de estudio',
};

const modePrompts: Record<TutorMode, string> = {
  solve: 'Listo. Pega el enunciado o escribe la pregunta y te explico el tema, la idea clave, los pasos y un truco de examen.',
  generate: 'Perfecto. Dime tema, cantidad y dificultad. Ej: "5 preguntas de funciones, nivel medio, con solución".',
  practice: 'Vamos a practicar. Dime el tema: álgebra, funciones, geometría, trigonometría, probabilidad, estadística o lectura de gráficas.',
  review: 'Pega el enunciado, tu respuesta y la respuesta correcta si la tienes. Te explico dónde estuvo el error y cómo evitarlo.',
  guide: 'Dime cuántos días tienes, qué examen preparas y tus temas flojos. Te armo una ruta corta de estudio.',
};

const initialBotMessage: Message = {
  id: 'initial-bot-message',
  text:
    'Hola. Soy tu tutor de matemáticas para admisión UNAL e ICFES Saber 11. Escríbeme una pregunta, un tema para practicar o pega un ejercicio que quieras resolver.',
  sender: 'bot',
};

const topicCards = [
  { title: 'Álgebra', text: 'Ecuaciones, desigualdades, factorización y expresiones.' },
  { title: 'Funciones', text: 'Lineales, cuadráticas, interpretación de gráficas y variación.' },
  { title: 'Geometría', text: 'Áreas, perímetros, semejanza, ángulos y cuerpos.' },
  { title: 'Probabilidad', text: 'Conteo, eventos, porcentajes y decisiones con datos.' },
];

const normalizeText = (input: string) =>
  input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const detectMode = (input: string): TutorMode | null => {
  const normalized = normalizeText(input);

  if (/generar|crear ejercicios|ejercicios tipo|preguntas tipo|banco|examen/.test(normalized)) return 'generate';
  if (/resolver|resuelve|solucionar|calcula|hallar|halla|factoriza|simplifica|pregunta|enunciado|cuanto es/.test(normalized)) return 'solve';
  if (/practicar|practica|tema|entrenar|repasar/.test(normalized)) return 'practice';
  if (/revisar|error|me equivoque|respuesta incorrecta|por que/.test(normalized)) return 'review';
  if (/plan|ruta|guia|clase|taller|quiz|evaluacion|material/.test(normalized)) return 'guide';

  return null;
};

const getExplicitModeSelection = (input: string): TutorMode | null => {
  const normalized = normalizeText(input);

  if (normalized === 'resolver una pregunta' || normalized === 'resolver pregunta') return 'solve';
  if (normalized === 'generar ejercicios tipo examen' || normalized === 'ejercicios tipo examen') return 'generate';
  if (normalized === 'practicar por tema') return 'practice';
  if (normalized === 'revisar mi error' || normalized === 'revisar error') return 'review';
  if (normalized === 'crear plan de estudio' || normalized === 'plan de estudio') return 'guide';

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
      audience: 'estudiantes que preparan admisión UNAL e ICFES Saber 11',
      mode: 'menu',
      instruction:
        'El estudiante aún no eligió modo. Ayúdalo a escoger entre resolver pregunta, generar ejercicios tipo examen, practicar por tema, revisar error o crear plan de estudio.',
    };
  }

  return {
    audience: 'estudiantes que preparan admisión UNAL e ICFES Saber 11',
    mode,
    modeLabel: modeLabels[mode],
    instruction: modePrompts[mode],
  };
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([initialBotMessage]);
  const [activeMode, setActiveMode] = useState<TutorMode | null>(null);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.localStorage.removeItem('asesor-ia-chat-state');
  }, []);

  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  const addBotMessage = (text: string) => {
    const botMessage: Message = {
      id: `${Date.now()}-bot`,
      text,
      sender: 'bot',
    };
    setMessages(prev => [...prev, botMessage]);
  };

  const handleUserInput = async (userInput: string) => {
    if (!userInput.trim() || isLoading) return;

    setIsChatOpen(true);
    const userMessage: Message = {
      id: Date.now().toString(),
      text: userInput,
      sender: 'user',
    };
    setMessages(prev => [...prev, userMessage]);

    const explicitMode = getExplicitModeSelection(userInput);
    if (explicitMode) {
      setActiveMode(explicitMode);
      addBotMessage(modePrompts[explicitMode]);
      return;
    }
    const inferredMode = detectMode(userInput);
    const modeForRequest = inferredMode || activeMode;
    if (inferredMode && inferredMode !== activeMode) {
      setActiveMode(inferredMode);
    }

    setIsLoading(true);

    try {
      const history: ChatHistoryContent[] = messages
        .filter(msg => !isTechnicalMessage(msg))
        .map(msg => ({
          role: msg.sender === 'bot' ? 'model' : 'user',
          parts: [{ text: msg.text }],
        }));

      const response = await generateBotResponse(history, userInput, buildModeContext(modeForRequest));

      if (!response) {
        throw new Error('Invalid response from API');
      }

      const botMessage: Message = {
        id: `${Date.now()}-bot`,
        text: response.responseText,
        sender: 'bot',
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      addBotMessage('Algo falló al generar la respuesta. Intenta otra vez en unos segundos.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-xl font-black text-white">∑</div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Prep Matemática</p>
              <h1 className="text-lg font-bold text-slate-950">Admisión UNAL e ICFES Saber 11</h1>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-wide text-emerald-700">Repaso guiado para estudiantes</p>
            <h2 className="max-w-3xl text-4xl font-black leading-tight text-slate-950 md:text-5xl">
              Matemáticas para entrar con más seguridad al examen.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
              Practica preguntas tipo admisión UNAL e ICFES Saber 11, revisa errores y recibe explicaciones paso a paso sin perderte en teoría innecesaria.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Entrenamiento rápido</h3>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">IA Tutor</span>
            </div>
            <div className="space-y-3">
              {modeQuickReplies.slice(0, 4).map(reply => (
                <button
                  key={reply.value}
                  type="button"
                  onClick={() => handleUserInput(reply.value)}
                  className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-800 transition hover:border-emerald-500 hover:bg-white"
                >
                  {reply.label}
                  <span className="text-slate-400">→</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Temas frecuentes</p>
              <h2 className="text-2xl font-black text-slate-950">Repasa lo que más aparece</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {topicCards.map(card => (
              <button
                key={card.title}
                type="button"
                onClick={() => {
                  setIsChatOpen(true);
                  setActiveMode('practice');
                  addBotMessage(`Listo. Practiquemos ${card.title}. Dime si quieres nivel básico, medio o alto.`);
                }}
                className="rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-md"
              >
                <h3 className="font-bold text-slate-950">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.text}</p>
              </button>
            ))}
          </div>
        </section>

        <footer className="border-t border-slate-200 bg-white px-5 py-6 text-center text-sm font-medium text-slate-600">
          Todos los derechos reservados - Jhonatan Solano - Matemático de la Universidad Nacional de Colombia.
        </footer>
      </main>

      <button
        type="button"
        onClick={() => setIsChatOpen(prev => !prev)}
        className="fixed bottom-5 right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-3xl font-black text-white shadow-[0_0_0_6px_rgba(16,185,129,0.16),0_18px_35px_rgba(15,23,42,0.30)] transition duration-200 hover:scale-125 hover:bg-emerald-700 hover:shadow-[0_0_0_10px_rgba(16,185,129,0.22),0_22px_45px_rgba(16,185,129,0.35)]"
        aria-label="Abrir chat de tutor"
      >
        ∑
      </button>

      {isChatOpen && (
        <section className="fixed bottom-24 right-5 z-40 flex h-[min(680px,calc(100vh-8rem))] w-[calc(100vw-2.5rem)] max-w-md flex-col rounded-lg border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 font-black text-white">∑</div>
              <div>
                <h2 className="font-bold text-slate-950">Tutor de matemáticas</h2>
                <p className="text-xs text-slate-500">UNAL · ICFES Saber 11</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsChatOpen(false)}
              className="rounded-full px-3 py-1 text-xl font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Cerrar chat"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
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
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            <UserInput onSubmit={handleUserInput} isLoading={isLoading} />
          </div>
        </section>
      )}
    </div>
  );
};

export default App;
