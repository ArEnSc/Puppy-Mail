/**
 * Shared logger module with colored brackets for both main and renderer processes
 */

interface Logger {
  log: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

// ANSI color codes for terminal output
const colors = {
  info: '\x1b[36m', // Cyan
  warning: '\x1b[33m', // Yellow
  error: '\x1b[31m', // Red
  debug: '\x1b[35m', // Magenta
  reset: '\x1b[0m' // Reset color
}

// We'll use a fallback logger until electron-timber loads
let logger: Logger = {
  log: console.log,
  warn: console.warn,
  error: console.error
}

// Load electron-timber asynchronously since it's an ESM module
import('electron-timber')
  .then((module) => {
    logger = module.default
    logger.log(`${colors.info}[Info]${colors.reset} electron-timber loaded successfully`)
  })
  .catch((err) => {
    console.error(`${colors.error}[Error]${colors.reset} Failed to load electron-timber:`, err)
  })

// Export convenience methods with colored brackets
export const logInfo = (...args: unknown[]): void =>
  logger.log(`${colors.info}[Info]${colors.reset}`, ...args)

export const logWarning = (...args: unknown[]): void =>
  logger.warn(`${colors.warning}[Warning]${colors.reset}`, ...args)

export const logError = (...args: unknown[]): void =>
  logger.error(`${colors.error}[Error]${colors.reset}`, ...args)

export const logDebug = (...args: unknown[]): void =>
  logger.log(`${colors.debug}[Debug]${colors.reset}`, ...args)

// Export the logger instance for advanced usage
export default logger
