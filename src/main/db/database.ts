import { createRxDatabase, RxDatabase, RxCollection, RxDocument, addRxPlugin } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
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

  try {
    const db = await createRxDatabase<DatabaseCollections>({
      name: 'emailagentdb_v1',
      storage: getRxStorageDexie(),
      ignoreDuplicate: true
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
    return db
  } catch (error: any) {
    console.error('Error creating database:', error)
    
    // DB9 error means database already exists
    if (error?.code === 'DB9') {
      console.log('Database already exists, creating new instance...')
      
      // Try with a different name to avoid conflict
      const timestamp = Date.now()
      const db = await createRxDatabase<DatabaseCollections>({
        name: `emailagentdb_${timestamp}`,
        storage: getRxStorageDexie(),
        ignoreDuplicate: true
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
      return db
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
