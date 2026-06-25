
import React, { useState, useEffect, useRef } from 'react';
import { Message, UserData, SavingsGoal, Analysis, ChatHistoryContent } from './types';
import { generateBotResponse } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import UserInput from './components/UserInput';
import SavingsChart from './components/SavingsChart';
import Spinner from './components/Spinner';

const initialBotMessage: Message = {
  id: 'initial-bot-message',
  text: "¡Qué más, parce! Soy Asesor-IA, tu Pana Financiero 🚀. Estoy aquí para ayudarte a organizar tus finanzas y alcanzar tus metas de ahorro. ¿Cómo te llamas?",
  sender: 'bot'
};

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

  const normalized = normalizeText(timeline);
  if (!/(ano|anos|mes|meses)/.test(normalized)) return undefined;

  const numericMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(anos?|mes(?:es)?)/);
  const unit = numericMatch?.[2] || normalized.match(/\b(anos?|mes(?:es)?)\b/)?.[1];
  const unitIndex = unit ? normalized.indexOf(unit) : -1;
  const beforeUnit = unitIndex >= 0 ? normalized.slice(0, unitIndex).split(/\s+/).slice(-5).join(' ') : normalized;
  let value = numericMatch
    ? Number(numericMatch[1].replace(',', '.'))
    : parseNumberValue(beforeUnit);

  if (value && /anos?\s+y\s+medio|anos?\s+y\s+media/.test(normalized)) {
    value += 0.5;
  }

  if (!value) return undefined;

  if (unit?.startsWith('ano') || normalized.includes('año') || normalized.includes('ano')) {
    return Math.round(value * 12);
  }

  return Math.round(value);
};

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  medio: 0.5,
  media: 0.5,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
};

const parseNumberWords = (input: string) => {
  const words = normalizeText(input).split(/\s+/);
  let total = 0;
  let found = false;

  for (let i = 0; i < words.length; i += 1) {
    const current = words[i];
    const next = words[i + 1];

    if (NUMBER_WORDS[current]) {
      found = true;
      total += NUMBER_WORDS[current];
      continue;
    }

    if (current === 'y' && next && NUMBER_WORDS[next] && (total >= 20 || next === 'medio' || next === 'media')) {
      total += NUMBER_WORDS[next];
      i += 1;
    }
  }

  return found ? total : undefined;
};

