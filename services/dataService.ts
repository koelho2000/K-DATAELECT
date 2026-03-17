

import { TelemetryRow, HourlyData, ColumnMapping, TariffCycle, Season, DayType, TariffOption } from '../types';

declare global {
  interface Window {
    XLSX: any;
  }
}

// Helper to determine the last Sunday of a given month (2=March, 9=October)
const getLastSunday = (year: number, month: number): Date => {
  const date = new Date(year, month + 1, 0);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  date.setHours(2, 0, 0, 0);
  return date;
};

const getMinutes = (date: Date) => date.getHours() * 60 + date.getMinutes();

export const getTariffInfo = (date: Date, option: TariffOption = TariffOption.STANDARD): { cycle: TariffCycle, season: Season, dayType: DayType } => {
  const year = date.getFullYear();
  const lastSundayMarch = getLastSunday(year, 2);
  const lastSundayOctober = getLastSunday(year, 9);
  
  const isSummer = date >= lastSundayMarch && date < lastSundayOctober;
  const season = isSummer ? Season.SUMMER : Season.WINTER;
  const day = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const mins = getMinutes(date);

  let dayType = DayType.WEEKDAY;
  if (day === 6) dayType = DayType.SATURDAY;
  else if (day === 0) dayType = DayType.SUNDAY;

  let cycle = TariffCycle.VAZIO_NORMAL;

  if (option === TariffOption.STANDARD) {
    if (isSummer) {
      if (day >= 1 && day <= 5) { // Weekdays
        if (mins >= 9*60+15 && mins < 12*60+15) cycle = TariffCycle.PONTA;
        else if (mins >= 7*60 && mins < 9*60+15) cycle = TariffCycle.CHEIAS;
        else if (mins >= 12*60+15 && mins < 24*60) cycle = TariffCycle.CHEIAS;
        else if (mins >= 0 && mins < 2*60) cycle = TariffCycle.VAZIO_NORMAL;
        else if (mins >= 6*60 && mins < 7*60) cycle = TariffCycle.VAZIO_NORMAL;
        else cycle = TariffCycle.SUPER_VAZIO;
      } else if (day === 6) { // Saturday
        if (mins >= 9*60 && mins < 14*60) cycle = TariffCycle.CHEIAS;
        else if (mins >= 20*60 && mins < 22*60) cycle = TariffCycle.CHEIAS;
        else if (mins >= 2*60 && mins < 6*60) cycle = TariffCycle.SUPER_VAZIO;
        else cycle = TariffCycle.VAZIO_NORMAL;
      } else { // Sunday
        if (mins >= 2*60 && mins < 6*60) cycle = TariffCycle.SUPER_VAZIO;
        else cycle = TariffCycle.VAZIO_NORMAL;
      }
    } else { // Winter
      if (day >= 1 && day <= 5) { // Weekdays
        if (mins >= 9*60+30 && mins < 12*60) cycle = TariffCycle.PONTA;
        else if (mins >= 18*60+30 && mins < 21*60) cycle = TariffCycle.PONTA;
        else if (mins >= 7*60 && mins < 9*60+30) cycle = TariffCycle.CHEIAS;
        else if (mins >= 12*60 && mins < 18*60+30) cycle = TariffCycle.CHEIAS;
        else if (mins >= 21*60 && mins < 24*60) cycle = TariffCycle.CHEIAS;
        else if (mins >= 0 && mins < 2*60) cycle = TariffCycle.VAZIO_NORMAL;
        else if (mins >= 6*60 && mins < 7*60) cycle = TariffCycle.VAZIO_NORMAL;
        else cycle = TariffCycle.SUPER_VAZIO;
      } else if (day === 6) { // Saturday
        if (mins >= 9*60+30 && mins < 13*60) cycle = TariffCycle.CHEIAS;
        else if (mins >= 18*60+30 && mins < 22*60) cycle = TariffCycle.CHEIAS;
        else if (mins >= 2*60 && mins < 6*60) cycle = TariffCycle.SUPER_VAZIO;
        else cycle = TariffCycle.VAZIO_NORMAL;
      } else { // Sunday
        if (mins >= 2*60 && mins < 6*60) cycle = TariffCycle.SUPER_VAZIO;
        else cycle = TariffCycle.VAZIO_NORMAL;
      }
    }
  } else {
    // Optional Cycle
    if (isSummer) {
      if (day >= 1 && day <= 5) { // Weekdays
        if (mins >= 14*60 && mins < 17*60) cycle = TariffCycle.PONTA;
        else if (mins >= 0 && mins < 0*60+30) cycle = TariffCycle.CHEIAS;
        else if (mins >= 7*60+30 && mins < 14*60) cycle = TariffCycle.CHEIAS;
        else if (mins >= 17*60 && mins < 24*60) cycle = TariffCycle.CHEIAS;
        else if (mins >= 0*60+30 && mins < 2*60) cycle = TariffCycle.VAZIO_NORMAL;
        else if (mins >= 6*60 && mins < 7*60+30) cycle = TariffCycle.VAZIO_NORMAL;
        else cycle = TariffCycle.SUPER_VAZIO;
      } else if (day === 6) { // Saturday
        if (mins >= 10*60 && mins < 13*60+30) cycle = TariffCycle.CHEIAS;
        else if (mins >= 19*60+30 && mins < 23*60) cycle = TariffCycle.CHEIAS;
        else if (mins >= 3*60+30 && mins < 7*60+30) cycle = TariffCycle.SUPER_VAZIO;
        else cycle = TariffCycle.VAZIO_NORMAL;
      } else { // Sunday
        if (mins >= 4*60 && mins < 8*60) cycle = TariffCycle.SUPER_VAZIO;
        else cycle = TariffCycle.VAZIO_NORMAL;
      }
    } else { // Winter
      if (day >= 1 && day <= 5) { // Weekdays
        if (mins >= 17*60 && mins < 22*60) cycle = TariffCycle.PONTA;
        else if (mins >= 0 && mins < 0*60+30) cycle = TariffCycle.CHEIAS;
        else if (mins >= 7*60+30 && mins < 17*60) cycle = TariffCycle.CHEIAS;
        else if (mins >= 22*60 && mins < 24*60) cycle = TariffCycle.CHEIAS;
        else if (mins >= 0*60+30 && mins < 2*60) cycle = TariffCycle.VAZIO_NORMAL;
        else if (mins >= 6*60 && mins < 7*60+30) cycle = TariffCycle.VAZIO_NORMAL;
        else cycle = TariffCycle.SUPER_VAZIO;
      } else if (day === 6) { // Saturday
        if (mins >= 10*60+30 && mins < 12*60+30) cycle = TariffCycle.CHEIAS;
        else if (mins >= 17*60+30 && mins < 22*60+30) cycle = TariffCycle.CHEIAS;
        else if (mins >= 3*60 && mins < 7*60) cycle = TariffCycle.SUPER_VAZIO;
        else cycle = TariffCycle.VAZIO_NORMAL;
      } else { // Sunday
        if (mins >= 4*60 && mins < 8*60) cycle = TariffCycle.SUPER_VAZIO;
        else cycle = TariffCycle.VAZIO_NORMAL;
      }
    }
  }

  return { cycle, season, dayType };
};

