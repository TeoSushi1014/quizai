type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, any>;
  userId?: string;
  errorDetails?: {
    name?: string;
    message?: string;
    stack?: string;
  };
}

class Logger {
  private isProduction = false;
  private userId: string | null = null;

  constructor() {
    // Attempt to determine environment. In Vite, import.meta.env is used.
    // For Jest, process.env.NODE_ENV might be set.
    try {
        // @ts-ignore
        this.isProduction = import.meta.env.PROD;
    } catch (e) {
        // Fallback for environments where import.meta.env is not available (like Jest by default)
        this.isProduction = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';
    }
  }

  setUserId(id: string | null) {
    this.userId = id;
  }

  debug(message: string, context?: string, data?: Record<string, any>) {
    this.log('debug', message, context, data);
  }

  info(message: string, context?: string, data?: Record<string, any>) {
    this.log('info', message, context, data);
  }

  warn(message: string, context?: string, data?: Record<string, any>, error?: Error) {
    this.log('warn', message, context, data, error);
  }

  error(message: string, context?: string, data?: Record<string, any>, error?: Error) {
    this.log('error', message, context, data, error);
  }

  private log(level: LogLevel, message: string, context?: string, data?: Record<string, any>, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data,
      userId: this.userId || undefined
    };

    if (error) {
      entry.errorDetails = {
        name: error.name,
        message: error.message,
        stack: this.isProduction ? undefined : error.stack // Only include stack in dev
      };
    }

    if (this.isProduction) {
      // In production, only log warnings and errors to reduce console spam
      if (level === 'warn' || level === 'error') {
        this.consoleLog(entry);
      }
      // Store critical logs for debugging
      if (level === 'error') {
        this.storeRecentLog(entry);
      }
    } else {
      // In development, log everything to console
      this.consoleLog(entry);
      this.storeRecentLog(entry);
    }
  }

  private consoleLog(entry: LogEntry) {
    const prefix = `[${entry.level.toUpperCase()}]${entry.context ? ` [${entry.context}]` : ''}`;
    const logArgs: any[] = [prefix, entry.message];
    if (entry.data && Object.keys(entry.data).length > 0) logArgs.push(entry.data);
    if (entry.errorDetails) logArgs.push(entry.errorDetails);
    if (entry.userId) logArgs.push(`(User: ${entry.userId})`);


    switch (entry.level) {
      case 'debug':
        console.debug(...logArgs);
        break;
      case 'info':
        console.info(...logArgs);
        break;
      case 'warn':
        console.warn(...logArgs);
        break;
      case 'error':
        console.error(...logArgs);
        break;
    }
  }

  private storeRecentLog(entry: LogEntry) {
    // Avoid localStorage in non-browser environments (like Node/Jest during SSR tests if any)
    if (typeof localStorage === 'undefined') return;
    try {
      const LOGS_KEY = 'quizai-recent-logs';
      const MAX_LOGS = 50;
      
      const storedLogsJson = localStorage.getItem(LOGS_KEY);
      let storedLogs: LogEntry[] = [];
      if (storedLogsJson) {
          try {
            storedLogs = JSON.parse(storedLogsJson);
            if (!Array.isArray(storedLogs)) storedLogs = []; // Ensure it's an array
          } catch (parseError) {
            console.warn("Failed to parse recent logs from localStorage. Resetting.", parseError);
            storedLogs = [];
          }
      }
      
      const updatedLogs = [entry, ...storedLogs.slice(0, MAX_LOGS - 1)];
      localStorage.setItem(LOGS_KEY, JSON.stringify(updatedLogs));
    } catch (err) {
      // Ignore storage errors (e.g. quota exceeded, security restrictions)
      console.warn("Could not store recent log in localStorage.", err);
    }
  }
}

export const logger = new Logger();