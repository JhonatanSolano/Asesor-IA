
import React, { useState, useEffect, useRef } from 'react';
import { Message, UserData, SavingsGoal, Analysis, ChatHistoryContent } from './types';
import { generateBotResponse } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import UserInput from './components/UserInput';
import SavingsChart from './components/SavingsChart';
import Spinner from './components/Spinner';

const isTechnicalMessage = (message: Message) => {
  if (message.sender !== 'bot') return false;

  return [
    'Error del Pana-Servidor:',
    '¡Uy, parce! El servidor respondió',
    '¡Uy, parce! Algo falló',
    '¡Uy, parce! 😬 Parece que algo',
    'Estoy con mucho tráfico',
  ].some(prefix => message.text.startsWith(prefix));
};

const parseTimelineInMonths = (timeline?: string) => {
  if (!timeline) return undefined;

  const normalized = timeline.toLowerCase();
  const value = Number(normalized.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.'));
  if (!value) return undefined;

  if (normalized.includes('año') || normalized.includes('ano')) {
    return Math.round(value * 12);
  }

  return Math.round(value);
};

const buildAnalysis = (
  data: UserData & SavingsGoal,
  modelAnalysis?: Analysis
): Analysis | null => {
  const income = Number(data.income);
  const expenses = Number(data.expenses);
  const goalAmount = Number(data.goalAmount);
  const goalTimelineInMonths = Number(data.goalTimelineInMonths) || parseTimelineInMonths(data.goalTimeline);

  if (!income || !goalAmount || !goalTimelineInMonths || Number.isNaN(expenses)) {
    return modelAnalysis || null;
  }

  const monthlyAvailable = income - expenses;
  const ahorroMensual = Math.max(monthlyAvailable * 0.2, 0);
  const ahorroNecesarioMensual = goalAmount / goalTimelineInMonths;
  const progresoPorcentaje = ahorroNecesarioMensual > 0
    ? (ahorroMensual / ahorroNecesarioMensual) * 100
    : 0;

  return {
    ...modelAnalysis,
    monthlyAvailable,
    ahorroMensual,
    ahorroNecesarioMensual,
    goalTimelineInMonths,
    progresoPorcentaje,
    isViable: ahorroMensual > 0 && progresoPorcentaje >= 50,
    sugerencias: modelAnalysis?.sugerencias?.length ? modelAnalysis.sugerencias : [
      'Separa el ahorro apenas recibas tus ingresos para que no se mezcle con los gastos del mes.',
      'Revisa los gastos variables y define un tope semanal para mantener el plan bajo control.',
      'Si quieres llegar antes, aumenta el porcentaje de ahorro o busca un ingreso extra puntual.',
    ],
  };
};

const getFinalMessage = (analysis: Analysis) => {
  if (analysis.isViable) {
    return '¡Listo! Ya tengo tu análisis completo. La meta se ve alcanzable con tu capacidad de ahorro actual; mira el resumen visual aquí abajo.';
  }

  return '¡Listo! Ya tengo tu análisis completo. La meta necesita algunos ajustes, pero aquí abajo ves exactamente qué mover para acercarte.';
};

const isClosingThanks = (input: string) =>
  /^(gracias|gracias[,. ]+ya|listo|ok|bueno|entendido|ya entend[ií])\b/i.test(input.trim());

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userData, setUserData] = useState<UserData>({});
  const [savingsGoal, setSavingsGoal] = useState<SavingsGoal>({});
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initialMessage: Message = {
      id: Date.now().toString(),
      text: "¡Qué más, parce! Soy Asesor-IA, tu Pana Financiero 🚀. Estoy aquí para ayudarte a organizar tus finanzas y alcanzar tus metas de ahorro. ¿Cómo te llamas?",
      sender: 'bot'
    };
    setMessages([initialMessage]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleUserInput = async (userInput: string) => {
    if (!userInput.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: userInput,
      sender: 'user',
    };
    setMessages(prev => [...prev, userMessage]);

    if (analysis && isClosingThanks(userInput)) {
      const botMessage: Message = {
        id: `${Date.now()}-bot`,
        text: '¡Con mucho gusto! Cuando quieras ajustar el plazo, el monto o revisar otra meta, aquí estoy para ayudarte.',
        sender: 'bot',
      };
      setMessages(prev => [...prev, botMessage]);
      return;
    }

    setIsLoading(true);

    try {
      const history: ChatHistoryContent[] = messages
        .filter(msg => !isTechnicalMessage(msg))
        .map(msg => ({
          role: msg.sender === 'bot' ? 'model' : 'user',
          parts: [{ text: msg.text }]
        }));
      
      const response = await generateBotResponse(history, userInput, { ...userData, ...savingsGoal });
      
      if (response) {
        const combinedData = { ...userData, ...savingsGoal, ...response.updatedData };
        const nextAnalysis = buildAnalysis(combinedData, response.analysis);
        const shouldCloseAnalysis = response.action === "END" || Boolean(nextAnalysis);
        const botText = shouldCloseAnalysis && nextAnalysis
          ? getFinalMessage(nextAnalysis)
          : response.responseText;
        const botMessage: Message = {
          id: `${Date.now()}-bot`,
          text: botText,
          sender: 'bot',
        };
        setMessages(prev => [...prev, botMessage]);

        if (response.updatedData) {
            setUserData(prev => ({...prev, ...response.updatedData}));
            setSavingsGoal(prev => ({...prev, ...response.updatedData}));
        }
        if (shouldCloseAnalysis) {
            setAnalysis(nextAnalysis);
        }
      } else {
        throw new Error("Invalid response from API");
      }

    } catch (error) {
      console.error("Error calling Gemini API:", error);
      const errorMessage: Message = {
        id: `${Date.now()}-error`,
        text: "¡Uy, parce! 😬 Parece que algo no está funcionando bien por acá. Dame un chance y vuelve a intentarlo más tarde, porfa.",
        sender: 'bot',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4 font-sans">
      <header className="text-center mb-4">
        <h1 className="text-3xl font-bold text-gray-800">
          Asesor-IA: Tu Pana Financiero 🐷💰
        </h1>
        <p className="text-gray-600">Tu guía amigable para unas finanzas más bacanas.</p>
      </header>
      
      <main className="flex-1 bg-white rounded-lg shadow-xl p-4 overflow-y-auto flex flex-col space-y-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && <Spinner />}
        {analysis && (
          <div className="bg-gray-50 rounded-lg p-4 shadow-inner">
            <h3 className="text-xl font-bold text-center mb-2 text-green-700">¡Análisis de tu Meta! 🚀</h3>
            <SavingsChart analysis={analysis} />
          </div>
        )}
        <div ref={chatEndRef} />
      </main>

      <footer className="mt-4">
        <UserInput onSubmit={handleUserInput} isLoading={isLoading} />
      </footer>
    </div>
  );
};

export default App;
