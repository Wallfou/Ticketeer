import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { useNavigate } from 'react-router-dom'
import { useTickets } from '../context/TicketContext'
import type { Ticket, TicketColumns } from '../context/TicketContext'

const COLUMNS: { key: keyof TicketColumns; label: string; accent: string; bg: string; badge: string }[] = [
  {
    key: 'beginner',
    label: 'Beginner',
    accent: '#2da44e',
    bg: '#0d1f17',
    badge: 'bg-[#0d1f17] text-[#2da44e] border border-[#2da44e44]',
  },
  {
    key: 'intermediate',
    label: 'Intermediate',
    accent: '#d29922',
    bg: '#1f1a0d',
    badge: 'bg-[#1f1a0d] text-[#d29922] border border-[#d2992244]',
  },
  {
    key: 'advanced',
    label: 'Advanced',
    accent: '#f85149',
    bg: '#1f0d0d',
    badge: 'bg-[#1f0d0d] text-[#f85149] border border-[#f8514944]',
  },
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

function TicketCard({ ticket, index }: { ticket: Ticket; index: number }) {
  return (
    <Draggable draggableId={ticket.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-[#161b22] border rounded-xl p-4 mb-3 select-none transition-shadow ${
            snapshot.isDragging
              ? 'border-[#2da44e] shadow-lg shadow-[#2da44e22] rotate-1'
              : 'border-[#30363d] hover:border-[#484f58]'
          }`}
        >
          {/* Epic + Priority row */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs bg-[#1c2128] text-[#8b949e] border border-[#30363d] px-2 py-0.5 rounded-full truncate max-w-[140px]">
              {ticket.epic}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ml-auto whitespace-nowrap ${PRIORITY_STYLES[ticket.priority] ?? PRIORITY_STYLES.nice_to_have}`}>
              {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
            </span>
          </div>

          {/* Title */}
          <p className="text-sm font-medium text-[#e6edf3] leading-snug">{ticket.title}</p>

          {/* Description snippet */}
          {ticket.description && (
            <p className="text-xs text-[#8b949e] mt-1.5 line-clamp-2 leading-relaxed">
              {ticket.description}
            </p>
          )}

          {/* File references */}
          {ticket.file_references?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {ticket.file_references.slice(0, 2).map((f) => (
                <span key={f} className="text-[10px] bg-[#1c2128] text-[#484f58] px-1.5 py-0.5 rounded font-mono truncate max-w-[120px]">
                  {f.split('/').pop()}
                </span>
              ))}
              {ticket.file_references.length > 2 && (
                <span className="text-[10px] text-[#484f58]">+{ticket.file_references.length - 2} more</span>
              )}
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}

function Dashboard() {
  const { columns, setColumns, goal, repo } = useTickets()
  const navigate = useNavigate()

  const totalTickets = Object.values(columns).reduce((sum, col) => sum + col.length, 0)

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
        <p className="text-[#8b949e] text-sm mb-4">No tickets yet. Analyze a repo to get started.</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-[#2da44e] hover:bg-[#3fb950] text-white text-sm font-medium rounded-lg transition"
        >
          Go to Home
        </button>
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col px-6 py-6 min-h-0">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-xl font-semibold text-[#e6edf3]">Ticket Board</h2>
          <span className="text-xs bg-[#1a3a2a] text-[#2da44e] px-2.5 py-1 rounded-full font-medium">
            {totalTickets} tickets
          </span>
        </div>
        {goal && <p className="text-sm text-[#8b949e]">Goal: <span className="text-[#e6edf3]">{goal}</span></p>}
        {repo && <p className="text-xs text-[#484f58] mt-0.5">{repo}</p>}
      </div>

      {/* Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 flex-1 min-h-0">
          {COLUMNS.map((col) => (
            <div key={col.key} className="flex flex-col flex-1 min-w-0">
              {/* Column header */}
              <div
                className="flex items-center justify-between px-3 py-2 rounded-lg mb-3"
                style={{ backgroundColor: col.bg, borderLeft: `3px solid ${col.accent}` }}
              >
                <span className="text-sm font-semibold" style={{ color: col.accent }}>
                  {col.label}
                </span>
                <span className="text-xs text-[#8b949e] bg-[#1c2128] px-2 py-0.5 rounded-full">
                  {columns[col.key].length}
                </span>
              </div>

              {/* Droppable column */}
              <Droppable droppableId={col.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 rounded-xl p-3 transition-colors overflow-y-auto ${
                      snapshot.isDraggingOver ? 'bg-[#1c2128]' : 'bg-[#0d1117]'
                    }`}
                    style={{ minHeight: '200px' }}
                  >
                    {columns[col.key].map((ticket, index) => (
                      <TicketCard key={ticket.id} ticket={ticket} index={index} />
                    ))}
                    {provided.placeholder}
                    {columns[col.key].length === 0 && !snapshot.isDraggingOver && (
                      <p className="text-xs text-[#484f58] text-center pt-8">No tickets</p>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </main>
  )
}

export default Dashboard
