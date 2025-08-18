import { createRxDatabase, RxDatabase, RxCollection, RxDocument, addRxPlugin } from 'rxdb'
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory'
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder'
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration-schema'
import { RxDBUpdatePlugin } from 'rxdb/plugins/update'
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
  date: Date
  labels: string[]
  attachments: Array<{
    filename: string
    mimeType: string
    size: number
    attachmentId: string
  }>
  isRead: boolean
  isStarred: boolean
  syncedAt: Date
}>

export type AccountDocument = RxDocument<{
  id: string
  email: string
  provider: 'gmail' | 'outlook' | 'other'
  accessToken: string
  refreshToken: string
  expiresAt: Date
  lastSync: Date
  isActive: boolean
}>

export type EmailCollection = RxCollection<EmailDocument>
export type AccountCollection = RxCollection<AccountDocument>

export type DatabaseCollections = {
  emails: EmailCollection
  accounts: AccountCollection
}

export type EmailDatabase = RxDatabase<DatabaseCollections>

let dbInstance: EmailDatabase | null = null

export async function createDatabase(): Promise<EmailDatabase> {
  if (dbInstance) {
    return dbInstance
  }

  const dbName = 'chloedb' // Database for Chloe email app

  try {
    // Use memory storage for now to avoid persistence issues
    const db = await createRxDatabase<DatabaseCollections>({
      name: dbName,
      storage: getRxStorageMemory(), // Using memory storage temporarily
      ignoreDuplicate: true,
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
    console.log('Database created successfully')
    return db
  } catch (error) {
    console.error('Error creating database:', error)

    // If database already exists, we shouldn't get here with ignoreDuplicate: true
    // But if we do, let's handle it gracefully
    if ((error as Error & { code?: string })?.code === 'DB9') {
      console.log('Database conflict detected, this should not happen with ignoreDuplicate: true')
      throw new Error('Database initialization failed due to conflict')
    }

    throw error
  }
}

export async function getDatabase(): Promise<EmailDatabase> {
  if (!dbInstance) {
    return createDatabase()
  }
  return dbInstance
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.destroy()
    dbInstance = null
  }
}
