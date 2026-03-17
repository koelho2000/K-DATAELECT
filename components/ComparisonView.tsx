
import React, { useState, useMemo, useRef } from 'react';
import { ProjectState, TariffCycle } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { 
  FileJson, Upload, Trash2, BarChart3, Table as TableIcon, 
  Download, FileText, FileCode, ChevronLeft, CheckCircle2,
  Printer, Activity, Zap, TrendingUp, DollarSign, Info
} from 'lucide-react';

interface ComparisonViewProps {
  onBack: () => void;
  isComparisonOnly?: boolean;
}

interface ComparisonProject {
  id: string;
  data: ProjectState;
  selected: boolean;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const ComparisonView: React.FC<ComparisonViewProps> = ({ onBack, isComparisonOnly }) => {
  const [projects, setProjects] = useState<ComparisonProject[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const comparisonInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const projectData = JSON.parse(event.target?.result as string) as ProjectState;
          // Basic validation
          if (projectData.metadata && projectData.hourlyData) {
            // Convert timestamps back to Date objects
            projectData.hourlyData.forEach(d => d.timestamp = new Date(d.timestamp));
            if (projectData.rawData) {
              projectData.rawData.forEach(d => d.timestamp = new Date(d.timestamp));
            }

            setProjects(prev => [
              ...prev,
              {
                id: Math.random().toString(36).substr(2, 9),
                data: projectData,
                selected: true
              }
            ]);
          }
        } catch (err) {
          console.error("Error parsing JSON:", err);
        }
      };
      reader.readAsText(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const toggleSelection = (id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p));
  };

  const selectedProjects = useMemo(() => projects.filter(p => p.selected), [projects]);

  const getKPIStatus = (type: 'nightDay' | 'variability' | 'peak' | 'utilization' | 'reactive', value: number, contracted?: number) => {
    switch (type) {
      case 'nightDay':
        if (value < 15) return { label: 'Bom', color: 'text-emerald-600 bg-emerald-50' };
        if (value < 30) return { label: 'Médio', color: 'text-amber-600 bg-amber-50' };
        return { label: 'Mau', color: 'text-red-600 bg-red-50' };
      case 'variability':
        if (value < 40) return { label: 'Bom', color: 'text-emerald-600 bg-emerald-50' };
        if (value < 70) return { label: 'Médio', color: 'text-amber-600 bg-amber-50' };
        return { label: 'Mau', color: 'text-red-600 bg-red-50' };
      case 'peak':
        if (!contracted) return { label: '-', color: 'text-slate-400' };
        const ratio = value / contracted;
        if (ratio < 0.8) return { label: 'Bom', color: 'text-emerald-600 bg-emerald-50' };
        if (ratio <= 1.0) return { label: 'Médio', color: 'text-amber-600 bg-amber-50' };
        return { label: 'Mau', color: 'text-red-600 bg-red-50' };
      case 'utilization':
        if (value > 0.6) return { label: 'Bom', color: 'text-emerald-600 bg-emerald-50' };
        if (value > 0.3) return { label: 'Médio', color: 'text-amber-600 bg-amber-50' };
        return { label: 'Mau', color: 'text-red-600 bg-red-50' };
      case 'reactive':
        if (value < 5) return { label: 'Bom', color: 'text-emerald-600 bg-emerald-50' };
        if (value < 50) return { label: 'Médio', color: 'text-amber-600 bg-amber-50' };
        return { label: 'Mau', color: 'text-red-600 bg-red-50' };
      default:
        return { label: '-', color: 'text-slate-400' };
    }
  };

  const getConsumptionStatus = (value: number, allValues: number[]) => {
    if (allValues.length <= 1) return null;
    const max = Math.max(...allValues);
    const min = Math.min(...allValues);
    
    if (value === max) return { label: 'Maior', color: 'text-red-600 bg-red-50' };
    if (value === min) return { label: 'Menor', color: 'text-emerald-600 bg-emerald-50' };
    return { label: 'Médio', color: 'text-amber-600 bg-amber-50' };
  };

  // Calculation Logic for comparison
  const comparisonData = useMemo(() => {
    if (selectedProjects.length === 0) return null;

    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    // 1. Monthly Stats (Avg, Max, Min, Sum)
    const monthlyStats = months.map((month, mIdx) => {
      const entry: any = { month };
      selectedProjects.forEach(p => {
        const pData = p.data.hourlyData.filter(d => d.timestamp.getMonth() === mIdx);
        if (pData.length > 0) {
          const values = pData.map(d => d.activeAvg);
          entry[`${p.data.metadata.name}_avg`] = values.reduce((a, b) => a + b, 0) / values.length;
          entry[`${p.data.metadata.name}_max`] = Math.max(...values);
          entry[`${p.data.metadata.name}_min`] = Math.min(...values);
          entry[`${p.data.metadata.name}_sum`] = values.reduce((a, b) => a + b, 0);
          
          // Cost if exists
          const costs = pData.map(d => d.cost || 0);
          entry[`${p.data.metadata.name}_cost`] = costs.reduce((a, b) => a + b, 0);
        } else {
          entry[`${p.data.metadata.name}_avg`] = 0;
          entry[`${p.data.metadata.name}_max`] = 0;
          entry[`${p.data.metadata.name}_min`] = 0;
          entry[`${p.data.metadata.name}_sum`] = 0;
          entry[`${p.data.metadata.name}_cost`] = 0;
        }
      });
      return entry;
    });

    // 2. Cycle Distribution
    const cycleStats = selectedProjects.map(p => {
      const stats: any = { name: p.data.metadata.name };
      const cycles = [TariffCycle.PONTA, TariffCycle.CHEIAS, TariffCycle.VAZIO_NORMAL, TariffCycle.SUPER_VAZIO];
      
      cycles.forEach(c => {
        const cData = p.data.hourlyData.filter(d => d.cycle === c);
        stats[c] = cData.reduce((acc, curr) => acc + curr.activeAvg, 0);
      });
      
      return stats;
    });

    // 3. Overall Summary Table Data
    const summaryTable = selectedProjects.map(p => {
      const values = p.data.hourlyData.map(d => d.activeAvg);
      const costs = p.data.hourlyData.map(d => d.cost || 0);
      const totalEnergy = values.reduce((a, b) => a + b, 0);
      const totalCost = costs.reduce((a, b) => a + b, 0);
      const avgPower = totalEnergy / values.length;
      
      const cycles = [TariffCycle.PONTA, TariffCycle.CHEIAS, TariffCycle.VAZIO_NORMAL, TariffCycle.SUPER_VAZIO];
      const cycleSums: any = {};
      cycles.forEach(c => {
        cycleSums[c] = p.data.hourlyData.filter(d => d.cycle === c).reduce((acc, curr) => acc + curr.activeAvg, 0);
      });

      // Rácio Noite/Dia: (Consumo 00h-06h / Consumo Total) × 100
      const nightConsumption = p.data.hourlyData
        .filter(d => d.timestamp.getHours() >= 0 && d.timestamp.getHours() < 6)
        .reduce((acc, curr) => acc + curr.activeAvg, 0);
      const nightDayRatio = totalEnergy > 0 ? (nightConsumption / totalEnergy) * 100 : 0;

      // Variabilidade (CV): (Desvio Padrão / Média Horária) × 100
      const mean = avgPower;
      const squareDiffs = values.map(v => Math.pow(v - mean, 2));
      const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(avgSquareDiff);
      const variability = mean > 0 ? (stdDev / mean) * 100 : 0;

      // Fator de Utilização: Consumo Médio (kW) / Potência Contratada
      const contractedPower = p.data.metadata.contractedPower || 100; // Default to 100 if not set
      const utilizationFactor = contractedPower > 0 ? avgPower / contractedPower : 0;

      // Custo de Reativa: Soma de custos por excesso de KVARh
      // Using a standard Portuguese formula: excess above 33% of active energy is charged
      const reactiveCost = p.data.hourlyData.reduce((acc, curr) => {
        const excess = Math.max(0, curr.inductiveAvg - 0.33 * curr.activeAvg);
        return acc + (excess * 0.02); // Assuming 0.02€ per kVArh of excess
      }, 0);

      // Baseload calculation (Percentile 5)
      const sortedValues = [...values].sort((a, b) => a - b);
      const baseload = sortedValues.length > 0 
        ? sortedValues[Math.floor(sortedValues.length * 0.05)] 
        : 0;

      // Hourly Profile (0-23)
      const hourlyProfile = Array.from({ length: 24 }, (_, hour) => {
        const hourData = p.data.hourlyData.filter(d => d.timestamp.getHours() === hour);
        return hourData.length > 0 
          ? hourData.reduce((acc, curr) => acc + curr.activeAvg, 0) / hourData.length 
          : 0;
      });

      // Find "Wake up" hour (first hour where consumption > 1.2 * baseload)
      const wakeUpHour = hourlyProfile.findIndex(v => v > baseload * 1.2);
      const sleepHour = [...hourlyProfile].reverse().findIndex(v => v > baseload * 1.2);
      const actualSleepHour = sleepHour === -1 ? -1 : 23 - sleepHour;

      // Peak info
      const maxVal = Math.max(...values);
      const peakHour = p.data.hourlyData.find(d => d.activeAvg === maxVal)?.timestamp.getHours();

      return {
        name: p.data.metadata.name,
        cpe: p.data.metadata.cpe,
        max: maxVal,
        min: Math.min(...values),
        avg: avgPower,
        total: totalEnergy,
        totalCost: totalCost,
        avgPrice: totalEnergy > 0 ? totalCost / totalEnergy : 0,
        cycleSums,
        baseload,
        wakeUpHour,
        actualSleepHour,
        peakHour,
        nightDayRatio,
        variability,
        utilizationFactor,
        reactiveCost,
        contractedPower
      };
    });

    // Calculate Savings Potential relative to the most efficient (lowest avgPrice)
    const validCosts = summaryTable.filter(s => s.avgPrice > 0);
    const bestPrice = validCosts.length > 0 ? Math.min(...validCosts.map(s => s.avgPrice)) : 0;
    
    const summaryWithSavings = summaryTable.map(s => ({
      ...s,
      savingsPotential: s.avgPrice > bestPrice ? (s.avgPrice - bestPrice) * s.total : 0
    }));

    return { monthlyStats, cycleStats, summaryTable: summaryWithSavings, bestPrice };
  }, [selectedProjects]);

  const saveComparison = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projects));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `comparativo_energia_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const loadComparison = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const loadedProjects = JSON.parse(event.target?.result as string) as ComparisonProject[];
        loadedProjects.forEach(p => {
          p.data.hourlyData.forEach((d: any) => d.timestamp = new Date(d.timestamp));
          if (p.data.rawData) {
            p.data.rawData.forEach((d: any) => d.timestamp = new Date(d.timestamp));
          }
        });
        setProjects(loadedProjects);
      } catch (err) {
        alert("Ficheiro de comparativo inválido");
      }
    };
    reader.readAsText(file);
  };

  const exportReport = (type: 'pdf' | 'html' | 'doc') => {
    if (type === 'pdf') {
      window.focus();
      setTimeout(() => {
        window.print();
      }, 100);
      return;
    }

    const content = document.getElementById('comparison-report-content');
    if (!content) return;

    const projectNames = selectedProjects.map(p => p.data.metadata.name).join(', ');
    
    if (type === 'html' || type === 'doc') {
      const html = `
        <!DOCTYPE html>
        <html lang="pt-PT">
        <head>
          <meta charset="UTF-8">
          <title>Relatório Comparativo - ${projectNames}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
             @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
             body { font-family: 'Inter', sans-serif; background: #fff; color: #000; }
             .recharts-wrapper { margin: 0 auto; }
             table { border-collapse: collapse; width: 100%; }
             td, th { border: 1px solid #e5e7eb; padding: 0.5rem; }
             .no-print { display: none !important; }
             .page-break { page-break-before: always; break-before: page; margin-top: 2rem; border-top: 1px dashed #ccc; padding-top: 2rem;}
             @media print { .page-break { border: none; } }
          </style>
        </head>
        <body>
          <div class="max-w-6xl mx-auto p-8">
            <style>
              @media print {
                .page-break { page-break-before: always; }
                .no-print { display: none !important; }
                .chart-container { page-break-inside: avoid; }
                .section-container { page-break-inside: avoid; }
              }
            </style>
            ${content.innerHTML}
          </div>
        </body>
        </html>
      `;
      
      const blob = new Blob([html], {type: type === 'html' ? 'text/html' : 'application/msword'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Relatorio_Comparativo_${new Date().toISOString().split('T')[0]}.${type}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <button 
            onClick={onBack}
            className="flex items-center text-slate-500 hover:text-slate-800 transition-colors mb-2"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {isComparisonOnly ? 'Voltar à Importação' : 'Voltar'}
          </button>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-indigo-600" />
            Comparativo de Projetos
          </h2>
          <p className="text-slate-500 text-sm">Importe e compare múltiplos projetos de telecontagem.</p>
        </div>

        <div className="flex gap-2">
          {isComparisonOnly && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3 mr-4">
              <div className="bg-amber-100 p-2 rounded-lg">
                <Activity className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-xs text-amber-800">
                <p className="font-bold">Modo Comparativo Ativo</p>
                <p>As restantes funcionalidades estão desativadas.</p>
              </div>
            </div>
          )}
          <button 
            onClick={() => comparisonInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
          >
            <FileCode className="w-4 h-4" />
            Abrir Comparativo
          </button>
          <button 
            onClick={saveComparison}
            disabled={projects.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Gravar Comparativo
          </button>
          <input 
            type="file" 
            ref={comparisonInputRef} 
            onChange={loadComparison} 
            accept=".json" 
            className="hidden" 
          />
        </div>
      </div>

      {!isComparing ? (
        <div className="space-y-6 no-print">
          {/* Upload Area */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-3xl p-12 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
          >
            <div className="bg-indigo-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Importar Projetos (JSON)</h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto">Selecione um ou mais ficheiros exportados anteriormente para comparar.</p>
            <input 
              type="file" 
              multiple 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".json" 
              className="hidden" 
            />
          </div>

          {/* Project List */}
          {projects.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <TableIcon className="w-5 h-5 text-indigo-500" />
                  Lista de Projetos ({projects.length})
                </h3>
                <button 
                  onClick={() => setIsComparing(true)}
                  disabled={selectedProjects.length < 2}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                  Comparar Selecionados ({selectedProjects.length})
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider font-bold">
                      <th className="px-6 py-4 w-10">
                        <input 
                          type="checkbox" 
                          checked={projects.length > 0 && projects.every(p => p.selected)}
                          onChange={(e) => setProjects(prev => prev.map(p => ({ ...p, selected: e.target.checked })))}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="px-6 py-4">Projeto / CPE</th>
                      <th className="px-6 py-4">Localização / Técnico</th>
                      <th className="px-6 py-4">Data Relatório</th>
                      <th className="px-6 py-4 text-right">Total Energia</th>
                      <th className="px-6 py-4 text-right">Média / Máximo</th>
                      <th className="px-6 py-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {projects.map((p) => {
                      const values = p.data.hourlyData.map(d => d.activeAvg);
                      const total = values.reduce((a, b) => a + b, 0);
                      const avg = total / values.length;
                      const max = Math.max(...values);

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <input 
                              type="checkbox" 
                              checked={p.selected}
                              onChange={() => toggleSelection(p.id)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-slate-800">{p.data.metadata.name || 'Sem Nome'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{p.data.metadata.cpe || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs text-slate-600">{p.data.metadata.location || 'N/A'}</div>
                            <div className="text-[10px] text-slate-400">{p.data.metadata.technician || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs text-slate-600">{p.data.metadata.reportDate || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-sm font-bold text-indigo-600">{total.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} kWh</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-xs font-medium text-slate-700">{avg.toFixed(2)} kW (méd)</div>
                            <div className="text-[10px] text-red-500 font-bold">{max.toFixed(2)} kW (máx)</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button 
                              onClick={() => removeProject(p.id)}
                              className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div id="comparison-report-content" className="space-y-8">
          {/* Cover Page (Visible only in print/export) */}
          <div className="hidden print:flex flex-col justify-between min-h-[297mm] p-16 border-b-2 border-gray-100 page-break break-after-page">
            <div className="text-right border-b-4 border-slate-900 pb-4">
              <h1 className="text-6xl font-black tracking-tighter text-slate-900 mb-2">RELATÓRIO</h1>
              <h2 className="text-3xl font-light text-slate-600 uppercase">Comparativo de Projetos</h2>
            </div>

            <div className="my-12">
              <div className="bg-slate-50 p-8 rounded-l-lg border-l-8 border-indigo-600">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Projetos em Comparação</h3>
                <div className="space-y-4">
                  {selectedProjects.map((p, i) => (
                    <div key={i} className="border-b border-slate-200 pb-2 last:border-0">
                      <p className="text-2xl font-bold text-slate-800">{p.data.metadata.name}</p>
                      <p className="text-sm font-mono text-indigo-600">CPE: {p.data.metadata.cpe || 'N/A'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 text-sm text-gray-600">
              <div>
                <p className="uppercase font-bold text-gray-400 text-xs">Data do Relatório</p>
                <p className="text-lg font-medium">{new Date().toLocaleDateString('pt-PT')}</p>
              </div>
              <div className="text-right">
                <p className="uppercase font-bold text-gray-400 text-xs">Total de Projetos</p>
                <p className="text-lg font-medium">{selectedProjects.length}</p>
              </div>
            </div>
            
            <div className="text-center mt-12 pt-8 border-t border-gray-200">
              <p className="text-xs text-gray-400">Gerado por K-DATAELECT | www.koelho2000.com</p>
            </div>
          </div>

          {/* Comparison Dashboard */}
          <div className="flex justify-between items-center no-print">
            <button 
              onClick={() => setIsComparing(false)}
              className="text-indigo-600 font-bold text-sm flex items-center gap-1 hover:underline"
            >
              &larr; Voltar à Lista
            </button>
            <div className="flex gap-2">
              <button 
                onClick={() => exportReport('pdf')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all"
              >
                <Printer className="w-4 h-4" />
                Exportar PDF / Imprimir
              </button>
              <button 
                onClick={() => exportReport('html')}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-all"
              >
                <FileCode className="w-4 h-4" />
                Exportar HTML
              </button>
              <button 
                onClick={() => exportReport('doc')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-900 transition-all"
              >
                <FileText className="w-4 h-4" />
                Exportar DOC
              </button>
            </div>
          </div>

          {/* Summary Table */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden section-container">
            <div className="p-6 border-b border-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-500" />
                Resumo Comparativo de Métricas
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider font-bold">
                    <th className="px-6 py-4">Projeto</th>
                    <th className="px-6 py-4 text-right">Máx (kW)</th>
                    <th className="px-6 py-4 text-right">Mín (kW)</th>
                    <th className="px-6 py-4 text-right">Média (kW)</th>
                    <th className="px-6 py-4 text-right">Total (kWh)</th>
                    <th className="px-6 py-4 text-right text-red-500">Ponta</th>
                    <th className="px-6 py-4 text-right text-amber-500">Cheias</th>
                    <th className="px-6 py-4 text-right text-blue-500">Vazio</th>
                    <th className="px-6 py-4 text-right text-emerald-500">S.Vazio</th>
                    <th className="px-6 py-4 text-right">Custo (€)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {comparisonData?.summaryTable.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                        <div className="text-sm font-bold text-slate-800">{row.name}</div>
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-mono text-red-600 font-bold">{row.max.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-xs font-mono text-emerald-600 font-bold">{row.min.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-xs font-mono text-slate-700">{row.avg.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-mono text-indigo-600 font-bold">{row.total.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}</span>
                          {(() => {
                            const status = getConsumptionStatus(row.total, comparisonData?.summaryTable.map(s => s.total) || []);
                            return status && (
                              <span className={`text-[8px] px-1 py-0.5 rounded-full font-bold uppercase mt-1 ${status.color}`}>
                                {status.label}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-mono text-slate-500">{row.cycleSums[TariffCycle.PONTA].toLocaleString('pt-PT', { maximumFractionDigits: 0 })}</td>
                      <td className="px-6 py-4 text-right text-xs font-mono text-slate-500">{row.cycleSums[TariffCycle.CHEIAS].toLocaleString('pt-PT', { maximumFractionDigits: 0 })}</td>
                      <td className="px-6 py-4 text-right text-xs font-mono text-slate-500">{row.cycleSums[TariffCycle.VAZIO_NORMAL].toLocaleString('pt-PT', { maximumFractionDigits: 0 })}</td>
                      <td className="px-6 py-4 text-right text-xs font-mono text-slate-500">{row.cycleSums[TariffCycle.SUPER_VAZIO].toLocaleString('pt-PT', { maximumFractionDigits: 0 })}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-mono text-slate-900 font-bold">
                            {row.totalCost > 0 ? row.totalCost.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }) : 'N/A'}
                          </span>
                          {(() => {
                            const status = getConsumptionStatus(row.totalCost, comparisonData?.summaryTable.map(s => s.totalCost) || []);
                            return status && (
                              <span className={`text-[8px] px-1 py-0.5 rounded-full font-bold uppercase mt-1 ${status.color}`}>
                                {status.label}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* KPI Summary Table */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden section-container">
            <div className="p-6 border-b border-slate-50 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-500" />
                Tabela Sumária de Indicadores (KPIs)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/50 text-slate-500 text-[10px] uppercase tracking-wider font-bold">
                    <th className="px-6 py-4">Indicador (KPI)</th>
                    <th className="px-6 py-4">Unidade</th>
                    {comparisonData?.summaryTable.map((row, idx) => (
                      <th key={idx} className="px-6 py-4 text-right" style={{ color: COLORS[idx % COLORS.length] }}>
                        {row.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <div className="text-sm font-bold text-slate-800">Rácio Noite/Dia</div>
                        <span title="(Consumo 00h-06h / Consumo Total) × 100. Mede o desperdício de energia fora do horário de atividade.">
                          <Info className="w-3 h-3 text-slate-400 cursor-help" />
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">Desperdício fora de horas</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">%</td>
                    {comparisonData?.summaryTable.map((row, idx) => {
                      const status = getKPIStatus('nightDay', row.nightDayRatio);
                      return (
                        <td key={idx} className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-mono font-bold text-slate-700">{row.nightDayRatio.toFixed(1)}%</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase mt-1 ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <div className="text-sm font-bold text-slate-800">Variabilidade (CV)</div>
                        <span title="(Desvio Padrão / Média Horária) × 100. Indica a instabilidade ou flutuação do consumo elétrico.">
                          <Info className="w-3 h-3 text-slate-400 cursor-help" />
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">Instabilidade do consumo</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">%</td>
                    {comparisonData?.summaryTable.map((row, idx) => {
                      const status = getKPIStatus('variability', row.variability);
                      return (
                        <td key={idx} className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-mono font-bold text-slate-700">{row.variability.toFixed(1)}%</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase mt-1 ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <div className="text-sm font-bold text-slate-800">Pico de Potência</div>
                        <span title="Valor máximo de carga registado no período. Importante para dimensionar a potência contratada.">
                          <Info className="w-3 h-3 text-slate-400 cursor-help" />
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">Carga máxima instantânea</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">kW</td>
                    {comparisonData?.summaryTable.map((row, idx) => {
                      const status = getKPIStatus('peak', row.max, row.contractedPower);
                      return (
                        <td key={idx} className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-mono font-bold text-red-600">{row.max.toFixed(2)}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase mt-1 ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <div className="text-sm font-bold text-slate-800">Fator de Utilização</div>
                        <span title="Consumo Médio (kW) / Potência Contratada. Mede a eficiência com que a potência contratada está a ser utilizada.">
                          <Info className="w-3 h-3 text-slate-400 cursor-help" />
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">Eficiência da Potência</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">0 a 1</td>
                    {comparisonData?.summaryTable.map((row, idx) => {
                      const status = getKPIStatus('utilization', row.utilizationFactor);
                      return (
                        <td key={idx} className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-mono font-bold text-indigo-600">{row.utilizationFactor.toFixed(2)}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase mt-1 ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <div className="text-sm font-bold text-slate-800">Custo de Reativa</div>
                        <span title="Soma estimada de custos por excesso de energia reativa (kVArh). Representa penalizações técnicas na fatura.">
                          <Info className="w-3 h-3 text-slate-400 cursor-help" />
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">Penalizações técnicas</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">€</td>
                    {comparisonData?.summaryTable.map((row, idx) => {
                      const status = getKPIStatus('reactive', row.reactiveCost);
                      return (
                        <td key={idx} className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-mono font-bold text-amber-600">
                              {row.reactiveCost.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase mt-1 ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            
            {/* KPI Legend */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-6 justify-center no-print">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Bom (Eficiente)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Médio (Otimizável)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Mau (Ineficiente)</span>
              </div>
            </div>
          </div>

          {/* Analytical Summary Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 section-container">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-indigo-500" />
                Perfil de Carga e Comportamento
              </h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Diagrama de Carga Diário</h4>
                  <p className="text-sm text-slate-600">
                    {comparisonData?.summaryTable.map((s, i) => (
                      <span key={i} className="block">
                        • <strong>{s.name}</strong>: Inicia atividade às {s.wakeUpHour}h e reduz às {s.actualSleepHour}h.
                      </span>
                    ))}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Consumo de Base (Baseload)</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {comparisonData?.summaryTable.map((s, i) => (
                      <div key={i} className="p-2 bg-slate-50 rounded-lg">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{s.name}</div>
                        <div className="text-sm font-mono font-bold text-slate-700">{s.baseload.toFixed(2)} kW</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 italic">Valores altos indicam desperdício em períodos de fecho.</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Picos de Potência</h4>
                  <p className="text-sm text-slate-600">
                    {comparisonData?.summaryTable.map((s, i) => (
                      <span key={i} className="block">
                        • <strong>{s.name}</strong>: Pico de {s.max.toFixed(2)} kW às {s.peakHour}h.
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                Aspetos Económicos
              </h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Custo por Unidade</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {comparisonData?.summaryTable.map((s, i) => (
                      <div key={i} className="p-2 bg-slate-50 rounded-lg">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{s.name}</div>
                        <div className="text-sm font-mono font-bold text-slate-700">{s.avgPrice.toFixed(4)} €/kWh</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">Potencial de Poupança</h4>
                  <p className="text-sm text-emerald-800 mb-4">
                    Estimativa se todos os edifícios atingissem a eficiência do melhor tarifário ({comparisonData?.bestPrice.toFixed(4)} €/kWh):
                  </p>
                  <div className="space-y-2">
                    {comparisonData?.summaryTable.map((s, i) => s.savingsPotential > 0 && (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-emerald-700">{s.name}</span>
                        <span className="font-bold text-emerald-900">-{s.savingsPotential.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Chart 1: Average */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 chart-container">
              <h4 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                Gráfico 1: Média Mensal (kW)
              </h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData?.monthlyStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Legend />
                    {selectedProjects.map((p, idx) => (
                      <Bar 
                        key={p.id} 
                        dataKey={`${p.data.metadata.name}_avg`} 
                        name={p.data.metadata.name} 
                        fill={COLORS[idx % COLORS.length]} 
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Maximum */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 chart-container">
              <h4 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Zap className="w-4 h-4 text-red-500" />
                Gráfico 2: Máximo Mensal (kW)
              </h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData?.monthlyStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Legend />
                    {selectedProjects.map((p, idx) => (
                      <Bar 
                        key={p.id} 
                        dataKey={`${p.data.metadata.name}_max`} 
                        name={p.data.metadata.name} 
                        fill={COLORS[idx % COLORS.length]} 
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Minimum */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 chart-container">
              <h4 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Gráfico 3: Mínimo Mensal (kW)
              </h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={comparisonData?.monthlyStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Legend />
                    {selectedProjects.map((p, idx) => (
                      <Line 
                        key={p.id} 
                        type="monotone"
                        dataKey={`${p.data.metadata.name}_min`} 
                        name={p.data.metadata.name} 
                        stroke={COLORS[idx % COLORS.length]} 
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Accumulated */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 chart-container">
              <h4 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-500" />
                Gráfico 4: Acumulado Mensal (kWh)
              </h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData?.monthlyStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Legend />
                    {selectedProjects.map((p, idx) => (
                      <Bar 
                        key={p.id} 
                        dataKey={`${p.data.metadata.name}_sum`} 
                        name={p.data.metadata.name} 
                        fill={COLORS[idx % COLORS.length]} 
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 5: Cycle Distribution */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 xl:col-span-2 chart-container">
              <h4 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-500" />
                Gráfico 5: Distribuição de Energia Ativa em Ciclos (kWh)
              </h4>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData?.cycleStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" fontSize={10} />
                    <YAxis dataKey="name" type="category" fontSize={10} width={100} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey={TariffCycle.PONTA} name="Ponta" stackId="a" fill="#ef4444" />
                    <Bar dataKey={TariffCycle.CHEIAS} name="Cheias" stackId="a" fill="#f59e0b" />
                    <Bar dataKey={TariffCycle.VAZIO_NORMAL} name="Vazio Normal" stackId="a" fill="#3b82f6" />
                    <Bar dataKey={TariffCycle.SUPER_VAZIO} name="Super Vazio" stackId="a" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Chart 6: Costs (Optional if data exists) */}
            {selectedProjects.some(p => p.data.hourlyData.some(d => d.cost && d.cost > 0)) && (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 xl:col-span-2 chart-container">
                <h4 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  Gráfico 6: Comparativo de Custos Mensais (€)
                </h4>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData?.monthlyStats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Legend />
                      {selectedProjects.map((p, idx) => (
                        <Bar 
                          key={p.id} 
                          dataKey={`${p.data.metadata.name}_cost`} 
                          name={p.data.metadata.name} 
                          fill={COLORS[idx % COLORS.length]} 
                          radius={[4, 4, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Monthly Details Table */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mt-8 section-container">
            <div className="p-6 border-b border-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <TableIcon className="w-5 h-5 text-indigo-500" />
                Detalhes Mensais por Projeto (kWh)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider font-bold">
                    <th className="px-6 py-4">Mês</th>
                    {selectedProjects.map((p, idx) => (
                      <th key={p.id} className="px-6 py-4 text-right" style={{ color: COLORS[idx % COLORS.length] }}>
                        {p.data.metadata.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {comparisonData?.monthlyStats.map((monthRow, mIdx) => (
                    <tr key={mIdx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-slate-700">{monthRow.month}</td>
                      {selectedProjects.map((p) => (
                        <td key={p.id} className="px-6 py-4 text-right text-xs font-mono">
                          {monthRow[`${p.data.metadata.name}_sum`].toLocaleString('pt-PT', { maximumFractionDigits: 0 })}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr className="font-bold text-slate-800">
                    <td className="px-6 py-4 text-sm uppercase tracking-wider">Total Anual</td>
                    {selectedProjects.map((p) => {
                      const projectSummary = comparisonData?.summaryTable.find(s => s.name === p.data.metadata.name);
                      return (
                        <td key={p.id} className="px-6 py-4 text-right text-sm font-mono">
                          {projectSummary?.total.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparisonView;
