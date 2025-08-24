import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { ipc } from '@renderer/lib/ipc'
import { EMAIL_IPC_CHANNELS } from '@shared/types/email'
import { logInfo, logError } from '@shared/logger'
export interface Email {
  id: string
  threadId: string
  subject: string
  from: {
    name: string
    email: string
  }
  to: {
    name: string
    email: string
  }[]
  cc?: {
    name: string
    email: string
  }[]
  date: Date
  snippet: string
  body: string
  cleanBody?: string
  isRead: boolean
  isStarred: boolean
  isImportant: boolean
  labels: string[]
  attachments?: {
    id: string
    filename: string
    mimeType: string
    size: number
  }[]
  categorizedAttachments?: {
    images: Array<{ id: string; filename: string; mimeType: string; size: number }>
    pdfs: Array<{ id: string; filename: string; mimeType: string; size: number }>
    videos: Array<{ id: string; filename: string; mimeType: string; size: number }>
    others: Array<{ id: string; filename: string; mimeType: string; size: number }>
  }
}

export interface EmailFolder {
  id: string
  name: string
  icon?: string
  count: number
  type: 'system' | 'custom'
}

interface EmailState {
  emails: Email[]
  folders: EmailFolder[]
  selectedFolderId: string
  selectedEmailId: string | null
  selectedAutomatedTask: string | null
  searchQuery: string
  isLoading: boolean
  error: string | null
  lastSyncTime: Date | null

  // Pagination
  currentPage: number
  pageSize: number
  totalPages: number

  // Panel sizes
  folderListWidth: number
  emailListWidth: number

  // Actions
  setEmails: (emails: Email[]) => void
  setLastSyncTime: (time: Date) => void
  addEmail: (email: Email) => void
  updateEmail: (id: string, updates: Partial<Email>) => void
  deleteEmail: (id: string) => void
  moveToTrash: (id: string) => void
  clearAllEmails: () => void

  setFolders: (folders: EmailFolder[]) => void
  selectFolder: (folderId: string) => void
  selectEmail: (emailId: string | null) => void
  selectAutomatedTask: (taskId: string | null) => void

  markAsRead: (id: string) => void
  markAsUnread: (id: string) => void
  toggleStar: (id: string) => void
  toggleImportant: (id: string) => void

