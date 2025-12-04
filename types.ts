

export interface TelemetryRow {
  timestamp: Date;
  activePower: number; // kW
  inductivePower: number; // kVAr
  capacitivePower: number; // kVAr
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
}

export interface InstallationMetadata {
  name: string;
  location: string;
  technician: string;
  reportDate: string;
  cpe: string;
  sourceInterval?: string;
  filesCount?: number;
  totalRecords?: number;
}

export interface ProjectState {
  metadata: InstallationMetadata;
  rawData: TelemetryRow[];
  hourlyData: HourlyData[];
  aiAnalysis: string | null;
}

export enum ViewMode {
  UPLOAD = 'UPLOAD',
  CONFIG_IMPORT = 'CONFIG_IMPORT',
  DASHBOARD = 'DASHBOARD',
  REPORT = 'REPORT',
}

export enum LoadType {
  ACTIVE = 'active',
  INDUCTIVE = 'inductive',
  CAPACITIVE = 'capacitive',
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
  inductive: boolean;
  capacitive: boolean;
  tables: boolean;
  ai: boolean;
  conclusion: boolean;
}
