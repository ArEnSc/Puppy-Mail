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
export const logger: Logger = {
  log: console.log,
  warn: console.warn,
  error: console.error
}

// Helper function to format timestamp
const getTimestamp = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`
}

// Determine process type
const getProcessType = (): string => {
  // Check if we're in the main process
  if (typeof process !== 'undefined' && process.type === 'browser') {
    return 'Main'
  }
  // Check if we're in the renderer process
  if (typeof process !== 'undefined' && process.type === 'renderer') {
    return 'Renderer'
  }
  // Fallback check for renderer
  if (typeof window !== 'undefined') {
    return 'Renderer'
  }
  // Default to Main if we can't determine
  return 'Main'
}

// Get caller file and line from stack trace
const getCallerInfo = (): string => {
  const error = new Error()
  const stack = error.stack?.split('\n') || []

  // Skip the first 3 lines (Error, getCallerInfo, and the log function itself)
  const callerLine = stack[3]

  if (!callerLine) return ''

  // Extract filename and line number from the stack trace
  // Stack trace format varies between environments
  const match = callerLine.match(/(?:at\s+)?(?:.*?\s+)?(?:\()?(.+?):(\d+):(\d+)\)?$/)

  if (match) {
    const fullPath = match[1]
    // Extract just the filename from the full path
    const filename = fullPath.split('/').pop() || fullPath.split('\\').pop() || fullPath

    // Just return filename without line number since it's not accurate after transformation
    return filename
  }

  return ''
}

// Export convenience methods with colored brackets and timestamps
export const logInfo = (...args: unknown[]): void => {
  const callerInfo = getCallerInfo()
  const location = callerInfo ? ` (${callerInfo})` : ''
  logger.log(
    `${colors.info}[${getTimestamp()}] [${getProcessType()}] [Info]${location}${colors.reset}`,
    ...args
  )
}

export const logWarning = (...args: unknown[]): void => {
  const callerInfo = getCallerInfo()
  const location = callerInfo ? ` (${callerInfo})` : ''
  logger.warn(
    `${colors.warning}[${getTimestamp()}] [${getProcessType()}] [Warning]${location}${colors.reset}`,
    ...args
  )
}

export const logError = (...args: unknown[]): void => {
  const callerInfo = getCallerInfo()
  const location = callerInfo ? ` (${callerInfo})` : ''
  logger.error(
    `${colors.error}[${getTimestamp()}] [${getProcessType()}] [Error]${location}${colors.reset}`,
    ...args
  )
}

export const logDebug = (...args: unknown[]): void => {
  const callerInfo = getCallerInfo()
  const location = callerInfo ? ` (${callerInfo})` : ''
  logger.log(
    `${colors.debug}[${getTimestamp()}] [${getProcessType()}] [Debug]${location}${colors.reset}`,
    ...args
  )
}

// Export the logger instance for advanced usage
export default logger