  setSearchQuery: (query: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Pagination actions
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
  nextPage: () => void
  previousPage: () => void

  // Panel size actions
  setPanelSizes: (folderListWidth: number, emailListWidth: number) => void

  // Computed
  getFilteredEmails: () => Email[]
  getPaginatedEmails: () => Email[]
  updateTotalPages: () => void
  getSelectedEmail: () => Email | null
}

const defaultFolders: EmailFolder[] = [
  { id: 'inbox', name: 'Inbox', type: 'system', count: 0 },
  { id: 'important', name: 'Starred', type: 'system', count: 0 },
  { id: 'sent', name: 'Sent', type: 'system', count: 0 },
  { id: 'drafts', name: 'Drafts', type: 'system', count: 0 },
  { id: 'trash', name: 'Trash', type: 'system', count: 0 }
]

export const useEmailStore = create<EmailState>()(
  devtools(
    persist(
      (set, get) => ({
        emails: [],
        folders: defaultFolders,
        selectedFolderId: 'inbox',
        selectedEmailId: null,
        selectedAutomatedTask: null,
        searchQuery: '',
        isLoading: false,
        error: null,
        lastSyncTime: null,

        // Pagination state
        currentPage: 1,
        pageSize: 50,
        totalPages: 1,

        // Panel sizes
        folderListWidth: 256,
        emailListWidth: 384,

        setEmails: (emails) => {
          const pageSize = get().pageSize
          const totalPages = Math.ceil(emails.length / pageSize)
          logInfo(
            `setEmails: Received ${emails.length} emails, pageSize: ${pageSize}, totalPages: ${totalPages}`
          )
          set({ emails, totalPages, currentPage: 1 })
        },
        setLastSyncTime: (time) => set({ lastSyncTime: time }),

        addEmail: (email) =>
          set((state) => ({
            emails: [email, ...state.emails]
          })),

        updateEmail: (id, updates) =>
          set((state) => ({
            emails: state.emails.map((email) =>
              email.id === id ? { ...email, ...updates } : email
            )
          })),

        deleteEmail: (id) =>
          set((state) => ({
            emails: state.emails.filter((email) => email.id !== id),
            selectedEmailId: state.selectedEmailId === id ? null : state.selectedEmailId
          })),

        moveToTrash: (id) =>
          set((state) => ({
            emails: state.emails.map((email) =>
              email.id === id ? { ...email, labels: ['trash'] } : email
            )
          })),

        clearAllEmails: () => {
          set({
            emails: [],
            selectedEmailId: null,
            totalPages: 1,
            currentPage: 1
          })
        },

        setFolders: (folders) => set({ folders }),

        selectFolder: (folderId) =>
          set({
            selectedFolderId: folderId,
            selectedEmailId: null,
            selectedAutomatedTask: null,
            currentPage: 1
          }),

        selectEmail: (emailId) => set({ selectedEmailId: emailId }),

        selectAutomatedTask: (taskId) =>
          set({
            selectedAutomatedTask: taskId,
            selectedFolderId: '',
            selectedEmailId: null,
            currentPage: 1
          }),

        markAsRead: (id) => {
          set((state) => ({
            emails: state.emails.map((email) =>
              email.id === id ? { ...email, isRead: true } : email
            )
          }))
          // Sync to database
          if (ipc.isAvailable()) {
            ipc.invoke(EMAIL_IPC_CHANNELS.EMAIL_MARK_AS_READ, id).catch(logError)
          }
        },

        markAsUnread: (id) =>
          set((state) => ({
            emails: state.emails.map((email) =>
              email.id === id ? { ...email, isRead: false } : email
            )
          })),

        toggleStar: (id) => {
          set((state) => ({
            emails: state.emails.map((email) =>
              email.id === id ? { ...email, isStarred: !email.isStarred } : email
            )
          }))
          // Sync to database
          if (ipc.isAvailable()) {
            ipc.invoke(EMAIL_IPC_CHANNELS.EMAIL_TOGGLE_STAR, id).catch(logError)
          }
        },

        toggleImportant: (id) =>
          set((state) => ({
            emails: state.emails.map((email) =>
              email.id === id ? { ...email, isImportant: !email.isImportant } : email
            )
          })),

        setSearchQuery: (query) => {
          set({ searchQuery: query, currentPage: 1 })
        },
        setLoading: (loading) => set({ isLoading: loading }),
        setError: (error) => set({ error }),

        // Pagination actions
        setCurrentPage: (page) => set({ currentPage: page }),
        setPageSize: (size) => {
          const emails = get().emails
          const totalPages = Math.ceil(emails.length / size)
          set({ pageSize: size, totalPages, currentPage: 1 })
        },
        nextPage: () => {
          const { currentPage, totalPages } = get()
          if (currentPage < totalPages) {
            set({ currentPage: currentPage + 1 })
          }
        },
        previousPage: () => {
          const currentPage = get().currentPage
          if (currentPage > 1) {
            set({ currentPage: currentPage - 1 })
          }
        },

        setPanelSizes: (folderListWidth, emailListWidth) => {
          set({ folderListWidth, emailListWidth })
        },

        getFilteredEmails: () => {
          const state = get()
          let filtered = state.emails

          // Filter by folder
          switch (state.selectedFolderId) {
            case 'inbox':
              filtered = filtered.filter(
                (email) => !email.labels.includes('trash') && !email.labels.includes('sent')
              )
              break
            case 'important':
              filtered = filtered.filter((email) => email.isStarred)
              break
            case 'trash':
              filtered = filtered.filter((email) => email.labels.includes('trash'))
              break
            case 'sent':
              filtered = filtered.filter((email) => email.labels.includes('sent'))
              break
            default:
              filtered = filtered.filter((email) => email.labels.includes(state.selectedFolderId))
          }

          // Filter by search query
          if (state.searchQuery) {
            const query = state.searchQuery.toLowerCase()
            filtered = filtered.filter(
              (email) =>
                email.subject.toLowerCase().includes(query) ||
                email.snippet.toLowerCase().includes(query) ||
                email.from.name.toLowerCase().includes(query) ||
                email.from.email.toLowerCase().includes(query)
            )
          }

          // Sort by date
          return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        },

        getPaginatedEmails: () => {
          const state = get()
          const filtered = state.getFilteredEmails()
          const start = (state.currentPage - 1) * state.pageSize
          const end = start + state.pageSize

          return filtered.slice(start, end)
        },

        updateTotalPages: () => {
          const state = get()
          const filtered = state.getFilteredEmails()
          const totalPages = Math.ceil(filtered.length / state.pageSize)
          if (totalPages !== state.totalPages) {
            set({ totalPages })
          }
        },

        getSelectedEmail: () => {
          const state = get()
          return state.emails.find((email) => email.id === state.selectedEmailId) || null
        }
      }),
      {
        name: 'email-store',
        partialize: (state) => ({
          selectedFolderId: state.selectedFolderId,
          searchQuery: state.searchQuery,
          folderListWidth: state.folderListWidth,
          emailListWidth: state.emailListWidth
        })
      }
    )
  )
)
