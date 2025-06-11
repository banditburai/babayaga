export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

export interface LogContext {
  requestId?: string;
  targetId?: string;
  method?: string;
  duration?: number;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'pretty';
  includeStack: boolean;
  contextFields: string[];
}

export class Logger {
  private static instance: Logger;
  private config: Required<LoggerConfig>;
  private context: LogContext = {};

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      format: 'pretty',
      includeStack: true,
      contextFields: ['requestId', 'targetId', 'method'],
      ...config
    };
  }

  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  withContext(context: LogContext): Logger {
    const newLogger = Object.create(this);
    newLogger.context = { ...this.context, ...context };
    return newLogger;
  }

  trace(message: string, context?: LogContext): void {
    this.log(LogLevel.TRACE, message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  fatal(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.FATAL, message, context, error);
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        ...(this.config.includeStack && { stack: error.stack })
      };
    }

    this.output(entry);
  }

  private output(entry: LogEntry): void {
    if (this.config.format === 'json') {
      console.error(JSON.stringify(entry));
    } else {
      this.outputPretty(entry);
    }
  }

  private outputPretty(entry: LogEntry): void {
    const levelName = LogLevel[entry.level];
    const timestamp = entry.timestamp.split('T')[1].split('.')[0];
    
    let output = `[${timestamp}] ${levelName.padEnd(5)} ${entry.message}`;
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = this.config.contextFields
        .filter(field => entry.context![field] !== undefined)
        .map(field => `${field}=${entry.context![field]}`)
        .join(' ');
      
      if (contextStr) {
        output += ` | ${contextStr}`;
      }
    }

    if (entry.error) {
      output += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack && this.config.includeStack) {
        output += `\n${entry.error.stack}`;
      }
    }

    console.error(output);
  }
}

// Singleton logger instance
export const logger = Logger.getInstance({
  level: process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : LogLevel.INFO,
  format: process.env.LOG_FORMAT as 'json' | 'pretty' || 'pretty',
  includeStack: process.env.NODE_ENV !== 'production'
});