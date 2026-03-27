import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export interface Ticket {
  id: string
  title: string
  epic: string
  description: string
  complexity: 'beginner' | 'intermediate' | 'advanced'
  complexity_reason: string
  priority: 'critical_path' | 'important' | 'nice_to_have'
  priority_reason: string
  file_references: string[]
  steps: string[]
  acceptance_criteria: string[]
  resources: string[]
}

export interface TicketColumns {
  beginner: Ticket[]
  intermediate: Ticket[]
  advanced: Ticket[]
}

interface TicketContextType {
  columns: TicketColumns
  setColumns: (columns: TicketColumns) => void
  goal: string
  setGoal: (goal: string) => void
  repo: string
  setRepo: (repo: string) => void
}

const TicketContext = createContext<TicketContextType | null>(null)

const STORAGE_KEY = 'ticketeer_cache'

function loadCache(): { columns: TicketColumns; goal: string; repo: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { columns: { beginner: [], intermediate: [], advanced: [] }, goal: '', repo: '' }
}

export function TicketProvider({ children }: { children: ReactNode }) {
  const cached = loadCache()
  const [columns, setColumns] = useState<TicketColumns>(cached.columns)
  const [goal, setGoal] = useState(cached.goal)
  const [repo, setRepo] = useState(cached.repo)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ columns, goal, repo }))
    } catch {}
  }, [columns, goal, repo])

  return (
    <TicketContext.Provider value={{ columns, setColumns, goal, setGoal, repo, setRepo }}>
      {children}
    </TicketContext.Provider>
  )
}

export function useTickets() {
  const ctx = useContext(TicketContext)
  if (!ctx) throw new Error('useTickets must be used within TicketProvider')
  return ctx
}
