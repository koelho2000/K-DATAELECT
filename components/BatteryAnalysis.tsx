
import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  Cell,
  ReferenceLine
} from 'recharts';
import { 
  ProjectState, 
  HourlyData, 
  TariffCycle, 
  ViewMode 
} from '../types';
import { 
  Battery, 
  Zap, 
  TrendingUp, 
  DollarSign, 
  ArrowRight, 
  Info, 
  AlertCircle,
  ChevronRight,
  History,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Activity,
  LayoutDashboard
} from 'lucide-react';

interface BatteryAnalysisProps {
  project: ProjectState;
  onNavigate: (mode: ViewMode) => void;
}

interface BatterySpecs {
  name: string;
  unitCapacity: number; // kWh
  unitPower: number; // kW
  voltage: string;
  efficiency: number;
  dimensions: string;
  weight: number; // kg
  cycles: number;
  baseCost: number;
  installCost: number;
}

const BATTERY_SOLUTIONS: Record<string, BatterySpecs> = {
  'Huawei LUNA2000': {
    name: 'Huawei LUNA2000-5-E0',
    unitCapacity: 5,
    unitPower: 2.5,
    voltage: '360V - 600V (HV)',
    efficiency: 0.92,
    dimensions: '670 x 150 x 360 mm',
    weight: 50,
    cycles: 6000,
    baseCost: 2200,
    installCost: 1500
  },
  'Huawei Smart String ESS': {
    name: 'Huawei LUNA2000-200kWh',
    unitCapacity: 200,
    unitPower: 100,
    voltage: '800V',
    efficiency: 0.90,
    dimensions: '1810 x 1200 x 2300 mm',
    weight: 2200,
    cycles: 6500,
    baseCost: 75000,
    installCost: 15000
  },
  'Tesla Megapack': {
    name: 'Tesla Megapack 2 XL',
    unitCapacity: 3916,
    unitPower: 1958,
    voltage: '480V - 1000V',
    efficiency: 0.88,
    dimensions: '7.1 x 1.6 x 2.5 m',
    weight: 30000,
    cycles: 5000,
    baseCost: 1200000,
    installCost: 250000
  }
};

