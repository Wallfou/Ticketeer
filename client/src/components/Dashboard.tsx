import { useState, useCallback, memo } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { useNavigate } from 'react-router-dom'
import { useTickets } from '../context/TicketContext'
import type { Ticket, TicketColumns } from '../context/TicketContext'

const COLUMNS: { key: keyof TicketColumns; label: string; dot: string }[] = [
  { key: 'beginner',     label: 'BEGINNER',     dot: 'bg-[#2da44e]' },
  { key: 'intermediate', label: 'INTERMEDIATE', dot: 'bg-[#d29922]' },
  { key: 'advanced',     label: 'ADVANCED',     dot: 'bg-[#f85149]' },
]

const PRIORITY_STYLES: Record<string, string> = {
  critical_path: 'bg-[#3d1a1a] text-[#f85149] border border-[#f8514944]',
  important: 'bg-[#2a2210] text-[#d29922] border border-[#d2992244]',
  nice_to_have: 'bg-[#1c2128] text-[#8b949e] border border-[#30363d]',
}

const PRIORITY_LABELS: Record<string, string> = {
  critical_path: 'Critical',
  important: 'Important',
  nice_to_have: 'Nice to Have',
}

const COMPLEXITY_DOT: Record<string, string> = {
  beginner:     'bg-[#2da44e]',
  intermediate: 'bg-[#d29922]',
  advanced:     'bg-[#f85149]',
}

const COMPLEXITY_LABELS: Record<string, string> = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
}

function TicketModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 border-b border-[#30363d]">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[11px] font-medium text-[#484f58] uppercase tracking-widest">
                {ticket.epic}
              </span>
              <span className="text-[#30363d]">·</span>
              <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${PRIORITY_STYLES[ticket.priority] ?? PRIORITY_STYLES.nice_to_have}`}>
                {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[#8b949e]">
                <span className={`w-1.5 h-1.5 rounded-full ${COMPLEXITY_DOT[ticket.complexity] ?? COMPLEXITY_DOT.beginner}`} />
                {COMPLEXITY_LABELS[ticket.complexity] ?? ticket.complexity}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-[#e6edf3] leading-snug">{ticket.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-[#484f58] hover:text-[#8b949e] transition-colors mt-0.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5 text-sm">
          {ticket.description && (
            <div>
              <h4 className="text-xs font-semibold text-[#484f58] uppercase tracking-wider mb-2">Description</h4>
              <p className="text-[#8b949e] leading-relaxed">{ticket.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {ticket.complexity_reason && (
              <div className="bg-[#0d1117] rounded-lg p-3">
                <h4 className="text-xs font-semibold text-[#484f58] uppercase tracking-wider mb-1.5">Complexity Reason</h4>
                <p className="text-xs text-[#8b949e] leading-relaxed">{ticket.complexity_reason}</p>
              </div>
            )}
            {ticket.priority_reason && (
              <div className="bg-[#0d1117] rounded-lg p-3">
                <h4 className="text-xs font-semibold text-[#484f58] uppercase tracking-wider mb-1.5">Priority Reason</h4>
                <p className="text-xs text-[#8b949e] leading-relaxed">{ticket.priority_reason}</p>
              </div>
            )}
          </div>

          {ticket.steps?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#484f58] uppercase tracking-wider mb-2">Implementation Steps</h4>
              <ol className="space-y-1.5">
                {ticket.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-[#8b949e]">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-[#1c2128] text-[#484f58] text-xs flex items-center justify-center font-mono">{i + 1}</span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {ticket.acceptance_criteria?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#484f58] uppercase tracking-wider mb-2">Acceptance Criteria</h4>
              <ul className="space-y-1.5">
                {ticket.acceptance_criteria.map((ac, i) => (
                  <li key={i} className="flex gap-2 text-[#8b949e]">
                    <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-[#2da44e]" />
                    <span className="leading-relaxed">{ac}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ticket.file_references?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#484f58] uppercase tracking-wider mb-2">File References</h4>
              <div className="flex flex-wrap gap-1.5">
                {ticket.file_references.map((f) => (
                  <span key={f} className="text-xs bg-[#1c2128] text-[#8b949e] border border-[#30363d] px-2 py-0.5 rounded font-mono">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {ticket.resources?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#484f58] uppercase tracking-wider mb-2">Resources</h4>
              <ul className="space-y-1">
                {ticket.resources.map((r, i) => (
                  <li key={i} className="text-xs text-[#2da44e] hover:underline truncate">
                    <a href={r} target="_blank" rel="noopener noreferrer">{r}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const TicketCard = memo(function TicketCard({ ticket, index, onOpen, dimmed }: { ticket: Ticket; index: number; onOpen: (t: Ticket) => void; dimmed: boolean }) {
  return (
    <Draggable draggableId={ticket.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => !dimmed && onOpen(ticket)}
          className={`bg-[#161b22] border-2 rounded-xl p-4 mb-2.5 select-none cursor-pointer ${
            dimmed ? 'opacity-20 pointer-events-none' : 'opacity-100'
          } ${
            snapshot.isDragging
              ? 'border-[#2da44e] shadow-xl shadow-black/40'
              : 'border-[#21262d] hover:border-[#30363d] hover:shadow-md hover:shadow-black/20 transition-[border-color,box-shadow,opacity] duration-150'
          }`}
        >
          {/* Epic label */}
          <p className="text-[10px] font-semibold text-[#484f58] uppercase tracking-widest mb-2 truncate">
            {ticket.epic}
          </p>

          {/* Title */}
          <p className="text-lg font-medium text-[#e6edf3] leading-snug mb-2">{ticket.title}</p>

          {/* Description snippet */}
          {ticket.description && (
            <p className="text-xs text-[#6e7681] line-clamp-1 leading-relaxed mb-3">
              {ticket.description}
            </p>
          )}

          {/* Footer row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {ticket.file_references?.slice(0, 2).map((f) => (
                <span key={f} className="text-[10px] text-[#484f58] bg-[#0d1117] border border-[#21262d] px-1.5 py-0.5 rounded font-mono max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap inline-block">
                  {f.split('/').pop()}
                </span>
              ))}
              {(ticket.file_references?.length ?? 0) > 2 && (
                <span className="text-[10px] text-[#484f58]">+{ticket.file_references.length - 2}</span>
              )}
            </div>
            <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md ${PRIORITY_STYLES[ticket.priority] ?? PRIORITY_STYLES.nice_to_have}`}>
              {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
            </span>
          </div>
        </div>
      )}
    </Draggable>
  )
})

