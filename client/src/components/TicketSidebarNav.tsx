import { useState } from 'react'
import type { Ticket, TicketColumns } from '../context/TicketContext'

const COL_KEYS: { key: keyof TicketColumns; label: string }[] = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'advanced', label: 'Advanced' },
]

const COMPLEXITY_DOT: Record<keyof TicketColumns, string> = {
  beginner: '#2da44e',
  intermediate: '#d29922',
  advanced: '#f85149',
}

const PRIORITY_LEFT: Record<string, string> = {
  critical_path: '#f85149',
  important: '#d29922',
  nice_to_have: '#8b949e',
}

/** Matches board toolbar & team panel count pills */
const COUNTER_CLASS =
  'text-xs font-medium text-[#8b949e] bg-[#21262d] px-2 py-0.5 rounded-md tabular-nums'

function TodoTicketRow({
  ticket,
  onOpen,
  onMarkComplete,
}: {
  ticket: Ticket
  onOpen: (t: Ticket) => void
  onMarkComplete: (t: Ticket) => void
}) {
  const p = ticket.priority
  const left = PRIORITY_LEFT[p] ?? PRIORITY_LEFT.nice_to_have

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(ticket)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(ticket)
        }
      }}
      className="group flex w-full min-w-0 cursor-pointer items-stretch gap-2 border-t border-r border-b border-[#21262d] border-l-[3px] bg-[#0d1117] pl-0 pr-2 py-2 transition-colors hover:border-t-[#30363d] hover:border-r-[#30363d] hover:border-b-[#30363d] hover:bg-[#161b22]"
      style={{ borderLeftColor: left }}
    >
      <button
        type="button"
        aria-label="Mark complete"
        onClick={(e) => {
          e.stopPropagation()
          onMarkComplete(ticket)
        }}
        className="mt-0.5 ml-2 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] border-[#30363d] bg-transparent hover:border-[#484f58] transition-colors"
      />
      <div className="min-w-0 flex-1 text-left">
        <div className="text-[13px] font-medium leading-snug text-[#e6edf3]">{ticket.title}</div>
      </div>
    </div>
  )
}

function CompletedTicketRow({
  ticket,
  onOpen,
  onReopenTodo,
}: {
  ticket: Ticket
  onOpen: (t: Ticket) => void
  onReopenTodo: (t: Ticket) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(ticket)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(ticket)
        }
      }}
      className="group flex w-full min-w-0 cursor-pointer items-stretch gap-2 rounded-md border border-[#21262d] bg-[#0d1117] px-2 py-2 opacity-50 transition-colors hover:border-[#30363d] hover:bg-[#161b22]"
    >
      <button
        type="button"
        aria-label="Mark as to do"
        onClick={(e) => {
          e.stopPropagation()
          onReopenTodo(ticket)
        }}
        className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] border-[#238636] bg-[#238636] hover:opacity-90 transition-opacity"
      >
        <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </button>
      <div className="min-w-0 flex-1 text-left">
        <div className="text-[13px] font-medium leading-snug text-[#e6edf3] line-through">{ticket.title}</div>
      </div>
    </div>
  )
}

export default function TicketSidebarNav({
  columns,
  completedTickets,
  onOpenTicket,
  onMarkComplete,
  onReopenTodo,
}: {
  columns: TicketColumns
  completedTickets: Ticket[]
  onOpenTicket: (t: Ticket) => void
  onMarkComplete: (t: Ticket) => void
  onReopenTodo: (t: Ticket) => void
}) {
  const todoCount =
    columns.beginner.length + columns.intermediate.length + columns.advanced.length
  const totalCount = todoCount + completedTickets.length
  const completedCount = completedTickets.length
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const [openSections, setOpenSections] = useState<Record<keyof TicketColumns, boolean>>({
    beginner: true,
    intermediate: true,
    advanced: true,
  })
  const [doneSectionOpen, setDoneSectionOpen] = useState(true)

  const toggleSection = (key: keyof TicketColumns) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden bg-[#010409] border-t border-[#30363d]">
      <div className="flex shrink-0 flex-col px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-md font-semibold text-[#e6edf3]">Todo</span>
          <span className={COUNTER_CLASS}>{todoCount}</span>
        </div>
        <div className="mt-2 mb-3">
          <div className="h-[3px] w-full overflow-hidden rounded-sm bg-[#161b22]">
            <div
              className="h-full rounded-sm bg-[#238636] transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-[#484f58]">
            {completedCount} of {totalCount} completed
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-3">
        {/* Complexity sections */}
        <div className="space-y-2">
          {todoCount === 0 ? (
            <p className="px-0.5 py-2 text-[10px] text-[#6e7681]">No open tickets</p>
          ) : (
            COL_KEYS.map(({ key, label }) => {
              const list = columns[key]
              const count = list.length
              const open = openSections[key]
              if (count === 0) return null

              return (
                <div key={key}>
                  <button
                    type="button"
                    onClick={() => toggleSection(key)}
                    className="flex w-full items-center gap-2 py-1.5 text-left"
                  >
                    <svg
                      className={`h-3.5 w-3.5 shrink-0 text-[#6e7681] transition-transform duration-200 ${
                        open ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span
                      className="h-[7px] w-[7px] shrink-0 rounded-[2px]"
                      style={{ backgroundColor: COMPLEXITY_DOT[key] }}
                      aria-hidden
                    />
                    <span
                      className="flex-1 text-left text-[10px] font-bold uppercase tracking-[1.2px] text-[#6e7681]"
                    >
                      {label}
                    </span>
                    <span className={COUNTER_CLASS}>{count}</span>
                  </button>
                  {open && (
                    <div className="mt-1.5 flex flex-col gap-1.5 pl-1">
                      {list.map((t) => (
                        <TodoTicketRow
                          key={t.id}
                          ticket={t}
                          onOpen={onOpenTicket}
                          onMarkComplete={onMarkComplete}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Completed */}
        <section className="mt-3 border-t border-[#21262d] pt-3">
          <button
            type="button"
            onClick={() => setDoneSectionOpen((o) => !o)}
            className="flex w-full items-center gap-2 py-1.5 text-left"
          >
            <svg
              className={`h-3.5 w-3.5 shrink-0 text-[#3fb950] transition-transform duration-200 ${
                doneSectionOpen ? 'rotate-90' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#238636]/25 text-[#3fb950]">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span className="flex-1 text-left text-[11px] font-semibold text-[#3fb950]">Completed</span>
            <span className={COUNTER_CLASS}>{completedTickets.length}</span>
          </button>
          {doneSectionOpen && (
            <div className="mt-2 flex flex-col gap-1.5">
              {completedTickets.length === 0 ? (
                <p className="px-0.5 py-1 text-[10px] text-[#6e7681]">None yet</p>
              ) : (
                completedTickets.map((t) => (
                  <CompletedTicketRow
                    key={t.id}
                    ticket={t}
                    onOpen={onOpenTicket}
                    onReopenTodo={onReopenTodo}
                  />
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
