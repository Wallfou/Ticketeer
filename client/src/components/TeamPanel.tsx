import { useCallback, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
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

function skillHue(tag: string): number {
  const key = tag.trim().toLowerCase()
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h << 5) - h + key.charCodeAt(i)
  return Math.abs(h) % 360
}

function skillChipStyle(tag: string): CSSProperties {
  const hue = skillHue(tag)
  return {
    backgroundColor: `hsla(${hue}, 38%, 16%, 0.95)`,
    color: `hsl(${hue}, 68%, 72%)`,
    border: `0px solid hsl(${hue}, 32%, 30%)`,
  }
}

function aggregateSkillCoverage(team: TeamMember[]): { label: string; count: number; colorKey: string }[] {
  const map = new Map<string, { label: string; count: number }>()
  for (const m of team) {
    for (const raw of m.tags) {
      const t = raw.trim()
      if (!t) continue
      const key = t.toLowerCase()
      const cur = map.get(key)
      if (cur) cur.count += 1
      else map.set(key, { label: t, count: 1 })
    }
  }
  return Array.from(map.entries())
    .map(([colorKey, { label, count }]) => ({ label, count, colorKey }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}

export default function TeamPanel({
  team,
  setTeam,
}: {
  team: TeamMember[]
  setTeam: (t: TeamMember[]) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ name: string; experience: ExperienceTier; tags: string } | null>(null)

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
      setTeam(team.filter((m) => m.id !== id))
      if (editingId === id) cancelEdit()
    },
    [team, setTeam, editingId, cancelEdit]
  )

  const isNewDraft = editingId && draft && !team.some((m) => m.id === editingId)

  const skillCoverage = useMemo(() => aggregateSkillCoverage(team), [team])

  return (
    <div className="w-[340px] shrink-0 flex flex-col min-h-0 bg-[#010409] border-r border-[#30363d] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-[#21262d] shrink-0">
        <span className="text-md font-semibold text-[#e6edf3]">Team Members</span>
        <span className="text-xs font-medium text-[#8b949e] bg-[#21262d] px-2 py-0.5 rounded-md tabular-nums ml-auto">{team.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {team.length === 0 && !draft && (
          <p className="text-xs text-[#6e7681] leading-relaxed px-1">
            Add members with experience and skills. Auto-assign matches tickets to the best fit and balances workload.
          </p>
        )}

        {team.map((m) => {
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
          return (
            <div
              key={m.id}
              className="group rounded-md border border-[#21262d] bg-[#0d1117] p-3 hover:border-[#30363d] transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border border-[#30363d] shadow-inner"
                    style={{ backgroundColor: `hsl(${avatarHue(m.name)}, 42%, 42%)` }}
                    aria-hidden
                  >
                    {initialsForName(m.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#e6edf3] truncate">{m.name}</p>
                    <p className="text-[10px] text-[#8b949e] mt-0.5 capitalize">{m.experience}</p>
                    {m.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {m.tags.map((t) => (
                          <span
                            key={t}
                            style={skillChipStyle(t)}
                            className="text-[9px] leading-tight border px-2 py-1 rounded-sm"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => startEdit(m)}
                    className="text-[10px] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMember(m.id)}
                    className="text-[10px] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
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

        {!isNewDraft && (
          <button
            type="button"
            onClick={startAdd}
            className="w-full flex items-center justify-center gap-2 text-xs font-medium text-[#c9d1d9] border-2 border-dashed border-[#30363d] hover:border-[#8b949e] hover:text-[#e6edf3] bg-[#161b22] hover:bg-[#21262d] py-2.5 rounded-md transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add member
          </button>
        )}
      </div>
    </div>
  )
}
