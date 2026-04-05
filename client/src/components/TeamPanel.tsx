import { useCallback, useState } from 'react'
import type { ExperienceTier, TeamMember } from '../context/TicketContext'

const TIER_OPTIONS: { value: ExperienceTier; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

function parseTags(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function formatTags(tags: string[]): string {
  return tags.join(', ')
}

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

function tierLabel(tier: ExperienceTier): string {
  return TIER_OPTIONS.find((o) => o.value === tier)?.label ?? tier
}

const TIER_TEXT: Record<ExperienceTier, string> = {
  beginner: 'text-[#3fb950]',
  intermediate: 'text-[#e3b341]',
  advanced: 'text-[#f85149]',
}

export default function TeamPanel({
  team,
  setTeam,
  selectedMemberId,
  onSelectMember,
}: {
  team: TeamMember[]
  setTeam: (t: TeamMember[]) => void
  selectedMemberId: string | null
  onSelectMember: (id: string | null) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ name: string; experience: ExperienceTier; tags: string } | null>(null)
  const [search, setSearch] = useState('')

  const startAdd = useCallback(() => {
    const id = crypto.randomUUID()
    setEditingId(id)
    setDraft({ name: '', experience: 'intermediate', tags: '' })
  }, [])

  const startEdit = useCallback((m: TeamMember) => {
    setEditingId(m.id)
    setDraft({ name: m.name, experience: m.experience, tags: formatTags(m.tags) })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setDraft(null)
  }, [])

  const saveDraft = useCallback(() => {
    if (!draft || !editingId) return
    const name = draft.name.trim()
    if (!name) return
    const tags = parseTags(draft.tags)
    const exists = team.some((m) => m.id === editingId)
    const next: TeamMember = { id: editingId, name, experience: draft.experience, tags }
    if (exists) {
      setTeam(team.map((m) => (m.id === editingId ? next : m)))
    } else {
      setTeam([...team, next])
    }
    setEditingId(null)
    setDraft(null)
  }, [draft, editingId, team, setTeam])

  const removeMember = useCallback(
    (id: string) => {
      if (selectedMemberId === id) onSelectMember(null)
      setTeam(team.filter((m) => m.id !== id))
      if (editingId === id) cancelEdit()
    },
    [team, setTeam, editingId, cancelEdit, selectedMemberId, onSelectMember]
  )

  const isNewDraft = editingId && draft && !team.some((m) => m.id === editingId)

  const q = search.trim().toLowerCase()
  const visibleMembers = team.filter((m) => {
    if (editingId === m.id) return true
    if (!q) return true
    return (
      m.name.toLowerCase().includes(q) ||
      m.tags.some((t) => t.toLowerCase().includes(q))
    )
  })

  return (
    <div className="flex w-full flex-1 flex-col min-h-0 bg-[#010409] overflow-hidden">
      <div className="shrink-0 px-3 pt-3 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-md font-semibold text-[#e6edf3]">Team Members</span>
          <span className="text-xs font-medium text-[#8b949e] bg-[#21262d] px-2 py-0.5 rounded-md tabular-nums ml-auto">
            {team.length}
          </span>
        </div>
        <div className="flex gap-2">
          <div className="flex flex-1 min-w-0 items-center gap-1.5 rounded-md bg-[#161b22] px-2 py-1.5 border border-[#30363d] focus-within:border-[#484f58]">
            <svg className="w-3 h-3 text-[#6e7681] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="min-w-0 flex-1 bg-transparent text-xs text-[#e6edf3] placeholder-[#6e7681] focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-[#6e7681] hover:text-[#c9d1d9] shrink-0 p-0.5"
                aria-label="Clear search"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {!isNewDraft && (
            <button
              type="button"
              onClick={startAdd}
              className="shrink-0 flex items-center justify-center gap-1 text-[11px] font-medium text-[#e6edf3] bg-[#207a39] hover:bg-[#3fb950] px-2.5 py-1.5 rounded-md transition"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2 min-h-0">
        {team.length === 0 && !draft && (
          <p className="text-xs text-[#6e7681] leading-relaxed px-1">
            Add members with experience and skills. Auto-assign matches tickets to the best fit and balances workload.
          </p>
        )}

        {q && visibleMembers.length === 0 && team.length > 0 && (
          <p className="text-xs text-[#6e7681] px-1 py-2">No members match your search.</p>
        )}

        {visibleMembers.map((m) => {
          if (editingId === m.id && draft) {
            return (
              <div key={m.id} className="rounded-md border border-[#388bfd55] bg-[#0d1117] p-3 space-y-2">
                <input
                  autoFocus
                  value={draft.name}
                  onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                  placeholder="Name"
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-md px-2.5 py-1.5 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#388bfd]"
                />
                <select
                  value={draft.experience}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, experience: e.target.value as ExperienceTier } : d))
                  }
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-md px-2.5 py-1.5 text-xs text-[#e6edf3] focus:outline-none focus:border-[#388bfd]"
                >
                  {TIER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  value={draft.tags}
                  onChange={(e) => setDraft((d) => (d ? { ...d, tags: e.target.value } : d))}
                  placeholder="Tags: React, CSS, databases…"
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-md px-2.5 py-1.5 text-xs text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#388bfd]"
                />
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="text-[10px] text-[#8b949e] hover:text-[#e6edf3] px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={!draft.name.trim()}
                    className="text-[10px] font-medium text-white bg-[#207a39] hover:bg-[#3fb950] disabled:opacity-40 px-3 py-1 rounded-md"
                  >
                    Save
                  </button>
                </div>
              </div>
            )
          }
          const expanded = selectedMemberId === m.id
          return (
            <div
              key={m.id}
              className={`rounded-md p-3 border transition-[background-color,border-color,box-shadow] duration-200 ${
                expanded
                  ? 'bg-[#388bfd14] hover:shadow-[0_0_20px_-4px_rgba(88,166,255,0.35)]'
                  : 'bg-[#0d1117] border-transparent hover:bg-[#1c2128] hover:border-[#30363d] hover:shadow-[0_0_0_1px_rgba(139,148,158,0.12),0_4px_14px_-4px_rgba(0,0,0,0.45)]'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectMember(expanded ? null : m.id)}
                className="flex w-full items-start gap-2.5 text-left rounded-md -m-0.5 p-0.5 transition-colors"
              >
                <div
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border border-[#30363d] shadow-inner"
                  style={{ backgroundColor: `hsl(${avatarHue(m.name)}, 42%, 42%)` }}
                  aria-hidden
                >
                  {initialsForName(m.name)}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-bold text-[#e6edf3] truncate">{m.name}</p>
                  <p className={`text-[10px] font-medium mt-0.5 ${TIER_TEXT[m.experience]}`}>
                    {tierLabel(m.experience)}
                  </p>
                </div>
              </button>

              {expanded && (
                <div className="space-y-2 pt-1">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8b949e] mb-1.5">
                      Skills
                    </p>
                    {m.tags.length === 0 ? (
                      <p className="text-[10px] text-[#6e7681] leading-relaxed">No skills listed. Edit member to add tags.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {m.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[9px] leading-tight text-[#8b949e] bg-[#161b22] border border-[#30363d] px-2 py-1 rounded-sm"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => startEdit(m)}
                      className="text-[10px] font-medium text-[#8b949e] hover:text-[#e6edf3] transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMember(m.id)}
                      className="text-[10px] font-medium text-[#8b949e] hover:text-[#e6edf3] transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {isNewDraft && draft && (
          <div className="rounded-md border border-[#388bfd55] bg-[#0d1117] p-3 space-y-2">
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
              placeholder="Name"
              className="w-full bg-[#161b22] border border-[#30363d] rounded-md px-2.5 py-1.5 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#388bfd]"
            />
            <select
              value={draft.experience}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, experience: e.target.value as ExperienceTier } : d))
              }
              className="w-full bg-[#161b22] border border-[#30363d] rounded-md px-2.5 py-1.5 text-xs text-[#e6edf3] focus:outline-none focus:border-[#388bfd]"
            >
              {TIER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              value={draft.tags}
              onChange={(e) => setDraft((d) => (d ? { ...d, tags: e.target.value } : d))}
              placeholder="Tags: React, CSS, databases…"
              className="w-full bg-[#161b22] border border-[#30363d] rounded-md px-2.5 py-1.5 text-xs text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#388bfd]"
            />
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={cancelEdit} className="text-[10px] text-[#8b949e] hover:text-[#e6edf3] px-2 py-1">
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDraft}
                disabled={!draft.name.trim()}
                className="text-[10px] font-medium text-white bg-[#207a39] hover:bg-[#3fb950] disabled:opacity-40 px-3 py-1 rounded-md"
              >
                Add
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
