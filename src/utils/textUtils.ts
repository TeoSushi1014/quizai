export function cleanMarkdownText(text: string): string {
  return text
    .replace(/^#+\s*Câu hỏi\s*\d*\s*$/gm, '')
    .replace(/^#+\s+/gm, '')
    .replace(/<[^>]*>?/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\{#[^}]+\}/g, '')
    .replace(/cu-hi-\d+/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractQuestionText(text: string): string {
  const cleanText = cleanMarkdownText(text);
  
  const questionMatch = cleanText.match(/(?:Thông báo|Câu hỏi|[^.!?]+\?)/);
  if (questionMatch) {
    return questionMatch[0].trim();
  }
  
  return cleanText;
}
