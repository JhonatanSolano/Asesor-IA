
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Analysis } from '../types';

interface SavingsChartProps {
  analysis: Analysis;
}

const SavingsChart: React.FC<SavingsChartProps> = ({ analysis }) => {
  const progress = Math.round(analysis.progresoPorcentaje);
  const data = [
    {
      name: 'Progreso de la Meta',
      progreso: progress > 100 ? 100 : progress, // Cap at 100 for visual clarity
      restante: progress > 100 ? 0 : 100 - progress,
    },
  ];

  return (
    <div style={{ width: '100%', height: 300 }}>
        <p className="text-center text-gray-700 mb-2">Con tu capacidad de ahorro mensual de <strong>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(analysis.ahorroMensual)}</strong>, ¡así vas para tu meta!</p>
        <ResponsiveContainer>
            <BarChart layout="vertical" data={data} stackOffset="expand" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <XAxis type="number" hide domain={[0, 100]} />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip
                formatter={(value: number) => `${value}%`}
                cursor={{ fill: 'transparent' }}
            />
            <Bar dataKey="progreso" fill="#4CAF50" stackId="a" radius={[10, 0, 0, 10]}>
                 <Cell fill="#4CAF50" />
            </Bar>
            <Bar dataKey="restante" fill="#e0e0e0" stackId="a" radius={[0, 10, 10, 0]}>
                 <Cell fill="#e0e0e0" />
            </Bar>
            </BarChart>
        </ResponsiveContainer>
         <div className="text-center font-bold text-2xl" style={{ color: '#4CAF50' }}>
            {progress}% ¡Chévere!
        </div>
    </div>
  );
};

export default SavingsChart;
