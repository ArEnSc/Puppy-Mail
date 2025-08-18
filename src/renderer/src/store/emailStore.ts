import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

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
  searchQuery: string
  isLoading: boolean
  error: string | null
  
  // Actions
  setEmails: (emails: Email[]) => void
  addEmail: (email: Email) => void
  updateEmail: (id: string, updates: Partial<Email>) => void
  deleteEmail: (id: string) => void
  moveToTrash: (id: string) => void
  
  setFolders: (folders: EmailFolder[]) => void
  selectFolder: (folderId: string) => void
  selectEmail: (emailId: string | null) => void
  
  markAsRead: (id: string) => void
  markAsUnread: (id: string) => void
  toggleStar: (id: string) => void
  toggleImportant: (id: string) => void
  
  setSearchQuery: (query: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Computed
  getFilteredEmails: () => Email[]
  getSelectedEmail: () => Email | null
}

const defaultFolders: EmailFolder[] = [
  { id: 'inbox', name: 'Inbox', type: 'system', count: 0 },
  { id: 'important', name: 'Important', type: 'system', count: 0 },
  { id: 'sent', name: 'Sent', type: 'system', count: 0 },
  { id: 'drafts', name: 'Drafts', type: 'system', count: 0 },
  { id: 'trash', name: 'Trash', type: 'system', count: 0 },
]

export const useEmailStore = create<EmailState>()(
  devtools(
    persist(
      (set, get) => ({
        emails: [],
        folders: defaultFolders,
        selectedFolderId: 'inbox',
        selectedEmailId: null,
        searchQuery: '',
        isLoading: false,
        error: null,
        
        setEmails: (emails) => set({ emails }),
        
        addEmail: (email) => set((state) => ({ 
          emails: [email, ...state.emails] 
        })),
        
        updateEmail: (id, updates) => set((state) => ({
          emails: state.emails.map(email => 
            email.id === id ? { ...email, ...updates } : email
          )
        })),
        
        deleteEmail: (id) => set((state) => ({
          emails: state.emails.filter(email => email.id !== id),
          selectedEmailId: state.selectedEmailId === id ? null : state.selectedEmailId
        })),
        
        moveToTrash: (id) => set((state) => ({
          emails: state.emails.map(email =>
            email.id === id
              ? { ...email, labels: ['trash'] }
              : email
          )
        })),
        
        setFolders: (folders) => set({ folders }),
        
        selectFolder: (folderId) => set({ 
          selectedFolderId: folderId,
          selectedEmailId: null 
        }),
        
        selectEmail: (emailId) => set({ selectedEmailId: emailId }),
        
        markAsRead: (id) => set((state) => ({
          emails: state.emails.map(email =>
            email.id === id ? { ...email, isRead: true } : email
          )
        })),
        
        markAsUnread: (id) => set((state) => ({
          emails: state.emails.map(email =>
            email.id === id ? { ...email, isRead: false } : email
          )
        })),
        
        toggleStar: (id) => set((state) => ({
          emails: state.emails.map(email =>
            email.id === id ? { ...email, isStarred: !email.isStarred } : email
          )
        })),
        
        toggleImportant: (id) => set((state) => ({
          emails: state.emails.map(email =>
            email.id === id ? { ...email, isImportant: !email.isImportant } : email
          )
        })),
        
        setSearchQuery: (query) => set({ searchQuery: query }),
        setLoading: (loading) => set({ isLoading: loading }),
        setError: (error) => set({ error }),
        
        getFilteredEmails: () => {
          const state = get()
          let filtered = state.emails
          
          // Filter by folder
          switch (state.selectedFolderId) {
            case 'inbox':
              filtered = filtered.filter(email => 
                !email.labels.includes('trash') && !email.labels.includes('sent')
              )
              break
            case 'important':
              filtered = filtered.filter(email => email.isImportant)
              break
            case 'trash':
              filtered = filtered.filter(email => email.labels.includes('trash'))
              break
            case 'sent':
              filtered = filtered.filter(email => email.labels.includes('sent'))
              break
            default:
              filtered = filtered.filter(email => 
                email.labels.includes(state.selectedFolderId)
              )
          }
          
          // Filter by search query
          if (state.searchQuery) {
            const query = state.searchQuery.toLowerCase()
            filtered = filtered.filter(email =>
              email.subject.toLowerCase().includes(query) ||
              email.snippet.toLowerCase().includes(query) ||
              email.from.name.toLowerCase().includes(query) ||
              email.from.email.toLowerCase().includes(query)
            )
          }
          
          // Sort by date
          return filtered.sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          )
        },
        
        getSelectedEmail: () => {
          const state = get()
          return state.emails.find(email => email.id === state.selectedEmailId) || null
        }
      }),
      {
        name: 'email-store',
        partialize: (state) => ({
          selectedFolderId: state.selectedFolderId,
          searchQuery: state.searchQuery
        })
      }
    )
  )
)