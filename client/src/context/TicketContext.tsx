import { createContext, useContext, useState, useEffect } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'

export type ExperienceTier = 'beginner' | 'intermediate' | 'advanced'

export interface TeamMember {
  id: string
  name: string
  experience: ExperienceTier
  tags: string[]
}

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
  assignee_member_id?: string | null
  assignee_name?: string | null
  assignment_reason?: string | null
}

export interface TicketColumns {
  beginner: Ticket[]
  intermediate: Ticket[]
  advanced: Ticket[]
}

interface TicketContextType {
  columns: TicketColumns
  setColumns: Dispatch<SetStateAction<TicketColumns>>
  completedTickets: Ticket[]
  setCompletedTickets: Dispatch<SetStateAction<Ticket[]>>
  goal: string
  setGoal: (goal: string) => void
  repo: string
  setRepo: (repo: string) => void
  team: TeamMember[]
  setTeam: (team: TeamMember[]) => void
}

const TicketContext = createContext<TicketContextType | null>(null)

const STORAGE_KEY = 'ticketeer_cache'

function loadCache(): {
  columns: TicketColumns
  completedTickets: Ticket[]
  goal: string
  repo: string
  team: TeamMember[]
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      return {
        columns: (parsed.columns as TicketColumns) ?? { beginner: [], intermediate: [], advanced: [] },
        completedTickets: Array.isArray(parsed.completedTickets)
          ? (parsed.completedTickets as Ticket[])
          : [],
        goal: (parsed.goal as string) ?? '',
        repo: (parsed.repo as string) ?? '',
        team: Array.isArray(parsed.team) ? (parsed.team as TeamMember[]) : [],
      }
    }
  } catch {}
  return {
    columns: { beginner: [], intermediate: [], advanced: [] },
    completedTickets: [],
    goal: '',
    repo: '',
    team: [],
  }
}

export function TicketProvider({ children }: { children: ReactNode }) {
  const cached = loadCache()
  const [columns, setColumns] = useState<TicketColumns>(cached.columns)
  const [completedTickets, setCompletedTickets] = useState<Ticket[]>(cached.completedTickets)
  const [goal, setGoal] = useState(cached.goal)
  const [repo, setRepo] = useState(cached.repo)
  const [team, setTeam] = useState<TeamMember[]>(cached.team)

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ columns, completedTickets, goal, repo, team }),
      )
    } catch {}
  }, [columns, completedTickets, goal, repo, team])

  return (
    <TicketContext.Provider
      value={{
        columns,
        setColumns,
        completedTickets,
        setCompletedTickets,
        goal,
        setGoal,
        repo,
        setRepo,
        team,
        setTeam,
      }}
    >
      {children}
    </TicketContext.Provider>
  )
}

export function useTickets() {
  const ctx = useContext(TicketContext)
  if (!ctx) throw new Error('useTickets must be used within TicketProvider')
  return ctx
}
