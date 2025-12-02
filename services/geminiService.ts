
import { GoogleGenAI } from "@google/genai";
import { HourlyData, InstallationMetadata } from "../types";

export const generateReportAnalysis = async (
  hourlyData: HourlyData[],
  metadata: InstallationMetadata
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key não configurada. A análise automática por IA não está disponível.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Não foi possível gerar a análise.";
  } catch (error) {
    console.error("Erro Gemini:", error);
    return "Erro ao contactar a IA para análise. Verifique a consola para detalhes.";
  }
};