// Helper to parse numbers that might use comma as decimal separator
const parseValue = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // Remove whitespace and replace comma with dot
    const cleanStr = val.trim().replace(',', '.');
    // Remove characters that are not digits, dot, or minus
    const numberOnly = cleanStr.replace(/[^0-9.-]/g, '');
    const num = parseFloat(numberOnly);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

// Helper to parse Date/Time
const parseDateTime = (dateVal: any, timeVal: any): Date | null => {
    let finalDate: Date | null = null;

    // --- CASE 1: Separate Time Column Exists ---
    if (timeVal !== undefined && timeVal !== null && String(timeVal).trim() !== '') {
        
        // Sub-case 1.1: Excel Serial Numbers (Date Int + Time Decimal)
        // e.g. Date=45353, Time=0.5 (12:00) -> 45353.5
        if (typeof dateVal === 'number' && typeof timeVal === 'number') {
             const total = Math.floor(dateVal) + (timeVal % 1); // Ensure integer date + fraction time
             finalDate = new Date((total - 25569) * 86400 * 1000);
        }
        // Sub-case 1.2: Date is DateObject/Serial, Time is String (e.g. "14:30")
        else {
             // 1. Parse Date part
             let d = new Date();
             if (typeof dateVal === 'number') {
                 d = new Date((dateVal - 25569) * 86400 * 1000);
             } else if (dateVal instanceof Date) {
                 d = new Date(dateVal);
             } else {
                 // Try string parsing DD/MM/YYYY
                 const dStr = String(dateVal).trim();
                 // Matches DD/MM/YYYY or DD-MM-YYYY
                 const parts = dStr.split(/[\/\-\s]/);
                 if (parts.length >= 3) {
                     // Assume DD/MM/YYYY if 3 parts found
                     // Note: year might be first or last, simplistic heuristic here:
                     const p1 = parseInt(parts[0]);
                     const p2 = parseInt(parts[1]);
                     const p3 = parseInt(parts[2]);
                     if(p3 > 1000) d = new Date(p3, p2 - 1, p1); // DD/MM/YYYY
                     else if(p1 > 1000) d = new Date(p1, p2 - 1, p3); // YYYY/MM/DD
                 } else {
                     d = new Date(dStr);
                 }
             }

             // 2. Parse Time part
             let hours = 0;
             let minutes = 0;
             
             if (typeof timeVal === 'number') {
                 // Convert fraction of day to hours/min
                 // 0.5 = 12:00
                 const totalSeconds = Math.round(timeVal * 86400);
                 hours = Math.floor(totalSeconds / 3600);
                 minutes = Math.floor((totalSeconds % 3600) / 60);
             } else {
                 const tStr = String(timeVal).trim();
                 // Supports "14:30", "14:30:00"
                 const tParts = tStr.split(':');
                 if (tParts.length >= 2) {
                     hours = parseInt(tParts[0]);
                     minutes = parseInt(tParts[1]);
                 }
             }

             // 3. Combine
             if (!isNaN(d.getTime())) {
                 d.setHours(hours, minutes, 0, 0);
                 finalDate = d;
             }
        }
    } 
    // --- CASE 2: Single Column (Date and Time together) ---
    else {
        if (typeof dateVal === 'number') {
            finalDate = new Date((dateVal - 25569) * 86400 * 1000);
        } else if (typeof dateVal === 'string') {
             let d = new Date(dateVal);
             if (isNaN(d.getTime())) {
                const parts = dateVal.split(/[\/\-\s:]/);
                // Heuristic for DD/MM/YYYY HH:MM
                if (parts.length >= 5) {
                   d = new Date(
                     parseInt(parts[2]),
                     parseInt(parts[1]) - 1,
                     parseInt(parts[0]),
                     parseInt(parts[3]),
                     parseInt(parts[4])
                   );
                }
             }
             if (!isNaN(d.getTime())) finalDate = d;
        }
    }

    // Adjust for Timezone offset if needed or ensure validity
    if (finalDate && !isNaN(finalDate.getTime()) && finalDate.getFullYear() > 1990) {
        // Round to nearest minute to avoid floating point seconds issues from Excel serial conversion
        finalDate.setSeconds(0, 0);
        return finalDate;
    }
    return null;
};

