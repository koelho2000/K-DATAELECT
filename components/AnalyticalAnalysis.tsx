
import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  Cell,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import { 
  ProjectState, 
  HourlyData, 
  Period, 
  TariffCycle, 
  DayType, 
  Season,
  ViewMode
} from '../types';
import { 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Activity, 
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Info,
  Loader2,
  RefreshCw,
  Maximize2,
  X
} from 'lucide-react';

interface AnalyticalAnalysisProps {
  project: ProjectState;
  onNavigate: (mode: any) => void;
}

const AnalyticalAnalysis: React.FC<AnalyticalAnalysisProps> = ({ project, onNavigate }) => {
  const data = project.hourlyData;
  const [analysisPeriod, setAnalysisPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [focusDate, setFocusDate] = useState<Date>(data.length > 0 ? new Date(data[data.length - 1].timestamp) : new Date());
  const [isSearchingOutliers, setIsSearchingOutliers] = useState(false);
  const [showOutlierModal, setShowOutlierModal] = useState(false);

  // 1. Period Comparison Logic
  const comparisonData = useMemo(() => {
    if (data.length === 0) return null;

    const currentStart = new Date(focusDate);
    const prevStart = new Date(focusDate);

    if (analysisPeriod === 'day') {
      currentStart.setHours(0, 0, 0, 0);
      prevStart.setDate(prevStart.getDate() - 1);
      prevStart.setHours(0, 0, 0, 0);
    } else if (analysisPeriod === 'week') {
      const day = currentStart.getDay();
      const diff = currentStart.getDate() - day + (day === 0 ? -6 : 1);
      currentStart.setDate(diff);
      currentStart.setHours(0, 0, 0, 0);
      
      prevStart.setDate(currentStart.getDate() - 7);
      prevStart.setHours(0, 0, 0, 0);
    } else {
      currentStart.setDate(1);
      currentStart.setHours(0, 0, 0, 0);
      
      prevStart.setMonth(prevStart.getMonth() - 1);
      prevStart.setDate(1);
      prevStart.setHours(0, 0, 0, 0);
    }

    const currentEnd = new Date(currentStart);
    const prevEnd = new Date(prevStart);

    if (analysisPeriod === 'day') {
      currentEnd.setHours(23, 59, 59, 999);
      prevEnd.setHours(23, 59, 59, 999);
    } else if (analysisPeriod === 'week') {
      currentEnd.setDate(currentStart.getDate() + 6);
      currentEnd.setHours(23, 59, 59, 999);
      prevEnd.setDate(prevStart.getDate() + 6);
      prevEnd.setHours(23, 59, 59, 999);
    } else {
      currentEnd.setMonth(currentStart.getMonth() + 1);
      currentEnd.setDate(0);
      currentEnd.setHours(23, 59, 59, 999);
      prevEnd.setMonth(prevStart.getMonth() + 1);
      prevEnd.setDate(0);
      prevEnd.setHours(23, 59, 59, 999);
    }

    const currentPeriodData = data.filter(d => d.timestamp >= currentStart && d.timestamp <= currentEnd);
    const prevPeriodData = data.filter(d => d.timestamp >= prevStart && d.timestamp <= prevEnd);

    const currentTotal = currentPeriodData.reduce((acc, curr) => acc + curr.activeAvg, 0);
    const prevTotal = prevPeriodData.reduce((acc, curr) => acc + curr.activeAvg, 0);
    const diffPercent = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;

    // Prepare chart data for comparison
    // We'll use a common X-axis (e.g., hour of day or day of week)
    const chartData: any[] = [];
    
    if (analysisPeriod === 'day') {
      for (let h = 0; h < 24; h++) {
        const currHour = currentPeriodData.find(d => d.timestamp.getHours() === h);
        const prevHour = prevPeriodData.find(d => d.timestamp.getHours() === h);
        
        // Historical average for this hour
        const allHourData = data.filter(d => d.timestamp.getHours() === h);
        const histAvg = allHourData.length > 0 ? allHourData.reduce((acc, curr) => acc + curr.activeAvg, 0) / allHourData.length : 0;

        chartData.push({
          label: `${h}h`,
          current: currHour?.activeAvg || 0,
          previous: prevHour?.activeAvg || 0,
          average: histAvg
        });
      }
    } else if (analysisPeriod === 'week') {
      const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
      for (let d = 1; d <= 7; d++) {
        const dayIdx = d === 7 ? 0 : d; // 1-6 is Mon-Sat, 0 is Sun
        const currDay = currentPeriodData.filter(item => item.timestamp.getDay() === dayIdx);
        const prevDay = prevPeriodData.filter(item => item.timestamp.getDay() === dayIdx);
        
        // Historical average for this day of week
        const dailyTotals: number[] = [];
        const uniqueDates = [...new Set(data.map(item => item.timestamp.toDateString()))];
        for (const dateStr of uniqueDates) {
          const dateObj = new Date(dateStr);
          if (dateObj.getDay() === dayIdx) {
            const dayData = data.filter(item => item.timestamp.toDateString() === dateStr);
            dailyTotals.push(dayData.reduce((acc, curr) => acc + curr.activeAvg, 0));
          }
        }
        const histAvg = dailyTotals.length > 0 ? dailyTotals.reduce((acc, curr) => acc + curr, 0) / dailyTotals.length : 0;

        chartData.push({
          label: days[d-1],
          current: currDay.reduce((acc, curr) => acc + curr.activeAvg, 0),
          previous: prevDay.reduce((acc, curr) => acc + curr.activeAvg, 0),
          average: histAvg
        });
      }
    } else {
      // Monthly comparison by day
      for (let d = 1; d <= 31; d++) {
        const currDay = currentPeriodData.filter(item => item.timestamp.getDate() === d);
        const prevDay = prevPeriodData.filter(item => item.timestamp.getDate() === d);
        
        // Historical average for this day of month
        const dailyTotals: number[] = [];
        const uniqueMonths = [...new Set(data.map(item => `${item.timestamp.getFullYear()}-${item.timestamp.getMonth()}`))];
        for (const monthKey of uniqueMonths) {
           const [year, month] = monthKey.split('-').map(Number);
           const dayData = data.filter(item => item.timestamp.getFullYear() === year && item.timestamp.getMonth() === month && item.timestamp.getDate() === d);
           if (dayData.length > 0) {
             dailyTotals.push(dayData.reduce((acc, curr) => acc + curr.activeAvg, 0));
           }
        }
        const histAvg = dailyTotals.length > 0 ? dailyTotals.reduce((acc, curr) => acc + curr, 0) / dailyTotals.length : 0;

        if (currDay.length > 0 || prevDay.length > 0) {
          chartData.push({
            label: `Dia ${d}`,
            current: currDay.reduce((acc, curr) => acc + curr.activeAvg, 0),
            previous: prevDay.reduce((acc, curr) => acc + curr.activeAvg, 0),
            average: histAvg
          });
        }
      }
    }

    return {
      currentTotal,
      prevTotal,
      diffPercent,
      chartData,
      currentStart,
      currentEnd,
      prevStart,
      prevEnd
    };
  }, [data, analysisPeriod, focusDate]);

  // 2. Anomaly Detection (Outliers)
  const anomalies = useMemo(() => {
    if (data.length === 0) return [];

    const avg = data.reduce((acc, curr) => acc + curr.activeAvg, 0) / data.length;
    const squareDiffs = data.map(d => Math.pow(d.activeAvg - avg, 2));
    const stdDev = Math.sqrt(squareDiffs.reduce((acc, curr) => acc + curr, 0) / data.length) || 1;
    
    const allWithDeviation = data.map(d => ({
      ...d,
      deviation: (d.activeAvg - avg) / stdDev
    }));

    // Sort by deviation descending to get the most relevant ones
    const sortedByRelevance = [...allWithDeviation].sort((a, b) => b.deviation - a.deviation);
    
    // Take at least 10 (or all if less than 10 total)
    const top10 = sortedByRelevance.slice(0, Math.max(10, sortedByRelevance.length > 10 ? 10 : sortedByRelevance.length));

    // Present in ASCENDING order of relevance (least relevant of the top 10 first)
    return top10.sort((a, b) => a.deviation - b.deviation);
  }, [data]);

  // 3. Load Profile Analysis (Heatmap-like data)
  const hourlyProfile = useMemo(() => {
    const profile: any[] = [];
    for (let h = 0; h < 24; h++) {
      const hours = data.filter(d => d.timestamp.getHours() === h);
      if (hours.length > 0) {
        const avg = hours.reduce((acc, curr) => acc + curr.activeAvg, 0) / hours.length;
        const max = Math.max(...hours.map(d => d.activeMax));
        profile.push({ hour: h, avg, max });
      }
    }
    return profile;
  }, [data]);

  // 4. Potential Problems Identification & Insights
  const analysisResults = useMemo(() => {
    const alerts: { type: 'low' | 'medium' | 'high', title: string, description: string }[] = [];
    const recommendations: string[] = [];
    const trends: string[] = [];
    
    if (data.length === 0) return { alerts, recommendations, trends, summary: '' };

    // A. Night Consumption (Vazio)
    const nightHours = data.filter(d => d.timestamp.getHours() >= 0 && d.timestamp.getHours() <= 5);
    const dayHours = data.filter(d => d.timestamp.getHours() > 5 && d.timestamp.getHours() < 22);
    
    if (nightHours.length > 0 && dayHours.length > 0) {
      const nightAvg = nightHours.reduce((acc, curr) => acc + curr.activeAvg, 0) / nightHours.length;
      const dayAvg = dayHours.reduce((acc, curr) => acc + curr.activeAvg, 0) / dayHours.length;
      
      if (nightAvg > dayAvg * 0.6) {
        alerts.push({
          type: 'medium',
          title: 'Consumo Noturno Elevado',
          description: `A média noturna (${nightAvg.toFixed(1)} kW) representa ${( (nightAvg/dayAvg)*100 ).toFixed(0)}% da média diurna. Indica possível desperdício ou equipamentos desnecessários ligados.`
        });
        recommendations.push('Implementar auditoria noturna para identificar cargas "fantasma" e otimizar horários de desligamento.');
      } else {
        trends.push('O perfil de consumo noturno está dentro dos parâmetros de eficiência esperados.');
      }
    }

    // B. Reactive Power Issues
    const totalActive = data.reduce((acc, curr) => acc + curr.activeAvg, 0);
    const totalInductive = data.reduce((acc, curr) => acc + curr.inductiveAvg, 0);
    const powerFactor = totalActive / Math.sqrt(Math.pow(totalActive, 2) + Math.pow(totalInductive, 2));
    
    if (powerFactor < 0.92) {
      alerts.push({
        type: 'high',
        title: 'Fator de Potência Crítico',
        description: `O fator de potência médio (${powerFactor.toFixed(2)}) está abaixo do limite regulamentar de 0.92, gerando custos evitáveis com energia reativa.`
      });
      recommendations.push('Revisar o dimensionamento ou funcionamento da bateria de condensadores para corrigir o fator de potência.');
    } else if (powerFactor < 0.95) {
      alerts.push({
        type: 'low',
        title: 'Otimização de Reativa',
        description: `Fator de potência em ${powerFactor.toFixed(2)}. Embora acima do limite, há margem para melhoria na eficiência do sistema.`
      });
    }

    // C. Peak Load
    const maxPeak = Math.max(...data.map(d => d.activeMax));
    const avgLoad = data.reduce((acc, curr) => acc + curr.activeAvg, 0) / data.length;
    
    if (maxPeak > avgLoad * 4) {
      alerts.push({
        type: 'medium',
        title: 'Picos de Carga Significativos',
        description: `Picos de até ${maxPeak.toFixed(1)} kW detetados. Estes picos podem forçar a infraestrutura e aumentar a potência contratada necessária.`
      });
      recommendations.push('Escalonar o arranque de grandes cargas (ex: AVAC, motores) para reduzir a ponta de potência.');
    }

    // D. Trends
    if (comparisonData) {
      if (comparisonData.diffPercent > 5) {
        trends.push(`Tendência de subida no consumo (${comparisonData.diffPercent.toFixed(1)}%) face ao período homólogo anterior.`);
      } else if (comparisonData.diffPercent < -5) {
        trends.push(`Redução sustentada no consumo (${Math.abs(comparisonData.diffPercent).toFixed(1)}%) indicando melhoria na eficiência.`);
      } else {
        trends.push('Consumo estável sem variações significativas face ao período anterior.');
      }
    }

    // E. Executive Summary Generation
    const summary = `A análise dos dados de telecontagem revela um perfil de consumo ${
      alerts.some(a => a.type === 'high') ? 'com necessidades críticas de intervenção' : 
      alerts.length > 0 ? 'com oportunidades moderadas de otimização' : 'altamente eficiente'
    }. O consumo total de ${totalActive.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} kWh apresenta um fator de potência médio de ${powerFactor.toFixed(2)}. ${
      trends[0] || ''
    }`;

    return { alerts, recommendations, trends, summary };
  }, [data, comparisonData]);

  // 5. Outliers with Explanations
  const outliersWithExplanations = useMemo(() => {
    return anomalies.map((a, index) => {
      let explanation = 'Pico de consumo pontual acima da média.';
      if (a.timestamp.getHours() >= 8 && a.timestamp.getHours() <= 10) explanation = 'Provável arranque de sistemas no início do período laboral.';
      if (a.timestamp.getHours() >= 12 && a.timestamp.getHours() <= 14) explanation = 'Aumento de carga coincidente com período de almoço/pico térmico.';
      if (a.timestamp.getHours() >= 23 || a.timestamp.getHours() <= 5) explanation = 'Consumo anómalo em período de vazio. Possível falha de automação ou manutenção noturna.';
      
      return { ...a, explanation, id: index + 1 };
    });
  }, [anomalies]);

  const handleNavigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(focusDate);
    const delta = direction === 'next' ? 1 : -1;
    if (analysisPeriod === 'day') newDate.setDate(newDate.getDate() + delta);
    else if (analysisPeriod === 'week') newDate.setDate(newDate.getDate() + (delta * 7));
    else newDate.setMonth(newDate.getMonth() + delta);
    setFocusDate(newDate);
  };

  const handleSearchOutliers = () => {
    setIsSearchingOutliers(true);
    setTimeout(() => setIsSearchingOutliers(false), 1200);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            Análise Analítica de Dados
          </h2>
          <p className="text-sm text-slate-500 mt-1">Relatório técnico de performance energética e diagnóstico de infraestrutura.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['day', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setAnalysisPeriod(p)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${analysisPeriod === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {p === 'day' ? 'Diário' : p === 'week' ? 'Semanal' : 'Mensal'}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <button onClick={() => handleNavigateDate('prev')} className="p-1 hover:bg-slate-200 rounded-lg text-slate-600">
              <ArrowDownRight className="w-4 h-4 rotate-45" />
            </button>
            <span className="text-xs font-bold text-slate-700 min-w-[120px] text-center">
              {analysisPeriod === 'day' ? focusDate.toLocaleDateString('pt-PT') : 
               analysisPeriod === 'week' ? `Semana ${focusDate.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}` :
               focusDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => handleNavigateDate('next')} className="p-1 hover:bg-slate-200 rounded-lg text-slate-600">
              <ArrowUpRight className="w-4 h-4 -rotate-45" />
            </button>
          </div>
          
          <button 
            onClick={() => onNavigate(ViewMode.DASHBOARD)}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>

      {/* Comparison Summary Cards */}
      {comparisonData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Activity className="w-5 h-5 text-indigo-600" />
              </div>
              <div className={`flex items-center gap-1 text-xs font-bold ${comparisonData.diffPercent > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {comparisonData.diffPercent > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(comparisonData.diffPercent).toFixed(1)}%
              </div>
            </div>
            <h4 className="text-sm font-medium text-slate-500">Consumo Total</h4>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {comparisonData.currentTotal.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} <span className="text-sm font-normal text-slate-400">kWh</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Vs. {comparisonData.prevTotal.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} kWh no período anterior</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <h4 className="text-sm font-medium text-slate-500">Pico de Carga</h4>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {Math.max(...(data.length > 0 ? data.map(d => d.activeMax) : [0])).toFixed(1)} <span className="text-sm font-normal text-slate-400">kW</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Máximo absoluto registado na telecontagem</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Clock className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <h4 className="text-sm font-medium text-slate-500">Média Horária</h4>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {(data.reduce((acc, curr) => acc + curr.activeAvg, 0) / (data.length || 1)).toFixed(2)} <span className="text-sm font-normal text-slate-400">kW</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Consumo médio por hora em todo o período</p>
          </div>
        </div>
      )}

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Comparison Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              Comparação de Períodos Iguais
            </h3>
            
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <button onClick={() => handleNavigateDate('prev')} className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors">
                <ArrowDownRight className="w-4 h-4 rotate-45" />
              </button>
              <div className="flex flex-col items-center min-w-[140px]">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Período em Foco</span>
                <span className="text-xs font-bold text-slate-700">
                  {analysisPeriod === 'day' ? focusDate.toLocaleDateString('pt-PT') : 
                   analysisPeriod === 'week' ? `Semana ${focusDate.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}` :
                   focusDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                </span>
              </div>
              <button onClick={() => handleNavigateDate('next')} className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors">
                <ArrowUpRight className="w-4 h-4 -rotate-45" />
              </button>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparisonData?.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" fontSize={10} stroke="#94a3b8" tickMargin={10} />
                <YAxis fontSize={10} stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number, name: string) => [`${value.toFixed(2)} kWh`, name]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                <Line 
                  type="monotone" 
                  dataKey="current" 
                  name="Período Atual" 
                  stroke="#4f46e5" 
                  strokeWidth={3} 
                  dot={false} 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="previous" 
                  name="Período Anterior" 
                  stroke="#cbd5e1" 
                  strokeWidth={2} 
                  strokeDasharray="5 5"
                  dot={false} 
                />
                <Line 
                  type="monotone" 
                  dataKey="average" 
                  name="Média Histórica" 
                  stroke="#94a3b8" 
                  strokeWidth={2} 
                  strokeDasharray="3 3"
                  dot={false} 
                  opacity={0.6}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Profile Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            Perfil de Carga Médio vs Máximo
          </h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyProfile}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hour" fontSize={10} stroke="#94a3b8" tickMargin={10} tickFormatter={(h) => `${h}h`} />
                <YAxis fontSize={10} stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                <Bar dataKey="avg" name="Média (kW)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="max" name="Máximo (kW)" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Insights & Trends Section */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-indigo-600" />
          Principais Insights e Tendências
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analysisResults.trends.map((trend, idx) => (
            <div key={idx} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="p-2 bg-white rounded-xl shadow-sm h-fit">
                <Info className="w-5 h-5 text-indigo-500" />
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{trend}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts & Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Alerts Section */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Alertas de Possíveis Problemas
          </h3>
          <div className="space-y-4">
            {analysisResults.alerts.length > 0 ? analysisResults.alerts.map((alert, idx) => (
              <div key={idx} className={`p-5 rounded-2xl border flex gap-4 ${
                alert.type === 'high' ? 'bg-red-50 border-red-100' : 
                alert.type === 'medium' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'
              }`}>
                <div className={`p-2 rounded-xl h-fit ${
                  alert.type === 'high' ? 'bg-red-100 text-red-600' : 
                  alert.type === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-bold text-sm ${
                      alert.type === 'high' ? 'text-red-900' : 
                      alert.type === 'medium' ? 'text-amber-900' : 'text-blue-900'
                    }`}>{alert.title}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      alert.type === 'high' ? 'bg-red-200 text-red-700' : 
                      alert.type === 'medium' ? 'bg-amber-200 text-amber-700' : 'bg-blue-200 text-blue-700'
                    }`}>
                      {alert.type === 'high' ? 'Crítico' : alert.type === 'medium' ? 'Médio' : 'Baixo'}
                    </span>
                  </div>
                  <p className={`text-xs leading-relaxed ${
                    alert.type === 'high' ? 'text-red-700' : 
                    alert.type === 'medium' ? 'text-amber-700' : 'text-blue-700'
                  }`}>{alert.description}</p>
                </div>
              </div>
            )) : (
              <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-2xl text-center">
                <Activity className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
                <h4 className="font-bold text-emerald-900">Sistema Estável</h4>
                <p className="text-xs text-emerald-700">Nenhum problema técnico detetado nos dados analisados.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recommendations Section */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-500" />
            Recomendações de Economia e Manutenção
          </h3>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            {analysisResults.recommendations.length > 0 ? analysisResults.recommendations.map((rec, idx) => (
              <div key={idx} className="flex gap-4 items-start">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {idx + 1}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{rec}</p>
              </div>
            )) : (
              <p className="text-sm text-slate-500 italic">Mantenha as boas práticas atuais de gestão energética.</p>
            )}
            <div className="pt-4 mt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                Dica de Manutenção
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Agende uma revisão semestral aos quadros elétricos principais para reaperto de ligações e termografia, prevenindo perdas por efeito Joule e potenciais falhas.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Outliers Table Section */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            Tabela de Outliers e Diagnóstico
          </h3>
          <button 
            onClick={handleSearchOutliers}
            disabled={isSearchingOutliers}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all disabled:opacity-50"
          >
            {isSearchingOutliers ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {isSearchingOutliers ? 'A Identificar...' : 'Pesquisa Detalhada'}
          </button>
          <button 
            onClick={() => setShowOutlierModal(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
          >
            <Maximize2 className="w-4 h-4" />
            Análise Gráfica
          </button>
        </div>
        
        <div className="overflow-x-auto">
          {isSearchingOutliers ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-10 h-10 animate-spin mb-4 text-indigo-200" />
              <p className="text-sm font-medium">A analisar padrões de consumo e desvios estatísticos...</p>
            </div>
          ) : (
            <>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Data e Hora</th>
                    <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Valor (kW)</th>
                    <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Desvio</th>
                    <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Explicação Técnica / Diagnóstico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {outliersWithExplanations.map((outlier, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                            {outlier.id}
                          </span>
                          <div className="text-sm font-bold text-slate-700">
                            {outlier.timestamp.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 ml-7">{outlier.timestamp.getHours()}h:00</div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-sm font-mono font-bold text-amber-600">{outlier.activeAvg.toFixed(1)}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-xs font-bold text-slate-500">+{outlier.deviation.toFixed(1)}σ</span>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-xs text-slate-600 leading-relaxed">{outlier.explanation}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {outliersWithExplanations.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-sm italic">
                  Nenhum outlier estatisticamente relevante detetado no período.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Executive Summary Section */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-3xl shadow-xl text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-white/20 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold">Resumo Executivo</h3>
        </div>
        <p className="text-indigo-100 leading-relaxed max-w-4xl">
          {analysisResults.summary}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
            <div className="text-xs text-indigo-200 uppercase tracking-wider font-bold mb-1">Status Global</div>
            <div className="text-lg font-bold flex items-center gap-2">
              {analysisResults.alerts.some(a => a.type === 'high') ? (
                <><AlertTriangle className="w-5 h-5 text-amber-400" /> Requer Atenção</>
              ) : (
                <><Activity className="w-5 h-5 text-emerald-400" /> Operação Normal</>
              )}
            </div>
          </div>
          <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
            <div className="text-xs text-indigo-200 uppercase tracking-wider font-bold mb-1">Eficiência de Carga</div>
            <div className="text-lg font-bold">
              {((data.reduce((acc, curr) => acc + curr.activeAvg, 0) / data.length) / Math.max(...data.map(d => d.activeMax)) * 100).toFixed(1)}% <span className="text-xs font-normal opacity-60">(Load Factor)</span>
            </div>
          </div>
          <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
            <div className="text-xs text-indigo-200 uppercase tracking-wider font-bold mb-1">Variação de Período</div>
            <div className="text-lg font-bold flex items-center gap-1">
              {comparisonData && (
                <>
                  {comparisonData.diffPercent > 0 ? <ArrowUpRight className="w-5 h-5 text-red-400" /> : <ArrowDownRight className="w-5 h-5 text-emerald-400" />}
                  {Math.abs(comparisonData.diffPercent).toFixed(1)}%
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Outlier Analysis Modal */}
      {showOutlierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-indigo-600" />
                  Análise Gráfica de Outliers
                </h3>
                <p className="text-sm text-slate-500">Identificação visual de desvios críticos na telecontagem horária.</p>
              </div>
              <button 
                onClick={() => setShowOutlierModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="h-[500px] mb-8">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.map(d => ({
                    ...d,
                    timeLabel: `${d.timestamp.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })} ${d.timestamp.getHours()}h`,
                    outlier: outliersWithExplanations.find(o => o.timestamp.getTime() === d.timestamp.getTime())
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="timestamp" 
                      fontSize={10} 
                      stroke="#94a3b8" 
                      tickFormatter={(ts) => new Date(ts).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
                      minTickGap={30}
                    />
                    <YAxis fontSize={10} stroke="#94a3b8" label={{ value: 'kW', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          const outlier = item.outlier;
                          return (
                            <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-100 max-w-xs">
                              <p className="text-xs font-bold text-slate-400 mb-1">{item.timeLabel}</p>
                              <p className="text-lg font-bold text-slate-900 mb-2">{item.activeAvg.toFixed(2)} kW</p>
                              {outlier && (
                                <div className="mt-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold">
                                      {outlier.id}
                                    </span>
                                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Outlier Detetado</span>
                                  </div>
                                  <p className="text-xs text-amber-700 leading-relaxed font-medium">
                                    {outlier.explanation}
                                  </p>
                                  <p className="text-[10px] text-amber-600 mt-1 font-bold">
                                    Desvio: +{outlier.deviation.toFixed(1)}σ
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="activeAvg" 
                      stroke="#4f46e5" 
                      strokeWidth={2} 
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (payload.outlier) {
                          return (
                            <g key={`dot-${payload.timestamp.getTime()}`}>
                              <circle cx={cx} cy={cy} r={6} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
                              <text 
                                x={cx} 
                                y={cy - 12} 
                                textAnchor="middle" 
                                fill="#f59e0b" 
                                fontSize="10" 
                                fontWeight="bold"
                              >
                                {payload.outlier.id}
                              </text>
                            </g>
                          );
                        }
                        return null;
                      }}
                      activeDot={{ r: 8, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {outliersWithExplanations.map((outlier) => (
                  <div key={outlier.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md transition-all group">
                    <div className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-amber-100 text-amber-700 text-xs font-bold group-hover:bg-amber-500 group-hover:text-white transition-colors">
                        {outlier.id}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-slate-800">
                          {outlier.timestamp.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit' })}h
                        </div>
                        <div className="text-lg font-mono font-bold text-amber-600 my-1">
                          {outlier.activeAvg.toFixed(1)} kW
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {outlier.explanation}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowOutlierModal(false)}
                className="bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all"
              >
                Fechar Análise
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticalAnalysis;
