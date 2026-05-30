import chalk from 'chalk';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let currentLevel: LogLevel = 'info';

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export const logger = {
  debug(...args: unknown[]): void {
    if (levels[currentLevel] <= levels.debug) {
      console.log(chalk.gray('[DEBUG]'), ...args);
    }
  },
  info(...args: unknown[]): void {
    if (levels[currentLevel] <= levels.info) {
      console.log(chalk.blue('[INFO]'), ...args);
    }
  },
  warn(...args: unknown[]): void {
    if (levels[currentLevel] <= levels.warn) {
      console.log(chalk.yellow('[WARN]'), ...args);
    }
  },
  error(...args: unknown[]): void {
    if (levels[currentLevel] <= levels.error) {
      console.log(chalk.red('[ERROR]'), ...args);
    }
  },
};
