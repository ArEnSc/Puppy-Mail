import { createRxDatabase, RxDatabase, RxCollection, RxDocument, addRxPlugin } from 'rxdb'
import { getRxStorageFilesystem } from 'rxdb/plugins/storage-filesystem'
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder'
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration-schema'
import { RxDBUpdatePlugin } from 'rxdb/plugins/update'
import { app } from 'electron'
import { join } from 'path'
import { emailSchema, accountSchema } from './schema'

// Add plugins
// Temporarily disable dev mode due to validation requirement
// if (process.env.NODE_ENV !== 'production') {
//   addRxPlugin(RxDBDevModePlugin)
// }
addRxPlugin(RxDBQueryBuilderPlugin)
addRxPlugin(RxDBMigrationPlugin)
addRxPlugin(RxDBUpdatePlugin)

// Type definitions
export type EmailDocument = RxDocument<{
  id: string
  threadId: string
  from: string
  to: string[]
  subject: string
  body: string
  snippet: string
  date: string
  labels: string[]
  attachments: Array<{
    filename: string
    mimeType: string
    size: number
    attachmentId: string
  }>
  isRead: boolean
  isStarred: boolean
  syncedAt: string
}>

export type AccountDocument = RxDocument<{
  id: string
  email: string
  provider: 'gmail' | 'outlook' | 'other'
  accessToken: string
  refreshToken: string
  expiresAt: string
  lastSync: string
  isActive: boolean
}>

export type EmailCollection = RxCollection<EmailDocument>
export type AccountCollection = RxCollection<AccountDocument>

export type DatabaseCollections = {
  emails: EmailCollection
  accounts: AccountCollection
}

export type EmailDatabase = RxDatabase<DatabaseCollections>

// Global database instance - only one should exist
let dbInstance: EmailDatabase | null = null
let dbInitPromise: Promise<EmailDatabase | null> | null = null
let dbInitialized = false

export async function createDatabase(): Promise<EmailDatabase | null> {
  // If already initialized (successfully or not), return the instance
  if (dbInitialized) {
    return dbInstance
  }

  // If initialization is already in progress, wait for it
  if (dbInitPromise) {
    return dbInitPromise
  }

  // Start initialization
  dbInitPromise = (async () => {
    try {
      // Double-check we don't already have an instance
      if (dbInstance) {
        dbInitialized = true
        return dbInstance
      }

      console.log('Creating new RxDB database instance...')

      // Get app data path for database storage
      const dbPath = join(app.getPath('userData'), 'database')
      console.log('Database path:', dbPath)

      // Use filesystem storage for persistence in Electron main process
      const db = await createRxDatabase<DatabaseCollections>({
        name: 'chloedb',
        storage: getRxStorageFilesystem({
          basePath: dbPath
        }),
        multiInstance: false,
        eventReduce: true
      })

      // Add collections
      await db.addCollections({
        emails: {
          schema: emailSchema
        },
        accounts: {
          schema: accountSchema
        }
      })

      dbInstance = db
      dbInitialized = true
      console.log('Database created successfully')
      return db
    } catch (error) {
      console.error('Error creating database:', error)
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })

      // Mark as initialized even on error to prevent repeated attempts
      dbInitialized = true
      dbInitPromise = null

      // Log the error but don't throw - let the app continue without database
      console.warn('App will continue without database functionality')
      return null
    }
  })()

  return dbInitPromise
}

export async function getDatabase(): Promise<EmailDatabase | null> {
  // Always go through createDatabase to ensure proper initialization
  const db = await createDatabase()
  if (!db) {
    console.warn('getDatabase: Database is not available')
  }
  return db
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.destroy()
    dbInstance = null
    dbInitPromise = null
    dbInitialized = false
  }
}
