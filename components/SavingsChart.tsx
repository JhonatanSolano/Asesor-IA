import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Analysis } from '../types';

interface SavingsChartProps {
  analysis: Analysis;
}

const formatCOP = (value = 0) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);

const StatCard: React.FC<{ icon: string; label: string; value: string; tone?: 'green' | 'amber' | 'blue' }> = ({
  icon,
  label,
  value,
  tone = 'blue',
}) => {
  const tones = {
    green: 'border-green-200 bg-green-50 text-green-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    blue: 'border-sky-200 bg-sky-50 text-sky-800',
  };

  return (
    <div className={`rounded-md border p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal opacity-75">
        <span className="text-base" aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold leading-tight">{value}</div>
    </div>
  );
};

const SavingsChart: React.FC<SavingsChartProps> = ({ analysis }) => {
  const progress = Math.max(Math.round(analysis.progresoPorcentaje), 0);
  const cappedProgress = Math.min(progress, 100);
  const needed = analysis.ahorroNecesarioMensual ?? 0;
  const chartData = [
    {
      name: 'Ahorro mensual',
      value: Math.round(analysis.ahorroMensual),
      fill: '#16a34a',
    },
    {
      name: 'Necesario',
      value: Math.round(needed),
      fill: '#2563eb',
    },
  ];

  return (
    <div className="space-y-4 text-gray-800">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon="🐷"
          label="Puedes ahorrar"
          value={formatCOP(analysis.ahorroMensual)}
          tone={analysis.isViable ? 'green' : 'amber'}
        />
        <StatCard icon="🎯" label="Necesitas ahorrar" value={formatCOP(needed)} />
        <StatCard
          icon="🗓️"
          label="Plazo"
          value={`${analysis.goalTimelineInMonths ?? '-'} meses`}
          tone="blue"
        />
      </div>

      <div className="rounded-md border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Avance mensual frente a la meta</span>
          <span className={`text-sm font-bold ${analysis.isViable ? 'text-green-700' : 'text-amber-700'}`}>
            {progress}%
          </span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full ${analysis.isViable ? 'bg-green-500' : 'bg-amber-500'}`}
            style={{ width: `${cappedProgress}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-gray-600">
          {analysis.isViable
            ? 'La meta va bien encaminada con tu capacidad de ahorro actual.'
            : 'La meta necesita un ajuste de ahorro, plazo o gastos para sentirse más cómoda.'}
        </p>
      </div>

      <div className="h-64 rounded-md border border-gray-200 bg-white p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 16, left: 8, bottom: 8 }}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} width={54} />
            <Tooltip formatter={(value: number) => formatCOP(value)} cursor={{ fill: '#f3f4f6' }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-md border border-gray-200 bg-white p-4">
        <h4 className="mb-2 text-sm font-bold text-gray-700">Siguientes pasos</h4>
        <ul className="space-y-2 text-sm text-gray-700">
          {analysis.sugerencias.map((suggestion) => (
            <li key={suggestion} className="flex gap-2">
              <span className="mt-0.5 flex-none" aria-hidden="true">✨</span>
              <span>{suggestion}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SavingsChart;
