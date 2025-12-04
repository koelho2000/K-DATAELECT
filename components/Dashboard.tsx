

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, ReferenceLine, Brush } from 'recharts';
import { HourlyData, TelemetryRow, LoadType, Period } from '../types';
import { generateCSV, ExportConfig } from '../services/dataService';

interface DashboardProps {
  data: HourlyData[];
  rawData: TelemetryRow[];
}

const Dashboard: React.FC<DashboardProps> = ({ data, rawData }) => {
  const [period, setPeriod] = useState<Period>(Period.MONTHLY);
  const [loadType, setLoadType] = useState<LoadType>(LoadType.ACTIVE);
  const [focusDate, setFocusDate] = useState<Date>(new Date());

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
      resolution: 'hourly',
      splitDateTime: false,
      columns: { active: true, inductive: true, capacitive: true }
  });
  const [exportRange, setExportRange] = useState<'current' | 'all'>('current');

  // Virtual Scroll State
  const [scrollTop, setScrollTop] = useState(0);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Initialize focus date when data loads
  useEffect(() => {
    if (data.length > 0) {
        // Default to the first month of data
        setFocusDate(new Date(data[0].timestamp));
    }
  }, [data]);

  // Reset scroll when data filter changes
  useEffect(() => {
    if (tableContainerRef.current) {
        tableContainerRef.current.scrollTop = 0;
    }
    setScrollTop(0);
  }, [period, focusDate, loadType]);

  // Global Stats Calculation (Annual / All Data)
  const globalStats = useMemo(() => {
    if (data.length === 0) return null;
    
    const stats = {
        active: { max: 0, min: Infinity, avg: 0, sum: 0 },
        inductive: { max: 0, min: Infinity, avg: 0, sum: 0 },
        capacitive: { max: 0, min: Infinity, avg: 0, sum: 0 },
        count: data.length
    };

    data.forEach(d => {
        // Active
        stats.active.max = Math.max(stats.active.max, d.activeMax);
        stats.active.min = Math.min(stats.active.min, d.activeMin);
        stats.active.sum += d.activeAvg; // Sum of hourly avg power = Energy (kWh)

        // Inductive
        stats.inductive.max = Math.max(stats.inductive.max, d.inductiveMax);
        stats.inductive.min = Math.min(stats.inductive.min, d.inductiveMin);
        stats.inductive.sum += d.inductiveAvg;

        // Capacitive
        stats.capacitive.max = Math.max(stats.capacitive.max, d.capacitiveMax);
        stats.capacitive.min = Math.min(stats.capacitive.min, d.capacitiveMin);
        stats.capacitive.sum += d.capacitiveAvg;
    });

    stats.active.avg = stats.active.sum / stats.count;
    stats.inductive.avg = stats.inductive.sum / stats.count;
    stats.capacitive.avg = stats.capacitive.sum / stats.count;

    return stats;
  }, [data]);

  // Filtering Data based on Period and Focus Date
  const filteredData = useMemo(() => {
    if (data.length === 0) return [];

    let start: Date, end: Date;
    const year = focusDate.getFullYear();
    const month = focusDate.getMonth();
    const day = focusDate.getDate();

    switch (period) {
        case Period.DAILY:
            start = new Date(year, month, day, 0, 0, 0);
            end = new Date(year, month, day, 23, 59, 59);
            break;
        case Period.WEEKLY:
            // Get Monday of the week
            const dayOfWeek = focusDate.getDay(); // 0 (Sun) - 6 (Sat)
            const diff = focusDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // adjust when day is sunday
            start = new Date(focusDate);
            start.setDate(diff);
            start.setHours(0,0,0,0);
            
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23,59,59,999);
            break;
        case Period.MONTHLY:
            start = new Date(year, month, 1);
            end = new Date(year, month + 1, 0, 23, 59, 59);
            break;
        case Period.YEARLY:
            start = new Date(year, 0, 1);
            end = new Date(year, 11, 31, 23, 59, 59);
            break;
        default:
            return data;
    }

    // This is for display purposes in charts/tables (Hourly format)
    return data
        .filter(d => d.timestamp >= start && d.timestamp <= end)
        .map(d => ({
            timestamp: d.timestamp.getTime(), 
            label: d.hourLabel,
            val: loadType === LoadType.ACTIVE ? d.activeAvg : (loadType === LoadType.INDUCTIVE ? d.inductiveAvg : d.capacitiveAvg),
            max: loadType === LoadType.ACTIVE ? d.activeMax : (loadType === LoadType.INDUCTIVE ? d.inductiveMax : d.capacitiveMax),
            min: loadType === LoadType.ACTIVE ? d.activeMin : (loadType === LoadType.INDUCTIVE ? d.inductiveMin : d.capacitiveMin),
        }));
  }, [data, period, focusDate, loadType]);

  // Optimized Chart Data (Downsampling for performance)
  const chartData = useMemo(() => {
      const MAX_POINTS = 2000;
      if (filteredData.length <= MAX_POINTS) return filteredData;
      
      const factor = Math.ceil(filteredData.length / MAX_POINTS);
      return filteredData.filter((_, i) => i % factor === 0);
  }, [filteredData]);

  // Navigation Handlers
  const handleNavigate = (direction: 'prev' | 'next') => {
      const newDate = new Date(focusDate);
      const delta = direction === 'next' ? 1 : -1;

      switch (period) {
          case Period.DAILY:
              newDate.setDate(newDate.getDate() + delta);
              break;
          case Period.WEEKLY:
              newDate.setDate(newDate.getDate() + (delta * 7));
              break;
          case Period.MONTHLY:
              newDate.setMonth(newDate.getMonth() + delta);
              break;
          case Period.YEARLY:
              newDate.setFullYear(newDate.getFullYear() + delta);
              break;
      }
      setFocusDate(newDate);
  };

  const getColor = () => {
      switch(loadType) {
          case LoadType.ACTIVE: return "#2563eb"; // Blue
          case LoadType.INDUCTIVE: return "#dc2626"; // Red
          case LoadType.CAPACITIVE: return "#16a34a"; // Green
      }
  };

  const viewStats = useMemo(() => {
      if(filteredData.length === 0) return null;
      const vals = filteredData.map(d => d.val);
      const maxes = filteredData.map(d => d.max);
      const sum = vals.reduce((a,b) => a+b, 0);
      return {
          min: Math.min(...vals),
          max: Math.max(...maxes),
          avg: sum / vals.length,
          sum: sum
      };
  }, [filteredData]);

  const formatXAxis = (tickItem: number) => {
      const d = new Date(tickItem);
      if (period === Period.DAILY) return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      if (period === Period.WEEKLY) return d.toLocaleDateString([], {weekday: 'short', day: 'numeric'});
      if (period === Period.MONTHLY) return d.toLocaleDateString([], {day: '2-digit'});
      if (period === Period.YEARLY) return d.toLocaleDateString([], {month: 'short'});
      return "";
  };

  const getPeriodLabel = () => {
      if (period === Period.DAILY) return focusDate.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (period === Period.WEEKLY) return `Semana de ${focusDate.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}`;
      if (period === Period.MONTHLY) return focusDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
      if (period === Period.YEARLY) return `Ano ${focusDate.getFullYear()}`;
      return "";
  };

  // Export Logic Handler
  const handleExport = () => {
      // Determine which dataset to use
      let datasetToExport: any[] = data; 
      
      // If raw resolution is selected, use rawData instead of hourly aggregated data
      if (exportConfig.resolution === 'raw') {
          datasetToExport = rawData;
      }

      if (exportRange === 'current') {
          // Re-filter source data based on current period
          let start: Date, end: Date;
          const year = focusDate.getFullYear();
          const month = focusDate.getMonth();
          const day = focusDate.getDate();

          if(period === Period.DAILY) {
              start = new Date(year, month, day, 0, 0, 0);
              end = new Date(year, month, day, 23, 59, 59);
          } else if(period === Period.WEEKLY) {
              const dayOfWeek = focusDate.getDay();
              const diff = focusDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
              start = new Date(focusDate); start.setDate(diff); start.setHours(0,0,0,0);
              end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
          } else if(period === Period.MONTHLY) {
              start = new Date(year, month, 1);
              end = new Date(year, month + 1, 0, 23, 59, 59);
          } else {
              start = new Date(year, 0, 1);
              end = new Date(year, 11, 31, 23, 59, 59);
          }
          
          datasetToExport = datasetToExport.filter((d: any) => d.timestamp >= start && d.timestamp <= end);
      }

      generateCSV(datasetToExport, exportConfig);
      setIsExportModalOpen(false);
  };

  // --- Virtualization Logic ---
  const ROW_HEIGHT = 37; // Fixed row height in pixels (h-9 approx)
  const TABLE_HEIGHT = 320; // max-h-80 = 20rem = 320px
  const OVERSCAN = 10; // Extra rows to render above/below
  
  const totalRows = filteredData.length;
  // Calculate indices
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(totalRows, Math.ceil((scrollTop + TABLE_HEIGHT) / ROW_HEIGHT) + OVERSCAN);
  
  const visibleRows = filteredData.slice(startIndex, endIndex);
  
  // Calculate spacers
  const paddingTop = startIndex * ROW_HEIGHT;
  const paddingBottom = (totalRows - endIndex) * ROW_HEIGHT;

  return (
    <div className="space-y-6">
      
      {/* General Summary Table */}
      {globalStats && (
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
             <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center border-b pb-2">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                Resumo Geral da Instalação (Total Importado)
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Active */}
                 <div className="bg-blue-50 p-4 rounded border border-blue-100">
                    <h4 className="font-bold text-blue-800 mb-2 border-b border-blue-200 pb-1">Potência Ativa</h4>
                    <div className="flex justify-between text-sm mb-1"><span>Total Energia:</span> <span className="font-mono font-bold text-lg">{globalStats.active.sum.toLocaleString('pt-PT', {maximumFractionDigits: 0})} kWh</span></div>
                    <div className="flex justify-between text-sm mb-1"><span>Média Potência:</span> <span className="font-mono font-bold">{globalStats.active.avg.toFixed(2)} kW</span></div>
                    <div className="flex justify-between text-sm mb-1"><span>Máximo Registado:</span> <span className="font-mono font-bold">{globalStats.active.max.toFixed(2)} kW</span></div>
                 </div>
                 {/* Inductive */}
                 <div className="bg-red-50 p-4 rounded border border-red-100">
                    <h4 className="font-bold text-red-800 mb-2 border-b border-red-200 pb-1">Reativa Indutiva</h4>
                    <div className="flex justify-between text-sm mb-1"><span>Total Energia:</span> <span className="font-mono font-bold text-lg">{globalStats.inductive.sum.toLocaleString('pt-PT', {maximumFractionDigits: 0})} kVArh</span></div>
                    <div className="flex justify-between text-sm mb-1"><span>Média Potência:</span> <span className="font-mono font-bold">{globalStats.inductive.avg.toFixed(2)} kVAr</span></div>
                    <div className="flex justify-between text-sm"><span>Máximo Registado:</span> <span className="font-mono font-bold">{globalStats.inductive.max.toFixed(2)} kVAr</span></div>
                 </div>
                 {/* Capacitive */}
                 <div className="bg-green-50 p-4 rounded border border-green-100">
                    <h4 className="font-bold text-green-800 mb-2 border-b border-green-200 pb-1">Reativa Capacitiva</h4>
                    <div className="flex justify-between text-sm mb-1"><span>Total Energia:</span> <span className="font-mono font-bold text-lg">{globalStats.capacitive.sum.toLocaleString('pt-PT', {maximumFractionDigits: 0})} kVArh</span></div>
                    <div className="flex justify-between text-sm mb-1"><span>Média Potência:</span> <span className="font-mono font-bold">{globalStats.capacitive.avg.toFixed(2)} kVAr</span></div>
                    <div className="flex justify-between text-sm"><span>Máximo Registado:</span> <span className="font-mono font-bold">{globalStats.capacitive.max.toFixed(2)} kVAr</span></div>
                 </div>
             </div>
        </div>
      )}

      {/* Controls & Navigation */}
      <div className="bg-white p-4 rounded-lg shadow flex flex-col md:flex-row justify-between items-center gap-4">
        
        {/* Load Type Selector */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            {Object.values(LoadType).map((t) => (
                <button
                    key={t}
                    onClick={() => setLoadType(t)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        loadType === t ? 'bg-white text-blue-700 shadow' : 'text-gray-500 hover:text-gray-800'
                    }`}
                >
                    {t === 'active' ? 'Ativa (kW)' : t === 'inductive' ? 'Indutiva (kVAr)' : 'Capacitiva (kVAr)'}
                </button>
            ))}
        </div>

        {/* Period Selector */}
        <div className="flex space-x-2">
            {Object.values(Period).map((p) => (
                <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                        period === p ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-700' : 'text-gray-500 hover:text-gray-800'
                    }`}
                >
                    {p}
                </button>
            ))}
        </div>

        {/* Date Navigation */}
        <div className="flex items-center space-x-2 bg-gray-50 p-1 rounded border border-gray-200">
             <button onClick={() => handleNavigate('prev')} className="p-1 hover:bg-gray-200 rounded text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
             </button>
             
             <div className="text-sm font-bold w-48 text-center text-gray-800 capitalize select-none">
                 {getPeriodLabel()}
             </div>

             <button onClick={() => handleNavigate('next')} className="p-1 hover:bg-gray-200 rounded text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
             </button>

             {period !== Period.YEARLY && (
                 <input 
                    type={period === Period.MONTHLY ? "month" : "date"}
                    className="text-xs bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                    onChange={(e) => {
                        if(e.target.value) setFocusDate(new Date(e.target.value));
                    }}
                    value={period === Period.MONTHLY 
                        ? `${focusDate.getFullYear()}-${String(focusDate.getMonth()+1).padStart(2,'0')}`
                        : `${focusDate.getFullYear()}-${String(focusDate.getMonth()+1).padStart(2,'0')}-${String(focusDate.getDate()).padStart(2,'0')}`
                    }
                 />
             )}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-100 h-[500px]">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-700 capitalize">
                Gráfico {period} - {loadType === 'active' ? 'Potência Ativa' : loadType === 'inductive' ? 'Reativa Indutiva' : 'Reativa Capacitiva'}
            </h3>
            {viewStats && (
                <div className="text-xs text-gray-500 font-mono">
                    Total: <span className="font-bold text-gray-800">{viewStats.sum.toFixed(0)}</span> | 
                    Max: <span className="font-bold text-gray-800">{viewStats.max.toFixed(2)}</span>
                    {filteredData.length > 2000 && <span className="ml-2 text-orange-500 text-[10px]">(Amostragem Otimizada)</span>}
                </div>
            )}
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis 
                dataKey="timestamp" 
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={formatXAxis}
                fontSize={12} 
                tickMargin={10} 
                stroke="#9ca3af"
                scale="time"
                minTickGap={30}
            />
            <YAxis fontSize={12} stroke="#9ca3af" label={{ value: loadType === 'active' ? 'kW' : 'kVAr', angle: -90, position: 'insideLeft' }} />
            <Tooltip 
                labelFormatter={(ts) => new Date(ts).toLocaleString('pt-PT')}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                formatter={(value: number) => [value.toFixed(2), loadType === 'active' ? 'kW' : 'kVAr']}
            />
            <Legend verticalAlign="top"/>
            <Area 
                type="monotone" 
                dataKey="val" 
                fill={getColor()} 
                fillOpacity={0.1} 
                stroke={getColor()} 
                strokeWidth={period === Period.YEARLY ? 1 : 2}
                name="Potência (Média 1h)" 
                activeDot={{ r: 4 }}
                dot={false}
                isAnimationActive={false} 
            />
            <Brush dataKey="timestamp" height={30} stroke="#8884d8" tickFormatter={formatXAxis} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Data Table with Virtual Scroll */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
             <h3 className="text-lg font-semibold text-gray-700">Dados Horários ({totalRows} registos)</h3>
             <button 
                onClick={() => setIsExportModalOpen(true)}
                className="text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded hover:bg-blue-100 flex items-center border border-blue-200"
             >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Exportar Excel (CSV)
             </button>
        </div>
        
        {/* Virtualized Container */}
        <div 
            ref={tableContainerRef}
            className="overflow-auto max-h-80 relative"
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Data/Hora</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Valor ({loadType === 'active' ? 'kW' : 'kVAr'})</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {/* Top Spacer */}
                    {paddingTop > 0 && (
                        <tr style={{ height: paddingTop }}>
                            <td colSpan={2} />
                        </tr>
                    )}
                    
                    {/* Visible Rows */}
                    {visibleRows.map((row) => (
                        <tr key={row.timestamp} className="hover:bg-gray-50 h-[37px]">
                            <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">{row.label}</td>
                            <td className="px-6 py-2 whitespace-nowrap text-sm text-right font-medium text-gray-900">{row.val.toFixed(2)}</td>
                        </tr>
                    ))}

                    {/* Bottom Spacer */}
                    {paddingBottom > 0 && (
                        <tr style={{ height: paddingBottom }}>
                            <td colSpan={2} />
                        </tr>
                    )}
                </tbody>
            </table>
            {totalRows === 0 && (
                 <div className="text-center py-8 text-gray-500 text-sm italic">
                    Sem dados para mostrar neste período.
                 </div>
            )}
        </div>
      </div>

      {/* Export Modal */}
      {isExportModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-slate-800 rounded-lg shadow-xl max-w-md w-full border border-gray-700">
                  <div className="p-4 border-b border-gray-700 bg-slate-900 rounded-t-lg">
                      <h3 className="text-xl font-bold text-white">Exportar Dados (CSV)</h3>
                  </div>
                  
                  <div className="p-6 space-y-4">
                    {/* Range */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Período</label>
                        <select 
                            className="w-full bg-slate-700 border border-slate-600 text-white p-2 rounded text-sm"
                            value={exportRange}
                            onChange={(e) => setExportRange(e.target.value as any)}
                        >
                            <option value="current">Apenas Período Atual ({getPeriodLabel()})</option>
                            <option value="all">Ano Completo (Todos os dados)</option>
                        </select>
                    </div>

                    {/* Resolution */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Formato (Resolução)</label>
                        <select 
                            className="w-full bg-slate-700 border border-slate-600 text-white p-2 rounded text-sm"
                            value={exportConfig.resolution}
                            onChange={(e) => setExportConfig({...exportConfig, resolution: e.target.value as any})}
                        >
                            <option value="raw">Detalhado (Original / 15 min)</option>
                            <option value="hourly">Horário (1h)</option>
                            <option value="daily">Diário (24h)</option>
                            <option value="monthly">Mensal</option>
                        </select>
                        <p className="text-xs text-gray-400 mt-1">
                            {exportConfig.resolution === 'hourly' 
                                ? 'Exporta linhas para cada hora (Média).' 
                                : exportConfig.resolution === 'raw' 
                                    ? 'Exporta dados originais (normalmente 15m).' 
                                    : 'Exporta a soma de energia (kWh/kVArh) por dia ou mês.'}
                        </p>
                    </div>

                    {/* Date/Time Format */}
                    <div className="flex items-center">
                        <input 
                            type="checkbox" 
                            checked={exportConfig.splitDateTime} 
                            onChange={e => setExportConfig({...exportConfig, splitDateTime: e.target.checked})} 
                            className="mr-2 rounded border-gray-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                        />
                        <label className="text-sm font-medium text-gray-300">Separar Data e Hora em colunas</label>
                    </div>

                    {/* Columns */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Variáveis</label>
                        <div className="space-y-2 text-gray-200">
                            <label className="flex items-center">
                                <input type="checkbox" checked={exportConfig.columns.active} onChange={e => setExportConfig(p => ({...p, columns: {...p.columns, active: e.target.checked}}))} className="mr-2 rounded border-gray-600 bg-slate-700" />
                                Potência Ativa
                            </label>
                            <label className="flex items-center">
                                <input type="checkbox" checked={exportConfig.columns.inductive} onChange={e => setExportConfig(p => ({...p, columns: {...p.columns, inductive: e.target.checked}}))} className="mr-2 rounded border-gray-600 bg-slate-700" />
                                Reativa Indutiva
                            </label>
                            <label className="flex items-center">
                                <input type="checkbox" checked={exportConfig.columns.capacitive} onChange={e => setExportConfig(p => ({...p, columns: {...p.columns, capacitive: e.target.checked}}))} className="mr-2 rounded border-gray-600 bg-slate-700" />
                                Reativa Capacitiva
                            </label>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-slate-900 p-3 rounded text-sm text-gray-400 border border-slate-700">
                        <p><strong>Resumo:</strong> Exportar dados {exportConfig.resolution === 'hourly' ? 'Horários' : exportConfig.resolution === 'daily' ? 'Diários' : exportConfig.resolution === 'raw' ? 'Originais (15m)' : 'Mensais'}.</p>
                        <p>Separador: Ponto e vírgula (;).</p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 p-4 border-t border-gray-700 bg-slate-900 rounded-b-lg">
                      <button onClick={() => setIsExportModalOpen(false)} className="px-4 py-2 text-gray-300 hover:bg-gray-800 rounded">Cancelar</button>
                      <button onClick={handleExport} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium shadow-lg shadow-blue-900/50">Confirmar Exportação</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default Dashboard;
