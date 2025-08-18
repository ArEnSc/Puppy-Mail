import Realm from 'realm'
import { app } from 'electron'
import { join } from 'path'

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
    console.log('Creating new Realm database instance...')

    // Get app data path for database storage
    const dbPath = join(app.getPath('userData'), 'chloe.realm')
    console.log('Database path:', dbPath)

    // Create Realm instance with persistence
    realmInstance = await Realm.open({
      path: dbPath,
      schema: [EmailDocument, AccountDocument],
      schemaVersion: 1,
      onMigration: (oldRealm, newRealm) => {
        console.log(
          'Database migration from version',
          oldRealm.schemaVersion,
          'to',
          newRealm.schemaVersion
        )
      }
    })

    console.log('Database created successfully')
    console.log('Database path:', realmInstance.path)
    console.log('Schema version:', realmInstance.schemaVersion)

    return realmInstance
  } catch (error) {
    console.error('Error creating database:', error)
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })

    // Log the error but don't throw - let the app continue without database
    console.warn('App will continue without database functionality')
    return null
  }
}

export async function getDatabase(): Promise<Realm | null> {
  // Always go through createDatabase to ensure proper initialization
  const db = await createDatabase()
  if (!db) {
    console.warn('getDatabase: Database is not available')
  }
  return db
}

export async function closeDatabase(): Promise<void> {
  if (realmInstance && !realmInstance.isClosed) {
    realmInstance.close()
    realmInstance = null
    console.log('Database closed successfully')
  }
}

