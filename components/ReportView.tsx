
import React, { useState } from 'react';
import { ProjectState, ReportSectionConfig } from '../types';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { generateReportAnalysis } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface ReportViewProps {
  project: ProjectState;
  updateAnalysis: (text: string) => void;
}

// Helper for Stats
const getStats = (data: any[], key: string) => {
    const values = data.map(d => d[key]);
    if (values.length === 0) return { min: 0, max: 0, avg: 0, total: 0, median: 0, maxMonth: '', minMonth: '', trend: 'Estável' };

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Find Max/Min Month
    const maxItem = data.find(d => d[key] === max);
    const minItem = data.find(d => d[key] === min);

    // Median
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    // Simple Trend (First half avg vs Last half avg)
    const half = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, half).reduce((a, b) => a + b, 0) / (half || 1);
    const secondHalf = values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half || 1);
    let trend = 'Estável';
    if (secondHalf > firstHalf * 1.05) trend = 'Crescente';
    if (secondHalf < firstHalf * 0.95) trend = 'Decrescente';

    return {
        min,
        max,
        avg,
        total: sum, 
        median,
        maxMonth: maxItem?.name || '',
        minMonth: minItem?.name || '',
        trend
    };
};

// Componente auxiliar para gráficos do relatório
const ReportChart: React.FC<{ data: any[], dataKey: string, name: string, color: string }> = ({ data, dataKey, name, color }) => (
    <div className="h-64 w-full border border-gray-200 p-2 bg-white">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 9}} interval={0} />
                <YAxis tick={{fontSize: 10}} />
                <Tooltip />
                <Legend />
                <Bar dataKey={dataKey} name={name} fill={color} />
            </BarChart>
        </ResponsiveContainer>
    </div>
);

