import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTickets } from '../context/TicketContext'
import type { Ticket, TicketColumns } from '../context/TicketContext'

const STEPS = [
  'Fetching repository...',
  'Analyzing codebase...',
  'Decomposing goal into epics...',
  'Classifying tasks...',
  'Writing tickets...',
]

async function post(url: string, body: object) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Request failed')
  return data
}

function HomePage() {
  const [url, setUrl] = useState('')
  const [goal, setGoal] = useState('')
  const [loading, setLoading] = useState(false)
  const [stepIndex, setStepIndex] = useState(-1)
  const [error, setError] = useState('')

  const { setColumns, setGoal: setCtxGoal, setRepo } = useTickets()
  const navigate = useNavigate()

  const handleGenerate = async () => {
    if (!url.trim() || !goal.trim()) return
    setLoading(true)
    setError('')

    try {
      setStepIndex(0)
      const repoData = await post('/api/github/analyze', { repo_url: url })

      setStepIndex(1)
      const analysis = await post('/api/ai/analyze', { repo_url: url })

      setStepIndex(2)
      const decomposition = await post('/api/ai/decompose', { goal, analysis })

      setStepIndex(3)
      const classified = await post('/api/ai/classify', {
        decomposition,
        analysis,
        repo_data: repoData,
      })

      setStepIndex(4)
      const ticketsData = await post('/api/ai/tickets', {
        classified,
        analysis,
        repo_data: repoData,
      })

      const columns: TicketColumns = { beginner: [], intermediate: [], advanced: [] }
      for (const epic of ticketsData.epics) {
        for (const ticket of epic.tickets) {
          const complexity = ticket.complexity as keyof TicketColumns
          if (complexity in columns) {
            columns[complexity].push({ ...ticket, id: crypto.randomUUID() } as Ticket)
          }
        }
      }

      setColumns(columns)
      setCtxGoal(goal)
      setRepo(url)
      navigate('/dashboard')
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
      setStepIndex(-1)
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center px-4 pt-32 pb-16 text-center">
      <h1 className="text-6xl font-semibold text-[#e6edf3] leading-tight tracking-tight mb-4 max-w-3xl">
        <em className="not-italic text-[#2da44e]">Analyze</em> your codebase,<br />
        generate perfect tickets
      </h1>
      <p className="text-[#8b949e] text-lg mb-12 mt-6 max-w-lg">
        Paste a GitHub repo URL, describe your goal, and let Ticketeer generate scoped, classified tickets for your team.
      </p>

      <div className="w-full max-w-2xl flex flex-col gap-3">
        {/* URL input */}
        <div className="flex items-center bg-[#161b22] border border-[#30363d] rounded-xl px-4 focus-within:border-[#2da44e] focus-within:ring-1 focus-within:ring-[#2da44e33] transition">
          <svg className="w-4 h-4 text-[#484f58] mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            disabled={loading}
            className="flex-1 py-3 text-sm text-[#e6edf3] placeholder-[#484f58] bg-transparent focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Goal textarea */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl px-4 py-3 focus-within:border-[#2da44e] focus-within:ring-1 focus-within:ring-[#2da44e33] transition">
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe your goal — e.g. 'Add OAuth2 login with Google and GitHub'"
            disabled={loading}
            rows={3}
            className="w-full text-sm text-[#e6edf3] placeholder-[#484f58] bg-transparent focus:outline-none resize-none disabled:opacity-50"
          />
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={loading || !url.trim() || !goal.trim()}
          className="w-full py-3 bg-[#2da44e] hover:bg-[#3fb950] disabled:bg-[#1a3a2a] disabled:text-[#484f58] text-white text-sm font-medium rounded-xl transition cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? STEPS[stepIndex] ?? 'Processing...' : 'Generate Tickets'}
        </button>

        {/* Step progress */}
        {loading && (
          <div className="flex justify-center gap-1.5 mt-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-500 ${
                  i <= stepIndex ? 'bg-[#2da44e] w-8' : 'bg-[#30363d] w-4'
                }`}
              />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-[#f85149] text-center mt-1">{error}</p>
        )}
      </div>
    </main>
  )
}

export default HomePage
