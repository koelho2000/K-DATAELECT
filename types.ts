

export interface TelemetryRow {
  timestamp: Date;
  activePower: number; // kW
  inductivePower: number; // kVAr
  capacitivePower: number; // kVAr
  cycle?: TariffCycle;
  season?: Season;
  dayType?: DayType;
  cost?: number;
}

export interface HourlyData {
  timestamp: Date;
  hourLabel: string; // e.g., "Jan 01 14:00"
  activeAvg: number;
  activeMax: number;
  activeMin: number;
  inductiveAvg: number;
  inductiveMax: number;
  inductiveMin: number;
  capacitiveAvg: number;
  capacitiveMax: number;
  capacitiveMin: number;
  cycle?: TariffCycle;
  season?: Season;
  dayType?: DayType;
  cost?: number;
  omiePrice?: number;
}

export interface InstallationMetadata {
  name: string;
  location: string;
  technician: string;
  reportDate: string;
  cpe: string;
  contractedPower?: number;
  sourceInterval?: string;
  filesCount?: number;
  totalRecords?: number;
}

export interface ProjectState {
  metadata: InstallationMetadata;
  rawData: TelemetryRow[];
  hourlyData: HourlyData[];
  aiAnalysis: string | null;
  tariffOption: TariffOption;
  costConfig?: {
    margin: number;
    fixedCost: number;
    tax: number;
  };
  invoice?: InvoiceData;
  retailers: RetailerData[];
  lastMarketUpdate?: string;
}

export interface InvoiceData {
  clientName: string;
  nif?: string;
  retailer?: string;
  tariffType?: string;
  address: string;
  cpe: string;
  periodStart: string;
  periodEnd: string;
  costs: {
    ponta: number;
    cheias: number;
    vazio: number;
    superVazio: number;
    fixed: number;
  };
}

export interface RetailerData {
  name: string;
  costs: {
    ponta: number;
    cheias: number;
    vazio: number;
    superVazio: number;
    fixed: number;
    margin?: number;
  };
  isIndexado: boolean;
  source?: string;
  url?: string;
  updatedAt?: string;
}

export enum ViewMode {
  HOME = 'HOME',
  UPLOAD = 'UPLOAD',
  CONFIG_IMPORT = 'CONFIG_IMPORT',
  DASHBOARD = 'DASHBOARD',
  COST_ANALYSIS = 'COST_ANALYSIS',
  ANALYTICAL_ANALYSIS = 'ANALYTICAL_ANALYSIS',
  BATTERY_ANALYSIS = 'BATTERY_ANALYSIS',
  COMPARISON = 'COMPARISON',
  REPORT = 'REPORT',
}

export enum TariffOption {
  STANDARD = 'Standard',
  OPTIONAL = 'Opcional',
}

export enum TariffCycle {
  PONTA = 'Ponta',
  CHEIAS = 'Cheias',
  VAZIO_NORMAL = 'Vazio Normal',
  SUPER_VAZIO = 'Super Vazio',
}

export enum Season {
  WINTER = 'Inverno',
  SUMMER = 'Verão',
}

export enum DayType {
  WEEKDAY = 'Segunda a Sexta',
  SATURDAY = 'Sábado',
  SUNDAY = 'Domingo',
}

export enum LoadType {
  ACTIVE = 'active',
  INDUCTIVE = 'inductive',
  CAPACITIVE = 'capacitive',
  COST = 'cost',
}

// Helper for aggregation periods
export enum Period {
  DAILY = 'Diário',
  WEEKLY = 'Semanal',
  MONTHLY = 'Mensal',
  YEARLY = 'Anual',
}

export interface ColumnMapping {
  dateCol: number; 
  dateRow: number;
  
  timeCol?: number; 
  timeRow?: number;
  
  activeCol: number; 
  activeRow: number;
  
  inductiveCol: number; 
  inductiveRow: number;
  
  capacitiveCol: number; 
  capacitiveRow: number;

  cpeRow?: number;
  cpeCol?: number;
}

export interface ReportSectionConfig {
  intro: boolean;
  active: boolean;
  energy: boolean;
  cycleAnalysis: boolean;
  inductive: boolean;
  capacitive: boolean;
  costs: boolean;
  tables: boolean;
  ai: boolean;
  conclusion: boolean;
}