const BatteryAnalysis: React.FC<BatteryAnalysisProps> = ({ project, onNavigate }) => {
  const data = project.hourlyData;
  
  // User Inputs
  const [batteryPower, setBatteryPower] = useState(100); // kW
  const [dischargeTime, setDischargeTime] = useState(2); // hours
  
  // Visualization State
  const [chartViewMode, setChartViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState<Date>(data.length > 0 ? new Date(data[0].timestamp) : new Date());
  
  // Derived Capacity
  const batteryCapacity = useMemo(() => batteryPower * dischargeTime, [batteryPower, dischargeTime]);
  
  const [efficiency, setEfficiency] = useState(0.9); // 90% round-trip efficiency
  const [dod, setDod] = useState(0.9); // 90% Depth of Discharge
  
  // Financial Inputs
  const [inflation, setInflation] = useState(0.02); // 2%
  const [energyEscalation, setEnergyEscalation] = useState(0.03); // 3%
  const [maintenanceCost, setMaintenanceCost] = useState(0.01); // 1% of CAPEX per year

  // 1. Calculate Average Daily Profile and Stats
  const dailyProfile = useMemo(() => {
    if (data.length === 0) return [];
    
    const profile: Record<number, { sum: number, count: number, cycle: TariffCycle }> = {};
    
    data.forEach(d => {
      const hour = d.timestamp.getHours();
      if (!profile[hour]) {
        profile[hour] = { sum: 0, count: 0, cycle: d.cycle || TariffCycle.CHEIAS };
      }
      profile[hour].sum += d.activeAvg;
      profile[hour].count++;
    });

    return Object.entries(profile).map(([hour, val]) => ({
      hour: parseInt(hour),
      avgPower: val.sum / val.count,
      cycle: val.cycle
    })).sort((a, b) => a.hour - b.hour);
  }, [data]);

  const cycleStats = useMemo(() => {
    if (data.length === 0) return null;
    
    const stats: Record<string, { sum: number, count: number, cost: number, unitCost: number }> = {
      [TariffCycle.PONTA]: { sum: 0, count: 0, cost: 0, unitCost: 0 },
      [TariffCycle.CHEIAS]: { sum: 0, count: 0, cost: 0, unitCost: 0 },
      [TariffCycle.VAZIO_NORMAL]: { sum: 0, count: 0, cost: 0, unitCost: 0 },
      [TariffCycle.SUPER_VAZIO]: { sum: 0, count: 0, cost: 0, unitCost: 0 },
    };

    data.forEach(d => {
      if (d.cycle && stats[d.cycle]) {
        stats[d.cycle].sum += d.activeAvg;
        stats[d.cycle].count++;
        
        let unitCost = 0;
        if (project.invoice) {
          const inv = project.invoice.costs;
          switch(d.cycle) {
            case TariffCycle.PONTA: unitCost = inv.ponta; break;
            case TariffCycle.CHEIAS: unitCost = inv.cheias; break;
            case TariffCycle.VAZIO_NORMAL: unitCost = inv.vazio; break;
            case TariffCycle.SUPER_VAZIO: unitCost = inv.superVazio || 0; break;
          }
        }
        stats[d.cycle].unitCost = unitCost;
        stats[d.cycle].cost += d.activeAvg * unitCost;
      }
    });

    const totalDays = data.length / 24;
    const totalAnnualEnergy = Object.values(stats).reduce((acc, curr) => acc + curr.sum, 0) * (365 / totalDays);
    const totalAnnualCost = Object.values(stats).reduce((acc, curr) => acc + curr.cost, 0) * (365 / totalDays);
    const avgAnnualPower = Object.values(stats).reduce((acc, curr) => acc + curr.sum, 0) / data.length;

    return {
      cycles: Object.entries(stats).map(([name, val]) => ({
        name,
        avgDailyEnergy: val.sum / totalDays,
        avgDailyCost: val.cost / totalDays,
        annualEnergy: (val.sum / totalDays) * 365,
        annualCost: (val.cost / totalDays) * 365,
        unitCost: val.unitCost
      })),
      totalAnnualEnergy,
      totalAnnualCost,
      avgAnnualPower
    };
  }, [data, project.invoice]);

  const handleAISuggestion = (profile: 'balanced' | 'economic' | 'maximized') => {
    if (!cycleStats) return;
    
    const peakPower = Math.max(...dailyProfile.map(h => h.avgPower));
    
    switch(profile) {
      case 'balanced':
        setBatteryPower(Math.round(peakPower * 0.6));
        setDischargeTime(4);
        break;
      case 'economic':
        setBatteryPower(Math.round(peakPower * 0.3));
        setDischargeTime(2);
        break;
      case 'maximized':
        setBatteryPower(Math.round(peakPower * 1.1));
        setDischargeTime(12);
        break;
    }
  };

  // 2. Full Battery Simulation Logic (Runs on all data for accuracy)
  const fullSimulation = useMemo(() => {
    if (data.length === 0 || !project.invoice) return null;

    const inv = project.invoice.costs;
    const costs = {
      [TariffCycle.PONTA]: inv.ponta,
      [TariffCycle.CHEIAS]: inv.cheias,
      [TariffCycle.VAZIO_NORMAL]: inv.vazio,
      [TariffCycle.SUPER_VAZIO]: inv.superVazio || 0
    };

    let currentSoc = 0; // State of Charge (kWh)
    const maxSoc = batteryCapacity * dod;
    
    const results = data.map(d => {
      let charge = 0;
      let discharge = 0;
      const unitCost = costs[d.cycle || TariffCycle.CHEIAS];

      const isChargeCycle = d.cycle === TariffCycle.VAZIO_NORMAL || d.cycle === TariffCycle.SUPER_VAZIO;
      const isDischargeCycle = d.cycle === TariffCycle.PONTA || d.cycle === TariffCycle.CHEIAS;

      if (batteryPower > 0) {
        if (isChargeCycle && currentSoc < maxSoc) {
          const maxChargePossible = (maxSoc - currentSoc) / efficiency;
          charge = Math.min(batteryPower, maxChargePossible);
          currentSoc += charge * efficiency;
        } else if (isDischargeCycle && currentSoc > 0) {
          discharge = Math.min(batteryPower, currentSoc, d.activeAvg);
          currentSoc -= discharge;
        }
      }

      const newPower = Math.max(0, d.activeAvg + charge - discharge);
      
      return {
        timestamp: d.timestamp,
        hour: d.timestamp.getHours(),
        cycle: d.cycle || TariffCycle.CHEIAS,
        avgPower: d.activeAvg,
        charge,
        discharge,
        soc: currentSoc,
        newPower,
        baseCost: d.activeAvg * unitCost,
        newCost: newPower * unitCost
      };
    });

    const totalBaseCost = results.reduce((acc, curr) => acc + curr.baseCost, 0);
    const totalNewCost = results.reduce((acc, curr) => acc + curr.newCost, 0);
    const totalSavings = totalBaseCost - totalNewCost;
    const totalDays = data.length / 24;

    return {
      results,
      annualSavings: (totalSavings / totalDays) * 365
    };
  }, [data, project.invoice, batteryPower, batteryCapacity, efficiency, dod]);

  // 3. Financial Analysis & Solution Recommendation
  const solutionKey = useMemo(() => {
    if (batteryCapacity <= 30) return "Huawei LUNA2000";
    if (batteryCapacity <= 500) return "Huawei Smart String ESS";
    return "Tesla Megapack";
  }, [batteryCapacity]);

  const selectedSolution = BATTERY_SOLUTIONS[solutionKey];
  const numUnits = batteryPower > 0 ? Math.max(1, Math.ceil(batteryCapacity / selectedSolution.unitCapacity)) : 0;
  const totalCapex = batteryPower > 0 ? (selectedSolution.baseCost * numUnits) + selectedSolution.installCost : 0;

  const financialAnalysis = useMemo(() => {
    if (!fullSimulation) return null;

    const capex = totalCapex;
    
    const years = [5, 10, 15, 20];
    const timeline = years.map(year => {
      let totalSavings = 0;
      let totalMaintenance = 0;
      for (let i = 1; i <= year; i++) {
        const yearSavings = fullSimulation.annualSavings * Math.pow(1 + energyEscalation, i - 1);
        const yearMaintenance = capex * maintenanceCost * Math.pow(1 + inflation, i - 1);
        totalSavings += yearSavings;
        totalMaintenance += yearMaintenance;
      }
      return {
        year,
        savings: totalSavings,
        maintenance: totalMaintenance,
        net: totalSavings - totalMaintenance - capex
      };
    });

    const pri = capex / (fullSimulation.annualSavings - (capex * maintenanceCost));

    return {
      capex,
      pri,
      timeline
    };
  }, [fullSimulation, totalCapex, energyEscalation, maintenanceCost, inflation]);

  const comparisonStats = useMemo(() => {
    if (!cycleStats || !fullSimulation) return null;

    const newStats: Record<string, { energy: number, cost: number }> = {
      [TariffCycle.PONTA]: { energy: 0, cost: 0 },
      [TariffCycle.CHEIAS]: { energy: 0, cost: 0 },
      [TariffCycle.VAZIO_NORMAL]: { energy: 0, cost: 0 },
      [TariffCycle.SUPER_VAZIO]: { energy: 0, cost: 0 },
    };

    fullSimulation.results.forEach(h => {
      if (newStats[h.cycle]) {
        newStats[h.cycle].energy += h.newPower;
        newStats[h.cycle].cost += h.newCost;
      }
    });

    const totalDays = data.length / 24;

    return cycleStats.cycles.map(base => {
      const sim = newStats[base.name];
      const isNoBattery = batteryPower === 0;
      
      if (isNoBattery) {
        return {
          ...base,
          newAnnualEnergy: base.annualEnergy,
          newAnnualCost: base.annualCost,
          newDailyEnergy: base.avgDailyEnergy,
          newDailyCost: base.avgDailyCost
        };
      }

      return {
        ...base,
        newAnnualEnergy: (sim.energy / totalDays) * 365,
        newAnnualCost: (sim.cost / totalDays) * 365,
        newDailyEnergy: sim.energy / totalDays,
        newDailyCost: sim.cost / totalDays
      };
    });
  }, [cycleStats, fullSimulation, batteryPower, data.length]);

  // 4. Chart Data Preparation
  const chartData = useMemo(() => {
    if (!fullSimulation) return [];

    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    
    let end = new Date(start);
    if (chartViewMode === 'daily') end.setDate(end.getDate() + 1);
    else if (chartViewMode === 'weekly') end.setDate(end.getDate() + 7);
    else if (chartViewMode === 'monthly') end.setMonth(end.getMonth() + 1);

    const filtered = fullSimulation.results.filter(r => {
      const d = new Date(r.timestamp);
      return d >= start && d < end;
    });

    if (chartViewMode === 'daily') {
      return filtered.map(r => ({
        ...r,
        label: `${r.hour}h`
      }));
    }

    // For weekly/monthly, aggregate by day or show all hours? 
    // Showing all hours might be too much. Let's aggregate by day for weekly/monthly.
    const aggregated: Record<string, any> = {};
    filtered.forEach(r => {
      const dayKey = r.timestamp.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
      if (!aggregated[dayKey]) {
        aggregated[dayKey] = { label: dayKey, avgPower: 0, newPower: 0, charge: 0, discharge: 0, count: 0 };
      }
      aggregated[dayKey].avgPower += r.avgPower;
      aggregated[dayKey].newPower += r.newPower;
      aggregated[dayKey].charge += r.charge;
      aggregated[dayKey].discharge += r.discharge;
      aggregated[dayKey].count++;
    });

    return Object.values(aggregated).map(v => ({
      ...v,
      avgPower: v.avgPower / v.count,
      newPower: v.newPower / v.count,
      charge: v.charge / v.count,
      discharge: v.discharge / v.count
    }));
  }, [fullSimulation, selectedDate, chartViewMode]);

  const navigatePeriod = (direction: number) => {
    const next = new Date(selectedDate);
    if (chartViewMode === 'daily') next.setDate(next.getDate() + direction);
    else if (chartViewMode === 'weekly') next.setDate(next.getDate() + direction * 7);
    else if (chartViewMode === 'monthly') next.setMonth(next.getMonth() + direction);
    
    // Boundary check
    if (data.length > 0) {
      const first = new Date(data[0].timestamp);
      const last = new Date(data[data.length - 1].timestamp);
      if (next >= first && next <= last) {
        setSelectedDate(next);
      }
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Battery className="w-6 h-6 text-emerald-600" />
            Acumulação de Energia Elétrica
          </h2>
          <p className="text-sm text-slate-500 mt-1">Simulação de baterias para arbitragem tarifária e otimização de custos.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate(ViewMode.DASHBOARD)}
            className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            <LayoutDashboard className="w-4 h-4" />
            Voltar ao Dashboard
          </button>
          <button 
            onClick={() => onNavigate(ViewMode.ANALYTICAL_ANALYSIS)}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            Voltar à Análise
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Configuração do Sistema
            </h3>
            
            <div className="space-y-8">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Potência da Bateria (kW)</label>
                  <span className="text-sm font-bold text-indigo-600">{batteryPower} kW</span>
                </div>
                <input 
                  type="range" min="0" max="10000" step="1"
                  value={batteryPower} onChange={(e) => setBatteryPower(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Tempo de Descarga (Horas)</label>
                  <span className="text-sm font-bold text-indigo-600">{dischargeTime} h</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 4, 8, 12].map(h => (
                    <button
                      key={h}
                      onClick={() => setDischargeTime(h)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${dischargeTime === h ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 italic">A capacidade ({batteryCapacity} kWh) é calculada com base na potência e tempo de descarga.</p>
              </div>

              <div className="pt-4 border-t border-slate-50">
                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Battery className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold">Solução Recomendada</div>
                    <div className="text-sm font-bold text-emerald-900">{selectedSolution.name}</div>
                    <div className="text-[10px] text-emerald-700 font-medium">Necessário: {numUnits} Unidade(s)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Ajuda IA - Sugestão de Perfil
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => handleAISuggestion('economic')}
                className="flex flex-col items-start p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl transition-all group"
              >
                <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">Perfil Económico</span>
                <span className="text-[10px] text-slate-500">Foco no retorno rápido (Payback).</span>
              </button>
              <button 
                onClick={() => handleAISuggestion('balanced')}
                className="flex flex-col items-start p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl transition-all group"
              >
                <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">Perfil Equilibrado</span>
                <span className="text-[10px] text-slate-500">Equilíbrio entre investimento e poupança.</span>
              </button>
              <button 
                onClick={() => handleAISuggestion('maximized')}
                className="flex flex-col items-start p-3 bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-200 rounded-xl transition-all group"
              >
                <span className="text-xs font-bold text-slate-700 group-hover:text-purple-700">Perfil Maximizado</span>
                <span className="text-[10px] text-slate-500">Máxima poupança e autonomia.</span>
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-indigo-500" />
              Ficha Técnica da Solução
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-xs border-b border-slate-50 pb-2">
                <span className="text-slate-500">Capacidade Total:</span>
                <span className="font-bold text-slate-900">{(selectedSolution.unitCapacity * numUnits).toLocaleString()} kWh</span>
              </div>
              <div className="flex justify-between text-xs border-b border-slate-50 pb-2">
                <span className="text-slate-500">Potência Nominal:</span>
                <span className="font-bold text-slate-900">{(selectedSolution.unitPower * numUnits).toLocaleString()} kW</span>
              </div>
              <div className="flex justify-between text-xs border-b border-slate-50 pb-2">
                <span className="text-slate-500">Tensão Nominal:</span>
                <span className="font-bold text-slate-900">{selectedSolution.voltage}</span>
              </div>
              <div className="flex justify-between text-xs border-b border-slate-50 pb-2">
                <span className="text-slate-500">Eficiência (AC-AC):</span>
                <span className="font-bold text-slate-900">{(selectedSolution.efficiency * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-xs border-b border-slate-50 pb-2">
                <span className="text-slate-500">N.º Ciclos Estimado:</span>
                <span className="font-bold text-slate-900">{selectedSolution.cycles.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs border-b border-slate-50 pb-2">
                <span className="text-slate-500">Peso Total:</span>
                <span className="font-bold text-slate-900">{(selectedSolution.weight * numUnits).toLocaleString()} kg</span>
              </div>
              <div className="flex justify-between text-xs border-b border-slate-50 pb-2">
                <span className="text-slate-500">Dimensões (Un.):</span>
                <span className="font-bold text-slate-900">{selectedSolution.dimensions}</span>
              </div>
              <div className="flex justify-between text-xs border-b border-slate-50 pb-2">
                <span className="text-slate-500">Custo Base Unidade:</span>
                <span className="font-bold text-slate-900">{selectedSolution.baseCost.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
              </div>
              <div className="flex justify-between text-xs pt-1">
                <span className="text-slate-500 font-bold">Infraestrutura Total:</span>
                <span className="font-bold text-indigo-600">{totalCapex.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              Resumo Anual de Consumo
            </h3>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Potência Média</div>
                  <div className="text-sm font-bold text-slate-900">{cycleStats?.avgAnnualPower.toFixed(2)} kW</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Custo Total Atual</div>
                  <div className="text-sm font-bold text-slate-900">{cycleStats?.totalAnnualCost.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</div>
                </div>
              </div>
              
              {/* Comparison Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-2 font-bold text-slate-400 uppercase">Ciclo</th>
                      <th className="py-2 font-bold text-slate-400 uppercase text-right">Base (€)</th>
                      <th className="py-2 font-bold text-slate-400 uppercase text-right">Novo (€)</th>
                      <th className="py-2 font-bold text-slate-400 uppercase text-right">Var.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonStats?.map(stat => {
                      const savings = stat.annualCost - stat.newAnnualCost;
                      return (
                        <tr key={stat.name} className="border-b border-slate-50 last:border-0">
                          <td className="py-2 font-bold text-slate-600">{stat.name}</td>
                          <td className="py-2 text-right text-slate-500">{stat.annualCost.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}€</td>
                          <td className="py-2 text-right font-bold text-slate-900">{stat.newAnnualCost.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}€</td>
                          <td className={`py-2 text-right font-bold ${savings >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {savings >= 0 ? '-' : '+'}{Math.abs(savings).toLocaleString('pt-PT', { maximumFractionDigits: 0 })}€
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-50 font-bold border-t border-slate-200">
                      <td className="py-2 px-1 font-bold text-slate-800">TOTAL</td>
                      <td className="py-2 text-right px-1 text-slate-900">
                        {cycleStats?.totalAnnualCost.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}€
                      </td>
                      <td className="py-2 text-right px-1 text-slate-900">
                        {comparisonStats?.reduce((acc, curr) => acc + curr.newAnnualCost, 0).toLocaleString('pt-PT', { maximumFractionDigits: 0 })}€
                      </td>
                      <td className={`py-2 text-right px-1 ${fullSimulation?.annualSavings && fullSimulation.annualSavings >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {fullSimulation?.annualSavings && fullSimulation.annualSavings >= 0 ? '-' : '+'}{Math.abs(fullSimulation?.annualSavings || 0).toLocaleString('pt-PT', { maximumFractionDigits: 0 })}€
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Daily Summary Table */}
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider">Resumo Dia de Consumo</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] text-left">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-2 font-bold text-slate-400 uppercase">Ciclo</th>
                        <th className="py-2 font-bold text-slate-400 uppercase text-right">Energia Base (kWh)</th>
                        <th className="py-2 font-bold text-slate-400 uppercase text-right">Energia Novo (kWh)</th>
                        <th className="py-2 font-bold text-slate-400 uppercase text-right">Custo Base (€)</th>
                        <th className="py-2 font-bold text-slate-400 uppercase text-right">Custo Novo (€)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonStats?.map(stat => (
                        <tr key={stat.name} className="border-b border-slate-50 last:border-0">
                          <td className="py-2 font-bold text-slate-600">{stat.name}</td>
                          <td className="py-2 text-right text-slate-500">{stat.avgDailyEnergy.toFixed(1)}</td>
                          <td className="py-2 text-right text-slate-900 font-medium">{stat.newDailyEnergy.toFixed(1)}</td>
                          <td className="py-2 text-right text-slate-500">{stat.avgDailyCost.toFixed(2)}€</td>
                          <td className="py-2 text-right text-slate-900 font-bold">{stat.newDailyCost.toFixed(2)}€</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-bold">
                        <td className="py-2 px-1">TOTAL DIA</td>
                        <td className="py-2 text-right px-1">
                          {comparisonStats?.reduce((acc, curr) => acc + curr.avgDailyEnergy, 0).toFixed(1)}
                        </td>
                        <td className="py-2 text-right px-1">
                          {comparisonStats?.reduce((acc, curr) => acc + curr.newDailyEnergy, 0).toFixed(1)}
                        </td>
                        <td className="py-2 text-right px-1">
                          {comparisonStats?.reduce((acc, curr) => acc + curr.avgDailyCost, 0).toFixed(2)}€
                        </td>
                        <td className="py-2 text-right px-1">
                          {comparisonStats?.reduce((acc, curr) => acc + curr.newDailyCost, 0).toFixed(2)}€
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-8">
          {/* Main Simulation Chart */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                Simulação de Ciclo (Carga/Descarga)
              </h3>
              
              <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                {(['daily', 'weekly', 'monthly'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setChartViewMode(mode)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${chartViewMode === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {mode === 'daily' ? 'Dia' : mode === 'weekly' ? 'Semana' : 'Mês'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mb-6 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
              <button 
                onClick={() => navigatePeriod(-1)}
                className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-indigo-600"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <div className="text-sm font-bold text-slate-700">
                {chartViewMode === 'daily' && selectedDate.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}
                {chartViewMode === 'weekly' && `Semana de ${selectedDate.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}`}
                {chartViewMode === 'monthly' && selectedDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
              </div>
              <button 
                onClick={() => navigatePeriod(1)}
                className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-indigo-600"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" fontSize={10} stroke="#94a3b8" />
                  <YAxis fontSize={10} stroke="#94a3b8" label={{ value: 'kW', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                  <Area type="monotone" dataKey="avgPower" name="Consumo Base" fill="#e2e8f0" stroke="#94a3b8" />
                  <Line type="monotone" dataKey="newPower" name="Novo Perfil" stroke="#4f46e5" strokeWidth={3} dot={chartViewMode === 'daily'} />
                  <Bar dataKey="charge" name="Carga (+)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="discharge" name="Descarga (-)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Investimento Estimado</h4>
              <div className="text-2xl font-bold text-slate-900">
                {financialAnalysis?.capex.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">CAPEX baseado em {numUnits} Unidades</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Poupança Anual</h4>
              <div className="text-2xl font-bold text-emerald-600">
                {fullSimulation?.annualSavings.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Redução de custo por arbitragem</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Payback (PRI)</h4>
              <div className="text-2xl font-bold text-indigo-600">
                {financialAnalysis?.pri.toFixed(1)} <span className="text-sm font-normal text-slate-400">Anos</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Tempo de retorno do investimento</p>
            </div>
          </div>

          {/* Financial Timeline */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              Cronograma Financeiro (Projeção 20 Anos)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {financialAnalysis?.timeline.map(item => (
                <div key={item.year} className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                  <div className="text-xs font-bold text-slate-400 mb-3">{item.year} Anos</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Poupança:</span>
                      <span className="font-bold text-emerald-600">+{item.savings.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}€</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Manut.:</span>
                      <span className="font-bold text-red-500">-{item.maintenance.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}€</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between text-sm">
                      <span className="font-bold text-slate-700">Net:</span>
                      <span className={`font-black ${item.net > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {item.net.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}€
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
              <Info className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-[10px] text-amber-800 leading-relaxed">
                A projeção considera uma inflação anual de {(inflation * 100).toFixed(0)}% e uma flutuação do custo de energia de {(energyEscalation * 100).toFixed(0)}%. 
                Os valores são estimativos e dependem da manutenção do perfil de consumo e das condições de mercado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatteryAnalysis;