const parseNumberValue = (input: string) => {
  const normalized = normalizeText(input);
  const numericValue = Number(normalized.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.'));
  return numericValue || parseNumberWords(normalized);
};

const parseMoneyValueFromText = (input: string) => {
  const normalized = normalizeText(input).replace(/(\d)(m\b|millones?|palos?)/g, '$1 $2');
  const hasDigit = /\d/.test(normalized);
  const hasMoneyUnit = /\b(m|millon|millones|palos?|pesos?)\b/.test(normalized);
  if (!hasDigit && !hasMoneyUnit) return undefined;

  const value = parseNumberValue(normalized);
  if (!value) return undefined;

  if (/\b(m|millon|millones|palos?)\b/.test(normalized)) {
    return Math.round(value * 1000000);
  }

  return Math.round(value);
};

const parseMoneyNearKeywords = (input: string, keywords: string[]) => {
  const normalized = normalizeText(input);
  const words = normalized.split(/\s+/);
  const keywordIndex = words.findIndex(word => keywords.some(keyword => word.includes(keyword)));

  if (keywordIndex < 0) return undefined;

  const after = words.slice(keywordIndex, keywordIndex + 9).join(' ');
  const before = words.slice(Math.max(0, keywordIndex - 4), keywordIndex + 1).join(' ');
  return parseMoneyValueFromText(after) || parseMoneyValueFromText(before);
};

const parseExtraIncomeAmount = (input: string) => {
  const normalized = normalizeText(input);
  if (!/(extra|adicional|mas|gano mas|ingreso extra)/.test(normalized)) return undefined;

  return parseMoneyNearKeywords(input, ['extra', 'adicional'])
    || parseMoneyValueFromText(input);
};

const formatTimeline = (months?: number) => {
  if (!months) return 'el nuevo plazo';
  if (months % 12 === 0) return `${months / 12} años`;
  if (months > 12) return `${Number((months / 12).toFixed(1))} años`;
  return `${months} meses`;
};

const parseMoneyAmount = (input: string) => {
  return parseMoneyValueFromText(input);
};

const parseGoalAmount = (input: string) => {
  const normalized = normalizeText(input);
  if (!/(monto|vale|cuesta|valor|meta|millon|millones|palos|pesos|carro|moto|viaje)/i.test(normalized)) {
    return undefined;
  }

  return parseMoneyNearKeywords(input, ['vale', 'cuesta', 'valor', 'monto', 'meta'])
    || parseMoneyValueFromText(input);
};

type AdjustmentMode = 'extraIncome' | 'timeline' | 'expenses' | 'goalAmount';

const getAdjustmentMenu = () =>
  '¿Quieres ajustar algo más?\n\n' +
  '1. Sumar ingreso extra 💼\n' +
  '2. Cambiar plazo 🗓️\n' +
  '3. Cambiar gastos mensuales 💸\n' +
  '4. Cambiar monto de la meta 🎯\n' +
  '5. Estoy satisfecho ✅';

const getAdjustmentModeFromInput = (input: string): AdjustmentMode | 'done' | null => {
  const normalized = normalizeText(input);

  if (/^(5|cinco)\b/.test(normalized) || isClosingThanks(input)) return 'done';
  if (/^(1|uno)\b/.test(normalized) || /(ingreso extra|extra|adicional|gano mas|otra entrada|rebusque)/.test(normalized)) return 'extraIncome';
  if (/^(2|dos)\b/.test(normalized) || /(plazo|tiempo|meses|anos|ano|anios|años)/.test(normalized)) return 'timeline';
  if (/^(3|tres)\b/.test(normalized) || /(gasto|gastos|egreso|arriendo|mercado)/.test(normalized)) return 'expenses';
  if (/^(4|cuatro)\b/.test(normalized) || /(monto|valor|cuesta|vale|meta)/.test(normalized)) return 'goalAmount';

  return null;
};

const getAdjustmentPrompt = (mode: AdjustmentMode) => {
  if (mode === 'extraIncome') {
    return 'De una, sumemos ese ingreso extra 💼. ¿Cuánto ingreso extra mensual quieres agregar? Ej: "800 mil extra" o "2 millones adicionales".';
  }

  if (mode === 'timeline') {
    return 'Listo, ajustemos el plazo 🗓️. ¿En cuánto tiempo quieres lograr la meta? Ej: "8 meses", "2.5 años" o "30 meses".';
  }

  if (mode === 'expenses') {
    return 'Hagámosle a los gastos 💸. Dime el nuevo total de gastos mensuales. Ej: "mis gastos ahora son 2.8 millones".';
  }

  return 'Perfecto, cambiemos el monto de la meta 🎯. ¿Cuál es el nuevo valor total? Ej: "la meta ahora vale 18 millones".';
};

const applyPostAnalysisAdjustment = (
  input: string,
  data: UserData & SavingsGoal
) => {
  const normalized = input.toLowerCase();
  const goalTimelineInMonths = parseTimelineInMonths(input);
  const goalAmount = parseGoalAmount(input);
  const income = parseMoneyNearKeywords(input, ['ingreso', 'ingresos', 'gano', 'gana', 'salario', 'mensualidad']);
  const extraIncome = parseExtraIncomeAmount(input);
  const expenses = parseMoneyNearKeywords(input, ['gasto', 'gastos', 'egreso', 'arriendo', 'mercado']);

  if (!goalTimelineInMonths && !goalAmount && !income && !extraIncome && !expenses) {
    return null;
  }

  return {
    ...data,
    ...(goalTimelineInMonths ? {
      goalTimelineInMonths,
      goalTimeline: formatTimeline(goalTimelineInMonths),
    } : {}),
    ...(goalAmount ? { goalAmount } : {}),
    ...(income ? { income: /extra|adicional|mas/.test(normalizeText(input)) && data.income ? data.income + income : income } : {}),
    ...(extraIncome && !income ? { income: (data.income || 0) + extraIncome } : {}),
    ...(expenses ? { expenses } : {}),
  };
};

const hydratePlanData = (
  data: UserData & SavingsGoal,
  currentAnalysis?: Analysis | null
) => {
  const goalTimelineInMonths = Number(data.goalTimelineInMonths)
    || parseTimelineInMonths(data.goalTimeline)
    || currentAnalysis?.goalTimelineInMonths;
  const goalAmount = Number(data.goalAmount)
    || (currentAnalysis?.ahorroNecesarioMensual && goalTimelineInMonths
      ? Math.round(currentAnalysis.ahorroNecesarioMensual * goalTimelineInMonths)
      : undefined);
  const income = Number(data.income) || undefined;
  const expenses = Number(data.expenses) || undefined;
  const explicitMonthlyAvailable = Number(data.monthlyAvailable) || undefined;
  const monthlyAvailable = explicitMonthlyAvailable
    || (income && !Number.isNaN(expenses) ? income - expenses : undefined)
    || currentAnalysis?.monthlyAvailable
    || (currentAnalysis?.ahorroMensual ? currentAnalysis.ahorroMensual / 0.2 : undefined);

  return {
    ...data,
    income: income || (expenses && monthlyAvailable ? expenses + monthlyAvailable : undefined),
    expenses: expenses || (income && monthlyAvailable ? income - monthlyAvailable : undefined),
    monthlyAvailable,
    goalAmount,
    goalTimelineInMonths,
    goalTimeline: data.goalTimeline || formatTimeline(goalTimelineInMonths),
  };
};

const getMissingPlanFields = (data: UserData & SavingsGoal) => {
  const missing: string[] = [];
  const hasMonthlyAvailable = Number(data.monthlyAvailable) > 0;
  if (!hasMonthlyAvailable && !Number(data.income)) missing.push('ingresos mensuales');
  if (!hasMonthlyAvailable && (Number.isNaN(Number(data.expenses)) || data.expenses === undefined)) missing.push('gastos mensuales');
  if (!Number(data.goalAmount)) missing.push('monto de la meta');
  if (!Number(data.goalTimelineInMonths) && !parseTimelineInMonths(data.goalTimeline)) missing.push('plazo');
  return missing;
};

const buildAnalysis = (
  data: UserData & SavingsGoal,
  modelAnalysis?: Analysis
): Analysis | null => {
  const income = Number(data.income);
  const expenses = Number(data.expenses);
  const savedMonthlyAvailable = Number(data.monthlyAvailable);
  const goalAmount = Number(data.goalAmount);
  const goalTimelineInMonths = Number(data.goalTimelineInMonths) || parseTimelineInMonths(data.goalTimeline);
  const monthlyAvailable = savedMonthlyAvailable || (income && !Number.isNaN(expenses) ? income - expenses : undefined);

  if (!monthlyAvailable || !goalAmount || !goalTimelineInMonths) {
    return modelAnalysis || null;
  }

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
  const followUp = `\n\n${getAdjustmentMenu()}`;

  if (analysis.isViable) {
    return `¡Listo! Ya tengo tu análisis completo. La meta se ve alcanzable con tu capacidad de ahorro actual; mira el resumen visual aquí abajo.${followUp}`;
  }

  return `¡Listo! Ya tengo tu análisis completo. La meta necesita algunos ajustes, pero aquí abajo ves exactamente qué mover para acercarte.${followUp}`;
};

const normalizeText = (input: string) =>
  input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const isClosingThanks = (input: string) => {
  const normalized = normalizeText(input);

  return [
    /^vale[,\s]+gracias\b/,
    /^gracias\b/,
    /^muchas gracias\b/,
    /^listo\b/,
    /^ok\b/,
    /^bueno\b/,
    /^entendido\b/,
    /^ya entendi\b/,
    /^nada mas\b/,
    /^eso es todo\b/,
    /^eso era todo\b/,
    /^terminamos\b/,
    /^finalicemos\b/,
    /^cerrar\b/,
    /^chao\b/,
    /^bye\b/,
    /^hasta luego\b/,
  ].some(pattern => pattern.test(normalized));
};

const getPostAnalysisMessage = (input: string) => {
  const normalized = input.toLowerCase();

  if (isClosingThanks(input)) {
    return '¡Con mucho gusto! Me alegra que te haya servido el análisis. Cuando quieras revisar otra meta, aquí estaré para ayudarte.';
  }

  if (normalized.includes('plazo') || normalized.includes('tiempo')) {
    return 'Claro, ajustamos el plazo. Dime el nuevo tiempo completo, por ejemplo: "en 8 meses", "a 2.5 años" o "en 30 meses".';
  }

  if (normalized.includes('monto') || normalized.includes('meta') || normalized.includes('valor')) {
    return 'Listo, ajustamos el monto. Dime el nuevo valor completo, por ejemplo: "la meta ahora vale 4 millones".';
  }

  if (normalized.includes('gano mas') || normalized.includes('gano más') || normalized.includes('extra')) {
    return 'Súper. ¿Cuánto más ganas al mes? Puedes decirme algo como "2 millones extra" o "gano 800 mil más".';
  }

  if (normalized.includes('gasto') || normalized.includes('ingreso')) {
    return 'Listo, ajustamos tus datos mensuales. Dime el valor completo, por ejemplo: "gano 6 millones", "tengo 2 millones extra" o "mis gastos son 2.5 millones".';
  }

  return `Claro, lo seguimos revisando. Escoge qué quieres ajustar:\n\n${getAdjustmentMenu()}`;
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([initialBotMessage]);
  const [userData, setUserData] = useState<UserData>({});
  const [savingsGoal, setSavingsGoal] = useState<SavingsGoal>({});
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [planData, setPlanData] = useState<(UserData & SavingsGoal) | null>(null);
  const [adjustmentMode, setAdjustmentMode] = useState<AdjustmentMode | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.localStorage.removeItem('asesor-ia-chat-state');
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

    if (analysis) {
      const basePlan = planData || hydratePlanData({ ...userData, ...savingsGoal }, analysis);
      const selectedMode = adjustmentMode || getAdjustmentModeFromInput(userInput);

      if (selectedMode === 'done') {
        setAdjustmentMode(null);
        const botMessage: Message = {
          id: `${Date.now()}-bot`,
          text: '¡Con mucho gusto! Me alegra que te haya servido el análisis. Si más adelante quieres ajustar algo o revisar otra meta, aquí sigo para ayudarte.',
          sender: 'bot',
        };
        setMessages(prev => [...prev, botMessage]);
        return;
      }

      if (selectedMode && selectedMode !== 'done') {
        const valueFromInput = selectedMode === 'timeline'
          ? parseTimelineInMonths(userInput)
          : parseMoneyAmount(userInput);

        if (!adjustmentMode && !valueFromInput) {
          setAdjustmentMode(selectedMode);
          const botMessage: Message = {
            id: `${Date.now()}-bot`,
            text: getAdjustmentPrompt(selectedMode),
            sender: 'bot',
          };
          setMessages(prev => [...prev, botMessage]);
          return;
        }

        let completeAdjustedData: UserData & SavingsGoal | null = null;
        let adjustmentLabel = 'los nuevos datos';

        if (selectedMode === 'extraIncome') {
          const extraIncome = parseExtraIncomeAmount(userInput) || parseMoneyAmount(userInput);

          if (!extraIncome) {
            setAdjustmentMode('extraIncome');
            const botMessage: Message = {
              id: `${Date.now()}-bot`,
              text: getAdjustmentPrompt('extraIncome'),
              sender: 'bot',
            };
            setMessages(prev => [...prev, botMessage]);
            return;
          }

          const currentMonthlyAvailable = Number(basePlan.monthlyAvailable)
            || (Number(basePlan.income) && !Number.isNaN(Number(basePlan.expenses))
              ? Number(basePlan.income) - Number(basePlan.expenses)
              : 0);
          const nextMonthlyAvailable = currentMonthlyAvailable + extraIncome;

          completeAdjustedData = hydratePlanData({
            ...basePlan,
            income: Number(basePlan.income) ? Number(basePlan.income) + extraIncome : undefined,
            monthlyAvailable: nextMonthlyAvailable,
          }, analysis);
          adjustmentLabel = `ingreso extra de ${extraIncome.toLocaleString('es-CO')} pesos mensuales`;
        }

        if (selectedMode === 'timeline') {
          const goalTimelineInMonths = parseTimelineInMonths(userInput);

          if (!goalTimelineInMonths) {
            setAdjustmentMode('timeline');
            const botMessage: Message = {
              id: `${Date.now()}-bot`,
              text: getAdjustmentPrompt('timeline'),
              sender: 'bot',
            };
            setMessages(prev => [...prev, botMessage]);
            return;
          }

          completeAdjustedData = hydratePlanData({
            ...basePlan,
            goalTimelineInMonths,
            goalTimeline: formatTimeline(goalTimelineInMonths),
          }, analysis);
          adjustmentLabel = `plazo de ${formatTimeline(goalTimelineInMonths)}`;
        }

        if (selectedMode === 'expenses') {
          const expenses = parseMoneyAmount(userInput);

          if (!expenses) {
            setAdjustmentMode('expenses');
            const botMessage: Message = {
              id: `${Date.now()}-bot`,
              text: getAdjustmentPrompt('expenses'),
              sender: 'bot',
            };
            setMessages(prev => [...prev, botMessage]);
            return;
          }

          const income = Number(basePlan.income) || undefined;
          completeAdjustedData = hydratePlanData({
            ...basePlan,
            expenses,
            monthlyAvailable: income ? income - expenses : basePlan.monthlyAvailable,
          }, analysis);
          adjustmentLabel = `gastos mensuales de ${expenses.toLocaleString('es-CO')} pesos`;
        }

        if (selectedMode === 'goalAmount') {
          const goalAmount = parseGoalAmount(userInput) || parseMoneyAmount(userInput);

          if (!goalAmount) {
            setAdjustmentMode('goalAmount');
            const botMessage: Message = {
              id: `${Date.now()}-bot`,
              text: getAdjustmentPrompt('goalAmount'),
              sender: 'bot',
            };
            setMessages(prev => [...prev, botMessage]);
            return;
          }

          completeAdjustedData = hydratePlanData({
            ...basePlan,
            goalAmount,
          }, analysis);
          adjustmentLabel = `monto de meta de ${goalAmount.toLocaleString('es-CO')} pesos`;
        }

        if (completeAdjustedData) {
          const nextAnalysis = buildAnalysis(completeAdjustedData);
          const missingFields = getMissingPlanFields(completeAdjustedData);
          const adjustmentMessage: Message = {
            id: `${Date.now()}-bot`,
            text: nextAnalysis
              ? `¡Listo! Ajusté el análisis con ${adjustmentLabel}. Revisa cómo cambia el plan aquí abajo.\n\n${getAdjustmentMenu()}`
              : `Listo, tomé el ajuste. Para recalcular bien me falta: ${missingFields.join(', ')}.`,
            sender: 'bot',
            analysis: nextAnalysis || undefined,
          };

          setAdjustmentMode(null);
          setUserData({
            name: completeAdjustedData.name,
            income: completeAdjustedData.income,
            expenses: completeAdjustedData.expenses,
            monthlyAvailable: completeAdjustedData.monthlyAvailable,
          });
          setSavingsGoal({
            goalName: completeAdjustedData.goalName,
            goalAmount: completeAdjustedData.goalAmount,
            goalTimeline: completeAdjustedData.goalTimeline,
            goalStartDate: completeAdjustedData.goalStartDate,
            goalTimelineInMonths: completeAdjustedData.goalTimelineInMonths,
          });
          setPlanData(completeAdjustedData);
          if (nextAnalysis) {
            setAnalysis(nextAnalysis);
          }
          setMessages(prev => [...prev, adjustmentMessage]);
          return;
        }
      }

      const adjustedData = applyPostAnalysisAdjustment(userInput, basePlan);

      if (adjustedData) {
        const completeAdjustedData = hydratePlanData(adjustedData, analysis);
        const nextAnalysis = buildAnalysis(completeAdjustedData);
        const missingFields = getMissingPlanFields(completeAdjustedData);
        const adjustmentMessage: Message = {
          id: `${Date.now()}-bot`,
          text: nextAnalysis
            ? `¡Listo! Ajusté el análisis con ${completeAdjustedData.goalTimeline ? `plazo de ${completeAdjustedData.goalTimeline}` : 'los nuevos datos'}. Revisa cómo cambia el plan aquí abajo.\n\n${getAdjustmentMenu()}`
            : `Listo, tomé el ajuste. Para recalcular bien me falta: ${missingFields.join(', ')}.`,
          sender: 'bot',
          analysis: nextAnalysis || undefined,
        };

        setUserData({
          name: completeAdjustedData.name,
          income: completeAdjustedData.income,
          expenses: completeAdjustedData.expenses,
          monthlyAvailable: completeAdjustedData.monthlyAvailable,
        });
        setSavingsGoal({
          goalName: completeAdjustedData.goalName,
          goalAmount: completeAdjustedData.goalAmount,
          goalTimeline: completeAdjustedData.goalTimeline,
          goalStartDate: completeAdjustedData.goalStartDate,
          goalTimelineInMonths: completeAdjustedData.goalTimelineInMonths,
        });
        setPlanData(completeAdjustedData);
        if (nextAnalysis) {
          setAnalysis(nextAnalysis);
        }
        setMessages(prev => [...prev, adjustmentMessage]);
        return;
      }

      const botMessage: Message = {
        id: `${Date.now()}-bot`,
        text: getPostAnalysisMessage(userInput),
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
          analysis: shouldCloseAnalysis && nextAnalysis ? nextAnalysis : undefined,
        };
        setMessages(prev => [...prev, botMessage]);

        if (response.updatedData) {
            setUserData(prev => ({...prev, ...response.updatedData}));
            setSavingsGoal(prev => ({...prev, ...response.updatedData}));
        }
        if (shouldCloseAnalysis) {
            setAnalysis(nextAnalysis);
            setPlanData(hydratePlanData(combinedData, nextAnalysis));
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
          <React.Fragment key={msg.id}>
            <ChatMessage message={msg} />
            {msg.analysis && (
              <div className="bg-gray-50 rounded-lg p-4 shadow-inner">
                <h3 className="text-xl font-bold text-center mb-2 text-green-700">¡Análisis de tu Meta! 🚀</h3>
                <SavingsChart analysis={msg.analysis} />
              </div>
            )}
          </React.Fragment>
        ))}
        {isLoading && <Spinner />}
        <div ref={chatEndRef} />
      </main>

      <footer className="mt-4">
        <UserInput onSubmit={handleUserInput} isLoading={isLoading} />
      </footer>
    </div>
  );
};

export default App;
