

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, ReferenceLine, Brush, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { HourlyData, TelemetryRow, LoadType, Period, TariffCycle, Season, DayType, TariffOption, ProjectState } from '../types';
import { generateCSV, ExportConfig } from '../services/dataService';
import TariffSupportModal from './TariffSupportModal';

interface DashboardProps {
  project: ProjectState;
  rawData: TelemetryRow[];
}

const Dashboard: React.FC<DashboardProps> = ({ project, rawData }) => {
  const data = project.hourlyData;
  const tariffOption = project.tariffOption;
  const [period, setPeriod] = useState<Period>(Period.MONTHLY);
  const [loadType, setLoadType] = useState<LoadType>(LoadType.ACTIVE);
  const [cycleViewMode, setCycleViewMode] = useState<'energy' | 'cost'>('energy');
  const [focusDate, setFocusDate] = useState<Date>(new Date());
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
      resolution: 'hourly',
      splitDateTime: false,
      columns: { active: true, inductive: true, capacitive: true, cost: true }
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
        cost: { max: 0, min: Infinity, avg: 0, sum: 0 },
        omie: { max: 0, min: Infinity, avg: 0, sum: 0 },
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

        // Cost
        let currentCost = d.cost || 0;
        if (project.invoice) {
            const inv = project.invoice.costs;
            switch(d.cycle) {
                case TariffCycle.PONTA: currentCost = d.activeAvg * inv.ponta; break;
                case TariffCycle.CHEIAS: currentCost = d.activeAvg * inv.cheias; break;
                case TariffCycle.VAZIO_NORMAL: currentCost = d.activeAvg * inv.vazio; break;
                case TariffCycle.SUPER_VAZIO: currentCost = d.activeAvg * (inv.superVazio || 0); break;
            }
        }
        stats.cost.max = Math.max(stats.cost.max, currentCost);
        stats.cost.min = Math.min(stats.cost.min, currentCost);
        stats.cost.sum += currentCost;

        // OMIE
        if (d.omiePrice !== undefined) {
          stats.omie.max = Math.max(stats.omie.max, d.omiePrice);
          stats.omie.min = Math.min(stats.omie.min, d.omiePrice);
          stats.omie.sum += d.omiePrice;
        }
    });

    stats.active.avg = stats.active.sum / stats.count;
    stats.inductive.avg = stats.inductive.sum / stats.count;
    stats.capacitive.avg = stats.capacitive.sum / stats.count;
    stats.cost.avg = stats.cost.sum / stats.count;
    stats.omie.avg = stats.omie.sum / stats.count;

    return stats;
  }, [data, project.invoice]);

  // Cycle Stats Calculation
  const cycleStats = useMemo(() => {
    if (data.length === 0) return null;
    
    const stats: Record<string, { sum: number, count: number, max: number, cost: number, color: string }> = {
      [TariffCycle.PONTA]: { sum: 0, count: 0, max: 0, cost: 0, color: '#ef4444' }, // Red
      [TariffCycle.CHEIAS]: { sum: 0, count: 0, max: 0, cost: 0, color: '#3b82f6' }, // Blue
      [TariffCycle.VAZIO_NORMAL]: { sum: 0, count: 0, max: 0, cost: 0, color: '#10b981' }, // Green
      [TariffCycle.SUPER_VAZIO]: { sum: 0, count: 0, max: 0, cost: 0, color: '#8b5cf6' }, // Purple
    };

    data.forEach(d => {
      if (d.cycle && stats[d.cycle]) {
        stats[d.cycle].sum += d.activeAvg;
        stats[d.cycle].count++;
        stats[d.cycle].max = Math.max(stats[d.cycle].max, d.activeMax);
        
        let currentCost = d.cost || 0;
        if (project.invoice) {
            const inv = project.invoice.costs;
            switch(d.cycle) {
                case TariffCycle.PONTA: currentCost = d.activeAvg * inv.ponta; break;
                case TariffCycle.CHEIAS: currentCost = d.activeAvg * inv.cheias; break;
                case TariffCycle.VAZIO_NORMAL: currentCost = d.activeAvg * inv.vazio; break;
                case TariffCycle.SUPER_VAZIO: currentCost = d.activeAvg * (inv.superVazio || 0); break;
            }
        }
        stats[d.cycle].cost += currentCost;
      }
    });

    return Object.entries(stats).map(([name, data]) => ({
      name,
      ...data,
      percentage: (data.sum / (globalStats?.active.sum || 1)) * 100,
      costPercentage: (data.cost / (globalStats?.cost.sum || 1)) * 100
    }));
  }, [data, globalStats, project.invoice]);

  // Detailed Cycle Stats (Season, DayType, Cycle)
  const detailedCycleStats = useMemo(() => {
    if (data.length === 0) return [];
    
    const map: Record<string, { season: Season, dayType: DayType, cycle: TariffCycle, sum: number, max: number, cost: number }> = {};

    data.forEach(d => {
      if (d.cycle && d.season && d.dayType) {
        const key = `${d.season}-${d.dayType}-${d.cycle}`;
        if (!map[key]) {
          map[key] = { season: d.season, dayType: d.dayType, cycle: d.cycle, sum: 0, max: 0, cost: 0 };
        }
        map[key].sum += d.activeAvg;
        map[key].max = Math.max(map[key].max, d.activeMax);

        let currentCost = d.cost || 0;
        if (project.invoice) {
            const inv = project.invoice.costs;
            switch(d.cycle) {
                case TariffCycle.PONTA: currentCost = d.activeAvg * inv.ponta; break;
                case TariffCycle.CHEIAS: currentCost = d.activeAvg * inv.cheias; break;
                case TariffCycle.VAZIO_NORMAL: currentCost = d.activeAvg * inv.vazio; break;
                case TariffCycle.SUPER_VAZIO: currentCost = d.activeAvg * (inv.superVazio || 0); break;
            }
        }
        map[key].cost += currentCost;
      }
    });

    return Object.values(map).sort((a, b) => {
      // Sort by Season, then DayType, then Cycle
      if (a.season !== b.season) return a.season === Season.SUMMER ? -1 : 1;
      if (a.dayType !== b.dayType) {
        const order = [DayType.WEEKDAY, DayType.SATURDAY, DayType.SUNDAY];
        return order.indexOf(a.dayType) - order.indexOf(b.dayType);
      }
      const cycleOrder = [TariffCycle.PONTA, TariffCycle.CHEIAS, TariffCycle.VAZIO_NORMAL, TariffCycle.SUPER_VAZIO];
      return cycleOrder.indexOf(a.cycle) - cycleOrder.indexOf(b.cycle);
    });
  }, [data, project.invoice]);

  // Histograms / Profiles
  const histograms = useMemo(() => {
    if (data.length === 0) return null;

    // 1. Weekly/Hour Profile (0-167)
    const weeklyMap: Record<number, { sum: number, count: number }> = {};
    // 2. Monthly/Day Profile (1-31)
    const monthlyMap: Record<number, { sum: number, count: number }> = {};
    // 3. Yearly/Month Profile (0-11)
    const yearlyMap: Record<number, { sum: number, count: number }> = {};
    const yearlyMaxMap: Record<number, number> = {};
    const yearlyMinMap: Record<number, number> = {};

    data.forEach(d => {
      const date = d.timestamp;
      
      // Weekly: Day (0-6) * 24 + Hour (0-23)
      const weekKey = date.getDay() * 24 + date.getHours();
      if (!weeklyMap[weekKey]) weeklyMap[weekKey] = { sum: 0, count: 0 };
      weeklyMap[weekKey].sum += d.activeAvg;
      weeklyMap[weekKey].count++;

      // Monthly: Day of month (1-31)
      const monthKey = date.getDate();
      if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { sum: 0, count: 0 };
      monthlyMap[monthKey].sum += d.activeAvg;
      monthlyMap[monthKey].count++;

      // Yearly: Month (0-11)
      const yearKey = date.getMonth();
      if (!yearlyMap[yearKey]) yearlyMap[yearKey] = { sum: 0, count: 0 };
      yearlyMap[yearKey].sum += d.activeAvg;
      yearlyMap[yearKey].count++;

      if (!yearlyMaxMap[yearKey] || d.activeAvg > yearlyMaxMap[yearKey]) {
        yearlyMaxMap[yearKey] = d.activeAvg;
      }
      if (!yearlyMinMap[yearKey] || d.activeAvg < yearlyMinMap[yearKey]) {
        yearlyMinMap[yearKey] = d.activeAvg;
      }
    });

    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    return {
      weekly: Object.entries(weeklyMap).map(([key, val]) => {
        const k = parseInt(key);
        const dayIdx = Math.floor(k / 24);
        const hour = k % 24;
        return {
          label: `${days[dayIdx]} ${String(hour).padStart(2, '0')}h`,
          value: val.sum / val.count,
          dayIdx,
          hour
        };
      }).sort((a, b) => (a.dayIdx * 24 + a.hour) - (b.dayIdx * 24 + b.hour)),
      
      monthly: Object.entries(monthlyMap).map(([key, val]) => ({
        label: `Dia ${key}`,
        value: val.sum / val.count,
        day: parseInt(key)
      })).sort((a, b) => a.day - b.day),

      yearly: Object.entries(yearlyMap).map(([key, val]) => ({
        label: months[parseInt(key)],
        value: val.sum / val.count,
        month: parseInt(key)
      })).sort((a, b) => a.month - b.month),

      yearlyMax: Object.entries(yearlyMaxMap).map(([key, val]) => ({
        label: months[parseInt(key)],
        value: val,
        month: parseInt(key)
      })).sort((a, b) => a.month - b.month),

      yearlySum: Object.entries(yearlyMap).map(([key, val]) => ({
        label: months[parseInt(key)],
        value: val.sum,
        month: parseInt(key)
      })).sort((a, b) => a.month - b.month),

      yearlyMin: Object.entries(yearlyMinMap).map(([key, val]) => ({
        label: months[parseInt(key)],
        value: val,
        month: parseInt(key)
      })).sort((a, b) => a.month - b.month)
    };
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
            start = new Date(0);
            end = new Date();
    }

    // This is for display purposes in charts/tables (Hourly format)
    return data
        .filter(d => d.timestamp >= start && d.timestamp <= end)
        .map(d => {
            let costVal = d.cost || 0;
            
            // If viewing costs and invoice data exists, use invoice unit prices
            if (loadType === LoadType.COST && project.invoice) {
                const inv = project.invoice.costs;
                switch(d.cycle) {
                    case TariffCycle.PONTA: costVal = d.activeAvg * inv.ponta; break;
                    case TariffCycle.CHEIAS: costVal = d.activeAvg * inv.cheias; break;
                    case TariffCycle.VAZIO_NORMAL: costVal = d.activeAvg * inv.vazio; break;
                    case TariffCycle.SUPER_VAZIO: costVal = d.activeAvg * (inv.superVazio || 0); break;
                }
            }

            return {
                timestamp: d.timestamp.getTime(), 
                label: d.hourLabel,
                val: loadType === LoadType.ACTIVE ? d.activeAvg : (loadType === LoadType.INDUCTIVE ? d.inductiveAvg : (loadType === LoadType.CAPACITIVE ? d.capacitiveAvg : costVal)),
                max: loadType === LoadType.ACTIVE ? d.activeMax : (loadType === LoadType.INDUCTIVE ? d.inductiveMax : (loadType === LoadType.CAPACITIVE ? d.capacitiveMax : costVal)),
                min: loadType === LoadType.ACTIVE ? d.activeMin : (loadType === LoadType.INDUCTIVE ? d.inductiveMin : (loadType === LoadType.CAPACITIVE ? d.capacitiveMin : costVal)),
                omie: d.omiePrice,
                cycle: d.cycle,
                season: d.season
            };
        });
  }, [data, period, focusDate, loadType, project.invoice]);

  const getCycleColor = (cycle?: TariffCycle, season?: Season) => {
    if (!cycle) return '#94a3b8';
    const isSummer = season === Season.SUMMER;
    switch (cycle) {
      case TariffCycle.PONTA: return isSummer ? '#ef4444' : '#b91c1c';
      case TariffCycle.CHEIAS: return isSummer ? '#3b82f6' : '#1d4ed8';
      case TariffCycle.VAZIO_NORMAL: return isSummer ? '#10b981' : '#047857';
      case TariffCycle.SUPER_VAZIO: return isSummer ? '#8b5cf6' : '#6d28d9';
      default: return '#94a3b8';
    }
  };

  // Optimized Chart Data (Downsampling for performance)
  const chartData = useMemo(() => {
      const MAX_POINTS = 2000;
      let result = filteredData;
      if (filteredData.length > MAX_POINTS) {
          const factor = Math.ceil(filteredData.length / MAX_POINTS);
          result = filteredData.filter((_, i) => i % factor === 0);
      }
      return result.map(d => ({
          ...d,
          color: getCycleColor(d.cycle, d.season)
      }));
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
          case LoadType.COST: return "#8b5cf6"; // Purple
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

      // Enrich with cost if needed
      const enrichedData = datasetToExport.map(d => {
          let costVal = d.cost || 0;
          if (project.invoice) {
              const inv = project.invoice.costs;
              const activeVal = d.activeAvg || d.activePower || 0;
              switch(d.cycle) {
                  case TariffCycle.PONTA: costVal = activeVal * inv.ponta; break;
                  case TariffCycle.CHEIAS: costVal = activeVal * inv.cheias; break;
                  case TariffCycle.VAZIO_NORMAL: costVal = activeVal * inv.vazio; break;
                  case TariffCycle.SUPER_VAZIO: costVal = activeVal * (inv.superVazio || 0); break;
              }
          }
          return { ...d, cost: costVal };
      });

      generateCSV(enrichedData, exportConfig);
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
                    onClick={() => {
                        const hasInvoice = project.invoice && (
                            project.invoice.costs.ponta > 0 || 
                            project.invoice.costs.cheias > 0 || 
                            project.invoice.costs.vazio > 0
                        );
                        
                        if (t === LoadType.COST && !hasInvoice) {
                            alert("Por favor, insira os Dados do Cliente e Edifício (Fatura) na Análise Comercial para visualizar os custos reais baseados na sua fatura.");
                            return;
                        }
                        setLoadType(t);
                    }}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        loadType === t ? 'bg-white text-blue-700 shadow' : 'text-gray-500 hover:text-gray-800'
                    }`}
                >
                    {t === 'active' ? 'Ativa (kW)' : t === 'inductive' ? 'Indutiva (kVAr)' : t === 'capacitive' ? 'Capacitiva (kVAr)' : 'Custos (€)'}
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
                Gráfico {period} - {loadType === LoadType.ACTIVE ? 'Potência Ativa' : loadType === LoadType.INDUCTIVE ? 'Reativa Indutiva' : loadType === LoadType.CAPACITIVE ? 'Reativa Capacitiva' : 'Custos Estimados'}
            </h3>
            {viewStats && (
                <div className="text-xs text-gray-500 font-mono">
                    Total: <span className="font-bold text-gray-800">{viewStats.sum.toFixed(loadType === LoadType.COST ? 2 : 0)} {loadType === LoadType.ACTIVE ? 'kWh' : (loadType === LoadType.COST ? '€' : 'kVArh')}</span> | 
                    Max: <span className="font-bold text-gray-800">{viewStats.max.toFixed(loadType === LoadType.COST ? 4 : 2)} {loadType === LoadType.ACTIVE ? 'kW' : (loadType === LoadType.COST ? '€' : 'kVAr')}</span>
                    {filteredData.length > 2000 && <span className="ml-2 text-orange-500 text-[10px]">(Amostragem Otimizada)</span>}
                </div>
            )}
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 40, bottom: 50 }}>
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
                padding={{ left: 40, right: 40 }}
            />
            <YAxis 
                fontSize={12} 
                stroke="#9ca3af" 
                width={60}
                label={{ value: loadType === LoadType.ACTIVE ? 'kW' : (loadType === LoadType.COST ? '€' : 'kVAr'), angle: -90, position: 'insideLeft', offset: 0 }} 
            />
            <Tooltip 
                labelFormatter={(ts) => new Date(ts).toLocaleString('pt-PT')}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                formatter={(value: number, name: string, props: any) => {
                    const unit = loadType === LoadType.ACTIVE ? 'kW' : (loadType === LoadType.COST ? '€' : 'kVAr');
                    const cycle = props.payload.cycle;
                    const season = props.payload.season;
                    const omie = props.payload.omie;
                    return [
                        <div key="val" className="flex flex-col gap-1">
                            <div className="flex justify-between gap-4">
                                <span className="font-bold">{value.toFixed(loadType === LoadType.COST ? 4 : 2)} {unit}</span>
                                {cycle && <span className="text-[10px] opacity-70">({cycle} - {season})</span>}
                            </div>
                            {omie && <div className="text-[10px] text-blue-600">OMIE: {omie.toFixed(2)} €/MWh</div>}
                        </div>,
                        loadType === LoadType.ACTIVE ? 'Potência Ativa' : loadType === LoadType.INDUCTIVE ? 'Indutiva' : loadType === LoadType.CAPACITIVE ? 'Capacitiva' : 'Custo Estimado'
                    ];
                }}
            />
            <Bar dataKey="val" isAnimationActive={false}>
                {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
            </Bar>
            <Brush dataKey="timestamp" height={30} stroke="#cbd5e1" tickFormatter={formatXAxis} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Cycle Analysis Section */}
      {cycleStats && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => setCycleViewMode('energy')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${cycleViewMode === 'energy' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
            >
              Energia (kWh)
            </button>
            <button 
              onClick={() => setCycleViewMode('cost')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${cycleViewMode === 'cost' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
            >
              Custo (€)
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cycle Table */}
            <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center border-b pb-2">
                <svg className="w-5 h-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                {cycleViewMode === 'energy' ? 'Consumo por Ciclo (Total)' : 'Custo por Ciclo (Total)'}
              </h3>
              <div className="space-y-4">
                {cycleStats.map((cycle) => (
                  <div key={cycle.name} className="flex flex-col">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-bold text-gray-700">{cycle.name}</span>
                      <span className="text-xs font-mono text-gray-500">
                        {cycleViewMode === 'energy' ? cycle.percentage.toFixed(1) : cycle.costPercentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                      <div 
                        className="h-2 rounded-full transition-all duration-500" 
                        style={{ 
                          width: `${cycleViewMode === 'energy' ? cycle.percentage : cycle.costPercentage}%`, 
                          backgroundColor: cycle.color 
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>
                        {cycleViewMode === 'energy' 
                          ? `${cycle.sum.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} kWh` 
                          : `${cycle.cost.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
                      </span>
                      {cycleViewMode === 'energy' && <span>Max: {cycle.max.toFixed(1)} kW</span>}
                    </div>
                  </div>
                ))}
              </div>
            
            <button 
              onClick={() => setIsSupportModalOpen(true)}
              className="w-full mt-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-slate-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Apoio: Horários e Ciclos
            </button>
          </div>

          {/* Cycle Charts */}
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center border-b pb-2">
              <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
              {cycleViewMode === 'energy' ? 'Distribuição de Energia Ativa' : 'Distribuição de Custos'}
            </h3>
            <div className="h-[300px] flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cycleStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey={cycleViewMode === 'energy' ? 'sum' : 'cost'}
                    >
                      {cycleStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [
                        cycleViewMode === 'energy' 
                          ? `${value.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} kWh` 
                          : `${value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
                        cycleViewMode === 'energy' ? 'Energia' : 'Custo'
                      ]} 
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cycleStats} layout="vertical" margin={{ left: 20, right: 30 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" fontSize={10} width={80} />
                    <Tooltip 
                      formatter={(value: number) => [
                        cycleViewMode === 'energy' 
                          ? `${value.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} kWh` 
                          : `${value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
                        cycleViewMode === 'energy' ? 'Energia' : 'Custo'
                      ]} 
                    />
                    <Bar dataKey={cycleViewMode === 'energy' ? 'sum' : 'cost'} radius={[0, 4, 4, 0]}>
                      {cycleStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* Detailed Cycle Table */}
      {detailedCycleStats.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center border-b pb-2">
            <svg className="w-5 h-5 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Tabela Detalhada de Consumo por Ciclo e Estação
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3 border-b">Estação</th>
                  <th className="px-4 py-3 border-b">Tipo de Dia</th>
                  <th className="px-4 py-3 border-b">Ciclo</th>
                  <th className="px-4 py-3 border-b text-right">
                    {cycleViewMode === 'energy' ? 'Consumo (kWh)' : 'Custo (€)'}
                  </th>
                  <th className="px-4 py-3 border-b text-right">Pico Máx (kW)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detailedCycleStats.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <span className={`px-2 py-1 rounded-full text-[10px] ${row.season === Season.SUMMER ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                        {row.season}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{row.dayType}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center">
                        <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 
                          row.cycle === TariffCycle.PONTA ? '#ef4444' : 
                          row.cycle === TariffCycle.CHEIAS ? '#3b82f6' : 
                          row.cycle === TariffCycle.VAZIO_NORMAL ? '#10b981' : '#8b5cf6' 
                        }}></span>
                        {row.cycle}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">
                      {cycleViewMode === 'energy' 
                        ? row.sum.toLocaleString('pt-PT', { maximumFractionDigits: 0 })
                        : row.cost.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600">
                      {row.max.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-bold text-gray-900">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right">TOTAL GERAL</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {cycleViewMode === 'energy'
                      ? globalStats?.active.sum.toLocaleString('pt-PT', { maximumFractionDigits: 0 })
                      : globalStats?.cost.sum.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {globalStats?.active.max.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Histograms Section */}
      {histograms && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Weekly Profile */}
            <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center border-b pb-2">
                <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Histograma Semanal (Média por Hora) - kW
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histograms.weekly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" fontSize={8} interval={23} tickMargin={5} />
                    <YAxis fontSize={10} />
                    <Tooltip formatter={(v: number) => [v.toFixed(2) + ' kW', 'Média']} />
                    <Bar dataKey="value" fill="#6366f1" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Profile */}
            <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center border-b pb-2">
                <svg className="w-5 h-5 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Histograma Mensal (Média por Dia) - kW
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histograms.monthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip formatter={(v: number) => [v.toFixed(2) + ' kW', 'Média']} />
                    <Bar dataKey="value" fill="#10b981" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Yearly Profile */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center border-b pb-2">
                <svg className="w-5 h-5 mr-2 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                Histograma Anual (Média por Mês) - kW
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histograms.yearly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip formatter={(v: number) => [v.toFixed(2) + ' kW', 'Média']} />
                    <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center border-b pb-2">
                <svg className="w-5 h-5 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                Histograma Anual (Máximo por Mês) - kW
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histograms.yearlyMax}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip formatter={(v: number) => [v.toFixed(2) + ' kW', 'Máximo']} />
                    <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center border-b pb-2">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                Histograma Anual (Acumulado por Mês) - kWh
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histograms.yearlySum}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip formatter={(v: number) => [v.toLocaleString('pt-PT', { maximumFractionDigits: 0 }) + ' kWh', 'Acumulado']} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center border-b pb-2">
                <svg className="w-5 h-5 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                Histograma Anual (Mínimo por Mês) - kW
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histograms.yearlyMin}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip formatter={(v: number) => [v.toFixed(2) + ' kW', 'Mínimo']} />
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

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
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Valor ({loadType === LoadType.ACTIVE ? 'kW' : (loadType === LoadType.COST ? '€' : 'kVAr')})</th>
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

      <TariffSupportModal isOpen={isSupportModalOpen} onClose={() => setIsSupportModalOpen(false)} tariffOption={tariffOption} />

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
                            <label className="flex items-center">
                                <input type="checkbox" checked={exportConfig.columns.cost} onChange={e => setExportConfig(p => ({...p, columns: {...p.columns, cost: e.target.checked}}))} className="mr-2 rounded border-gray-600 bg-slate-700" />
                                Custo Estimado (€)
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