// Get preview of the first file (raw matrix)
export const getExcelPreview = async (file: File): Promise<any[][]> => {
  const dataBuffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(dataBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  // header: 1 returns array of arrays
  return window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
};

// Parse uploaded files based on user mapping
export const parseExcelFiles = async (files: File[], mapping: ColumnMapping, option: TariffOption = TariffOption.STANDARD): Promise<{ data: TelemetryRow[], cpe: string | null }> => {
  const allRows: TelemetryRow[] = [];
  let detectedCpe: string | null = null;

  // Calculate row offsets relative to the Date row
  const timeOffset = (mapping.timeRow !== undefined) ? (mapping.timeRow - mapping.dateRow) : 0;
  const activeOffset = mapping.activeRow - mapping.dateRow;
  const inductiveOffset = mapping.inductiveRow - mapping.dateRow;
  const capacitiveOffset = mapping.capacitiveRow - mapping.dateRow;

  for (let fIndex = 0; fIndex < files.length; fIndex++) {
    const file = files[fIndex];
    const dataBuffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(dataBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData: any[][] = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Extract CPE from the first file only
    if (fIndex === 0 && mapping.cpeRow !== undefined && mapping.cpeCol !== undefined) {
       const row = jsonData[mapping.cpeRow];
       if (row && row[mapping.cpeCol]) {
         detectedCpe = String(row[mapping.cpeCol]).trim();
       }
    }

    // Iterate data rows starting from the defined Date Start Row
    for (let i = mapping.dateRow; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length === 0) continue;

      const dateVal = row[mapping.dateCol];
      
      // Get Time Value with offset
      let timeVal = undefined;
      if (mapping.timeCol !== undefined) {
         if (jsonData[i + timeOffset]) {
             timeVal = jsonData[i + timeOffset][mapping.timeCol];
         }
      }

      const date = parseDateTime(dateVal, timeVal);

      if (date) {
         let active = 0, inductive = 0, capacitive = 0;
         if (jsonData[i + activeOffset]) active = parseValue(jsonData[i + activeOffset][mapping.activeCol]);
         if (jsonData[i + inductiveOffset]) inductive = parseValue(jsonData[i + inductiveOffset][mapping.inductiveCol]);
         if (jsonData[i + capacitiveOffset]) capacitive = parseValue(jsonData[i + capacitiveOffset][mapping.capacitiveCol]);

         const info = getTariffInfo(date, option);
         allRows.push({
           timestamp: date,
           activePower: active,
           inductivePower: inductive,
           capacitivePower: capacitive,
           cycle: info.cycle,
           season: info.season,
           dayType: info.dayType
         });
      }
    }
  }

  const sortedData = allRows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  return {
    data: sortedData,
    cpe: detectedCpe
  };
};

// Aggregation Logic: 15min -> 1 Hour
export const aggregateToHourly = (rows: TelemetryRow[], option: TariffOption = TariffOption.STANDARD): HourlyData[] => {
  const grouped: Record<string, TelemetryRow[]> = {};

  rows.forEach(row => {
    const d = new Date(row.timestamp);
    d.setMinutes(0, 0, 0); 
    const key = d.toISOString();
    
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  });

  return Object.keys(grouped).map(key => {
    const group = grouped[key];
    const date = new Date(key);
    
    const actives = group.map(r => r.activePower);
    const activeAvg = actives.reduce((a, b) => a + b, 0) / group.length;
    
    const inductives = group.map(r => r.inductivePower);
    const inductiveAvg = inductives.reduce((a, b) => a + b, 0) / group.length;
    
    const capacitives = group.map(r => r.capacitivePower);
    const capAvg = capacitives.reduce((a, b) => a + b, 0) / group.length;
    
    const info = getTariffInfo(date, option);
    return {
      timestamp: date,
      hourLabel: date.toLocaleString('pt-PT', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
      activeAvg,
      activeMax: Math.max(...actives),
      activeMin: Math.min(...actives),
      inductiveAvg,
      inductiveMax: Math.max(...inductives),
      inductiveMin: Math.min(...inductives),
      capacitiveAvg: capAvg,
      capacitiveMax: Math.max(...capacitives),
      capacitiveMin: Math.min(...capacitives),
      cycle: info.cycle,
      season: info.season,
      dayType: info.dayType
    };
  }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
};

export interface ExportConfig {
    resolution: 'raw' | 'hourly' | 'daily' | 'monthly';
    splitDateTime: boolean;
    columns: {
        active: boolean;
        inductive: boolean;
        capacitive: boolean;
        cost: boolean;
    };
}

export const generateCSV = (data: any[], config: ExportConfig) => {
    // 1. Filter and Aggregate based on resolution
    let processedData: any[] = [];

    if (config.resolution === 'raw') {
         processedData = data.map((d: TelemetryRow) => ({
            timestamp: d.timestamp,
            date: d.timestamp.toLocaleDateString('pt-PT'),
            time: d.timestamp.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
            dateTime: d.timestamp.toLocaleString('pt-PT'),
            active: d.activePower,
            inductive: d.inductivePower,
            capacitive: d.capacitivePower,
            cost: d.cost || 0
        }));
    } else if (config.resolution === 'hourly') {
        processedData = data.map((d: HourlyData) => ({
            timestamp: d.timestamp,
            date: d.timestamp.toLocaleDateString('pt-PT'),
            time: d.timestamp.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
            dateTime: d.timestamp.toLocaleString('pt-PT'),
            active: d.activeAvg,
            inductive: d.inductiveAvg,
            capacitive: d.capacitiveAvg,
            cost: d.cost || 0
        }));
    } else {
        // Aggregate for Daily or Monthly
        const grouped: Record<string, { timestamp: Date, count: number, actSum: number, indSum: number, capSum: number, costSum: number }> = {};
        
        data.forEach(d => {
            let key = '';
            let ts = new Date(d.timestamp);
            if (config.resolution === 'daily') {
                key = d.timestamp.toLocaleDateString('pt-PT');
                ts.setHours(0,0,0,0);
            } else {
                // Monthly
                key = d.timestamp.toLocaleString('pt-PT', { month: 'long', year: 'numeric' });
                ts.setDate(1); ts.setHours(0,0,0,0);
            }
            
            const costVal = d.cost || 0;

            if (!grouped[key]) grouped[key] = { timestamp: ts, count: 0, actSum: 0, indSum: 0, capSum: 0, costSum: 0 };
            grouped[key].count++;
            grouped[key].actSum += d.activeAvg || d.activePower || 0;
            grouped[key].indSum += d.inductiveAvg || d.inductivePower || 0;
            grouped[key].capSum += d.capacitiveAvg || d.capacitivePower || 0;
            grouped[key].costSum += costVal;
        });

        processedData = Object.keys(grouped).map(k => {
            const g = grouped[k];
            // If resolution is Daily/Monthly, users usually want Total Energy (Sum of hourly averages)
            return {
                timestamp: g.timestamp,
                date: k,
                time: '',
                dateTime: k,
                active: g.actSum,
                inductive: g.indSum,
                capacitive: g.capSum,
                cost: g.costSum
            };
        });
    }

    // 2. Build Headers
    const headers: string[] = [];
    if (config.splitDateTime) {
        headers.push('Data');
        if (config.resolution === 'hourly' || config.resolution === 'raw') headers.push('Hora');
    } else {
        headers.push('Período');
    }

    if (config.columns.active) headers.push((config.resolution === 'hourly' || config.resolution === 'raw') ? 'Ativa (kW)' : 'Ativa (kWh)');
    if (config.columns.inductive) headers.push((config.resolution === 'hourly' || config.resolution === 'raw') ? 'Indutiva (kVAr)' : 'Indutiva (kVArh)');
    if (config.columns.capacitive) headers.push((config.resolution === 'hourly' || config.resolution === 'raw') ? 'Capacitiva (kVAr)' : 'Capacitiva (kVArh)');
    if (config.columns.cost) headers.push('Custo (€)');

    // 3. Build Rows
    const rows = processedData.map(d => {
        const row: string[] = [];
        
        if (config.splitDateTime) {
            row.push(d.date);
            if (config.resolution === 'hourly' || config.resolution === 'raw') row.push(d.time);
        } else {
            row.push(d.dateTime);
        }

        // Use dot for decimal separator (removed .replace('.', ','))
        if (config.columns.active) row.push(d.active.toFixed(2));
        if (config.columns.inductive) row.push(d.inductive.toFixed(2));
        if (config.columns.capacitive) row.push(d.capacitive.toFixed(2));
        if (config.columns.cost) row.push(d.cost.toFixed(4));
        return row;
    });

    // 4. Create CSV Content (using semi-colon separator)
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    
    // 5. Trigger Download
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `k-dataelect_export_${config.resolution}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const parseRetailersExcel = async (file: File): Promise<any[]> => {
  const dataBuffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(dataBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return window.XLSX.utils.sheet_to_json(sheet);
};
