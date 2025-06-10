import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import mammoth from 'mammoth';

// Configure worker source for pdf.js
if (typeof window !== 'undefined') {
  // Use esm.sh for the worker, matching the library version from importmap.
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.min.js`;
}

export const extractTextFromPdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let textContent = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const text = await page.getTextContent();
    textContent += text.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n';
  }
  return textContent;
};

export const extractTextFromDocx = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value; // The raw text content
};

export const convertImageToBase64 = (file: File): Promise<{ base64Data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is like "data:image/png;base64,xxxxxx"
      // we need to extract base64 data part and mimeType
      const parts = result.split(',');
      if (parts.length !== 2) {
        reject(new Error("Invalid file data for base64 conversion"));
        return;
      }
      const mimeTypePart = parts[0].split(':')[1].split(';')[0];
      resolve({ base64Data: parts[1], mimeType: mimeTypePart });
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
};