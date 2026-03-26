import { createContext, useContext, useState, ReactNode } from 'react'

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

export function TicketProvider({ children }: { children: ReactNode }) {
  const [columns, setColumns] = useState<TicketColumns>({
    beginner: [],
    intermediate: [],
    advanced: [],
  })
  const [goal, setGoal] = useState('')
  const [repo, setRepo] = useState('')

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
