

import React, { useState, useRef } from 'react';
import { InstallationMetadata, ProjectState, ViewMode, ColumnMapping } from './types';
import Dashboard from './components/Dashboard';
import ReportView from './components/ReportView';
import { aggregateToHourly, parseExcelFiles, getExcelPreview } from './services/dataService';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.UPLOAD);
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
    aiAnalysis: null
  });

  // Import Wizard State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewData, setPreviewData] = useState<any[][]>([]);
  const [loading, setLoading] = useState(false);
  
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const resetProject = () => {
      if(window.confirm("Tem a certeza que deseja limpar todos os dados e começar um novo projeto?")) {
          setProject({
              metadata: { name: '', location: '', technician: '', reportDate: new Date().toISOString().split('T')[0], cpe: '', sourceInterval: '15m', filesCount: 0, totalRecords: 0 },
              rawData: [], hourlyData: [], aiAnalysis: null
          });
          setSelectedFiles([]);
          setPreviewData([]);
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
          const { data: rawData, cpe } = await parseExcelFiles(selectedFiles, mapping);
          
          if (rawData.length === 0) {
            alert("Não foram encontrados dados válidos. Verifique as colunas selecionadas.");
            setLoading(false);
            return;
          }

          const hourlyData = aggregateToHourly(rawData);
          
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-slate-800 font-sans">
      
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <div>
                <h1 className="text-xl font-bold tracking-wider">K-DATAELECT</h1>
                <p className="text-[10px] text-gray-400">By Koelho2000 | v1.3</p>
            </div>
            <div className="flex gap-4 text-sm items-center">
                <button onClick={resetProject} className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded transition text-xs font-bold uppercase tracking-wide">Novo Projeto</button>
                <div className="h-6 w-px bg-slate-700 mx-2"></div>
                <button onClick={saveProject} className="hover:text-blue-300 transition">Gravar</button>
                <button onClick={() => jsonInputRef.current?.click()} className="hover:text-blue-300 transition">Abrir</button>
                <input type="file" ref={jsonInputRef} onChange={loadProject} accept=".json" className="hidden" />
                <a href="https://www.koelho2000.com" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white">www.koelho2000.com</a>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-8">
        
        {/* Metadata Inputs */}
        <div className="bg-slate-900 rounded-lg shadow-lg p-6 mb-8 border border-slate-700">
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
                    <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded shadow transition transform hover:-translate-y-1">
                        Selecionar Ficheiros
                    </button>
                </div>
            </div>
        )}

        {/* View: Configuration / Preview */}
        {viewMode === ViewMode.CONFIG_IMPORT && (
            <div className="bg-white rounded-lg shadow p-6 text-gray-900">
                <h2 className="text-xl font-bold mb-4 text-slate-900">Configuração da Importação</h2>
                
                {/* Interval and Variables Config */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 bg-slate-50 p-4 rounded border border-gray-200">
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

                <p className="mb-4 text-sm text-gray-600">
                    Selecione o tipo de dado na barra abaixo e clique na <strong>primeira célula de dados</strong> correspondente na tabela.
                </p>

                {/* Toolbar */}
                <div className="flex flex-wrap gap-2 mb-4 bg-slate-100 p-2 rounded border border-gray-300">
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
                    <button 
                        onClick={() => setViewMode(ViewMode.REPORT)}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded shadow flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Criar Relatório
                    </button>
                </div>

                <Dashboard data={project.hourlyData} rawData={project.rawData} />
            </div>
        )}

      </main>

      <footer className="bg-white border-t border-gray-200 mt-auto">
          <div className="container mx-auto px-4 py-6 text-center text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} K-DATAELECT. Todos os direitos reservados.
          </div>
      </footer>
    </div>
  );
};

export default App;
