import Realm from 'realm'
import { app } from 'electron'
import { join } from 'path'
import { logInfo, logError, logWarning } from '../../shared/logger'

// Email schema
export class EmailDocument extends Realm.Object<EmailDocument> {
  id!: string
  threadId!: string
  from!: string
  to!: string[]
  subject!: string
  body!: string
  snippet!: string
  date!: Date
  labels!: string[]
  attachments!: unknown[]
  isRead!: boolean
  isStarred!: boolean
  isImportant!: boolean
  syncedAt!: Date

  static schema: Realm.ObjectSchema = {
    name: 'Email',
    primaryKey: 'id',
    properties: {
      id: 'string',
      threadId: 'string',
      from: { type: 'string', indexed: true },
      to: 'string[]',
      subject: 'string',
      body: 'string',
      snippet: 'string',
      date: { type: 'date', indexed: true },
      labels: 'string[]',
      attachments: 'mixed[]',
      isRead: { type: 'bool', default: false },
      isStarred: { type: 'bool', default: false },
      isImportant: { type: 'bool', default: false },
      syncedAt: { type: 'date', default: new Date() }
    }
  }
}

// Account schema
export class AccountDocument extends Realm.Object<AccountDocument> {
  id!: string
  email!: string
  provider!: 'gmail' | 'outlook' | 'other'
  accessToken!: string
  refreshToken!: string
  expiresAt!: Date
  lastSync!: Date
  isActive!: boolean

  static schema: Realm.ObjectSchema = {
    name: 'Account',
    primaryKey: 'id',
    properties: {
      id: 'string',
      email: 'string',
      provider: 'string',
      accessToken: 'string',
      refreshToken: 'string',
      expiresAt: 'date',
      lastSync: 'date',
      isActive: { type: 'bool', default: true }
    }
  }
}

// Global database instance
let realmInstance: Realm | null = null

export async function createDatabase(): Promise<Realm | null> {
  // If already initialized, return the instance
  if (realmInstance && !realmInstance.isClosed) {
    return realmInstance
  }

  try {
    logInfo('Creating new Realm database instance...')

    // Get app data path for database storage
    const dbPath = join(app.getPath('userData'), 'chloe.realm')
    logInfo('Database path:', dbPath)

    // Create Realm instance with persistence
    realmInstance = await Realm.open({
      path: dbPath,
      schema: [EmailDocument, AccountDocument],
      schemaVersion: 2,
      onMigration: (oldRealm, newRealm) => {
        logInfo(
          'Database migration from version',
          oldRealm.schemaVersion,
          'to',
          newRealm.schemaVersion
        )
      }
    })

    logInfo('Database created successfully')
    logInfo('Database path:', realmInstance.path)
    logInfo('Schema version:', realmInstance.schemaVersion)

    return realmInstance
  } catch (error) {
    logError('Error creating database:', error)
    logError('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })

    // Log the error but don't throw - let the app continue without database
    logWarning('App will continue without database functionality')
    return null
  }
}

export async function getDatabase(): Promise<Realm | null> {
  // Always go through createDatabase to ensure proper initialization
  const db = await createDatabase()
  if (!db) {
    logWarning('getDatabase: Database is not available')
  }
  return db
}

export async function closeDatabase(): Promise<void> {
  if (realmInstance && !realmInstance.isClosed) {
    realmInstance.close()
    realmInstance = null
    logInfo('Database closed successfully')
  }
}
