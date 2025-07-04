export function generateUUID(): string {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  } else {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function generateQuizId(): string {
  const uuid = generateUUID();
  if (!isValidUUID(uuid)) {
    console.error('Generated invalid UUID for quiz:', uuid);
    // Fallback to crypto.randomUUID if available, otherwise generate again
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    // Try one more time with manual generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  return uuid;
}

export function generateQuestionId(): string {
  const uuid = generateUUID();
  if (!isValidUUID(uuid)) {
    console.error('Generated invalid UUID for question:', uuid);
    // Fallback to crypto.randomUUID if available, otherwise generate again
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    // Try one more time with manual generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  return uuid;
}
