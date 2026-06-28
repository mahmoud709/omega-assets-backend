// Logger utility
// TODO: Implement logging functionality

export class Logger {
  static info(message: string, ...args: any[]): void {
    console.log(`[INFO] ${message}`, ...args);
  }

  static error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }

  static warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  static debug(message: string, ...args: any[]): void {
    console.debug(`[DEBUG] ${message}`, ...args);
  }
}
