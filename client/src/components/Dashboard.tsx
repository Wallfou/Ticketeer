import { useState, useCallback, memo, useRef, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { useNavigate } from 'react-router-dom'
import { useTickets } from '../context/TicketContext'
import type { TeamMember, Ticket, TicketColumns } from '../context/TicketContext'
import TeamPanel from './TeamPanel'
import TicketSidebarNav from './TicketSidebarNav'

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  const n = name.trim()
  return n.length >= 2 ? n.slice(0, 2).toUpperCase() : (n[0]?.toUpperCase() ?? '?')
}

function avatarHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i)
  return Math.abs(h) % 360
}

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

const REASON_DETAILS_SUMMARY_CLASS =
  'flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-xs font-semibold text-[#8b949e] uppercase tracking-wider list-none select-none [&::-webkit-details-marker]:hidden'

function TicketModal({
  ticket,
  team,
  isCompleted,
  onClose,
  onUpdate,
  onRemove,
  onMarkComplete,
  onReopenTodo,
}: {
  ticket: Ticket
  team: TeamMember[]
  isCompleted: boolean
  onClose: () => void
  onUpdate: (id: string, fields: Partial<Ticket>) => void
  onRemove: (id: string) => void
  onMarkComplete: () => void
  onReopenTodo: () => void
}) {
  const [acDone, setAcDone] = useState<Record<number, boolean>>({})
  const [assignReasonOpen, setAssignReasonOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    title: ticket.title,
    epic: ticket.epic,
    description: ticket.description,
    priority: ticket.priority,
    complexity: ticket.complexity,
  })

  useEffect(() => {
    setAcDone({})
    setAssignReasonOpen(false)
    setEditing(false)
    setForm({
      title: ticket.title,
      epic: ticket.epic,
      description: ticket.description,
      priority: ticket.priority,
      complexity: ticket.complexity,
    })
  }, [ticket.id])

  const setField = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const saveEdit = () => {
    if (!form.title.trim()) return
    onUpdate(ticket.id, {
      title: form.title.trim(),
      epic: form.epic,
      description: form.description,
      priority: form.priority as Ticket['priority'],
      complexity: form.complexity as Ticket['complexity'],
    })
    setEditing(false)
  }

  const roster = ticket.assignee_member_id ? team.find((m) => m.id === ticket.assignee_member_id) : null
  const assigneeLabel = roster?.name ?? ticket.assignee_name ?? null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-md border border-[#30363d] bg-[#161b22] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#30363d] bg-[#161b22] p-6">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[11px] font-medium text-[#484f58] uppercase tracking-widest">
                {ticket.epic}
              </span>
              <span className="text-[#30363d]">·</span>
              <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${PRIORITY_STYLES[ticket.priority] ?? PRIORITY_STYLES.nice_to_have}`}>
                {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
              </span>
              {isCompleted && (
                <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-[#1c2a21] text-[#3fb950] border border-[#238636]/50">
                  Completed
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-[#e6edf3] leading-snug">{ticket.title}</h3>
            {assigneeLabel && (
              <div
                className={
                  ticket.assignment_reason
                    ? 'mt-3 flex cursor-pointer items-start gap-3 rounded-md p-2 -m-2 transition-colors hover:bg-[#21262d]/60'
                    : 'mt-3 flex items-start gap-3'
                }
                onClick={
                  ticket.assignment_reason
                    ? () => setAssignReasonOpen((o) => !o)
                    : undefined
                }
                role={ticket.assignment_reason ? 'button' : undefined}
                tabIndex={ticket.assignment_reason ? 0 : undefined}
                onKeyDown={
                  ticket.assignment_reason
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setAssignReasonOpen((o) => !o)
                        }
                      }
                    : undefined
                }
              >
                <div
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-inner"
                  style={{ backgroundColor: `hsl(${avatarHue(assigneeLabel)}, 42%, 42%)` }}
                  title={assigneeLabel}
                >
                  {initialsForName(assigneeLabel)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold text-[#484f58] uppercase tracking-wider">Assigned to</p>
                      <p className="text-sm text-[#e6edf3] font-medium">{assigneeLabel}</p>
                    </div>
                    {ticket.assignment_reason && (
                      <svg
                        className={`mt-1 h-4 w-4 shrink-0 text-[#6e7681] transition-transform ${assignReasonOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </div>
                  {ticket.assignment_reason && assignReasonOpen && (
                    <p className="mt-2 text-xs leading-relaxed text-[#8b949e]">{ticket.assignment_reason}</p>
                  )}
                </div>
              </div>
            )}
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

        {/* Body — scrolls; footer stays fixed below */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5 text-sm">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-[#484f58] uppercase tracking-widest block mb-1.5">
                  Title <span className="text-[#f85149]">*</span>
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#21262d] rounded-md px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#388bfd]"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#484f58] uppercase tracking-widest block mb-1.5">Epic</label>
                <input
                  value={form.epic}
                  onChange={(e) => setField('epic', e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#21262d] rounded-md px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#388bfd]"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#484f58] uppercase tracking-widest block mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  rows={4}
                  className="w-full bg-[#0d1117] border border-[#21262d] rounded-md px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#388bfd] resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-[#484f58] uppercase tracking-widest block mb-1.5">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setField('priority', e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#21262d] rounded-md px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#388bfd]"
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
                    onChange={(e) => setField('complexity', e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#21262d] rounded-md px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#388bfd]"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <>
          {ticket.description && (
            <div>
              <h4 className="text-xs font-semibold text-[#484f58] uppercase tracking-wider mb-2">Description</h4>
              <p className="text-[#8b949e] leading-relaxed">{ticket.description}</p>
            </div>
          )}

          {(ticket.complexity_reason || ticket.priority_reason) && (
            <div className="space-y-3">
              {ticket.complexity_reason && (
                <details className="group rounded-md bg-[#21262d]/80">
                  <summary className={REASON_DETAILS_SUMMARY_CLASS}>
                    <span>Complexity reason</span>
                    <svg
                      className="h-4 w-4 shrink-0 text-[#6e7681] transition-transform group-open:rotate-180"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <p className="px-3 pb-2 pt-0 text-xs leading-relaxed text-[#8b949e]">{ticket.complexity_reason}</p>
                </details>
              )}
              {ticket.priority_reason && (
                <details className="group rounded-md bg-[#21262d]/80">
                  <summary className={REASON_DETAILS_SUMMARY_CLASS}>
                    <span>Priority reason</span>
                    <svg
                      className="h-4 w-4 shrink-0 text-[#6e7681] transition-transform group-open:rotate-180"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <p className="px-3 pb-2 pt-0 text-xs leading-relaxed text-[#8b949e]">{ticket.priority_reason}</p>
                </details>
              )}
            </div>
          )}

          {ticket.steps?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#484f58] uppercase tracking-wider mb-2">Implementation Steps</h4>
              <ul className="space-y-2">
                {ticket.steps.map((step, i) => (
                  <li key={i} className="leading-relaxed text-[#8b949e]">
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ticket.acceptance_criteria?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#484f58] uppercase tracking-wider mb-2">Acceptance Criteria</h4>
              <div className="overflow-hidden rounded-md border border-[#30363d]">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#30363d] bg-[#0d1117]">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#484f58]">
                        Criterion
                      </th>
                      <th className="w-14 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[#484f58]">
                        Met
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticket.acceptance_criteria.map((ac, i) => (
                      <tr key={i} className="border-b border-[#21262d] last:border-b-0">
                        <td className="px-3 py-2 align-top text-[#8b949e]">{ac}</td>
                        <td className="px-2 py-2 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={acDone[i] ?? false}
                            onChange={() =>
                              setAcDone((prev) => ({ ...prev, [i]: !prev[i] }))
                            }
                            className="h-4 w-4 cursor-pointer rounded border-[#30363d] bg-[#000000] text-[#2da44e] focus:ring-offset-0"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {ticket.file_references?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#484f58] uppercase tracking-wider mb-2">File References</h4>
              <div className="flex flex-wrap gap-1.5">
                {ticket.file_references.map((f) => (
                  <span key={f} className="text-xs bg-[#1c2128] text-[#8b949e] border border-[#30363d] px-2 py-0.5 rounded-sm font-mono">
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
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[#30363d] bg-[#161b22] px-6 py-4">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setForm({
                    title: ticket.title,
                    epic: ticket.epic,
                    description: ticket.description,
                    priority: ticket.priority,
                    complexity: ticket.complexity,
                  })
                }}
                className="text-xs font-medium text-[#8b949e] hover:text-[#e6edf3] px-3 py-2 rounded-md transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={!form.title.trim()}
                className="text-xs font-medium text-white bg-[#207a39] hover:bg-[#3fb950] disabled:opacity-40 px-4 py-2 rounded-md transition"
              >
                Save
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs font-medium text-[#c9d1d9] border border-[#30363d] hover:border-[#8b949e] hover:bg-[#21262d] px-3 py-2 rounded-md transition"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Remove this ticket permanently?')) onRemove(ticket.id)
                }}
                className="text-xs font-medium text-[#f85149] border border-[#f8514944] hover:bg-[#f8514918] px-3 py-2 rounded-md transition"
              >
                Remove
              </button>
              {!isCompleted && (
                <button
                  type="button"
                  onClick={onMarkComplete}
                  className="text-xs font-medium text-white bg-[#207a39] hover:bg-[#3fb950] px-3 py-2 rounded-md transition"
                >
                  Mark complete
                </button>
              )}
              {isCompleted && (
                <button
                  type="button"
                  onClick={onReopenTodo}
                  className="text-xs font-medium text-[#c9d1d9] border border-[#388bfd55] bg-[#388bfd14] hover:bg-[#388bfd22] px-3 py-2 rounded-md transition"
                >
                  Move to to do
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const TicketCard = memo(function TicketCard({
  ticket,
  index,
  onOpen,
  dimmed,
  team,
  assignModeMember,
  onAssignToSelected,
  onUnassignTicket,
}: {
  ticket: Ticket
  index: number
  onOpen: (t: Ticket) => void
  dimmed: boolean
  team: TeamMember[]
  assignModeMember: TeamMember | null
  onAssignToSelected: (t: Ticket) => void
  onUnassignTicket: (t: Ticket) => void
}) {
  const rosterMember = ticket.assignee_member_id ? team.find((m) => m.id === ticket.assignee_member_id) : undefined
  const assigneeLabel = rosterMember?.name ?? ticket.assignee_name ?? null
  const reasonText = ticket.assignment_reason
  const assignMode = !!assignModeMember
  const assignedToSelected =
    !!assignModeMember && ticket.assignee_member_id === assignModeMember.id
  const blockPointerWhenDimmed = dimmed && !assignMode
  const canOpenModal = !blockPointerWhenDimmed

  return (
    <Draggable draggableId={ticket.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => canOpenModal && onOpen(ticket)}
          className={`group relative bg-[#161b22] border-2 rounded-sm p-4 mb-1.5 select-none cursor-pointer ${
            blockPointerWhenDimmed ? 'opacity-20 pointer-events-none' : dimmed ? 'opacity-[0.38]' : 'opacity-100'
          } ${
            snapshot.isDragging
              ? 'border-[#2da44e] shadow-xl shadow-black/40'
              : 'border-[#21262d] hover:border-[#30363d] hover:shadow-md hover:shadow-black/20 transition-[border-color,box-shadow,opacity] duration-150'
          }`}
        >
          {/* Epic label */}
          <p className="text-[13px] font-semibold text-[#6e7681] uppercase tracking-widest mb-2 truncate">
            {ticket.epic}
          </p>

          {/* Title */}
          <p className="text-lg font-medium text-[#e6edf3] leading-snug mb-2">{ticket.title}</p>

          {/* Footer row */}
          <div className="flex items-center justify-between gap-2">
            <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md ${PRIORITY_STYLES[ticket.priority] ?? PRIORITY_STYLES.nice_to_have}`}>
              {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
            </span>
            {assigneeLabel && (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border border-[#30363d] shadow-inner shrink-0"
                style={{ backgroundColor: `hsl(${avatarHue(assigneeLabel)}, 42%, 42%)` }}
                title={reasonText ? `${assigneeLabel} — ${reasonText}` : assigneeLabel}
                onClick={(e) => {
                  e.stopPropagation()
                }}
              >
                {initialsForName(assigneeLabel)}
              </div>
            )}
          </div>

          {assignModeMember && (
            <>
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-28 rounded-b-sm opacity-0 bg-gradient-to-t from-[#010409] via-[#010409]/70 to-transparent transition-opacity duration-150 group-hover:opacity-100"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-2.5 pt-10 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="pointer-events-auto flex gap-2">
                  {!assignedToSelected && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAssignToSelected(ticket)
                      }}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-md bg-[#207a39] text-white hover:bg-[#3fb950] shadow-sm"
                    >
                      Assign to {assignModeMember.name.split(/\s+/)[0]}
                    </button>
                  )}
                  {assignedToSelected && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onUnassignTicket(ticket)
                      }}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-md bg-[#21262d] text-[#e6edf3] border border-[#484f58] hover:bg-[#30363d]"
                    >
                      Unassign
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
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
        className="relative z-10 bg-[#161b22] border border-[#30363d] rounded-md w-full max-w-lg shadow-2xl"
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
              className="w-full bg-[#0d1117] border border-[#21262d] rounded-md px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#388bfd] transition"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-[#484f58] uppercase tracking-widest block mb-1.5">Epic</label>
            <input
              value={form.epic}
              onChange={(e) => set('epic', e.target.value)}
              placeholder="e.g. Authentication, UI Redesign"
              className="w-full bg-[#0d1117] border border-[#21262d] rounded-md px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#388bfd] transition"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-[#484f58] uppercase tracking-widest block mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What needs to be done?"
              rows={3}
              className="w-full bg-[#0d1117] border border-[#21262d] rounded-md px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#388bfd] transition resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-[#484f58] uppercase tracking-widest block mb-1.5">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
                className="w-full bg-[#0d1117] border border-[#21262d] rounded-md px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#388bfd] transition"
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
                className="w-full bg-[#0d1117] border border-[#21262d] rounded-md px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#388bfd] transition"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#21262d]">
          <button onClick={onClose} className="text-xs text-[#6e7681] hover:text-[#8b949e] px-4 py-2 rounded-md transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.title.trim()}
            className="text-xs font-medium text-white bg-[#2da44e] hover:bg-[#3fb950] disabled:bg-[#1a3a2a] disabled:text-[#484f58] px-4 py-2 rounded-md transition"
          >
            Create Ticket
          </button>
        </div>
      </div>
    </div>
  )
}

type ChatMessage = {
  id: string
  role: 'user' | 'ai'
  text: string
}

type Action =
  | { type: 'update'; ticket_id: string; fields: Partial<Ticket> }
  | { type: 'create'; ticket: Omit<Ticket, 'id'> }
  | { type: 'delete'; ticket_id: string }

function applyActions(columns: TicketColumns, actions: Action[]): TicketColumns {
  let next: TicketColumns = {
    beginner: [...columns.beginner],
    intermediate: [...columns.intermediate],
    advanced: [...columns.advanced],
  }

  for (const action of actions) {
    if (action.type === 'update') {
      const keys = Object.keys(next) as (keyof TicketColumns)[]
      for (const col of keys) {
        next[col] = next[col].map((t) =>
          t.id === action.ticket_id ? { ...t, ...action.fields } : t
        )
        const moved = next[col].find((t) => t.id === action.ticket_id)
        if (moved && moved.complexity !== col) {
          next[col] = next[col].filter((t) => t.id !== action.ticket_id)
          next[moved.complexity] = [...next[moved.complexity], moved]
        }
      }
    } else if (action.type === 'create') {
      const newTicket: Ticket = { ...action.ticket, id: crypto.randomUUID() }
      const col = newTicket.complexity as keyof TicketColumns
      next[col] = [...next[col], newTicket]
    } else if (action.type === 'delete') {
      const keys = Object.keys(next) as (keyof TicketColumns)[]
      for (const col of keys) {
        next[col] = next[col].filter((t) => t.id !== action.ticket_id)
      }
    }
  }

  return next
}

function applyAssignments(
  columns: TicketColumns,
  assignments: { ticket_id: string; member: string; reason: string }[],
  roster: TeamMember[],
): TicketColumns {
  const byTicket = new Map(assignments.map((a) => [a.ticket_id, a]))
  const nameLookup = new Map(roster.map((m) => [m.name.trim().toLowerCase(), m]))

  const patch = (t: Ticket): Ticket => {
    const a = byTicket.get(t.id)
    if (!a) return t
    const member = nameLookup.get(a.member.trim().toLowerCase())
    return {
      ...t,
      assignee_member_id: member?.id ?? null,
      assignee_name: a.member.trim(),
      assignment_reason: a.reason,
    }
  }

  return {
    beginner: columns.beginner.map(patch),
    intermediate: columns.intermediate.map(patch),
    advanced: columns.advanced.map(patch),
  }
}

const INITIAL_AI_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'ai',
  text: 'Hi! I can help you customize your tickets. Try asking me something like "make the auth ticket more detailed" or "split the payment ticket into smaller ones".',
}

function Dashboard() {
  const {
    columns,
    setColumns,
    completedTickets,
    setCompletedTickets,
    team,
    setTeam,
    repo,
  } = useTickets()
  const navigate = useNavigate()
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [showNewTicket, setShowNewTicket] = useState(false)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [assignLoading, setAssignLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('chatMessages')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return [INITIAL_AI_MESSAGE]
      }
    }
    return [INITIAL_AI_MESSAGE]
  })
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    localStorage.setItem('chatMessages', JSON.stringify(chatMessages))
  }, [chatMessages])
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    if (selectedMemberId && !team.some((m) => m.id === selectedMemberId)) {
      setSelectedMemberId(null)
    }
  }, [team, selectedMemberId])

  const assignModeMember = selectedMemberId
    ? team.find((m) => m.id === selectedMemberId) ?? null
    : null

  useEffect(() => {
    if (!selectedTicket) return
    const fromBoard = [...columns.beginner, ...columns.intermediate, ...columns.advanced].find(
      (t) => t.id === selectedTicket.id,
    )
    const fromDone = completedTickets.find((t) => t.id === selectedTicket.id)
    const updated = fromBoard ?? fromDone
    if (updated) setSelectedTicket(updated)
    else setSelectedTicket(null)
  }, [columns, completedTickets, selectedTicket?.id])

  const selectedTicketIsCompleted = selectedTicket
    ? completedTickets.some((t) => t.id === selectedTicket.id)
    : false

  const updateTicketFields = useCallback(
    (id: string, fields: Partial<Ticket>) => {
      setColumns((prev) => applyActions(prev, [{ type: 'update', ticket_id: id, fields }]))
      setCompletedTickets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...fields } : t)),
      )
    },
    [setColumns, setCompletedTickets],
  )

  const removeTicketById = useCallback(
    (id: string) => {
      setColumns((prev) => ({
        beginner: prev.beginner.filter((t) => t.id !== id),
        intermediate: prev.intermediate.filter((t) => t.id !== id),
        advanced: prev.advanced.filter((t) => t.id !== id),
      }))
      setCompletedTickets((prev) => prev.filter((t) => t.id !== id))
      setSelectedTicket(null)
    },
    [setColumns, setCompletedTickets],
  )

  const markTicketComplete = useCallback(
    (ticket: Ticket) => {
      setColumns((prev) => {
        const col = ticket.complexity as keyof TicketColumns
        return { ...prev, [col]: prev[col].filter((t) => t.id !== ticket.id) }
      })
      setCompletedTickets((prev) =>
        prev.some((t) => t.id === ticket.id) ? prev : [...prev, ticket],
      )
      setSelectedTicket(null)
    },
    [setColumns, setCompletedTickets],
  )

  const reopenTicketTodo = useCallback(
    (ticket: Ticket) => {
      setCompletedTickets((prev) => prev.filter((t) => t.id !== ticket.id))
      setColumns((prev) => {
        const col = ticket.complexity as keyof TicketColumns
        return { ...prev, [col]: [...prev[col], ticket] }
      })
      setSelectedTicket(null)
    },
    [setColumns, setCompletedTickets],
  )

  const runExportToGithub = useCallback(async () => {
    if (!repo.trim() || exportLoading) return
    const allTickets: Ticket[] = [
      ...columns.beginner,
      ...columns.intermediate,
      ...columns.advanced,
      ...completedTickets,
    ]
    if (allTickets.length === 0) return

    setExportLoading(true)
    try {
      const res = await fetch('/api/github/export-issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: repo.trim(),
          tickets: allTickets.map((t) => ({
            ...t,
            depends_on_ticket_ids: t.depends_on_ticket_ids ?? [],
          })),
          team: team.map((m) => ({
            id: m.id,
            name: m.name,
            github_username: m.github_username ?? null,
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const detail = typeof data.detail === 'string' ? data.detail : 'Export failed'
        throw new Error(detail)
      }
      const created = data.created as number
      const urls = (data.issue_urls as string[]) ?? []
      const warnings = (data.warnings as string[]) ?? []
      const lines = [
        `Exported ${created} issue(s) to GitHub.`,
        urls.length > 0 ? `Open: ${urls.slice(0, 3).join(' · ')}${urls.length > 3 ? ' …' : ''}` : '',
        warnings.length > 0 ? `Notes: ${warnings.slice(0, 2).join(' ')}` : '',
      ].filter(Boolean)
      setChatMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'ai', text: lines.join('\n') },
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      setChatMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'ai', text: `GitHub export failed: ${msg}` },
      ])
    } finally {
      setExportLoading(false)
    }
  }, [
    repo,
    exportLoading,
    columns,
    completedTickets,
    team,
    setChatMessages,
  ])

  const runAutoAssign = useCallback(async () => {
    if (team.length === 0 || assignLoading) return
    const allTickets = [...columns.beginner, ...columns.intermediate, ...columns.advanced]
    setAssignLoading(true)
    try {
      const res = await fetch('/api/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickets: allTickets, roster: team }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(typeof err.detail === 'string' ? err.detail : 'Server error')
      }
      const data = (await res.json()) as { assignments: { ticket_id: string; member: string; reason: string }[] }
      setColumns((prev) => applyAssignments(prev, data.assignments, team))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Assign failed'
      setChatMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'ai', text: `Auto-assign failed: ${msg}` },
      ])
    } finally {
      setAssignLoading(false)
    }
  }, [team, assignLoading, columns, setColumns, setChatMessages])

  const sendMessage = useCallback(async () => {
    const text = chatInput.trim()
    if (!text || chatLoading) return

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', text }
    setChatMessages((prev) => [...prev, userMsg])
    setChatInput('')
    if (chatTextareaRef.current) chatTextareaRef.current.style.height = 'auto'
    setChatLoading(true)

    try {
      const allTickets: Ticket[] = [
        ...columns.beginner,
        ...columns.intermediate,
        ...columns.advanced,
        ...completedTickets,
      ]

      // keeping only the most recent messages to avoid exceeding the model's context window
      const CHAT_HISTORY_LIMIT = 20
      const recentMessages = [...chatMessages, userMsg]
      const truncated =
        recentMessages.length > CHAT_HISTORY_LIMIT
          ? [recentMessages[0], ...recentMessages.slice(-(CHAT_HISTORY_LIMIT - 1))]
          : recentMessages

      const history = truncated.map((m) => ({
        role: m.role,
        content: m.text,
      }))

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, tickets: allTickets, team }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(err.detail ?? 'Server error')
      }

      const data: { reply: string; actions: Action[] } = await res.json()

      setColumns(applyActions(columns, data.actions))
      setCompletedTickets((prev) => {
        let next = [...prev]
        for (const action of data.actions) {
          if (action.type === 'delete') {
            next = next.filter((t) => t.id !== action.ticket_id)
          }
          if (action.type === 'update') {
            next = next.map((t) =>
              t.id === action.ticket_id ? { ...t, ...action.fields } : t,
            )
          }
        }
        return next
      })

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'ai',
        text: data.reply,
      }
      setChatMessages((prev) => [...prev, aiMsg])
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'ai',
        text: `Sorry, something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }
      setChatMessages((prev) => [...prev, errorMsg])
    } finally {
      setChatLoading(false)
    }
  }, [chatInput, chatLoading, chatMessages, columns, completedTickets, team, setColumns, setCompletedTickets])

  const totalActiveTickets =
    columns.beginner.length + columns.intermediate.length + columns.advanced.length
  const hasAnyTickets = totalActiveTickets > 0 || completedTickets.length > 0

  const matches = (ticket: Ticket) => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || ticket.title.toLowerCase().includes(q) || ticket.description?.toLowerCase().includes(q) || ticket.epic?.toLowerCase().includes(q)
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter
    const matchesMember =
      !selectedMemberId || ticket.assignee_member_id === selectedMemberId
    return matchesSearch && matchesPriority && matchesMember
  }

  const handleAssignToSelectedMember = useCallback(
    (ticket: Ticket) => {
      if (!assignModeMember) return
      setColumns((prev) => {
        const keys = Object.keys(prev) as (keyof TicketColumns)[]
        const next: TicketColumns = {
          beginner: [...prev.beginner],
          intermediate: [...prev.intermediate],
          advanced: [...prev.advanced],
        }
        for (const col of keys) {
          next[col] = next[col].map((t) =>
            t.id === ticket.id
              ? {
                  ...t,
                  assignee_member_id: assignModeMember.id,
                  assignee_name: assignModeMember.name,
                  assignment_reason: null,
                }
              : t
          )
        }
        return next
      })
    },
    [assignModeMember, setColumns]
  )

  const handleUnassignTicket = useCallback(
    (ticket: Ticket) => {
      setColumns((prev) => {
        const keys = Object.keys(prev) as (keyof TicketColumns)[]
        const next: TicketColumns = {
          beginner: [...prev.beginner],
          intermediate: [...prev.intermediate],
          advanced: [...prev.advanced],
        }
        for (const col of keys) {
          next[col] = next[col].map((t) =>
            t.id === ticket.id
              ? { ...t, assignee_member_id: null, assignee_name: null, assignment_reason: null }
              : t
          )
        }
        return next
      })
    },
    [setColumns]
  )

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

  if (!hasAnyTickets) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <p className="text-[#6e7681] text-sm mb-4">No tickets yet. Analyze a repo to get started.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-[#2da44e] hover:bg-[#3fb950] text-white text-sm font-medium rounded-md transition"
        >
          Back to home
        </button>
      </main>
    )
  }

  return (
    <main className="flex-1 flex min-h-0">
      <div className="flex w-[350px] shrink-0 flex-col min-h-0 border-r border-[#30363d] bg-[#010409] overflow-hidden">
        <TeamPanel
          team={team}
          setTeam={setTeam}
          selectedMemberId={selectedMemberId}
          onSelectMember={setSelectedMemberId}
        />
        <TicketSidebarNav
          columns={columns}
          completedTickets={completedTickets}
          onOpenTicket={setSelectedTicket}
          onMarkComplete={markTicketComplete}
          onReopenTodo={reopenTicketTodo}
        />
      </div>

      {/* center: toolbar + board */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0 pl-6 pr-2 pt-6 pb-4">

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 pb-3">
        <h2 className="text-xl font-semibold tracking-tight text-[#e6edf3] shrink-0 mr-1">Ticket Board</h2>
        <span className="text-xs font-medium text-[#8b949e] bg-[#21262d] px-2 py-0.5 rounded-md tabular-nums shrink-0">{totalActiveTickets}</span>

        <div className="w-px h-4 bg-[#30363d] shrink-0 mx-1" />

      
        <div className="flex items-center gap-2 bg-[#161b22] mx-4 border-2 border-[#30363d] rounded-md px-3 py-1.5 flex-1 max-w-xs focus-within:border-[#2da44e] transition">
          <svg className="w-3.5 h-3.5 text-[#8b949e] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets…"
            className="bg-transparent text-xs text-[#e6edf3] placeholder-[#6e7681] focus:outline-none w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-[#6e7681] hover:text-[#c9d1d9] transition shrink-0">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Priority filter pills */}
        <div className="flex items-center gap-0.5 shrink-0 bg-[#161b22] border border-[#30363d] rounded-md p-0.5">
          {PRIORITY_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPriorityFilter(opt.value)}
              className={`text-xs px-3 py-1.5 rounded-md transition font-medium ${
                priorityFilter === opt.value
                  ? 'bg-[#207a39] text-white shadow-sm'
                  : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <button
          type="button"
          onClick={runAutoAssign}
          disabled={team.length === 0 || assignLoading}
          title={team.length === 0 ? 'Add team members first' : 'Assign each ticket using AI'}
          className="flex items-center gap-1.5 text-xs font-medium text-[#e6edf3] border border-[#388bfd55] bg-[#388bfd14] hover:bg-[#388bfd22] disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-md transition shrink-0"
        >
          {assignLoading ? (
            <span className="w-3.5 h-3.5 border-2 border-[#58a6ff] border-t-transparent rounded-md animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5 text-[#58a6ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
          Auto-assign
        </button>
        <button
          onClick={() => setShowNewTicket(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#207a39] hover:bg-[#3fb950] px-3 py-1.5 rounded-md transition shrink-0 shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Ticket
        </button>
        <button
          type="button"
          onClick={runExportToGithub}
          disabled={!repo.trim() || exportLoading}
          title={
            !repo.trim()
              ? 'Run analysis from the home page with a repo URL first'
              : 'Create GitHub Issues in the connected repository'
          }
          className="flex items-center gap-1.5 text-xs font-medium text-[#e6edf3] border border-[#23863666] bg-[#23863614] hover:bg-[#23863622] disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-md transition shrink-0"
        >
          {exportLoading ? (
            <span className="w-3.5 h-3.5 border-2 border-[#3fb950] border-t-transparent rounded-md animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5 text-[#3fb950]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
          )}
          Export to GitHub Issues
        </button>
      </div>

      {/* Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-2 flex-1 min-h-0">
            {COLUMNS.map((col) => (
              <div key={col.key} className="flex flex-col flex-1 min-w-0">
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${col.dot}`} />
                  <span className="text-sm font-semibold tracking-widest text-[#c9d1d9]">{col.label}</span>
                  <span className="ml-auto text-xs font-medium text-[#8b949e] bg-[#21262d] px-2 py-0.5 rounded-md tabular-nums">
                    {columns[col.key].filter(matches).length}
                  </span>
                </div>

                {/* Droppable column */}
                <Droppable droppableId={col.key}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 rounded-sm p-2 transition-colors duration-150 overflow-y-auto ${
                        snapshot.isDraggingOver ? 'bg-[#161b22]' : 'bg-[#0d1117]'
                      }`}
                      style={{ minHeight: '200px' }}
                    >
                      {columns[col.key].map((ticket, index) => (
                        <TicketCard
                          key={ticket.id}
                          ticket={ticket}
                          index={index}
                          onOpen={handleOpenTicket}
                          dimmed={!matches(ticket)}
                          team={team}
                          assignModeMember={assignModeMember}
                          onAssignToSelected={handleAssignToSelectedMember}
                          onUnassignTicket={handleUnassignTicket}
                        />
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

      </div>

      {/* Chat Panel */}
        <div className="w-[350px] shrink-0 flex flex-col min-h-0 min-w-0 bg-[#010409] border-l border-[#30363d] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-[#21262d] shrink-0">
            <span className="text-md font-semibold text-[#e6edf3]">Ticket Copilot</span>
          </div>

          <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-3 space-y-3">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex w-full min-w-0 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`min-w-0 max-w-[90%] rounded-md px-3 py-2 text-sm leading-relaxed break-words [overflow-wrap:anywhere] whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#207a39] text-white rounded-br-sm'
                      : 'bg-[#1c2128] text-white border border-[#30363d] rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-[#1c2128] border border-[#30363d] rounded-md rounded-bl-sm px-3 py-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-sm bg-[#484f58] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-sm bg-[#484f58] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-sm bg-[#484f58] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="shrink-0 p-4">
            <div className="flex items-end gap-2 bg-[#010409] border-2 border-[#30363d] rounded-md px-3 py-1 focus-within:border-[#2da44e] transition">
              <textarea
                ref={chatTextareaRef}
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                    const el = e.currentTarget
                    requestAnimationFrame(() => { el.style.height = 'auto' })
                  }
                }}
                placeholder="Ask about your tickets…"
                rows={1}
                className="flex-1 bg-transparent text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none resize-none leading-relaxed overflow-hidden"
                style={{ maxHeight: '120px', overflowY: 'auto' }}
              />
              <button
                onClick={sendMessage}
                disabled={!chatInput.trim() || chatLoading}
                className="shrink-0 w-7 h-7 rounded-3xl flex items-center justify-center bg-[#207a39] hover:bg-[#2da44e] disabled:bg-[#1a2d1e] disabled:cursor-not-allowed transition"
              >
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

      {selectedTicket && (
        <TicketModal
          ticket={selectedTicket}
          team={team}
          isCompleted={selectedTicketIsCompleted}
          onClose={() => setSelectedTicket(null)}
          onUpdate={updateTicketFields}
          onRemove={removeTicketById}
          onMarkComplete={() => markTicketComplete(selectedTicket)}
          onReopenTodo={() => reopenTicketTodo(selectedTicket)}
        />
      )}
      {showNewTicket && (
        <NewTicketModal onClose={() => setShowNewTicket(false)} onSave={handleNewTicket} />
      )}
    </main>
  )
}

export default Dashboard