const ReportView: React.FC<ReportViewProps> = ({ project, updateAnalysis }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Section Visibility Configuration
  const [sections, setSections] = useState<ReportSectionConfig>({
      intro: true,
      active: true,
      inductive: true,
      capacitive: true,
      tables: true,
      ai: true,
      conclusion: true
  });

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    const text = await generateReportAnalysis(project.hourlyData, project.metadata);
    updateAnalysis(text);
    setIsGenerating(false);
  };

  // Aggregated data for Report (Monthly)
  const monthlyData = React.useMemo(() => {
    const map: Record<string, any> = {};
    project.hourlyData.forEach(d => {
        const key = d.timestamp.toLocaleString('pt-PT', { month: 'short' });
        if(!map[key]) map[key] = { 
            name: key, 
            activeSumAvg: 0, activeMax: 0, activeSum: 0,
            indSumAvg: 0, indMax: 0, indSum: 0,
            capSumAvg: 0, capMax: 0, capSum: 0,
            count: 0, 
            order: d.timestamp.getMonth() 
        };
        
        // Sum of averages (for calculating monthly average later)
        map[key].activeSumAvg += d.activeAvg;
        map[key].indSumAvg += d.inductiveAvg;
        map[key].capSumAvg += d.capacitiveAvg;

        // True Max (Peak)
        map[key].activeMax = Math.max(map[key].activeMax, d.activeMax);
        map[key].indMax = Math.max(map[key].indMax, d.inductiveMax);
        map[key].capMax = Math.max(map[key].capMax, d.capacitiveMax);

        // True Sum (Energy) - Assuming 1h interval data, Avg Power * 1h = Energy
        map[key].activeSum += d.activeAvg; 
        map[key].indSum += d.inductiveAvg;
        map[key].capSum += d.capacitiveAvg;

        map[key].count++;
    });

    return Object.values(map).sort((a: any, b: any) => a.order - b.order).map((v: any) => ({
        name: v.name,
        // Averages
        active: v.activeSumAvg / v.count,
        inductive: v.indSumAvg / v.count,
        capacitive: v.capSumAvg / v.count,
        // Maxes
        activeMax: v.activeMax,
        inductiveMax: v.indMax,
        capacitiveMax: v.capMax,
        // Sums (Totals)
        activeSum: v.activeSum,
        inductiveSum: v.indSum,
        capacitiveSum: v.capSum
    }));
  }, [project.hourlyData]);

  // Determine date range
  const dateRange = React.useMemo(() => {
      if (project.hourlyData.length === 0) return { start: '-', end: '-' };
      const start = project.hourlyData[0].timestamp.toLocaleDateString('pt-PT');
      const end = project.hourlyData[project.hourlyData.length - 1].timestamp.toLocaleDateString('pt-PT');
      return { start, end };
  }, [project.hourlyData]);

  const activeStats = getStats(monthlyData, 'active');
  const indStats = getStats(monthlyData, 'inductive');
  const capStats = getStats(monthlyData, 'capacitive');
  
  // Stats for Max table
  const activeMaxStats = getStats(monthlyData, 'activeMax');
  const indMaxStats = getStats(monthlyData, 'inductiveMax');
  const capMaxStats = getStats(monthlyData, 'capacitiveMax');

  // Stats for Sum table
  const activeSumStats = getStats(monthlyData, 'activeSum');
  const indSumStats = getStats(monthlyData, 'inductiveSum');
  const capSumStats = getStats(monthlyData, 'capacitiveSum');

  return (
    <div className="max-w-4xl mx-auto bg-white text-black leading-relaxed font-sans">
      
      {/* --- Control Bar (No Print) --- */}
      <div className="no-print bg-slate-800 text-white p-4 mb-8 rounded shadow-lg sticky top-4 z-50">
        <div className="flex justify-between items-center mb-4 border-b border-gray-600 pb-2">
            <div>
                <h2 className="font-bold">Configuração do Relatório</h2>
                <p className="text-xs text-slate-300">Selecione as secções que deseja incluir.</p>
            </div>
             <div className="flex gap-4">
                <button 
                    onClick={handleGenerateAI}
                    disabled={isGenerating}
                    className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded text-sm font-medium transition disabled:opacity-50"
                >
                    {isGenerating ? 'A gerar texto...' : 'Gerar Análise IA'}
                </button>
                <button 
                    onClick={() => window.print()}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-medium transition"
                >
                    Imprimir / PDF
                </button>
            </div>
        </div>
        
        {/* Toggles */}
        <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={sections.intro} onChange={e => setSections(p => ({...p, intro: e.target.checked}))} className="rounded" />
                <span>Introdução</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={sections.active} onChange={e => setSections(p => ({...p, active: e.target.checked}))} className="rounded" />
                <span>Análise Ativa</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={sections.inductive} onChange={e => setSections(p => ({...p, inductive: e.target.checked}))} className="rounded" />
                <span>Análise Indutiva</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={sections.capacitive} onChange={e => setSections(p => ({...p, capacitive: e.target.checked}))} className="rounded" />
                <span>Análise Capacitiva</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={sections.tables} onChange={e => setSections(p => ({...p, tables: e.target.checked}))} className="rounded" />
                <span>Tabelas Detalhadas</span>
            </label>
             <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={sections.ai} onChange={e => setSections(p => ({...p, ai: e.target.checked}))} className="rounded" />
                <span>Parecer IA</span>
            </label>
        </div>
      </div>

      {/* --- Page 1: Cover (Always Visible) --- */}
      <div className="min-h-[297mm] p-16 flex flex-col justify-between border-b-2 border-gray-100 page-break break-after-page print:break-after-page">
        <div className="text-right border-b-4 border-slate-900 pb-4">
             <h1 className="text-6xl font-black tracking-tighter text-slate-900 mb-2">RELATÓRIO</h1>
             <h2 className="text-3xl font-light text-slate-600 uppercase">Análise de Energia</h2>
        </div>

        <div className="my-12">
            <div className="bg-slate-50 p-8 rounded-l-lg border-l-8 border-blue-600">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Instalação</h3>
                <p className="text-4xl font-bold text-slate-800 mb-2">{project.metadata.name}</p>
                {project.metadata.cpe && (
                   <p className="text-sm font-mono text-blue-600 mb-2 bg-blue-50 inline-block px-2 py-1 rounded border border-blue-100">
                       CPE: {project.metadata.cpe}
                   </p>
                )}
                <p className="text-xl text-slate-600 mt-2">{project.metadata.location}</p>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-8 text-sm text-gray-600">
            <div>
                <p className="uppercase font-bold text-gray-400 text-xs">Técnico Responsável</p>
                <p className="text-lg font-medium">{project.metadata.technician}</p>
            </div>
            <div className="text-right">
                <p className="uppercase font-bold text-gray-400 text-xs">Data do Relatório</p>
                <p className="text-lg font-medium">{project.metadata.reportDate}</p>
            </div>
        </div>
        
        <div className="text-center mt-12 pt-8 border-t border-gray-200">
            <p className="font-bold text-xl tracking-widest">K-DATAELECT</p>
            <p className="text-xs text-gray-400 mt-2">Powered by Koelho2000</p>
        </div>
      </div>

      {/* --- Page 2: Index (Table of Contents) --- */}
      <div className="min-h-[297mm] p-16 page-break break-after-page print:break-after-page">
        <h2 className="text-3xl font-bold text-slate-900 mb-12 border-b border-slate-900 pb-4">Índice</h2>
        <ul className="space-y-6 text-lg">
            {sections.intro && (
            <li className="flex justify-between border-b border-gray-100 pb-2">
                <span className="font-medium text-slate-700">1. Introdução e Resumo Geral</span>
                <span className="text-gray-400">--</span>
            </li>
            )}
            {sections.active && (
            <li className="flex justify-between border-b border-gray-100 pb-2">
                <span className="font-medium text-slate-700">2. Análise de Potência Ativa (Consumo)</span>
                <span className="text-gray-400">--</span>
            </li>
            )}
            {sections.inductive && (
            <li className="flex justify-between border-b border-gray-100 pb-2">
                <span className="font-medium text-slate-700">3. Análise de Energia Reativa Indutiva</span>
                <span className="text-gray-400">--</span>
            </li>
            )}
            {sections.capacitive && (
             <li className="flex justify-between border-b border-gray-100 pb-2">
                <span className="font-medium text-slate-700">4. Análise de Energia Reativa Capacitiva</span>
                <span className="text-gray-400">--</span>
            </li>
            )}
            {sections.tables && (
            <li className="flex justify-between border-b border-gray-100 pb-2">
                <span className="font-medium text-slate-700">5. Tabelas Detalhadas</span>
                <span className="text-gray-400">--</span>
            </li>
            )}
            {sections.ai && (
            <li className="flex justify-between border-b border-gray-100 pb-2">
                <span className="font-medium text-slate-700">6. Parecer Técnico (IA)</span>
                <span className="text-gray-400">--</span>
            </li>
            )}
             {sections.conclusion && (
             <li className="flex justify-between border-b border-gray-100 pb-2">
                <span className="font-medium text-slate-700">7. Conclusão</span>
                <span className="text-gray-400">--</span>
            </li>
            )}
        </ul>
      </div>

      {/* --- Page 3: General Summary --- */}
      {sections.intro && (
      <div className="min-h-[297mm] p-16 page-break break-after-page print:break-after-page">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-2 border-b border-gray-300">1. Resumo Geral de Cargas</h2>
        
        {/* Methodology Subsection */}
        <div className="mb-8 border-b border-gray-200 pb-6">
            <h3 className="text-lg font-bold text-slate-800 mb-3">1.1 Metodologia e Caracterização dos Dados</h3>
            <p className="text-sm text-gray-700 text-justify mb-4">
                O presente estudo baseia-se na análise de dados de telecontagem importados para a plataforma K-DATAELECT. 
                Os dados originais foram normalizados para permitir uma avaliação precisa do perfil de consumo.
            </p>
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded text-sm border border-gray-200">
                <div>
                    <span className="block font-bold text-gray-500 text-xs uppercase">Período de Análise</span>
                    <span className="font-medium">{dateRange.start} a {dateRange.end}</span>
                </div>
                <div>
                    <span className="block font-bold text-gray-500 text-xs uppercase">Origem dos Dados</span>
                    <span className="font-medium">{project.metadata.filesCount || '-'} ficheiros importados</span>
                </div>
                <div>
                    <span className="block font-bold text-gray-500 text-xs uppercase">Volume de Dados</span>
                    <span className="font-medium">{project.metadata.totalRecords?.toLocaleString() || '-'} registos processados</span>
                </div>
                <div>
                    <span className="block font-bold text-gray-500 text-xs uppercase">Intervalo de Integração</span>
                    <span className="font-medium">{project.metadata.sourceInterval || '15m'} (Agregado em Médias Horárias)</span>
                </div>
            </div>
            <p className="text-xs text-gray-500 mt-2 italic">
                * Nota Técnica: A agregação para valores horários foi efetuada através da média aritmética dos 4 períodos de 15 minutos (ou equivalente) para a potência, mantendo a consistência energética.
            </p>
        </div>

        <p className="mb-6 text-gray-700 text-justify">
            Abaixo apresenta-se o perfil de carga anual da instalação, discriminado por tipologia de energia (Ativa, Indutiva e Capacitiva). 
            A análise baseia-se nas médias mensais recolhidas.
        </p>

        {/* Global Chart */}
        <div className="h-64 w-full mb-8 border border-gray-200 p-4">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{fontSize: 10}} />
                    <YAxis tick={{fontSize: 10}} />
                    <Tooltip />
                    <Legend verticalAlign="top" />
                    <Bar dataKey="active" name="Ativa (kW)" fill="#2563eb" />
                    <Bar dataKey="inductive" name="Indutiva (kVAr)" fill="#dc2626" />
                    <Bar dataKey="capacitive" name="Capacitiva (kVAr)" fill="#16a34a" />
                </BarChart>
             </ResponsiveContainer>
             <p className="text-center text-xs text-gray-500 mt-2 italic">Fig 1.1 Comparativo Mensal de Cargas</p>
        </div>
      </div>
      )}

      {/* --- Page 4: Active Power --- */}
      {sections.active && (
      <div className="min-h-[297mm] p-16 page-break break-after-page print:break-after-page">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-2 border-b border-gray-300">2. Análise de Potência Ativa</h2>
        <p className="mb-4 text-gray-600 text-sm">A Potência Ativa (kW) representa a energia efetivamente convertida em trabalho.</p>
        
        <ReportChart data={monthlyData} dataKey="active" name="Potência Ativa Média (kW)" color="#2563eb" />
        <p className="text-center text-xs text-gray-500 mb-8 italic">Fig 2.1 Evolução Mensal da Potência Ativa</p>

        <h3 className="font-bold text-lg mb-2 text-slate-700">Tabela de Dados (Ativa)</h3>
        <table className="w-full text-xs border border-gray-300 mb-4 text-black">
             <thead className="bg-blue-50">
                <tr><th className="border p-2">Mês</th><th className="border p-2 text-right">Média (kW)</th></tr>
             </thead>
             <tbody>
                {monthlyData.map((d, i) => (
                    <tr key={i}><td className="border p-2 font-medium">{d.name}</td><td className="border p-2 text-right font-bold text-black">{d.active.toFixed(2)}</td></tr>
                ))}
             </tbody>
        </table>

        {/* Stats Text */}
        <div className="bg-slate-50 p-4 rounded border-l-4 border-blue-500 text-sm text-justify">
            <h4 className="font-bold text-blue-900 mb-2">Análise Estatística - Potência Ativa</h4>
            <p className="mb-1 text-slate-800">
                O valor <strong>máximo</strong> registado foi de <strong>{activeStats.max.toFixed(2)} kW</strong> no mês de {activeStats.maxMonth}, enquanto o <strong>mínimo</strong> ocorreu em {activeStats.minMonth} com <strong>{activeStats.min.toFixed(2)} kW</strong>.
            </p>
            <p className="mb-1 text-slate-800">
                A <strong>média</strong> anual situa-se em <strong>{activeStats.avg.toFixed(2)} kW</strong>, com uma <strong>mediana</strong> de {activeStats.median.toFixed(2)} kW.
            </p>
            <p className="text-slate-800">
                A análise de tendência do primeiro para o segundo semestre indica um comportamento <strong>{activeStats.trend}</strong>.
            </p>
        </div>
      </div>
      )}

      {/* --- Page 5: Inductive Power --- */}
      {sections.inductive && (
      <div className="min-h-[297mm] p-16 page-break break-after-page print:break-after-page">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-2 border-b border-gray-300">3. Análise de Reativa Indutiva</h2>
         <p className="mb-4 text-gray-600 text-sm">Energia associada a motores e transformadores. O excesso pode gerar penalizações.</p>

        <ReportChart data={monthlyData} dataKey="inductive" name="Reativa Indutiva Média (kVAr)" color="#dc2626" />
        <p className="text-center text-xs text-gray-500 mb-8 italic">Fig 3.1 Evolução Mensal da Reativa Indutiva</p>

        <h3 className="font-bold text-lg mb-2 text-slate-700">Tabela de Dados (Indutiva)</h3>
        <table className="w-full text-xs border border-gray-300 mb-4 text-black">
             <thead className="bg-red-50">
                <tr><th className="border p-2">Mês</th><th className="border p-2 text-right">Média (kVAr)</th></tr>
             </thead>
             <tbody>
                {monthlyData.map((d, i) => (
                    <tr key={i}><td className="border p-2 font-medium">{d.name}</td><td className="border p-2 text-right font-bold text-black">{d.inductive.toFixed(2)}</td></tr>
                ))}
             </tbody>
        </table>

        {/* Stats Text */}
        <div className="bg-slate-50 p-4 rounded border-l-4 border-red-500 text-sm text-justify">
            <h4 className="font-bold text-red-900 mb-2">Análise Estatística - Reativa Indutiva</h4>
            <p className="mb-1 text-slate-800">
                O valor <strong>máximo</strong> registado foi de <strong>{indStats.max.toFixed(2)} kVAr</strong> no mês de {indStats.maxMonth}.
                O <strong>mínimo</strong> registou-se em {indStats.minMonth} com <strong>{indStats.min.toFixed(2)} kVAr</strong>.
            </p>
            <p className="mb-1 text-slate-800">
                A <strong>média</strong> anual de consumo indutivo é de <strong>{indStats.avg.toFixed(2)} kVAr</strong>.
            </p>
            <p className="text-slate-800">
                Comportamento anual: <strong>{indStats.trend}</strong>.
            </p>
        </div>
      </div>
      )}

       {/* --- Page 6: Capacitive Power --- */}
       {sections.capacitive && (
       <div className="min-h-[297mm] p-16 page-break break-after-page print:break-after-page">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-2 border-b border-gray-300">4. Análise de Reativa Capacitiva</h2>
         <p className="mb-4 text-gray-600 text-sm">Energia injetada na rede, comum em instalações com compensação fixa excessiva ou cabos longos em vazio.</p>

        <ReportChart data={monthlyData} dataKey="capacitive" name="Reativa Capacitiva Média (kVAr)" color="#16a34a" />
        <p className="text-center text-xs text-gray-500 mb-8 italic">Fig 4.1 Evolução Mensal da Reativa Capacitiva</p>

        <h3 className="font-bold text-lg mb-2 text-slate-700">Tabela de Dados (Capacitiva)</h3>
        <table className="w-full text-xs border border-gray-300 mb-4 text-black">
             <thead className="bg-green-50">
                <tr><th className="border p-2">Mês</th><th className="border p-2 text-right">Média (kVAr)</th></tr>
             </thead>
             <tbody>
                {monthlyData.map((d, i) => (
                    <tr key={i}><td className="border p-2 font-medium">{d.name}</td><td className="border p-2 text-right font-bold text-black">{d.capacitive.toFixed(2)}</td></tr>
                ))}
             </tbody>
        </table>

         {/* Stats Text */}
         <div className="bg-slate-50 p-4 rounded border-l-4 border-green-500 text-sm text-justify">
            <h4 className="font-bold text-green-900 mb-2">Análise Estatística - Reativa Capacitiva</h4>
            <p className="mb-1 text-slate-800">
                O valor <strong>máximo</strong> registado foi de <strong>{capStats.max.toFixed(2)} kVAr</strong> no mês de {capStats.maxMonth}.
                O <strong>mínimo</strong> foi de <strong>{capStats.min.toFixed(2)} kVAr</strong> em {capStats.minMonth}.
            </p>
            <p className="text-slate-800">
               Tendência anual: <strong>{capStats.trend}</strong>.
            </p>
        </div>
      </div>
      )}

      {/* --- Page 7, 8, 9: Split Tables (Averages, Max, Totals) --- */}
      {sections.tables && (
        <>
            {/* 5.1 Averages */}
            <div className="min-h-[297mm] p-16 page-break break-after-page print:break-after-page">
                <h2 className="text-2xl font-bold text-slate-900 mb-8 pb-2 border-b border-gray-300">5. Tabelas Gerais Detalhadas</h2>
                
                <h3 className="text-lg font-bold text-slate-700 mb-2">5.1 Média por Mês (Potência)</h3>
                <div className="mb-6">
                    <table className="w-full text-xs border border-gray-300 text-black">
                        <thead className="bg-blue-50">
                            <tr>
                                <th className="border p-2 text-left text-black">Mês</th>
                                <th className="border p-2 text-right text-black">Ativa (kW)</th>
                                <th className="border p-2 text-right text-black">Indutiva (kVAr)</th>
                                <th className="border p-2 text-right text-black">Capacitiva (kVAr)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthlyData.map((d, i) => (
                                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="border p-2 font-medium text-black">{d.name}</td>
                                    <td className="border p-2 text-right text-black">{d.active.toFixed(2)}</td>
                                    <td className="border p-2 text-right text-black">{d.inductive.toFixed(2)}</td>
                                    <td className="border p-2 text-right text-black">{d.capacitive.toFixed(2)}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
                                <td className="border p-2 text-black">MÉDIA ANUAL</td>
                                <td className="border p-2 text-right text-black">{activeStats.avg.toFixed(2)}</td>
                                <td className="border p-2 text-right text-black">{indStats.avg.toFixed(2)}</td>
                                <td className="border p-2 text-right text-black">{capStats.avg.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Analysis Text for Averages */}
                <div className="bg-blue-50 p-4 rounded border border-blue-200 text-sm text-justify">
                    <h4 className="font-bold text-blue-900 mb-2">Análise de Potência Média</h4>
                    <p>
                        A tabela 5.1 evidencia o perfil médio de carga da instalação. 
                        A potência ativa média anual situa-se em <strong>{activeStats.avg.toFixed(2)} kW</strong>, 
                        o que reflete o regime de laboração base.
                    </p>
                    <p className="mt-2">
                        Relativamente à energia reativa, verifica-se uma média indutiva de {indStats.avg.toFixed(2)} kVAr e capacitiva de {capStats.avg.toFixed(2)} kVAr.
                        O mês com maior carga ativa média foi <strong>{activeStats.maxMonth}</strong>, sugerindo um aumento sazonal de atividade nesse período.
                    </p>
                </div>
            </div>

            {/* 5.2 Maximums */}
            <div className="min-h-[297mm] p-16 page-break break-after-page print:break-after-page">
                <h2 className="text-2xl font-bold text-slate-900 mb-8 pb-2 border-b border-gray-300">5. Tabelas Gerais Detalhadas (Cont.)</h2>

                <h3 className="text-lg font-bold text-slate-700 mb-2">5.2 Máximo por Mês (Picos)</h3>
                <div className="mb-6">
                    <table className="w-full text-xs border border-gray-300 text-black">
                        <thead className="bg-red-50">
                            <tr>
                                <th className="border p-2 text-left text-black">Mês</th>
                                <th className="border p-2 text-right text-black">Ativa Max (kW)</th>
                                <th className="border p-2 text-right text-black">Indutiva Max (kVAr)</th>
                                <th className="border p-2 text-right text-black">Capacitiva Max (kVAr)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthlyData.map((d, i) => (
                                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="border p-2 font-medium text-black">{d.name}</td>
                                    <td className="border p-2 text-right text-black">{d.activeMax.toFixed(2)}</td>
                                    <td className="border p-2 text-right text-black">{d.inductiveMax.toFixed(2)}</td>
                                    <td className="border p-2 text-right text-black">{d.capacitiveMax.toFixed(2)}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
                                <td className="border p-2 text-black">MÁXIMO REGISTADO</td>
                                <td className="border p-2 text-right text-black">{activeMaxStats.max.toFixed(2)}</td>
                                <td className="border p-2 text-right text-black">{indMaxStats.max.toFixed(2)}</td>
                                <td className="border p-2 text-right text-black">{capMaxStats.max.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Analysis Text for Maximums */}
                <div className="bg-red-50 p-4 rounded border border-red-200 text-sm text-justify">
                    <h4 className="font-bold text-red-900 mb-2">Análise de Picos Máximos</h4>
                    <p>
                        A tabela 5.2 apresenta os valores extremos registados em cada mês. Estes valores são críticos para o dimensionamento da potência contratada e equipamentos de proteção.
                        O pico máximo absoluto de potência ativa foi de <strong>{activeMaxStats.max.toFixed(2)} kW</strong> em {activeMaxStats.maxMonth}.
                    </p>
                    <p className="mt-2">
                        Destaca-se ainda o pico indutivo de {indMaxStats.max.toFixed(2)} kVAr. Se este valor for recorrente e próximo da potência ativa, poderá indiciar um fator de potência baixo em momentos de arranque de motores ou cargas específicas.
                    </p>
                </div>
            </div>

            {/* 5.3 Totals */}
            <div className="min-h-[297mm] p-16 page-break break-after-page print:break-after-page">
                <h2 className="text-2xl font-bold text-slate-900 mb-8 pb-2 border-b border-gray-300">5. Tabelas Gerais Detalhadas (Cont.)</h2>

                <h3 className="text-lg font-bold text-slate-700 mb-2">5.3 Total por Mês (Energia / Soma)</h3>
                <div className="mb-6">
                    <table className="w-full text-xs border border-gray-300 text-black">
                        <thead className="bg-green-50">
                            <tr>
                                <th className="border p-2 text-left text-black">Mês</th>
                                <th className="border p-2 text-right text-black">Ativa (kWh)</th>
                                <th className="border p-2 text-right text-black">Indutiva (kVArh)</th>
                                <th className="border p-2 text-right text-black">Capacitiva (kVArh)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthlyData.map((d, i) => (
                                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="border p-2 font-medium text-black">{d.name}</td>
                                    <td className="border p-2 text-right text-black">{d.activeSum.toLocaleString('pt-PT', {maximumFractionDigits: 0})}</td>
                                    <td className="border p-2 text-right text-black">{d.inductiveSum.toLocaleString('pt-PT', {maximumFractionDigits: 0})}</td>
                                    <td className="border p-2 text-right text-black">{d.capacitiveSum.toLocaleString('pt-PT', {maximumFractionDigits: 0})}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
                                <td className="border p-2 text-black">TOTAL ANUAL</td>
                                <td className="border p-2 text-right text-black">{activeSumStats.total.toLocaleString('pt-PT', {maximumFractionDigits: 0})}</td>
                                <td className="border p-2 text-right text-black">{indSumStats.total.toLocaleString('pt-PT', {maximumFractionDigits: 0})}</td>
                                <td className="border p-2 text-right text-black">{capSumStats.total.toLocaleString('pt-PT', {maximumFractionDigits: 0})}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Analysis Text for Totals */}
                <div className="bg-green-50 p-4 rounded border border-green-200 text-sm text-justify">
                    <h4 className="font-bold text-green-900 mb-2">Análise de Energia Total</h4>
                    <p>
                        A tabela 5.3 quantifica o consumo total de energia. O consumo anual de energia ativa ascende a <strong>{activeSumStats.total.toLocaleString('pt-PT', {maximumFractionDigits: 0})} kWh</strong>.
                        A distribuição mensal mostra que {activeSumStats.maxMonth} foi o mês com maior peso na fatura energética ({((activeSumStats.max / activeSumStats.total) * 100).toFixed(1)}% do total anual).
                    </p>
                    <p className="mt-2">
                        A relação entre energia reativa (Indutiva+Capacitiva) e Ativa deve ser monitorizada para garantir a eficiência global da instalação.
                    </p>
                </div>
            </div>
        </>
      )}

      {/* --- Page 8: AI Analysis --- */}
      {sections.ai && (
      <div className="min-h-[297mm] p-16 page-break break-after-page print:break-after-page">
        <h2 className="text-2xl font-bold text-slate-900 mb-8 pb-2 border-b border-gray-300">6. Parecer Técnico (IA)</h2>
        <div className="prose prose-slate max-w-none text-justify text-sm print:prose-sm">
            {project.aiAnalysis ? (
                <ReactMarkdown
                    components={{
                        // H2 = Subchapters (## 6.1 ...)
                        h2: ({node, ...props}) => <h3 className="text-xl font-bold text-slate-800 mt-6 mb-3 break-after-avoid" {...props} />,
                        // H3 = Smaller headings (### ...)
                        h3: ({node, ...props}) => <h4 className="text-lg font-bold text-slate-700 mt-4 mb-2 break-after-avoid" {...props} />,
                        // P = Paragraphs
                        p: ({node, ...props}) => <p className="text-gray-800 text-justify mb-4 leading-relaxed" {...props} />,
                        // UL/OL = Lists
                        ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1 text-gray-800" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1 text-gray-800" {...props} />,
                        li: ({node, ...props}) => <li className="pl-1" {...props} />,
                        // Strong = Bold black
                        strong: ({node, ...props}) => <span className="font-bold text-black" {...props} />
                    }}
                >
                    {project.aiAnalysis}
                </ReactMarkdown>
            ) : (
                <div className="bg-yellow-50 p-4 border-l-4 border-yellow-400 text-yellow-700">
                    <p className="font-bold">Análise Pendente</p>
                    <p>A análise automática ainda não foi gerada. Por favor, utilize o botão "Gerar Análise IA" na barra de ferramentas superior.</p>
                </div>
            )}
        </div>
      </div>
      )}

       {/* --- Page 9: Conclusion --- */}
       {sections.conclusion && (
       <div className="min-h-[297mm] p-16 page-break break-after-page print:break-after-page flex flex-col justify-between">
        <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-8 pb-2 border-b border-gray-300">7. Conclusão</h2>
            <p className="text-gray-700 text-justify mb-4 leading-relaxed">
                Este relatório compila os dados de telecontagem fornecidos, oferecendo uma visão clara do perfil energético da instalação <strong>{project.metadata.name}</strong>.
            </p>
            <p className="text-gray-700 text-justify mb-4 leading-relaxed">
                Recomenda-se a análise cuidada dos picos de potência indutiva para avaliação da necessidade de instalação ou manutenção de baterias de condensadores, visando a eliminação de penalizações por energia reativa.
                De igual forma, a presença de energia capacitiva deve ser monitorizada para evitar sobretensões na rede interna ou penalizações em vazio.
            </p>
            <p className="text-gray-700 text-justify leading-relaxed">
                Para um estudo mais aprofundado ou implementação de medidas corretivas, recomenda-se uma auditoria energética presencial.
            </p>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
             <div className="flex justify-between items-end">
                <div>
                    <p className="font-bold text-slate-800">Assinatura do Técnico</p>
                    <div className="h-16 border-b border-gray-400 w-64 mb-2"></div>
                    <p className="text-sm text-gray-600">{project.metadata.technician}</p>
                </div>
                <div className="text-right text-xs text-gray-400">
                    Documento gerado automaticamente por K-DATAELECT
                </div>
             </div>
        </div>
      </div>
      )}

      {/* --- Back Cover --- */}
      <div className="min-h-[297mm] flex flex-col items-center justify-center bg-slate-900 text-white page-break print:break-after-page">
            <div className="text-center">
                <h2 className="text-5xl font-bold mb-4 tracking-tighter">K-DATAELECT</h2>
                <p className="text-gray-400 text-xl tracking-wide uppercase">Engineering Solutions</p>
                <div className="w-24 h-1 bg-blue-500 mx-auto my-12"></div>
                <p className="text-sm font-mono">www.koelho2000.com</p>
                <p className="text-xs text-gray-500 mt-2">Versão 1.3.0</p>
            </div>
      </div>

    </div>
  );
};

export default ReportView;
