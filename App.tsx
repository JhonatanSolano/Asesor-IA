
import React, { useState, useEffect, useRef } from 'react';
import { Message, UserData, SavingsGoal, Analysis, ChatHistoryContent } from './types';
import { generateBotResponse } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import UserInput from './components/UserInput';
import SavingsChart from './components/SavingsChart';
import Spinner from './components/Spinner';

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
    setIsLoading(true);
    setAnalysis(null);

    try {
      const history: ChatHistoryContent[] = messages.map(msg => ({
        role: msg.sender === 'bot' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      }));
      
      const response = await generateBotResponse(history, userInput, { ...userData, ...savingsGoal });
      
      if (response) {
        const botMessage: Message = {
          id: `${Date.now()}-bot`,
          text: response.responseText,
          sender: 'bot',
        };
        setMessages(prev => [...prev, botMessage]);

        if (response.updatedData) {
            setUserData(prev => ({...prev, ...response.updatedData}));
            setSavingsGoal(prev => ({...prev, ...response.updatedData}));
        }
        if (response.action === "END" && response.analysis) {
            setAnalysis(response.analysis);
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
        {analysis && analysis.isViable && (
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