const PRIORITY_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',           label: 'All' },
  { value: 'critical_path', label: 'Critical' },
  { value: 'important',     label: 'Important' },
  { value: 'nice_to_have',  label: 'Nice to Have' },
]

const EMPTY_TICKET: Omit<Ticket, 'id'> = {
  title: '',
  epic: '',
  description: '',
  complexity: 'beginner',
  complexity_reason: '',
  priority: 'nice_to_have',
  priority_reason: '',
  file_references: [],
  steps: [],
  acceptance_criteria: [],
  resources: [],
}

function NewTicketModal({ onClose, onSave }: { onClose: () => void; onSave: (t: Ticket) => void }) {
  const [form, setForm] = useState({ ...EMPTY_TICKET })

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }))

  const handleSave = () => {
    if (!form.title.trim()) return
    onSave({ ...form, id: crypto.randomUUID() } as Ticket)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#21262d]">
          <h3 className="text-sm font-semibold text-[#e6edf3]">New Ticket</h3>
          <button onClick={onClose} className="text-[#484f58] hover:text-[#8b949e] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-semibold text-[#484f58] uppercase tracking-widest block mb-1.5">Title <span className="text-[#f85149]">*</span></label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Short, descriptive ticket title"
              className="w-full bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#388bfd] transition"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-[#484f58] uppercase tracking-widest block mb-1.5">Epic</label>
            <input
              value={form.epic}
              onChange={(e) => set('epic', e.target.value)}
              placeholder="e.g. Authentication, UI Redesign"
              className="w-full bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#388bfd] transition"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-[#484f58] uppercase tracking-widest block mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What needs to be done?"
              rows={3}
              className="w-full bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#388bfd] transition resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-[#484f58] uppercase tracking-widest block mb-1.5">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
                className="w-full bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#388bfd] transition"
              >
                <option value="critical_path">Critical</option>
                <option value="important">Important</option>
                <option value="nice_to_have">Nice to Have</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#484f58] uppercase tracking-widest block mb-1.5">Complexity</label>
              <select
                value={form.complexity}
                onChange={(e) => set('complexity', e.target.value as Ticket['complexity'])}
                className="w-full bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#388bfd] transition"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#21262d]">
          <button onClick={onClose} className="text-xs text-[#6e7681] hover:text-[#8b949e] px-4 py-2 rounded-lg transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.title.trim()}
            className="text-xs font-medium text-white bg-[#2da44e] hover:bg-[#3fb950] disabled:bg-[#1a3a2a] disabled:text-[#484f58] px-4 py-2 rounded-lg transition"
          >
            Create Ticket
          </button>
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const { columns, setColumns } = useTickets()
  const navigate = useNavigate()
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [showNewTicket, setShowNewTicket] = useState(false)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')

  const totalTickets = Object.values(columns).reduce((sum, col) => sum + col.length, 0)

  const matches = (ticket: Ticket) => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || ticket.title.toLowerCase().includes(q) || ticket.description?.toLowerCase().includes(q) || ticket.epic?.toLowerCase().includes(q)
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter
    return matchesSearch && matchesPriority
  }

  const handleNewTicket = useCallback((ticket: Ticket) => {
    const col = ticket.complexity as keyof TicketColumns
    setColumns({ ...columns, [col]: [...columns[col], ticket] })
  }, [columns, setColumns])

  const handleOpenTicket = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket)
  }, [])

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const srcKey = source.droppableId as keyof TicketColumns
    const dstKey = destination.droppableId as keyof TicketColumns

    const newColumns = {
      beginner: [...columns.beginner],
      intermediate: [...columns.intermediate],
      advanced: [...columns.advanced],
    }

    const [moved] = newColumns[srcKey].splice(source.index, 1)
    newColumns[dstKey].splice(destination.index, 0, moved)
    setColumns(newColumns)
  }

  if (totalTickets === 0) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <p className="text-[#6e7681] text-sm mb-4">No tickets yet. Analyze a repo to get started.</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-[#2da44e] hover:bg-[#3fb950] text-white text-sm font-medium rounded-lg transition"
        >
          New Analysis
        </button>
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col px-8 pt-6 pb-4 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 border-b border-[#21262d] pb-5">
        <h2 className="text-xl font-semibold tracking-tight text-[#e6edf3] shrink-0 mr-1">Ticket Board</h2>
        <span className="text-xs text-[#484f58] tabular-nums shrink-0">{totalTickets}</span>

        <div className="w-px h-4 bg-[#21262d] shrink-0 mx-1" />

      
        <div className="flex items-center gap-2 bg-[#0d1117] mx-4 border-2 border-[#21262d] rounded-lg px-3 py-1.5 flex-1 max-w-xs focus-within:border-[#207a39] transition">
          <svg className="w-3.5 h-3.5 text-[#484f58] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets…"
            className="bg-transparent text-xs text-[#e6edf3] placeholder-[#484f58] focus:outline-none w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-[#484f58] hover:text-[#6e7681] transition shrink-0">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Priority filter pills */}
        <div className="flex items-center gap-1 shrink-0 border-2 border-[#21262d] rounded-lg">
          {PRIORITY_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPriorityFilter(opt.value)}
              className={`text-xs px-2.5 py-1.5 rounded-md transition font-medium ${
                priorityFilter === opt.value
                  ? 'bg-[#21262d] text-[#e6edf3]'
                  : 'text-[#484f58] hover:text-[#ffffff]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <button
          onClick={() => setShowNewTicket(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#207a39] hover:bg-[#2da44e] px-3 py-1.5 rounded-lg transition shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Ticket
        </button>
        <button
          onClick={() => navigate('/')}
          className="text-xs text-[#6e7681] hover:text-[#8b949e] px-3 py-1.5 rounded-lg transition shrink-0"
        >
          New Analysis
        </button>
      </div>

      {/* Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-5 flex-1 min-h-0">
          {COLUMNS.map((col) => (
            <div key={col.key} className="flex flex-col flex-1 min-w-0">
              {/* Column header */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className={`w-3 h-3 rounded-full shrink-0 ${col.dot}`} />
                <span className="text-lg font-medium text-[#8b949e]">{col.label}</span>
                <span className="ml-auto text-xs text-[#484f58] tabular-nums">{columns[col.key].length}</span>
              </div>

              {/* Droppable column */}
              <Droppable droppableId={col.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 rounded-xl p-2 transition-colors duration-150 overflow-y-auto ${
                      snapshot.isDraggingOver ? 'bg-[#161b22]' : 'bg-[#0d1117]'
                    }`}
                    style={{ minHeight: '200px' }}
                  >
                    {columns[col.key].map((ticket, index) => (
                      <TicketCard key={ticket.id} ticket={ticket} index={index} onOpen={handleOpenTicket} dimmed={!matches(ticket)} />
                    ))}
                    {provided.placeholder}
                    {columns[col.key].length === 0 && !snapshot.isDraggingOver && (
                      <p className="text-xs text-[#30363d] text-center pt-10">No tickets</p>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {selectedTicket && (
        <TicketModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      )}
      {showNewTicket && (
        <NewTicketModal onClose={() => setShowNewTicket(false)} onSave={handleNewTicket} />
      )}
    </main>
  )
}

export default Dashboard
