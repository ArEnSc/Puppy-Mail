declare module 'electron-timber' {
  interface LoggerOptions {
    name?: string
    ignore?: RegExp
    logLevel?: 'info' | 'warn' | 'error'
  }

  interface Logger {
    log(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
    time(label: string): void
    timeEnd(label: string): void
    streamLog(stream: NodeJS.ReadableStream): void
    streamWarn(stream: NodeJS.ReadableStream): void
    streamError(stream: NodeJS.ReadableStream): void
    create(options?: LoggerOptions): Logger
  }

  const logger: Logger
  export default logger
}
