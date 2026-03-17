
import React, { useState, useMemo, useRef } from 'react';
import { ProjectState, ViewMode, InvoiceData, RetailerData, TariffCycle, HourlyData } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import { FileText, RefreshCw, TrendingUp, Building2, User, MapPin, CreditCard, Upload, Loader2, CheckCircle2, AlertCircle, Plus, Table, Trash2, ExternalLink, Edit2, ChevronLeft, ChevronRight, Search, Eye, HelpCircle, X } from 'lucide-react';
import { pdfToImages } from '../services/pdfService';
import { extractInvoiceData } from '../services/geminiService';
import { parseRetailersExcel } from '../services/dataService';

interface CostAnalysisProps {
  project: ProjectState;
  onUpdateProject: (updates: Partial<ProjectState>) => void;
  onNavigate: (view: ViewMode) => void;
  onRefreshOmie: () => Promise<void>;
}

const CostAnalysis: React.FC<CostAnalysisProps> = ({ project, onUpdateProject, onNavigate, onRefreshOmie }) => {
  const [isImportingInvoice, setIsImportingInvoice] = useState(false);
  const [isAddingRetailer, setIsAddingRetailer] = useState(false);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCostHelp, setShowCostHelp] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [editingRetailerIndex, setEditingRetailerIndex] = useState<number | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardPageIndex, setWizardPageIndex] = useState(0);
  const [isWizardProcessing, setIsWizardProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const retailerExcelRef = useRef<HTMLInputElement>(null);

  const [invoiceForm, setInvoiceForm] = useState<Partial<InvoiceData>>({
    clientName: '',
    nif: '',
    retailer: '',
    tariffType: '',
    address: '',
    cpe: project.metadata.cpe || '',
    costs: { ponta: 0, cheias: 0, vazio: 0, superVazio: 0, fixed: 0 }
  });

  const [wizardSelection, setWizardSelection] = useState({
    clientName: true,
    nif: true,
    retailer: true,
    tariffType: true,
    address: true,
    cpe: true,
    period: true,
    costs: true
  });

  const [costOptions, setCostOptions] = useState({
    pontaEqualsCheias: false,
    vazioEqualsSuperVazio: false
  });

  const [retailerForm, setRetailerForm] = useState<RetailerData>({
    name: '',
    costs: { ponta: 0, cheias: 0, vazio: 0, superVazio: 0, fixed: 0 },
    isIndexado: false,
    source: 'Manual',
    url: '',
    updatedAt: new Date().toISOString().split('T')[0]
  });

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPdf(true);
    setPdfError(null);

    try {
      const images = await pdfToImages(file);
      setPdfPages(images);
      setWizardPageIndex(0);
      setIsWizardOpen(true);
      setIsImportingInvoice(true); // Ensure the main form is also visible or at least the modal is ready
    } catch (error: any) {
      console.error("Erro no processamento do PDF:", error);
      setPdfError("Erro ao processar o PDF. Verifique se o ficheiro é válido e tente novamente.");
    } finally {
      setIsProcessingPdf(false);
    }
  };

  const handleWizardExtract = async () => {
    setIsWizardProcessing(true);
    try {
      // Extract from current page only
      const extractedData = await extractInvoiceData([pdfPages[wizardPageIndex]]);
      applyExtractedData(extractedData);
    } catch (error) {
      console.error("Erro na extração assistida:", error);
    } finally {
      setIsWizardProcessing(false);
    }
  };

  const handleFullSmartExtraction = async () => {
    setIsWizardProcessing(true);
    try {
      // Extract from ALL pages
      const extractedData = await extractInvoiceData(pdfPages);
      applyExtractedData(extractedData);
    } catch (error) {
      console.error("Erro na extração inteligente total:", error);
    } finally {
      setIsWizardProcessing(false);
    }
  };

  const applyExtractedData = (extractedData: InvoiceData | null) => {
    if (extractedData) {
      // Merge with existing form data based on selection
      setInvoiceForm(prev => {
        const next = { ...prev };
        
        if (wizardSelection.clientName) next.clientName = extractedData.clientName || prev.clientName;
        if (wizardSelection.nif) next.nif = extractedData.nif || prev.nif;
        if (wizardSelection.retailer) next.retailer = extractedData.retailer || prev.retailer;
        if (wizardSelection.tariffType) next.tariffType = extractedData.tariffType || prev.tariffType;
        if (wizardSelection.address) next.address = extractedData.address || prev.address;
        if (wizardSelection.cpe) next.cpe = extractedData.cpe || prev.cpe;
        if (wizardSelection.period) {
          next.periodStart = extractedData.periodStart || prev.periodStart;
          next.periodEnd = extractedData.periodEnd || prev.periodEnd;
        }
        
        if (wizardSelection.costs && extractedData.costs) {
          let p = extractedData.costs.ponta ?? prev.costs?.ponta ?? 0;
          let c = extractedData.costs.cheias ?? prev.costs?.cheias ?? 0;
          let v = extractedData.costs.vazio ?? prev.costs?.vazio ?? 0;
          let s = extractedData.costs.superVazio ?? prev.costs?.superVazio ?? 0;
          
          if (costOptions.pontaEqualsCheias) {
            const max = Math.max(p, c);
            p = max;
            c = max;
          }
          
          if (costOptions.vazioEqualsSuperVazio) {
            const max = Math.max(v, s);
            v = max;
            s = max;
          }

          next.costs = {
            ponta: p,
            cheias: c,
            vazio: v,
            superVazio: s,
            fixed: extractedData.costs.fixed ?? prev.costs?.fixed ?? 0,
          };
        }
        
        return next;
      });

      const filled = new Set(autoFilledFields);
      if (extractedData.clientName && wizardSelection.clientName) filled.add('clientName');
      if (extractedData.nif && wizardSelection.nif) filled.add('nif');
      if (extractedData.retailer && wizardSelection.retailer) filled.add('retailer');
      if (extractedData.tariffType && wizardSelection.tariffType) filled.add('tariffType');
      if (extractedData.address && wizardSelection.address) filled.add('address');
      if (extractedData.cpe && wizardSelection.cpe) filled.add('cpe');
      if (extractedData.costs && wizardSelection.costs) {
        if (extractedData.costs.ponta !== undefined) filled.add('ponta');
        if (extractedData.costs.cheias !== undefined) filled.add('cheias');
        if (extractedData.costs.vazio !== undefined) filled.add('vazio');
        if (extractedData.costs.superVazio !== undefined) filled.add('superVazio');
        if (extractedData.costs.fixed !== undefined) filled.add('fixed');
      }
      setAutoFilledFields(filled);
    }
  };

  const handleRetailerExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await parseRetailersExcel(file);
      const newRetailers: RetailerData[] = data.map((row: any) => ({
        name: row.Nome || row.name || row.Name || 'Novo Comercializador',
        costs: {
          ponta: parseFloat(row.Ponta || row.ponta || 0),
          cheias: parseFloat(row.Cheias || row.cheias || 0),
          vazio: parseFloat(row.Vazio || row.vazio || 0),
          superVazio: parseFloat(row.SuperVazio || row.superVazio || 0),
          fixed: parseFloat(row.Fixo || row.fixed || row.Fixed || 0),
          margin: parseFloat(row.Margem || row.margin || row.Margin || 0)
        },
        isIndexado: !!(row.Indexado || row.isIndexado || row.Indexed),
        source: row.Fonte || row.source || 'Excel Import',
        url: row.URL || row.url || row.Url || '',
        updatedAt: row.Data || row.updatedAt || new Date().toISOString().split('T')[0]
      }));

      onUpdateProject({ retailers: [...project.retailers, ...newRetailers] });
      alert(`${newRetailers.length} comercializadores importados com sucesso!`);
    } catch (error) {
      console.error("Erro ao importar Excel de comercializadores:", error);
      alert("Erro ao processar o ficheiro Excel.");
    }
  };

  const downloadRetailerTemplate = () => {
    const headers = ['Nome', 'Ponta', 'Cheias', 'Vazio', 'SuperVazio', 'Fixo', 'Margem', 'Indexado', 'Fonte', 'URL', 'Data'];
    const example = ['Exemplo Energia', '0.20', '0.16', '0.10', '0.08', '10.50', '0', '0', 'Site Oficial', 'https://exemplo.pt', '2026-03-04'];
    const csvContent = "\uFEFF" + [headers.join(';'), example.join(';')].join('\n');
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "modelo_comercializadores.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveRetailer = () => {
    if (editingRetailerIndex !== null) {
      const newList = [...project.retailers];
      newList[editingRetailerIndex] = retailerForm;
      onUpdateProject({ retailers: newList });
    } else {
      onUpdateProject({ retailers: [...project.retailers, retailerForm] });
    }
    setIsAddingRetailer(false);
    setEditingRetailerIndex(null);
    setRetailerForm({
      name: '',
      costs: { ponta: 0, cheias: 0, vazio: 0, superVazio: 0, fixed: 0 },
      isIndexado: false,
      source: 'Manual',
      url: '',
      updatedAt: new Date().toISOString().split('T')[0]
    });
  };

  const openEditRetailer = (index: number) => {
    setEditingRetailerIndex(index);
    setRetailerForm({ ...project.retailers[index] });
    setIsAddingRetailer(true);
  };

  const openAddRetailer = () => {
    setEditingRetailerIndex(null);
    setRetailerForm({
      name: '',
      costs: { ponta: 0, cheias: 0, vazio: 0, superVazio: 0, fixed: 0 },
      isIndexado: false,
      source: 'Manual',
      url: '',
      updatedAt: new Date().toISOString().split('T')[0]
    });
    setIsAddingRetailer(true);
  };

  const removeRetailer = (index: number) => {
    const newList = [...project.retailers];
    newList.splice(index, 1);
    onUpdateProject({ retailers: newList });
  };

  const handleRefreshMarket = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshOmie();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveInvoice = () => {
    // Check for CPE mismatch
    if (invoiceForm.cpe && project.metadata.cpe && invoiceForm.cpe !== project.metadata.cpe) {
      if (window.confirm(`O CPE da fatura (${invoiceForm.cpe}) é diferente do CPE do projeto (${project.metadata.cpe}). Deseja atualizar o CPE do projeto?`)) {
        onUpdateProject({ 
          invoice: invoiceForm as InvoiceData,
          metadata: { ...project.metadata, cpe: invoiceForm.cpe }
        });
        setIsImportingInvoice(false);
        return;
      }
    }

    onUpdateProject({ invoice: invoiceForm as InvoiceData });
    setIsImportingInvoice(false);
  };

  const openInvoiceModal = () => {
    if (project.invoice) {
      setInvoiceForm({ ...project.invoice });
    } else {
      setInvoiceForm({
        clientName: '',
        nif: '',
        retailer: '',
        tariffType: '',
        address: '',
        cpe: project.metadata.cpe || '',
        costs: { ponta: 0, cheias: 0, vazio: 0, superVazio: 0, fixed: 0 }
      });
    }
    setIsImportingInvoice(true);
    setPdfError(null);
    setAutoFilledFields(new Set());
  };

  const comparisonData = useMemo(() => {
    if (project.hourlyData.length === 0) return [];

    const totalEnergy = project.hourlyData.reduce((acc, curr) => acc + curr.activeAvg, 0);
    const energyByCycle = project.hourlyData.reduce((acc, curr) => {
      const cycle = curr.cycle || TariffCycle.CHEIAS;
      acc[cycle] = (acc[cycle] || 0) + curr.activeAvg;
      return acc;
    }, {} as Record<string, number>);

    const results = [];

    // 1. Current Invoice (if available)
    if (project.invoice) {
      const inv = project.invoice;
      const cycleCosts = {
        ponta: (energyByCycle[TariffCycle.PONTA] || 0) * inv.costs.ponta,
        cheias: (energyByCycle[TariffCycle.CHEIAS] || 0) * inv.costs.cheias,
        vazio: (energyByCycle[TariffCycle.VAZIO_NORMAL] || 0) * inv.costs.vazio,
        superVazio: (energyByCycle[TariffCycle.SUPER_VAZIO] || 0) * (inv.costs.superVazio || 0),
        fixed: inv.costs.fixed
      };
      const total = Object.values(cycleCosts).reduce((a, b) => a + b, 0);
      
      results.push({
        name: 'Fatura Atual',
        totalCost: total,
        avgPrice: total / totalEnergy,
        type: 'current',
        cycleCosts
      });
    }

    // 2. OMIE Market (Simulated with current config)
    const omieCost = project.hourlyData.reduce((acc, curr) => acc + (curr.cost || 0), 0);
    results.push({
      name: 'Mercado OMIE (Spot)',
      totalCost: omieCost,
      avgPrice: omieCost / totalEnergy,
      type: 'omie',
      cycleCosts: { ponta: 0, cheias: 0, vazio: 0, superVazio: 0, fixed: 0 } // OMIE is dynamic
    });

    // 3. Retailers
    project.retailers.forEach(ret => {
      let total = 0;
      let cycleCosts = { ponta: 0, cheias: 0, vazio: 0, superVazio: 0, fixed: ret.costs.fixed };

      if (ret.isIndexado) {
        total = project.hourlyData.reduce((acc, curr) => {
          const omieKWh = (curr.omiePrice || 80) / 1000;
          return acc + curr.activeAvg * (omieKWh + (ret.costs.margin || 0));
        }, 0) + ret.costs.fixed;
      } else {
        cycleCosts.ponta = (energyByCycle[TariffCycle.PONTA] || 0) * ret.costs.ponta;
        cycleCosts.cheias = (energyByCycle[TariffCycle.CHEIAS] || 0) * ret.costs.cheias;
        cycleCosts.vazio = (energyByCycle[TariffCycle.VAZIO_NORMAL] || 0) * ret.costs.vazio;
        cycleCosts.superVazio = (energyByCycle[TariffCycle.SUPER_VAZIO] || 0) * (ret.costs.superVazio || 0);
        total = Object.values(cycleCosts).reduce((a, b) => a + b, 0);
      }

      results.push({
        name: ret.name,
        totalCost: total,
        avgPrice: total / totalEnergy,
        type: 'retailer',
        cycleCosts,
        url: ret.url,
        source: ret.source
      });
    });

    return results.sort((a, b) => a.totalCost - b.totalCost);
  }, [project.hourlyData, project.invoice, project.retailers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-purple-600" />
          Análise Comercial e Comparação de Custos
        </h2>
        <div className="flex flex-wrap gap-2">
          {project.lastMarketUpdate && (
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mr-2">
              <RefreshCw className="w-3 h-3" />
              Atualizado: {project.lastMarketUpdate}
            </div>
          )}
          <a 
            href="https://www.omie.es/pt/market-results/daily/daily-market/day-ahead-price"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded shadow-sm flex items-center gap-2 text-sm font-bold transition-colors border border-slate-200"
          >
            <ExternalLink className="w-4 h-4 text-orange-500" />
            Consultar OMIE
          </a>
          <button 
            onClick={handleRefreshMarket}
            disabled={isRefreshing}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-4 py-2 rounded shadow flex items-center gap-2 text-sm font-bold transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'A atualizar...' : 'Atualizar Mercado'}
          </button>
          <button 
            onClick={openInvoiceModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow flex items-center gap-2 text-sm font-bold transition-colors"
          >
            <FileText className="w-4 h-4" />
            {project.invoice ? 'Editar Fatura' : 'Importar Fatura (PDF)'}
          </button>
          <button 
            onClick={() => onNavigate(ViewMode.DASHBOARD)}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded text-sm font-bold transition-colors"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Retailer Management Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Table className="w-5 h-5 text-purple-500" />
              Comercializadores
            </div>
            <div className="flex gap-1">
              <button 
                onClick={downloadRetailerTemplate}
                className="p-1 hover:bg-slate-100 rounded text-slate-400"
                title="Descarregar Modelo CSV"
              >
                <FileText className="w-4 h-4" />
              </button>
              <button 
                onClick={() => retailerExcelRef.current?.click()}
                className="p-1 hover:bg-slate-100 rounded text-slate-500"
                title="Importar Excel"
              >
                <Upload className="w-4 h-4" />
              </button>
              <button 
                onClick={openAddRetailer}
                className="p-1 hover:bg-slate-100 rounded text-purple-600"
                title="Adicionar Manual"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              ref={retailerExcelRef}
              onChange={handleRetailerExcelUpload}
            />
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {project.retailers.map((ret, i) => (
              <div key={i} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100 group">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-700 truncate">{ret.name}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2">
                    <span>{ret.isIndexado ? 'Indexado' : 'Fixo'} • {ret.updatedAt}</span>
                    {ret.url && (
                      <a 
                        href={ret.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-500 hover:underline flex items-center gap-0.5"
                      >
                        Justificativo
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => openEditRetailer(i)}
                    className="text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Editar"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => removeRetailer(i)}
                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice Info Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-500" />
              Dados do Cliente e Edifício
            </div>
            {project.invoice && (
              <button 
                onClick={openInvoiceModal}
                className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Editar
              </button>
            )}
          </h3>
          {project.invoice ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-start">
                <span className="text-slate-500 flex items-center gap-1"><Building2 className="w-3 h-3" /> Comercializadora:</span> 
                <span className="font-bold text-right">{project.invoice.retailer || '---'}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-slate-500 flex items-center gap-1"><User className="w-3 h-3" /> Cliente:</span> 
                <span className="font-bold text-right">{project.invoice.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 flex items-center gap-1"><CreditCard className="w-3 h-3" /> NIF:</span> 
                <span className="font-bold">{project.invoice.nif || '---'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 flex items-center gap-1"><CreditCard className="w-3 h-3" /> CPE:</span> 
                <span className="font-mono font-bold">{project.invoice.cpe}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> Morada:</span> 
                <span className="font-bold text-right">{project.invoice.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 flex items-center gap-1"><Table className="w-3 h-3" /> Tarifário:</span> 
                <span className="font-bold">{project.invoice.tariffType || '---'}</span>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <h4 className="font-bold text-xs text-slate-400 uppercase mb-2">Custos Unitários Fatura (€/kWh)</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 p-2 rounded">
                    <div className="text-[10px] text-slate-400">Ponta</div>
                    <div className="font-bold">{project.invoice.costs.ponta.toFixed(4)}</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <div className="text-[10px] text-slate-400">Cheias</div>
                    <div className="font-bold">{project.invoice.costs.cheias.toFixed(4)}</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <div className="text-[10px] text-slate-400">Vazio</div>
                    <div className="font-bold">{project.invoice.costs.vazio.toFixed(4)}</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <div className="text-[10px] text-slate-400">Super Vazio</div>
                    <div className="font-bold">{project.invoice.costs.superVazio.toFixed(4)}</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded col-span-2">
                    <div className="text-[10px] text-slate-400">Fixo (Mês)</div>
                    <div className="font-bold">{project.invoice.costs.fixed.toFixed(2)} €</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm mb-4">Nenhuma fatura importada.</p>
              <button 
                onClick={openInvoiceModal}
                className="bg-slate-100 hover:bg-slate-200 text-blue-600 font-bold text-sm px-4 py-2 rounded-lg transition-colors"
              >
                Configurar agora
              </button>
            </div>
          )}
        </div>

        {/* Comparison Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Comparação de Custos Totais (€)
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" fontSize={10} width={120} />
                <Tooltip 
                  formatter={(value: number) => [`${value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}`, 'Custo Total']}
                />
                <Bar dataKey="totalCost" radius={[0, 4, 4, 0]}>
                  {comparisonData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.type === 'current' ? '#3b82f6' : entry.type === 'omie' ? '#8b5cf6' : '#10b981'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Comparison Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Table className="w-5 h-5 text-blue-500" />
            Tabela Tarifária e Custos Unitários (€/kWh)
          </h3>
          <span className="text-xs text-slate-500">Fonte: Dados Importados / Manuais</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-6 py-3">Comercializadora</th>
                <th className="px-6 py-3 text-right">Ponta (€/kWh)</th>
                <th className="px-6 py-3 text-right">Cheias (€/kWh)</th>
                <th className="px-6 py-3 text-right">Vazio (€/kWh)</th>
                <th className="px-6 py-3 text-right">S. Vazio (€/kWh)</th>
                <th className="px-6 py-3 text-right">Fixo (€/mês)</th>
                <th className="px-6 py-3 text-right">Fonte</th>
                <th className="px-6 py-3 text-right">Atualização</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {project.retailers.map((ret, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">
                    <span>{ret.name}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono">{ret.isIndexado ? 'OMIE' : ret.costs.ponta.toFixed(4)}</td>
                  <td className="px-6 py-4 text-right font-mono">{ret.isIndexado ? 'OMIE' : ret.costs.cheias.toFixed(4)}</td>
                  <td className="px-6 py-4 text-right font-mono">{ret.isIndexado ? 'OMIE' : ret.costs.vazio.toFixed(4)}</td>
                  <td className="px-6 py-4 text-right font-mono">{ret.isIndexado ? 'OMIE' : ret.costs.superVazio.toFixed(4)}</td>
                  <td className="px-6 py-4 text-right font-mono">{ret.costs.fixed.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right text-xs text-slate-500">
                    <div className="flex flex-col items-end">
                      <span>{ret.source || 'N/A'}</span>
                      {ret.url && (
                        <a 
                          href={ret.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 mt-1 font-medium"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Justificativo
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-slate-500">{ret.updatedAt || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Comparison Table (Savings) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800">Custos por Comercializador e Ciclo</h3>
            <button 
              onClick={() => setShowCostHelp(true)}
              className="p-1 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"
              title="Ajuda sobre o cálculo"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <span className="text-xs text-slate-500">Valores totais para o período analisado</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-6 py-3">Comercializadora</th>
                <th className="px-6 py-3 text-right">Ponta (€)</th>
                <th className="px-6 py-3 text-right">Cheias (€)</th>
                <th className="px-6 py-3 text-right">Vazio (€)</th>
                <th className="px-6 py-3 text-right">S. Vazio (€)</th>
                <th className="px-6 py-3 text-right">Fixo (€)</th>
                <th className="px-6 py-3 text-right bg-slate-200/50">Custo Total (€)</th>
                <th className="px-6 py-3 text-right">Dif. vs Atual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparisonData.map((row, idx) => {
                const currentCost = comparisonData.find(r => r.type === 'current')?.totalCost || 0;
                const diff = currentCost ? row.totalCost - currentCost : 0;
                const diffPct = currentCost ? (diff / currentCost) * 100 : 0;

                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          {row.type === 'current' && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                          {row.type === 'omie' && <span className="w-2 h-2 bg-purple-500 rounded-full"></span>}
                          {row.type === 'retailer' && <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>}
                          {row.name}
                        </div>
                        {row.url && (
                          <a 
                            href={row.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 mt-1 font-normal"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            {row.source || 'Ver Justificativo'}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-600">{row.cycleCosts.ponta.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-600">{row.cycleCosts.cheias.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-600">{row.cycleCosts.vazio.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-600">{row.cycleCosts.superVazio.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-600">{row.cycleCosts.fixed.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold bg-slate-50">
                      {row.totalCost.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${diff < 0 ? 'text-emerald-600' : diff > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {row.type === 'current' ? '-' : `${diff > 0 ? '+' : ''}${diff.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })} (${diffPct.toFixed(1)}%)`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost Calculation Help Modal */}
      {showCostHelp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-blue-500" />
                Fórmulas de Cálculo de Custos
              </h3>
              <button onClick={() => setShowCostHelp(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-600" />
              </button>
            </div>
            <div className="p-8 space-y-8 overflow-y-auto max-h-[80vh]">
              <section>
                <h4 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <div className="w-2 h-6 bg-emerald-500 rounded-full"></div>
                  Mercado Não Indexado (Preço Fixo)
                </h4>
                <p className="text-sm text-slate-600 mb-4">
                  Neste regime, os preços por kWh são fixos para cada ciclo horário (Ponta, Cheias, Vazio, Super Vazio) durante o período do contrato.
                </p>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-xs leading-relaxed">
                  Custo Total = <br/>
                  &nbsp;&nbsp;(Energia_Ponta × Preço_Ponta) + <br/>
                  &nbsp;&nbsp;(Energia_Cheias × Preço_Cheias) + <br/>
                  &nbsp;&nbsp;(Energia_Vazio × Preço_Vazio) + <br/>
                  &nbsp;&nbsp;(Energia_S.Vazio × Preço_S.Vazio) + <br/>
                  &nbsp;&nbsp;Custo_Fixo_Mensal
                </div>
              </section>

              <section>
                <h4 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <div className="w-2 h-6 bg-purple-500 rounded-full"></div>
                  Mercado Indexado (Spot / OMIE)
                </h4>
                <p className="text-sm text-slate-600 mb-4">
                  O custo varia hora a hora de acordo com o preço do mercado grossista ibérico (OMIE). A fórmula reflete o consumo real em cada hora multiplicado pelo preço de mercado nesse momento.
                </p>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-xs leading-relaxed">
                  Custo Total = <br/>
                  &nbsp;&nbsp;Σ [ Energia_hora_h × ( Preço_OMIE_h + Margem_Comercial ) ] + <br/>
                  &nbsp;&nbsp;Custo_Fixo_Mensal
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-start gap-2 text-xs text-slate-500">
                    <div className="w-1 h-1 rounded-full bg-slate-400 mt-1.5 shrink-0"></div>
                    <span><strong>Preço_OMIE_h:</strong> Preço horário do mercado OMIE (convertido para €/kWh).</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-slate-500">
                    <div className="w-1 h-1 rounded-full bg-slate-400 mt-1.5 shrink-0"></div>
                    <span><strong>Margem_Comercial:</strong> Valor fixo por kWh (Fee) cobrado pelo comercializador.</span>
                  </div>
                </div>
              </section>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-700 leading-relaxed">
                  <strong>Nota:</strong> Os cálculos apresentados nesta simulação não incluem taxas reguladas (TAR), impostos (IVA) ou outras taxas específicas (IEC, DGEG), focando-se na componente de energia e comercialização para comparação direta entre ofertas.
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setShowCostHelp(false)}
                className="bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Retailer Modal */}
      {isAddingRetailer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900">{editingRetailerIndex !== null ? 'Editar Comercializador' : 'Adicionar Comercializador'}</h3>
              <button onClick={() => { setIsAddingRetailer(false); setEditingRetailerIndex(null); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Comercializador</label>
                  <input 
                    type="text" 
                    className="w-full border rounded p-2 text-sm" 
                    value={retailerForm.name} 
                    onChange={e => setRetailerForm({...retailerForm, name: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={retailerForm.isIndexado} 
                      onChange={e => setRetailerForm({...retailerForm, isIndexado: e.target.checked})}
                      className="rounded"
                    />
                    <span>Tarifário Indexado (OMIE)</span>
                  </label>
                </div>
                {!retailerForm.isIndexado ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preço Ponta (€/kWh)</label>
                      <input 
                        type="number" 
                        step="0.0001"
                        className="w-full border rounded p-2 text-sm" 
                        value={retailerForm.costs.ponta} 
                        onChange={e => setRetailerForm({...retailerForm, costs: {...retailerForm.costs, ponta: parseFloat(e.target.value)}})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preço Cheias (€/kWh)</label>
                      <input 
                        type="number" 
                        step="0.0001"
                        className="w-full border rounded p-2 text-sm" 
                        value={retailerForm.costs.cheias} 
                        onChange={e => setRetailerForm({...retailerForm, costs: {...retailerForm.costs, cheias: parseFloat(e.target.value)}})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preço Vazio (€/kWh)</label>
                      <input 
                        type="number" 
                        step="0.0001"
                        className="w-full border rounded p-2 text-sm" 
                        value={retailerForm.costs.vazio} 
                        onChange={e => setRetailerForm({...retailerForm, costs: {...retailerForm.costs, vazio: parseFloat(e.target.value)}})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preço Super Vazio (€/kWh)</label>
                      <input 
                        type="number" 
                        step="0.0001"
                        className="w-full border rounded p-2 text-sm" 
                        value={retailerForm.costs.superVazio} 
                        onChange={e => setRetailerForm({...retailerForm, costs: {...retailerForm.costs, superVazio: parseFloat(e.target.value)}})}
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Margem Comercial (€/kWh)</label>
                    <input 
                      type="number" 
                      step="0.0001"
                      className="w-full border rounded p-2 text-sm" 
                      value={retailerForm.costs.margin} 
                      onChange={e => setRetailerForm({...retailerForm, costs: {...retailerForm.costs, margin: parseFloat(e.target.value)}})}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custo Fixo Mensal (€)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full border rounded p-2 text-sm" 
                    value={retailerForm.costs.fixed} 
                    onChange={e => setRetailerForm({...retailerForm, costs: {...retailerForm.costs, fixed: parseFloat(e.target.value)}})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fonte dos Dados</label>
                  <input 
                    type="text" 
                    className="w-full border rounded p-2 text-sm" 
                    value={retailerForm.source} 
                    onChange={e => setRetailerForm({...retailerForm, source: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL Justificativo (Link WWW)</label>
                  <input 
                    type="url" 
                    placeholder="https://..."
                    className="w-full border rounded p-2 text-sm" 
                    value={retailerForm.url} 
                    onChange={e => setRetailerForm({...retailerForm, url: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => { setIsAddingRetailer(false); setEditingRetailerIndex(null); }} className="px-6 py-2 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={handleSaveRetailer} className="px-6 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors">{editingRetailerIndex !== null ? 'Guardar Alterações' : 'Adicionar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Import Modal */}
      {isImportingInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-600" />
                {project.invoice ? 'Editar Dados da Fatura' : 'Importar Dados da Fatura'}
              </h3>
              <button onClick={() => setIsImportingInvoice(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* PDF Upload Section */}
              <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${isProcessingPdf ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200 hover:border-blue-400'}`}>
                <input 
                  type="file" 
                  accept=".pdf" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handlePdfUpload}
                />
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isProcessingPdf ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                    {isProcessingPdf ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Importação Inteligente (IA)</h4>
                    <p className="text-sm text-slate-500">Carregue a sua fatura em PDF para extrair os dados automaticamente.</p>
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingPdf}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 shadow-sm"
                  >
                    {isProcessingPdf ? 'A processar...' : 'Selecionar PDF'}
                  </button>
                  {pdfError && (
                    <div className="flex items-center gap-2 text-red-600 text-xs mt-2 bg-red-50 p-2 rounded border border-red-100">
                      <AlertCircle className="w-4 h-4" />
                      {pdfError}
                    </div>
                  )}
                  {!pdfError && !isProcessingPdf && autoFilledFields.size > 0 && (
                    <div className="flex items-center gap-2 text-emerald-600 text-xs mt-2 bg-emerald-50 p-2 rounded border border-emerald-100">
                      <CheckCircle2 className="w-4 h-4" />
                      Dados extraídos com sucesso! Verifique os campos destacados em verde.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Dados de Identificação</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                      Comercializadora
                      {autoFilledFields.has('retailer') && <span className="text-[10px] text-emerald-600 font-normal lowercase italic">Extraído</span>}
                    </label>
                    <input 
                      type="text" 
                      className={`w-full border rounded p-2 text-sm transition-colors ${autoFilledFields.has('retailer') ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}
                      value={invoiceForm.retailer} 
                      onChange={e => setInvoiceForm({...invoiceForm, retailer: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                      Tipo de Tarifário
                      {autoFilledFields.has('tariffType') && <span className="text-[10px] text-emerald-600 font-normal lowercase italic">Extraído</span>}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Simples, Bi-horário..."
                      className={`w-full border rounded p-2 text-sm transition-colors ${autoFilledFields.has('tariffType') ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}
                      value={invoiceForm.tariffType} 
                      onChange={e => setInvoiceForm({...invoiceForm, tariffType: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                      Nome do Titular
                      {autoFilledFields.has('clientName') && <span className="text-[10px] text-emerald-600 font-normal lowercase italic">Extraído</span>}
                    </label>
                    <input 
                      type="text" 
                      className={`w-full border rounded p-2 text-sm transition-colors ${autoFilledFields.has('clientName') ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}
                      value={invoiceForm.clientName} 
                      onChange={e => setInvoiceForm({...invoiceForm, clientName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                      NIF do Cliente
                      {autoFilledFields.has('nif') && <span className="text-[10px] text-emerald-600 font-normal lowercase italic">Extraído</span>}
                    </label>
                    <input 
                      type="text" 
                      className={`w-full border rounded p-2 text-sm transition-colors ${autoFilledFields.has('nif') ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}
                      value={invoiceForm.nif} 
                      onChange={e => setInvoiceForm({...invoiceForm, nif: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                      CPE
                      {autoFilledFields.has('cpe') && <span className="text-[10px] text-emerald-600 font-normal lowercase italic">Extraído</span>}
                    </label>
                    <input 
                      type="text" 
                      className={`w-full border rounded p-2 text-sm font-mono transition-colors ${autoFilledFields.has('cpe') ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}
                      value={invoiceForm.cpe} 
                      onChange={e => setInvoiceForm({...invoiceForm, cpe: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Período de Faturação</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="date" 
                        className="w-full border border-slate-200 rounded p-2 text-xs"
                        value={invoiceForm.periodStart} 
                        onChange={e => setInvoiceForm({...invoiceForm, periodStart: e.target.value})}
                      />
                      <span className="text-slate-400">a</span>
                      <input 
                        type="date" 
                        className="w-full border border-slate-200 rounded p-2 text-xs"
                        value={invoiceForm.periodEnd} 
                        onChange={e => setInvoiceForm({...invoiceForm, periodEnd: e.target.value})}
                      />
                    </div>
                    {invoiceForm.periodStart && invoiceForm.periodEnd && project.hourlyData.length > 0 && (() => {
                      const dataStart = project.hourlyData[0].timestamp;
                      const dataEnd = project.hourlyData[project.hourlyData.length - 1].timestamp;
                      const invStart = new Date(invoiceForm.periodStart);
                      const invEnd = new Date(invoiceForm.periodEnd);
                      
                      const isMismatch = dataStart > invEnd || dataEnd < invStart;
                      
                      if (isMismatch) {
                        return (
                          <div className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            O período da fatura não coincide com os dados carregados.
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                      Morada / Edifício
                      {autoFilledFields.has('address') && <span className="text-[10px] text-emerald-600 font-normal lowercase italic">Extraído da fatura</span>}
                    </label>
                    <input 
                      type="text" 
                      className={`w-full border rounded p-2 text-sm transition-colors ${autoFilledFields.has('address') ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}
                      value={invoiceForm.address} 
                      onChange={e => setInvoiceForm({...invoiceForm, address: e.target.value})}
                    />
                  </div>
                </div>

                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1 pt-4">Custos Unitários e Fixos</h4>
                
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={costOptions.pontaEqualsCheias} 
                      onChange={() => setCostOptions(prev => ({ ...prev, pontaEqualsCheias: !prev.pontaEqualsCheias }))}
                      className="rounded text-blue-600"
                    />
                    <span className="text-[10px] font-medium text-slate-600">Ponta = Cheias</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={costOptions.vazioEqualsSuperVazio} 
                      onChange={() => setCostOptions(prev => ({ ...prev, vazioEqualsSuperVazio: !prev.vazioEqualsSuperVazio }))}
                      className="rounded text-blue-600"
                    />
                    <span className="text-[10px] font-medium text-slate-600">Vazio = Super Vazio</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex flex-col">
                      Ponta (€/kWh)
                      {autoFilledFields.has('ponta') && <span className="text-[9px] text-emerald-600 font-normal lowercase italic">Extraído</span>}
                    </label>
                    <input 
                      type="number" 
                      step="0.0001"
                      className={`w-full border rounded p-2 text-sm transition-colors ${autoFilledFields.has('ponta') ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}
                      value={invoiceForm.costs?.ponta} 
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setInvoiceForm({
                          ...invoiceForm, 
                          costs: {
                            ...invoiceForm.costs!, 
                            ponta: val,
                            cheias: costOptions.pontaEqualsCheias ? val : invoiceForm.costs!.cheias
                          }
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex flex-col">
                      Cheias (€/kWh)
                      {autoFilledFields.has('cheias') && <span className="text-[9px] text-emerald-600 font-normal lowercase italic">Extraído</span>}
                    </label>
                    <input 
                      type="number" 
                      step="0.0001"
                      className={`w-full border rounded p-2 text-sm transition-colors ${autoFilledFields.has('cheias') ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}
                      value={invoiceForm.costs?.cheias} 
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setInvoiceForm({
                          ...invoiceForm, 
                          costs: {
                            ...invoiceForm.costs!, 
                            cheias: val,
                            ponta: costOptions.pontaEqualsCheias ? val : invoiceForm.costs!.ponta
                          }
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex flex-col">
                      Vazio (€/kWh)
                      {autoFilledFields.has('vazio') && <span className="text-[9px] text-emerald-600 font-normal lowercase italic">Extraído</span>}
                    </label>
                    <input 
                      type="number" 
                      step="0.0001"
                      className={`w-full border rounded p-2 text-sm transition-colors ${autoFilledFields.has('vazio') ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}
                      value={invoiceForm.costs?.vazio} 
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setInvoiceForm({
                          ...invoiceForm, 
                          costs: {
                            ...invoiceForm.costs!, 
                            vazio: val,
                            superVazio: costOptions.vazioEqualsSuperVazio ? val : invoiceForm.costs!.superVazio
                          }
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex flex-col">
                      Super Vazio (€/kWh)
                      {autoFilledFields.has('superVazio') && <span className="text-[9px] text-emerald-600 font-normal lowercase italic">Extraído</span>}
                    </label>
                    <input 
                      type="number" 
                      step="0.0001"
                      className={`w-full border rounded p-2 text-sm transition-colors ${autoFilledFields.has('superVazio') ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}
                      value={invoiceForm.costs?.superVazio} 
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setInvoiceForm({
                          ...invoiceForm, 
                          costs: {
                            ...invoiceForm.costs!, 
                            superVazio: val,
                            vazio: costOptions.vazioEqualsSuperVazio ? val : invoiceForm.costs!.vazio
                          }
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex flex-col">
                      Fixo Total (€)
                      {autoFilledFields.has('fixed') && <span className="text-[9px] text-emerald-600 font-normal lowercase italic">Extraído</span>}
                    </label>
                    <input 
                      type="number" 
                      step="0.01"
                      className={`w-full border rounded p-2 text-sm transition-colors ${autoFilledFields.has('fixed') ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}
                      value={invoiceForm.costs?.fixed} 
                      onChange={e => setInvoiceForm({...invoiceForm, costs: {...invoiceForm.costs!, fixed: parseFloat(e.target.value)}})}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setIsImportingInvoice(false)} className="px-6 py-2 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={handleSaveInvoice} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">Guardar Dados</button>
            </div>
          </div>
        </div>
      )}
      {/* PDF Wizard Overlay */}
      {isWizardOpen && (
        <div className="fixed inset-0 bg-slate-900/95 z-[120] flex flex-col">
          {/* Header */}
          <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
            <div className="flex items-center gap-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-400" />
                Assistente de Extração de Fatura
              </h3>
              <div className="flex items-center bg-slate-700 rounded-lg px-3 py-1 gap-4">
                <button 
                  onClick={() => setWizardPageIndex(Math.max(0, wizardPageIndex - 1))}
                  disabled={wizardPageIndex === 0}
                  className="text-slate-300 hover:text-white disabled:opacity-30"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-xs text-slate-300 font-mono">Página {wizardPageIndex + 1} de {pdfPages.length}</span>
                <button 
                  onClick={() => setWizardPageIndex(Math.min(pdfPages.length - 1, wizardPageIndex + 1))}
                  disabled={wizardPageIndex === pdfPages.length - 1}
                  className="text-slate-300 hover:text-white disabled:opacity-30"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            <button 
              onClick={() => setIsWizardOpen(false)}
              className="text-slate-400 hover:text-white p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left: PDF Preview */}
            <div className="flex-1 bg-slate-900 p-8 overflow-auto flex justify-center items-start">
              <div className="relative shadow-2xl border border-slate-700 bg-white max-w-4xl w-full">
                <img 
                  src={`data:image/jpeg;base64,${pdfPages[wizardPageIndex]}`} 
                  alt={`Página ${wizardPageIndex + 1}`}
                  className="w-full h-auto"
                  referrerPolicy="no-referrer"
                />
                {isWizardProcessing && (
                  <div className="absolute inset-0 bg-blue-600/20 backdrop-blur-[2px] flex flex-col items-center justify-center text-white">
                    <Loader2 className="w-12 h-12 animate-spin mb-4" />
                    <p className="font-bold text-lg animate-pulse">A analisar página...</p>
                    <p className="text-sm opacity-80">A IA está a ler os dados desta página</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Data Panel */}
            <div className="w-96 bg-slate-50 border-l border-slate-200 flex flex-col shadow-xl">
              <div className="p-4 border-b border-slate-200 bg-white">
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                  <Search className="w-4 h-4 text-purple-600" />
                  Dados Extraídos
                </h4>
                <p className="text-[10px] text-slate-500 mt-1">Navegue até à página que contém os dados e clique em extrair.</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="space-y-2">
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase">Dados a Extrair</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(wizardSelection).map(([key, value]) => (
                      <label key={key} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <input 
                          type="checkbox" 
                          checked={value} 
                          onChange={() => setWizardSelection(prev => ({ ...prev, [key]: !value }))}
                          className="rounded text-purple-600"
                        />
                        <span className="text-[10px] font-medium text-slate-600 capitalize">
                          {key === 'clientName' ? 'Nome' : 
                           key === 'nif' ? 'NIF' :
                           key === 'retailer' ? 'Comercializadora' :
                           key === 'tariffType' ? 'Tarifário' :
                           key === 'address' ? 'Morada' :
                           key === 'cpe' ? 'CPE' :
                           key === 'period' ? 'Período' : 'Custos'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase">Opções de Custo</h5>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200 cursor-pointer hover:bg-slate-50">
                      <input 
                        type="checkbox" 
                        checked={costOptions.pontaEqualsCheias} 
                        onChange={() => setCostOptions(prev => ({ ...prev, pontaEqualsCheias: !prev.pontaEqualsCheias }))}
                        className="rounded text-blue-600"
                      />
                      <span className="text-[10px] font-medium text-slate-600">Ponta = Cheias (Bi-horário)</span>
                    </label>
                    <label className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200 cursor-pointer hover:bg-slate-50">
                      <input 
                        type="checkbox" 
                        checked={costOptions.vazioEqualsSuperVazio} 
                        onChange={() => setCostOptions(prev => ({ ...prev, vazioEqualsSuperVazio: !prev.vazioEqualsSuperVazio }))}
                        className="rounded text-blue-600"
                      />
                      <span className="text-[10px] font-medium text-slate-600">Vazio = Super Vazio</span>
                    </label>
                  </div>
                </div>

                <button 
                  onClick={handleWizardExtract}
                  disabled={isWizardProcessing}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] active:scale-95"
                >
                  {isWizardProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                  Extrair Selecionados
                </button>

                <button 
                  onClick={handleFullSmartExtraction}
                  disabled={isWizardProcessing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] active:scale-95 mt-2"
                  title="Usa IA para analisar todas as páginas do PDF e preencher os dados"
                >
                  {isWizardProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  Extração Inteligente (IA - Todas as Páginas)
                </button>

                <div className="space-y-4">
                  <div className={`p-3 rounded-lg border transition-all ${autoFilledFields.has('retailer') ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Comercializadora</label>
                    <div className="font-bold text-slate-700">{invoiceForm.retailer || '---'}</div>
                  </div>

                  <div className={`p-3 rounded-lg border transition-all ${autoFilledFields.has('cpe') ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CPE</label>
                    <div className="font-mono font-bold text-slate-700">{invoiceForm.cpe || '---'}</div>
                  </div>

                  <div className={`p-3 rounded-lg border transition-all ${autoFilledFields.has('nif') ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">NIF</label>
                    <div className="font-bold text-slate-700">{invoiceForm.nif || '---'}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className={`p-2 rounded-lg border transition-all ${autoFilledFields.has('ponta') ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase">Ponta</label>
                      <div className="font-bold text-slate-700">{invoiceForm.costs?.ponta?.toFixed(4) || '0.0000'}</div>
                    </div>
                    <div className={`p-2 rounded-lg border transition-all ${autoFilledFields.has('cheias') ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase">Cheias</label>
                      <div className="font-bold text-slate-700">{invoiceForm.costs?.cheias?.toFixed(4) || '0.0000'}</div>
                    </div>
                    <div className={`p-2 rounded-lg border transition-all ${autoFilledFields.has('vazio') ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase">Vazio</label>
                      <div className="font-bold text-slate-700">{invoiceForm.costs?.vazio?.toFixed(4) || '0.0000'}</div>
                    </div>
                    <div className={`p-2 rounded-lg border transition-all ${autoFilledFields.has('superVazio') ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase">Super Vazio</label>
                      <div className="font-bold text-slate-700">{invoiceForm.costs?.superVazio?.toFixed(4) || '0.0000'}</div>
                    </div>
                    <div className={`p-2 rounded-lg border transition-all ${autoFilledFields.has('fixed') ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase">Fixo</label>
                      <div className="font-bold text-slate-700">{invoiceForm.costs?.fixed?.toFixed(2) || '0.00'} €</div>
                    </div>
                  </div>
                </div>

                {autoFilledFields.size > 0 && (
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-[11px] text-blue-700">
                    <p className="font-bold mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Dica:</p>
                    Pode navegar para outras páginas e clicar novamente em "Extrair" para completar os dados em falta.
                  </div>
                )}
              </div>

              <div className="p-4 bg-white border-t border-slate-200">
                <button 
                  onClick={() => setIsWizardOpen(false)}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-bold transition-all shadow-lg"
                >
                  Concluir e Voltar ao Formulário
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostAnalysis;
