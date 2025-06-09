/**
 * Clean up markdown text to display in a plain text format
 * @param text The markdown text to clean
 * @returns The cleaned text
 */
export function cleanMarkdownText(text: string): string {
  return text
    // Remove markdown headers for questions (###, ##, etc)
    .replace(/^#+\s*Câu hỏi\s*\d*\s*$/gm, '')
    // Remove other markdown headers
    .replace(/^#+\s+/gm, '')
    // Remove HTML tags
    .replace(/<[^>]*>?/gm, '')
    // Remove markdown links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove custom IDs
    .replace(/\{#[^}]+\}/g, '')
    // Remove "cu-hi" references
    .replace(/cu-hi-\d+/g, '')
    // Remove extra newlines
    .replace(/\n+/g, ' ')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract the actual question from a markdown text
 * @param text The markdown text containing the question
 * @returns The extracted question text
 */
export function extractQuestionText(text: string): string {
  // Clean markdown first
  const cleanText = cleanMarkdownText(text);
  
  // Find the first actual question content
  const questionMatch = cleanText.match(/(?:Thông báo|Câu hỏi|[^.!?]+\?)/);
  if (questionMatch) {
    return questionMatch[0].trim();
  }
  
  return cleanText;
}
