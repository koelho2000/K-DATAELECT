
import { GoogleGenAI, Type } from "@google/genai";
import { HourlyData, InstallationMetadata, InvoiceData, ColumnMapping } from "../types";

export interface ExcelMappingAIResponse {
  headerRow: number;
  dataRow: number;
  dateCol: number;
  timeCol: number | null;
  activeCol: number;
  inductiveCol: number;
  capacitiveCol: number;
  cpe: string | null;
  cpeRow: number | null;
  cpeCol: number | null;
  name: string | null;
  location: string | null;
}

export const analyzeExcelMapping = async (
  previewData: any[][]
): Promise<ExcelMappingAIResponse | null> => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key não configurada.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Analise os seguintes dados de uma folha de cálculo de telecontagem de energia elétrica (primeiras 30 linhas).
    Identifique:
    1. A linha do cabeçalho (header row).
    2. A primeira linha de dados (data row).
    3. O índice da coluna (0-indexed) para: Data, Hora, Energia Ativa (kW/kWh), Energia Indutiva (kVAr/kVArh), Energia Capacitiva (kVAr/kVArh).
    4. O CPE (Código de Ponto de Entrega) se estiver presente (formato PT000...).
    5. O Nome da Instalação ou Cliente, se identificável.
    6. A Localização ou Morada, se identificável.

    Dados (JSON):
    ${JSON.stringify(previewData)}

    Responda APENAS em formato JSON com a seguinte estrutura:
    {
      "headerRow": number,
      "dataRow": number,
      "dateCol": number,
      "timeCol": number | null,
      "activeCol": number,
      "inductiveCol": number,
      "capacitiveCol": number,
      "cpe": string | null,
      "cpeRow": number | null,
      "cpeCol": number | null,
      "name": string | null,
      "location": string | null
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headerRow: { type: Type.NUMBER },
            dataRow: { type: Type.NUMBER },
            dateCol: { type: Type.NUMBER },
            timeCol: { type: Type.NUMBER, nullable: true },
            activeCol: { type: Type.NUMBER },
            inductiveCol: { type: Type.NUMBER },
            capacitiveCol: { type: Type.NUMBER },
            cpe: { type: Type.STRING, nullable: true },
            cpeRow: { type: Type.NUMBER, nullable: true },
            cpeCol: { type: Type.NUMBER, nullable: true },
            name: { type: Type.STRING, nullable: true },
            location: { type: Type.STRING, nullable: true }
          },
          required: ["headerRow", "dataRow", "dateCol", "activeCol", "inductiveCol", "capacitiveCol"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("Erro ao analisar mapeamento Excel:", error);
    return null;
  }
};

