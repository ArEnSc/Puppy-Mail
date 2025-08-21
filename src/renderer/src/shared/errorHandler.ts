/**
 * Standardized error handling utilities
 */

export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface AppError {
  code: string
  message: string
  severity: ErrorSeverity
  details?: unknown
  timestamp: Date
}

export class ErrorHandler {
  private static isDevelopment = import.meta.env.DEV

  /**
   * Log error with appropriate severity
   */
  static log(
    error: Error | AppError | string,
    severity: ErrorSeverity = ErrorSeverity.ERROR
  ): void {
    const appError = this.normalizeError(error, severity)

    // In development, always log to console
    if (this.isDevelopment) {
      switch (severity) {
        case ErrorSeverity.INFO:
          console.info(`[${appError.code}]`, appError.message, appError.details)
          break
        case ErrorSeverity.WARNING:
          console.warn(`[${appError.code}]`, appError.message, appError.details)
          break
        case ErrorSeverity.ERROR:
        case ErrorSeverity.CRITICAL:
          console.error(`[${appError.code}]`, appError.message, appError.details)
          break
      }
    } else {
      // In production, only log errors and critical
      if (severity === ErrorSeverity.ERROR || severity === ErrorSeverity.CRITICAL) {
        console.error(`[${appError.code}]`, appError.message)
      }
    }
  }

  /**
   * Handle async errors with consistent pattern
   */
  static async handleAsync<T>(
    promise: Promise<T>,
    errorMessage: string,
    errorCode: string = 'ASYNC_ERROR'
  ): Promise<[T | null, AppError | null]> {
    try {
      const result = await promise
      return [result, null]
    } catch (error) {
      const appError = this.normalizeError(error, ErrorSeverity.ERROR, errorCode, errorMessage)
      this.log(appError)
      return [null, appError]
    }
  }

  /**
   * Create a standardized error handler for IPC operations
   */
  static createIPCErrorHandler(channel: string) {
    return (error: Error) => {
      this.log(error, ErrorSeverity.ERROR)
      throw new Error(`IPC error on channel ${channel}: ${error.message}`)
    }
  }

  /**
   * Normalize various error types to AppError
   */
  private static normalizeError(
    error: Error | AppError | string,
    severity: ErrorSeverity,
    code?: string,
    message?: string
  ): AppError {
    if (typeof error === 'string') {
      return {
        code: code || 'GENERIC_ERROR',
        message: message || error,
        severity,
        timestamp: new Date()
      }
    }

    if ('code' in error && 'severity' in error) {
      return error as AppError
    }

    return {
      code: code || error.name || 'UNKNOWN_ERROR',
      message: message || error.message || 'An unknown error occurred',
      severity,
      details: error.stack,
      timestamp: new Date()
    }
  }
}

// Export convenience functions
export const logInfo = (message: string, details?: unknown): void =>
  ErrorHandler.log(
    { code: 'INFO', message, details, severity: ErrorSeverity.INFO, timestamp: new Date() },
    ErrorSeverity.INFO
  )

export const logWarning = (message: string, details?: unknown): void =>
  ErrorHandler.log(
    { code: 'WARNING', message, details, severity: ErrorSeverity.WARNING, timestamp: new Date() },
    ErrorSeverity.WARNING
  )

export const logError = (error: Error | string): void =>
  ErrorHandler.log(error, ErrorSeverity.ERROR)

export const handleAsync = ErrorHandler.handleAsync.bind(ErrorHandler)
