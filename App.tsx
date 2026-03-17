

import React, { useState, useRef } from 'react';
import { InstallationMetadata, ProjectState, ViewMode, ColumnMapping, TariffOption } from './types';
import Dashboard from './components/Dashboard';
import ReportView from './components/ReportView';
import Home from './components/Home';
import CostAnalysis from './components/CostAnalysis';
import AnalyticalAnalysis from './components/AnalyticalAnalysis';
import BatteryAnalysis from './components/BatteryAnalysis';
import ComparisonView from './components/ComparisonView';
import { aggregateToHourly, parseExcelFiles, getExcelPreview } from './services/dataService';
import { fetchOmiePrices, applyOmiePrices } from './services/omieService';
import { analyzeExcelMapping } from './services/geminiService';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.HOME);
  const [isComparisonOnly, setIsComparisonOnly] = useState(false);
  const [project, setProject] = useState<ProjectState>({
    metadata: {
        name: '',
        location: '',
        technician: '',
        reportDate: new Date().toISOString().split('T')[0],
        cpe: '',
        sourceInterval: '15m',
        filesCount: 0,
        totalRecords: 0
    },
    rawData: [],
    hourlyData: [],
    aiAnalysis: null,
    tariffOption: TariffOption.STANDARD,
    retailers: [
      {
        name: 'EDP Comercial',
        costs: { ponta: 0.22, cheias: 0.18, vazio: 0.12, superVazio: 0.09, fixed: 12.5 },
        isIndexado: false,
        source: 'Predefinição',
        url: 'https://www.edp.pt/particulares/energia/tarifarios/',
        updatedAt: '2026-03-04'
      },
      {
        name: 'Endesa',
        costs: { ponta: 0.21, cheias: 0.17, vazio: 0.11, superVazio: 0.08, fixed: 11.0 },
        isIndexado: false,
        source: 'Predefinição',
        url: 'https://www.endesa.pt/particulares/luz-gas/tarifas',
        updatedAt: '2026-03-04'
      },
      {
        name: 'Iberdrola',
        costs: { ponta: 0.23, cheias: 0.19, vazio: 0.13, superVazio: 0.10, fixed: 13.0 },
        isIndexado: false,
        source: 'Predefinição',
        url: 'https://www.iberdrola.pt/eletricidade/tarifas-eletricidade',
        updatedAt: '2026-03-04'
      },
      {
        name: 'Repsol',
        costs: { ponta: 0.215, cheias: 0.175, vazio: 0.115, superVazio: 0.085, fixed: 11.5 },
        isIndexado: false,
        source: 'Predefinição',
        url: 'https://www.repsol.pt/particulares/eletricidade-e-gas/tarifas/',
        updatedAt: '2026-03-04'
      },
      {
        name: 'Plenitude',
        costs: { ponta: 0.205, cheias: 0.165, vazio: 0.105, superVazio: 0.075, fixed: 10.5 },
        isIndexado: false,
        source: 'Predefinição',
        url: 'https://www.eniplenitude.pt/tarifas-luz-gas/',
        updatedAt: '2026-03-04'
      },
      {
        name: 'Cepsa',
        costs: { ponta: 0.225, cheias: 0.185, vazio: 0.125, superVazio: 0.095, fixed: 12.0 },
        isIndexado: false,
        source: 'Predefinição',
        url: 'https://www.cepsa.pt/pt/particulares/eletricidade-e-gas',
        updatedAt: '2026-03-04'
      },
      {
        name: 'Luzboa (Indexado)',
        costs: { ponta: 0, cheias: 0, vazio: 0, superVazio: 0, fixed: 5.0, margin: 0.005 },
        isIndexado: true,
        source: 'Predefinição',
        url: 'https://luzboa.pt/tarifarios-luz/',
        updatedAt: '2026-03-04'
      }
    ],
    costConfig: {
        margin: 0.01, // 0.01 EUR/kWh
        fixedCost: 15.0, // 15 EUR/month
        tax: 0.23 // 23% VAT
    }
  });

  // Import Wizard State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewData, setPreviewData] = useState<any[][]>([]);
  const [loading, setLoading] = useState(false);
  const [isAISmartLoading, setIsAISmartLoading] = useState(false);
  
  // Mapping now includes Rows
  const [mapping, setMapping] = useState<ColumnMapping>({
      dateCol: 0, dateRow: 1,
      timeCol: undefined, timeRow: undefined,
      activeCol: 1, activeRow: 1,
      inductiveCol: 2, inductiveRow: 1,
      capacitiveCol: 3, capacitiveRow: 1,
      cpeRow: undefined, cpeCol: undefined
  });

  // Variable selection checkboxes
  const [enabledVars, setEnabledVars] = useState({
      active: true,
      inductive: true,
      capacitive: true
  });

  type SelectionType = 'date' | 'time' | 'active' | 'inductive' | 'capacitive' | 'cpe' | 'none';
  const [selectionMode, setSelectionMode] = useState<SelectionType>('none');
  const [isTariffHelpOpen, setIsTariffHelpOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const resetProject = () => {
      if(window.confirm("Tem a certeza que deseja limpar todos os dados e começar um novo projeto?")) {
          setProject({
              metadata: { name: '', location: '', technician: '', reportDate: new Date().toISOString().split('T')[0], cpe: '', sourceInterval: '15m', filesCount: 0, totalRecords: 0 },
              rawData: [], hourlyData: [], aiAnalysis: null,
              tariffOption: TariffOption.STANDARD,
              retailers: []
          });
          setSelectedFiles([]);
          setPreviewData([]);
          setIsComparisonOnly(false);
          setViewMode(ViewMode.UPLOAD);
      }
  };

  const handleMetadataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setProject(prev => ({
          ...prev,
          metadata: { ...prev.metadata, [e.target.name]: e.target.value }
      }));
  };

  const handleInitialFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const files = Array.from(e.target.files) as File[];
          setSelectedFiles(files);
          setLoading(true);
          try {
              // Read first file for preview
              const preview = await getExcelPreview(files[0]);
              setPreviewData(preview.slice(0, 30)); // Take first 30 rows
              
              // Reset mapping to reasonable defaults or empty
              setMapping({
                  dateCol: 0, dateRow: 0,
                  timeCol: undefined, timeRow: undefined,
                  activeCol: 1, activeRow: 0,
                  inductiveCol: 2, inductiveRow: 0,
                  capacitiveCol: 3, capacitiveRow: 0,
              });
              
              setViewMode(ViewMode.CONFIG_IMPORT);
          } catch (err) {
              alert("Erro ao ler ficheiro de pré-visualização.");
              console.error(err);
          } finally {
              setLoading(false);
          }
      }
  };

  const handleProcessFiles = async () => {
      setLoading(true);
      try {
          const { data: rawData, cpe } = await parseExcelFiles(selectedFiles, mapping, project.tariffOption);
          
          if (rawData.length === 0) {
            alert("Não foram encontrados dados válidos. Verifique as colunas selecionadas.");
            setLoading(false);
            return;
          }

          let hourlyData = aggregateToHourly(rawData, project.tariffOption);
          
          // Apply OMIE prices and calculate costs
          const start = hourlyData[0].timestamp;
          const end = hourlyData[hourlyData.length - 1].timestamp;
          const omiePrices = await fetchOmiePrices(start, end);
          hourlyData = applyOmiePrices(hourlyData, omiePrices, project.costConfig!);
          
          setProject(prev => ({
              ...prev,
              metadata: {
                ...prev.metadata,
                cpe: cpe || prev.metadata.cpe,
                filesCount: selectedFiles.length,
                totalRecords: rawData.length
              },
              rawData,
              hourlyData
          }));
          setViewMode(ViewMode.DASHBOARD);
      } catch (err) {
          alert("Erro ao processar ficheiros. Verifique se as colunas de Data e Hora estão corretas.");
          console.error(err);
      } finally {
          setLoading(false);
      }
  };

  const handleRefreshOmie = async () => {
    if (project.hourlyData.length === 0) return;
    
    try {
        const start = project.hourlyData[0].timestamp;
        const end = project.hourlyData[project.hourlyData.length - 1].timestamp;
        const omiePrices = await fetchOmiePrices(start, end);
        const updatedHourly = applyOmiePrices(project.hourlyData, omiePrices, project.costConfig!);
        
        setProject(prev => ({
            ...prev,
            hourlyData: updatedHourly,
            lastMarketUpdate: new Date().toLocaleString('pt-PT')
        }));
    } catch (err) {
        console.error("Erro ao atualizar mercado:", err);
        alert("Erro ao atualizar dados do mercado.");
    }
  };

  // Main interaction handler for the grid
  const handleCellClick = (rowIndex: number, colIndex: number, val: any) => {
      if (selectionMode === 'none') return;

      if (selectionMode === 'cpe') {
          setMapping(prev => ({ ...prev, cpeRow: rowIndex, cpeCol: colIndex }));
          setProject(prev => ({ ...prev, metadata: { ...prev.metadata, cpe: String(val) }}));
      }
      else if (selectionMode === 'date') {
          setMapping(prev => ({ ...prev, dateRow: rowIndex, dateCol: colIndex }));
      }
      else if (selectionMode === 'time') {
          setMapping(prev => ({ ...prev, timeRow: rowIndex, timeCol: colIndex }));
      }
      else if (selectionMode === 'active' && enabledVars.active) {
          setMapping(prev => ({ ...prev, activeRow: rowIndex, activeCol: colIndex }));
      }
      else if (selectionMode === 'inductive' && enabledVars.inductive) {
          setMapping(prev => ({ ...prev, inductiveRow: rowIndex, inductiveCol: colIndex }));
      }
      else if (selectionMode === 'capacitive' && enabledVars.capacitive) {
          setMapping(prev => ({ ...prev, capacitiveRow: rowIndex, capacitiveCol: colIndex }));
      }
  };

  const handleSmartSelection = () => {
      if (previewData.length === 0) return;

      let bestHeaderRow = -1;
      let maxMatches = 0;
      let foundMapping: Partial<ColumnMapping> = {};

      const keywords = {
          date: ['data', 'date', 'dia'],
          time: ['hora', 'time', ' h '],
          active: ['ativa', 'active', 'kw', 'kwh'],
          inductive: ['indutiva', 'inductive', 'kvar', 'kvarh'],
          capacitive: ['capacitiva', 'capacitive', 'cap'],
          cpe: ['cpe', 'ponto de entrega']
      };

      // 1. Find Header Row
      for (let r = 0; r < Math.min(previewData.length, 15); r++) {
          let matches = 0;
          const row = previewData[r];
          if (!row) continue;

          row.forEach((cell: any) => {
              const str = String(cell).toLowerCase();
              if (keywords.date.some(k => str.includes(k))) matches++;
              if (keywords.time.some(k => str.includes(k))) matches++;
              if (keywords.active.some(k => str.includes(k))) matches++;
          });

          if (matches > maxMatches) {
              maxMatches = matches;
              bestHeaderRow = r;
          }
      }

      if (bestHeaderRow !== -1) {
          const header = previewData[bestHeaderRow];
          const dataRow = bestHeaderRow + 1;
          
          header.forEach((cell: any, c: number) => {
              const str = String(cell).toLowerCase();
              if (keywords.date.some(k => str.includes(k)) && foundMapping.dateCol === undefined) foundMapping.dateCol = c;
              if (keywords.time.some(k => str.includes(k)) && foundMapping.timeCol === undefined) foundMapping.timeCol = c;
              if (keywords.active.some(k => str.includes(k)) && foundMapping.activeCol === undefined) foundMapping.activeCol = c;
              if (keywords.inductive.some(k => str.includes(k)) && foundMapping.inductiveCol === undefined) foundMapping.inductiveCol = c;
              if (keywords.capacitive.some(k => str.includes(k)) && foundMapping.capacitiveCol === undefined) foundMapping.capacitiveCol = c;
              if (keywords.cpe.some(k => str.includes(k)) && foundMapping.cpeCol === undefined) {
                  // If "CPE" is in header, the value is likely to the right or below
                  // But often CPE is in a fixed cell like L1:C1
                  foundMapping.cpeCol = c;
                  foundMapping.cpeRow = bestHeaderRow;
              }
          });

          // Look for CPE value (PT...) in the whole preview if not found by keyword
          if (!foundMapping.cpeCol) {
              for (let r = 0; r < previewData.length; r++) {
                  for (let c = 0; c < previewData[r].length; c++) {
                      const val = String(previewData[r][c]);
                      if (val.startsWith('PT')) {
                          foundMapping.cpeRow = r;
                          foundMapping.cpeCol = c;
                          break;
                      }
                  }
                  if (foundMapping.cpeCol !== undefined) break;
              }
          }

          setMapping(prev => ({
              ...prev,
              dateRow: dataRow,
              dateCol: foundMapping.dateCol ?? prev.dateCol,
              timeRow: foundMapping.timeCol !== undefined ? dataRow : prev.timeRow,
              timeCol: foundMapping.timeCol ?? prev.timeCol,
              activeRow: dataRow,
              activeCol: foundMapping.activeCol ?? prev.activeCol,
              inductiveRow: dataRow,
              inductiveCol: foundMapping.inductiveCol ?? prev.inductiveCol,
              capacitiveRow: dataRow,
              capacitiveCol: foundMapping.capacitiveCol ?? prev.capacitiveCol,
              cpeRow: foundMapping.cpeRow ?? prev.cpeRow,
              cpeCol: foundMapping.cpeCol ?? prev.cpeCol
          }));

          // Update CPE in metadata if found
          if (foundMapping.cpeRow !== undefined && foundMapping.cpeCol !== undefined) {
              const cpeVal = previewData[foundMapping.cpeRow][foundMapping.cpeCol];
              setProject(prev => ({ ...prev, metadata: { ...prev.metadata, cpe: String(cpeVal) }}));
          }

          alert("Seleção inteligente concluída! Verifique se as colunas estão corretas.");
      } else {
          alert("Não foi possível identificar o cabeçalho automaticamente.");
      }
  };

  const handleAISmartSelection = async () => {
      if (previewData.length === 0) return;
      
      setIsAISmartLoading(true);
      try {
          const result = await analyzeExcelMapping(previewData);
          
          if (result) {
              setMapping(prev => ({
                  ...prev,
                  dateRow: result.dataRow,
                  dateCol: result.dateCol,
                  timeRow: result.timeCol !== null ? result.dataRow : prev.timeRow,
                  timeCol: result.timeCol ?? prev.timeCol,
                  activeRow: result.dataRow,
                  activeCol: result.activeCol,
                  inductiveRow: result.dataRow,
                  inductiveCol: result.inductiveCol,
                  capacitiveRow: result.dataRow,
                  capacitiveCol: result.capacitiveCol,
                  cpeRow: result.cpeRow ?? prev.cpeRow,
                  cpeCol: result.cpeCol ?? prev.cpeCol
              }));

              if (result.cpe) {
                  setProject(prev => ({ ...prev, metadata: { ...prev.metadata, cpe: result.cpe!, name: result.name || prev.metadata.name, location: result.location || prev.metadata.location }}));
              } else if (result.name || result.location) {
                  setProject(prev => ({ ...prev, metadata: { ...prev.metadata, name: result.name || prev.metadata.name, location: result.location || prev.metadata.location }}));
              }

              alert("Preenchimento Inteligente (IA) concluído com sucesso!");
          } else {
              alert("A IA não conseguiu identificar os campos. Tente a seleção manual ou a seleção por palavras-chave.");
          }
      } catch (err) {
          console.error("Erro na seleção IA:", err);
          alert("Erro ao contactar a IA. Verifique se a chave de API está configurada.");
      } finally {
          setIsAISmartLoading(false);
      }
  };

  const saveProject = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `k-dataelect_${project.metadata.name || 'projeto'}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const loadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const obj = JSON.parse(event.target?.result as string);
              obj.rawData.forEach((r: any) => r.timestamp = new Date(r.timestamp));
              obj.hourlyData.forEach((r: any) => r.timestamp = new Date(r.timestamp));
              setProject(obj);
              setViewMode(ViewMode.DASHBOARD);
          } catch (err) {
              alert("Ficheiro de projeto inválido");
          }
      };
      reader.readAsText(file);
  };

  // Helper to get cell background based on mapping
  const getCellClass = (r: number, c: number) => {
      if (mapping.dateRow === r && mapping.dateCol === c) return "bg-gray-500 text-white ring-2 ring-gray-700";
      if (mapping.timeRow === r && mapping.timeCol === c) return "bg-orange-500 text-white ring-2 ring-orange-700";
      if (mapping.activeRow === r && mapping.activeCol === c) return "bg-blue-600 text-white ring-2 ring-blue-800";
      if (mapping.inductiveRow === r && mapping.inductiveCol === c) return "bg-red-600 text-white ring-2 ring-red-800";
      if (mapping.capacitiveRow === r && mapping.capacitiveCol === c) return "bg-green-600 text-white ring-2 ring-green-800";
      if (mapping.cpeRow === r && mapping.cpeCol === c) return "bg-purple-600 text-white ring-2 ring-purple-800";
      return "hover:bg-blue-50 cursor-pointer";
  };

  // Render Report View
  if (viewMode === ViewMode.REPORT) {
      return (
          <div className="bg-gray-500 min-h-screen p-8 print:p-0 print:bg-white">
               <div className="max-w-4xl mx-auto mb-4 no-print">
                   <button onClick={() => setViewMode(ViewMode.DASHBOARD)} className="text-white hover:text-gray-200 flex items-center">
                       &larr; Voltar ao Dashboard
                   </button>
               </div>
               <ReportView 
                  project={project} 
                  updateAnalysis={(text) => setProject(prev => ({ ...prev, aiAnalysis: text }))}
               />
          </div>
      );
  }

  if (viewMode === ViewMode.HOME) {
      return <Home onStart={() => setViewMode(ViewMode.UPLOAD)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-slate-800 font-sans">
      
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-40 no-print">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <div>
                <h1 className="text-xl font-bold tracking-wider">K-DATAELECT</h1>
                <p className="text-[10px] text-gray-400">By Koelho2000 | v1.3</p>
            </div>
            <div className="flex gap-4 text-sm items-center">
                <button 
                    onClick={resetProject} 
                    disabled={isComparisonOnly}
                    className={`${isComparisonOnly ? 'bg-gray-600 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} px-3 py-1 rounded transition text-xs font-bold uppercase tracking-wide`}
                >
                    Novo Projeto
                </button>
                <div className="h-6 w-px bg-slate-700 mx-2"></div>
                <button 
                    onClick={saveProject} 
                    disabled={isComparisonOnly}
                    className={`${isComparisonOnly ? 'text-gray-600 cursor-not-allowed' : 'hover:text-blue-300'} transition`}
                >
                    Gravar
                </button>
                <button 
                    onClick={() => jsonInputRef.current?.click()} 
                    disabled={isComparisonOnly}
                    className={`${isComparisonOnly ? 'text-gray-600 cursor-not-allowed' : 'hover:text-blue-300'} transition`}
                >
                    Abrir
                </button>
                <input type="file" ref={jsonInputRef} onChange={loadProject} accept=".json" className="hidden" />
                <a href="https://www.koelho2000.com" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white">www.koelho2000.com</a>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-8">
        
        {/* Metadata Inputs */}
        {!isComparisonOnly && (
            <div className="bg-slate-900 rounded-lg shadow-lg p-6 mb-8 border border-slate-700 no-print">
                <h2 className="text-lg font-semibold mb-4 text-white flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    Dados da Instalação
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div className="md:col-span-1">
                        <label className="block text-xs text-gray-400 mb-1">CPE</label>
                        <input name="cpe" placeholder="PT000..." value={project.metadata.cpe} onChange={handleMetadataChange} className="w-full bg-slate-800 border border-slate-600 text-white p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500" />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs text-gray-400 mb-1">Nome</label>
                        <input name="name" placeholder="Nome da Instalação" value={project.metadata.name} onChange={handleMetadataChange} className="w-full bg-slate-800 border border-slate-600 text-white p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500" />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs text-gray-400 mb-1">Potência Contratada (kW)</label>
                        <input name="contractedPower" type="number" placeholder="kW" value={project.metadata.contractedPower || ''} onChange={handleMetadataChange} className="w-full bg-slate-800 border border-slate-600 text-white p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500" />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs text-gray-400 mb-1">Localização</label>
                        <input name="location" placeholder="Localização" value={project.metadata.location} onChange={handleMetadataChange} className="w-full bg-slate-800 border border-slate-600 text-white p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500" />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs text-gray-400 mb-1">Técnico</label>
                        <input name="technician" placeholder="Técnico Responsável" value={project.metadata.technician} onChange={handleMetadataChange} className="w-full bg-slate-800 border border-slate-600 text-white p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500" />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs text-gray-400 mb-1">Data Relatório</label>
                        <input name="reportDate" type="date" value={project.metadata.reportDate} onChange={handleMetadataChange} className="w-full bg-slate-800 border border-slate-600 text-white p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500" style={{colorScheme: 'dark'}} />
                    </div>
                </div>
            </div>
        )}

        {/* View: Upload */}
        {viewMode === ViewMode.UPLOAD && (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition duration-300">
                <div className="text-center">
                    <svg className="w-16 h-16 text-blue-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    <h3 className="text-xl font-medium text-gray-700 mb-2">Importar Dados de Telecontagem</h3>
                    <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                        Selecione os 12 ficheiros Excel. <br/>
                        Será solicitado para configurar as colunas no passo seguinte.
                    </p>
                    <input type="file" multiple accept=".xlsx, .xls" onChange={handleInitialFileSelect} ref={fileInputRef} className="hidden" />
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded shadow transition transform hover:-translate-y-1">
                            Selecionar Ficheiros
                        </button>
                        <button 
                            onClick={() => {
                                setIsComparisonOnly(true);
                                setViewMode(ViewMode.COMPARISON);
                            }} 
                            className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded shadow transition transform hover:-translate-y-1 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                            Comparar Projetos
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* View: Configuration / Preview */}
        {viewMode === ViewMode.CONFIG_IMPORT && (
            <div className="bg-white rounded-lg shadow p-6 text-gray-900">
                <h2 className="text-xl font-bold mb-4 text-slate-900">Configuração da Importação</h2>
                
                {/* Interval and Variables Config */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 bg-slate-50 p-4 rounded border border-gray-200">
                    <div>
                         <label className="block text-sm font-bold text-gray-700 mb-2">Intervalo de Leitura (Origem)</label>
                         <select 
                            name="sourceInterval" 
                            value={project.metadata.sourceInterval || '15m'} 
                            onChange={handleMetadataChange} 
                            className="w-full bg-white border border-gray-300 rounded p-2 text-sm"
                         >
                             <option value="15m">15 minutos (Padrão)</option>
                             <option value="30m">30 minutos</option>
                             <option value="1h">1 hora</option>
                             <option value="1min">1 minuto</option>
                             <option value="other">Outro / Específico</option>
                         </select>
                         <p className="text-xs text-gray-500 mt-1">Este intervalo será utilizado para normalizar os dados para hora.</p>
                    </div>
                    <div>
                         <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center justify-between">
                            Ciclo Tarifário
                            <button 
                                onClick={() => setIsTariffHelpOpen(true)}
                                className="text-blue-600 hover:text-blue-800 text-[10px] uppercase font-bold flex items-center gap-1"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Diferenças
                            </button>
                         </label>
                         <select 
                            value={project.tariffOption} 
                            onChange={(e) => setProject(prev => ({ ...prev, tariffOption: e.target.value as TariffOption }))} 
                            className="w-full bg-white border border-gray-300 rounded p-2 text-sm"
                         >
                             <option value={TariffOption.STANDARD}>Standard (Todos os fornecimentos)</option>
                             <option value={TariffOption.OPTIONAL}>Opcional (MAT, AT e MT)</option>
                         </select>
                         <p className="text-xs text-gray-500 mt-1">Selecione o tipo de ciclo semanal a aplicar.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Variáveis a Importar</label>
                        <div className="flex gap-4">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={enabledVars.active} onChange={e => setEnabledVars(p => ({...p, active: e.target.checked}))} className="rounded" />
                                <span>Ativa</span>
                            </label>
                             <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={enabledVars.inductive} onChange={e => setEnabledVars(p => ({...p, inductive: e.target.checked}))} className="rounded" />
                                <span>Indutiva</span>
                            </label>
                             <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={enabledVars.capacitive} onChange={e => setEnabledVars(p => ({...p, capacitive: e.target.checked}))} className="rounded" />
                                <span>Capacitiva</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Cost Simulation Config */}
                <div className="mb-6 bg-blue-50 p-4 rounded border border-blue-200">
                    <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Parâmetros para Simulação de Custos (OMIE)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-blue-700 mb-1">Margem Comercial (EUR/kWh)</label>
                            <input 
                                type="number" 
                                step="0.001"
                                value={project.costConfig?.margin} 
                                onChange={e => setProject(p => ({...p, costConfig: {...p.costConfig!, margin: parseFloat(e.target.value)}}))}
                                className="w-full bg-white border border-blue-300 rounded p-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-blue-700 mb-1">Custos Fixos Mensais (EUR)</label>
                            <input 
                                type="number" 
                                step="0.1"
                                value={project.costConfig?.fixedCost} 
                                onChange={e => setProject(p => ({...p, costConfig: {...p.costConfig!, fixedCost: parseFloat(e.target.value)}}))}
                                className="w-full bg-white border border-blue-300 rounded p-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-blue-700 mb-1">IVA (%)</label>
                            <input 
                                type="number" 
                                step="1"
                                value={(project.costConfig?.tax || 0) * 100} 
                                onChange={e => setProject(p => ({...p, costConfig: {...p.costConfig!, tax: parseFloat(e.target.value) / 100}}))}
                                className="w-full bg-white border border-blue-300 rounded p-2 text-sm"
                            />
                        </div>
                    </div>
                </div>

                <p className="mb-4 text-sm text-gray-600">
                    Selecione o tipo de dado na barra abaixo e clique na <strong>primeira célula de dados</strong> correspondente na tabela.
                </p>

                {/* Toolbar */}
                <div className="flex flex-wrap gap-2 mb-4 bg-slate-100 p-2 rounded border border-gray-300 items-center">
                    <button 
                        onClick={handleSmartSelection}
                        className="mr-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
                        title="Tenta identificar automaticamente as colunas e o CPE usando palavras-chave"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        Palavras-Chave
                    </button>

                    <button 
                        onClick={handleAISmartSelection}
                        disabled={isAISmartLoading}
                        className="mr-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        title="Usa Inteligência Artificial para identificar todos os campos e CPE"
                    >
                        {isAISmartLoading ? (
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        )}
                        Preenchimento Inteligente (IA)
                    </button>

                    <div className="h-8 w-px bg-gray-300 mx-2 hidden md:block"></div>

                    <button 
                        onClick={() => setSelectionMode('date')}
                        className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 ${selectionMode === 'date' ? 'bg-gray-600 text-white ring-2 ring-gray-400' : 'bg-white text-gray-700 hover:bg-gray-200'}`}
                    >
                        <div className="w-3 h-3 bg-gray-500 rounded-full border border-gray-600"></div> Data
                    </button>
                    
                    <button 
                        onClick={() => setSelectionMode('time')}
                        className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 ${selectionMode === 'time' ? 'bg-orange-500 text-white ring-2 ring-orange-300' : 'bg-white text-gray-700 hover:bg-gray-200'}`}
                    >
                        <div className="w-3 h-3 bg-orange-500 rounded-full border border-orange-600"></div> Hora
                    </button>

                    {enabledVars.active && (
                    <button 
                        onClick={() => setSelectionMode('active')}
                        className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 ${selectionMode === 'active' ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-white text-gray-700 hover:bg-gray-200'}`}
                    >
                        <div className="w-3 h-3 bg-blue-600 rounded-full border border-blue-700"></div> Ativa (kW)
                    </button>
                    )}

                    {enabledVars.inductive && (
                    <button 
                        onClick={() => setSelectionMode('inductive')}
                        className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 ${selectionMode === 'inductive' ? 'bg-red-600 text-white ring-2 ring-red-400' : 'bg-white text-gray-700 hover:bg-gray-200'}`}
                    >
                        <div className="w-3 h-3 bg-red-600 rounded-full border border-red-700"></div> Indutiva (kVAr)
                    </button>
                    )}

                    {enabledVars.capacitive && (
                    <button 
                        onClick={() => setSelectionMode('capacitive')}
                        className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 ${selectionMode === 'capacitive' ? 'bg-green-600 text-white ring-2 ring-green-400' : 'bg-white text-gray-700 hover:bg-gray-200'}`}
                    >
                        <div className="w-3 h-3 bg-green-600 rounded-full border border-green-700"></div> Capacitiva (kVAr)
                    </button>
                    )}

                    <div className="w-px bg-gray-300 mx-2"></div>

                    <button 
                        onClick={() => setSelectionMode('cpe')}
                        className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 ${selectionMode === 'cpe' ? 'bg-purple-600 text-white ring-2 ring-purple-400' : 'bg-white text-gray-700 hover:bg-gray-200'}`}
                    >
                        <div className="w-3 h-3 bg-purple-600 rounded-full border border-purple-700"></div> CPE (Célula Única)
                    </button>
                </div>
                
                {/* Current Selection Status Bar */}
                <div className="text-xs text-gray-600 mb-2 flex flex-wrap gap-4">
                     <span>Data: {mapping.dateRow >= 0 ? `L${mapping.dateRow}:C${mapping.dateCol}` : '-'}</span>
                     <span>Hora: {mapping.timeRow !== undefined ? `L${mapping.timeRow}:C${mapping.timeCol}` : '-'}</span>
                     <span>Ativa: {mapping.activeRow >= 0 ? `L${mapping.activeRow}:C${mapping.activeCol}` : '-'}</span>
                     <span>Indutiva: {mapping.inductiveRow >= 0 ? `L${mapping.inductiveRow}:C${mapping.inductiveCol}` : '-'}</span>
                     <span>Capacitiva: {mapping.capacitiveRow >= 0 ? `L${mapping.capacitiveRow}:C${mapping.capacitiveCol}` : '-'}</span>
                </div>

                {/* Preview Table */}
                <div className="overflow-auto max-h-[500px] border border-gray-300 rounded mb-6 relative select-none">
                    <table className="min-w-full text-xs divide-y divide-gray-200 text-gray-900">
                        <thead className="bg-gray-100 sticky top-0 z-10 text-gray-900">
                            <tr>
                                <th className="p-2 border-r bg-gray-200 w-10 sticky left-0 z-20">#</th>
                                {previewData[0]?.map((_, colIndex) => (
                                    <th key={colIndex} className="p-2 border-r text-center w-24">
                                        Col {colIndex}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 text-gray-800">
                            {previewData.map((row, rIndex) => (
                                <tr key={rIndex}>
                                    <td className="p-2 border-r bg-gray-50 font-mono text-gray-500 sticky left-0 text-center">{rIndex}</td>
                                    {row.map((cell: any, cIndex: number) => {
                                        return (
                                            <td 
                                                key={cIndex} 
                                                className={`p-2 border-r whitespace-nowrap transition-all duration-100 ${getCellClass(rIndex, cIndex)}`}
                                                onClick={() => handleCellClick(rIndex, cIndex, cell)}
                                            >
                                                {cell}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                <div className="flex justify-between items-center">
                    <button onClick={() => { setViewMode(ViewMode.UPLOAD); setSelectionMode('none'); }} className="text-gray-600 hover:text-gray-900">Cancelar</button>
                    <button 
                        onClick={handleProcessFiles}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded shadow font-bold flex items-center gap-2"
                    >
                        {loading ? 'A processar...' : 'Confirmar e Processar Todos os Ficheiros'}
                        {!loading && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                    </button>
                </div>
            </div>
        )}

        {/* View: Dashboard */}
        {viewMode === ViewMode.DASHBOARD && (
            <div className="space-y-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        Dashboard Analítico
                    </h2>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setViewMode(ViewMode.ANALYTICAL_ANALYSIS)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded shadow flex items-center gap-2 font-bold"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                            Análise Analítica
                        </button>
                        <button 
                            onClick={() => setViewMode(ViewMode.COMPARISON)}
                            className="bg-slate-700 hover:bg-slate-800 text-white px-6 py-2 rounded shadow flex items-center gap-2 font-bold"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                            Comparativo
                        </button>
                        <button 
                            onClick={() => setViewMode(ViewMode.BATTERY_ANALYSIS)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded shadow flex items-center gap-2 font-bold"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Acumulação Energia
                        </button>
                        <button 
                            onClick={() => setViewMode(ViewMode.COST_ANALYSIS)}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded shadow flex items-center gap-2 font-bold"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Análise Comercial
                        </button>
                        <button 
                            onClick={() => setViewMode(ViewMode.REPORT)}
                            className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded shadow flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            Criar Relatório
                        </button>
                    </div>
                </div>

                <Dashboard project={project} rawData={project.rawData} />
            </div>
        )}

        {/* View: Cost Analysis */}
        {viewMode === ViewMode.COST_ANALYSIS && (
            <CostAnalysis 
                project={project} 
                onUpdateProject={(updates) => setProject(prev => ({ ...prev, ...updates }))}
                onNavigate={setViewMode}
                onRefreshOmie={handleRefreshOmie}
            />
        )}

        {/* View: Analytical Analysis */}
        {viewMode === ViewMode.ANALYTICAL_ANALYSIS && (
            <AnalyticalAnalysis 
                project={project} 
                onNavigate={setViewMode}
            />
        )}

        {/* View: Battery Analysis */}
        {viewMode === ViewMode.BATTERY_ANALYSIS && (
            <BatteryAnalysis 
                project={project} 
                onNavigate={setViewMode}
            />
        )}

        {/* View: Comparison */}
        {viewMode === ViewMode.COMPARISON && (
            <ComparisonView 
                onBack={() => {
                    if (isComparisonOnly) {
                        setIsComparisonOnly(false);
                        setViewMode(ViewMode.UPLOAD);
                    } else {
                        setViewMode(project.hourlyData.length > 0 ? ViewMode.DASHBOARD : ViewMode.UPLOAD);
                    }
                }}
                isComparisonOnly={isComparisonOnly}
            />
        )}

        {/* Tariff Help Modal */}
        {isTariffHelpOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="text-xl font-bold text-slate-900">Diferenças entre Ciclos</h3>
                        <button onClick={() => setIsTariffHelpOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="p-8 overflow-y-auto space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <h4 className="font-bold text-slate-900 mb-2 border-b pb-1">Ciclo Standard</h4>
                                <p className="text-sm text-slate-600 mb-4">Aplicável a todos os fornecimentos em Portugal Continental (BT, BTE, MT).</p>
                                <ul className="text-xs space-y-2 text-slate-500">
                                    <li>• Horários de Ponta fixos (manhã e tarde no Inverno).</li>
                                    <li>• Focado em perfis de consumo doméstico e comercial padrão.</li>
                                    <li>• Período de Verão com Ponta apenas de manhã.</li>
                                </ul>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                <h4 className="font-bold text-blue-900 mb-2 border-b border-blue-200 pb-1">Ciclo Opcional</h4>
                                <p className="text-sm text-blue-600 mb-4">Específico para Muito Alta Tensão (MAT), Alta Tensão (AT) e Média Tensão (MT).</p>
                                <ul className="text-xs space-y-2 text-blue-500">
                                    <li>• Horários de Ponta deslocados (final do dia no Inverno: 17h-22h).</li>
                                    <li>• Horários de Ponta no Verão: 14h-17h.</li>
                                    <li>• Ajustes nos períodos de Vazio e Super Vazio.</li>
                                </ul>
                            </div>
                        </div>
                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 text-xs text-amber-800">
                            <strong>Nota:</strong> A escolha do ciclo deve corresponder ao contrato de fornecimento de energia para que a análise de custos e períodos seja fidedigna.
                        </div>
                    </div>
                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <button onClick={() => setIsTariffHelpOpen(false)} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors">Fechar</button>
                    </div>
                </div>
            </div>
        )}

      </main>

      <footer className="bg-white border-t border-gray-200 mt-auto no-print">
          <div className="container mx-auto px-4 py-6 text-center text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} K-DATAELECT. Todos os direitos reservados.
          </div>
      </footer>
    </div>
  );
};

export default App;