export const generateReportAnalysis = async (
  hourlyData: HourlyData[],
  metadata: InstallationMetadata
): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return "API Key não configurada. A análise automática por IA não está disponível.";
  }

  const ai = new GoogleGenAI({ apiKey });

  // Prepare a summary of the data to keep tokens low
  // We'll take monthly averages
  const monthlyStats: Record<string, { active: number, ind: number, cap: number, count: number }> = {};
  
  hourlyData.forEach(h => {
    const key = h.timestamp.toLocaleString('pt-PT', { month: 'long', year: 'numeric' });
    if (!monthlyStats[key]) monthlyStats[key] = { active: 0, ind: 0, cap: 0, count: 0 };
    monthlyStats[key].active += h.activeAvg;
    monthlyStats[key].ind += h.inductiveAvg;
    monthlyStats[key].cap += h.capacitiveAvg;
    monthlyStats[key].count += 1;
  });

  let summaryText = `Resumo de dados para ${metadata.name} em ${metadata.location}:\n`;
  for (const [month, stats] of Object.entries(monthlyStats)) {
    summaryText += `- ${month}: Média Ativa ${(stats.active / stats.count).toFixed(2)} kW, Indutiva ${(stats.ind / stats.count).toFixed(2)} kVAr, Capacitiva ${(stats.cap / stats.count).toFixed(2)} kVAr.\n`;
  }

  // Find peaks
  const maxActive = hourlyData.reduce((prev, curr) => (prev.activeMax > curr.activeMax) ? prev : curr);
  summaryText += `\nPico Máximo de Potência Ativa Registado: ${maxActive.activeMax.toFixed(2)} kW em ${maxActive.timestamp.toLocaleString()}.\n`;

  const prompt = `
    Atue como um engenheiro eletrotécnico sénior especializado em eficiência energética.
    Escreva uma análise técnica para o Capítulo 6 de um relatório de auditoria energética.
    
    Dados da Instalação:
    ${summaryText}

    Instruções Rigorosas de Formatação (Markdown):
    - NÃO use o título principal "# Parecer Técnico". Comece diretamente com os subtítulos.
    - Use "##" para os subtítulos das secções (Ex: "## 6.1 Análise de Perfil de Carga").
    - Use "**" para destacar valores importantes ou conclusões (Ex: "**85 kW**").
    - O texto deve ser formal, técnico (PT-PT) e organizado em parágrafos justificados.

    Estrutura Obrigatória:
    ## 6.1 Análise do Perfil de Consumo
    (Analise a evolução da Potência Ativa e a sazonalidade)

    ## 6.2 Análise de Energia Reativa e Fator de Potência
    (Analise os valores Indutivos e Capacitivos. Indique se há risco de penalização)

    ## 6.3 Dimensionamento e Picos
    (Analise o pico máximo registado em relação à média)

    ## 6.4 Recomendações de Eficiência
    (Sugira 3 medidas concretas baseadas nos dados)
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
    });
    return response.text || "Não foi possível gerar a análise.";
  } catch (error) {
    console.error("Erro Gemini:", error);
    return "Erro ao contactar a IA para análise. Verifique a consola para detalhes.";
  }
};

export const extractInvoiceData = async (images: string[]): Promise<InvoiceData | null> => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key não configurada.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
    Analise a imagem desta página de uma fatura de eletricidade portuguesa e extraia os dados visíveis.
    
    IMPORTANTE: Esta é uma análise página a página. Se um dado não estiver visível nesta página específica, deixe o campo como null ou vazio. Não invente dados.
    
    Campos a extrair (JSON):
    - clientName: Nome completo do titular.
    - nif: NIF do cliente (9 dígitos).
    - retailer: Nome da empresa comercializadora (ex: EDP, Endesa, Iberdrola, etc.).
    - tariffType: Tipo de tarifário (ex: Simples, Bi-horário, Tri-horário).
    - address: Morada de fornecimento.
    - cpe: Código de Ponto de Entrega (PT0002...).
    - periodStart: Data início (YYYY-MM-DD).
    - periodEnd: Data fim (YYYY-MM-DD).
    - costs: Objeto com preços unitários:
        - ponta: €/kWh
        - cheias: €/kWh
        - vazio: €/kWh
        - superVazio: €/kWh
        - fixed: Valor total de custos fixos (Potência + Taxas) em €.
    
    Dicas:
    - Se encontrar uma tabela de preços, extraia os valores unitários.
    - O CPE e o NIF costumam estar na primeira ou segunda página.
    - O nome da comercializadora costuma estar no logótipo ou cabeçalho.
    
    Responda APENAS com o JSON válido.
  `;

  const parts = [
    { text: prompt },
    ...images.map(img => ({
      inlineData: {
        mimeType: "image/jpeg",
        data: img
      }
    }))
  ];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            clientName: { type: Type.STRING },
            nif: { type: Type.STRING },
            retailer: { type: Type.STRING },
            tariffType: { type: Type.STRING },
            address: { type: Type.STRING },
            cpe: { type: Type.STRING },
            periodStart: { type: Type.STRING },
            periodEnd: { type: Type.STRING },
            costs: {
              type: Type.OBJECT,
              properties: {
                ponta: { type: Type.NUMBER },
                cheias: { type: Type.NUMBER },
                vazio: { type: Type.NUMBER },
                superVazio: { type: Type.NUMBER },
                fixed: { type: Type.NUMBER }
              },
              required: ["ponta", "cheias", "vazio", "fixed"]
            }
          },
          required: ["clientName", "cpe", "costs"]
        }
      }
    });

    if (response.text) {
      try {
        return JSON.parse(response.text) as InvoiceData;
      } catch (parseError) {
        console.error("Erro ao parsear JSON da fatura:", parseError, "Raw text:", response.text);
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error("Erro ao extrair dados da fatura:", error);
    return null;
  }
};
