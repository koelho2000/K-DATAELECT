
import * as pdfjs from 'pdfjs-dist';

// For pdfjs-dist v5+, we should use the mjs worker
// Using unpkg as it often handles ESM better for specific versions
const PDFJS_VERSION = '5.5.207';
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

export const extractTextFromPdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
};

export const pdfToImages = async (file: File): Promise<string[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const images: string[] = [];

    // Limit to first 5 pages to avoid token limits and processing time
    const pagesToProcess = Math.min(pdf.numPages, 5);

    for (let i = 1; i <= pagesToProcess; i++) {
      try {
        const page = await pdf.getPage(i);
        // Increase scale for better resolution (2.5x)
        const viewport = page.getViewport({ scale: 2.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
          await page.render({ canvasContext: context, viewport, canvas }).promise;
          // Use higher quality for JPEG
          images.push(canvas.toDataURL('image/jpeg', 0.95).split(',')[1]);
        }
      } catch (pageError) {
        console.error(`Erro ao processar página ${i}:`, pageError);
      }
    }

    if (images.length === 0) {
      throw new Error("Nenhuma página pôde ser convertida em imagem.");
    }

    return images;
  } catch (error) {
    console.error("Erro no pdfToImages:", error);
    throw error;
  }
};
