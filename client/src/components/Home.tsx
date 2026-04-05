import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTickets } from '../context/TicketContext'
import type { Ticket, TicketColumns } from '../context/TicketContext'

const LOADING_STEPS = [
  'Fetching repository...',
  'Analyzing codebase...',
  'Decomposing goal into epics...',
  'Classifying tasks...',
  'Writing tickets...',
]

const PIPELINE = [
  {
    label: 'Codebase analysis',
    description: 'Scans file tree, detects frameworks, maps module boundaries and complexity zones',
    code: 'analyze_repo(repo_data)',
    dotColor: 'bg-[#2da44e]',
    ringColor: 'ring-[#2da44e44]',
  },
  {
    label: 'Goal decomposition',
    description: 'Breaks your feature request into epics with concrete, isolated tasks',
    code: 'analyze_goal(goal, analysis)',
    dotColor: 'bg-[#2da44e]',
    ringColor: 'ring-[#2da44e44]',
  },
  {
    label: 'Classification',
    description: 'Rates every task by complexity and priority using relevant file context',
    code: 'classify_tasks(decomp, repo, analysis)',
    dotColor: 'bg-[#d29922]',
    ringColor: 'ring-[#d2992244]',
  },
  {
    label: 'Ticket generation',
    description: 'Writes full tickets with steps, acceptance criteria, and resources — adapted by skill level',
    code: 'write_tickets(classified, repo, analysis)',
    dotColor: 'bg-[#f85149]',
    ringColor: 'ring-[#f8514944]',
  },
  {
    label: 'Board ready',
    description: 'Drag-and-drop kanban with AI copilot chat for refinement',
    code: null,
    dotColor: 'bg-[#2da44e]',
    ringColor: 'ring-[#2da44e44]',
    isTerminal: true,
  },
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

  const { setColumns, setGoal: setCtxGoal, setRepo, setCompletedTickets } = useTickets()
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
      setCompletedTickets([])
      setCtxGoal(goal)
      setRepo(url)
      localStorage.removeItem('chatMessages')
      navigate('/dashboard')
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
      setStepIndex(-1)
    }
  }

  return (
    <main className="flex-1 flex items-center gap-0 overflow-hidden">

      {/* Left */}
      <div className="flex-1 flex flex-col justify-center px-16 h-full">
        <h1 className="text-5xl font-bold text-[#e6edf3] leading-tight tracking-tight mb-5">
          Turn your GitHub repo into<br />
          a scoped <span className="font-bold text-[#2da44e]">Ticket</span> board
        </h1>
        <p className="text-[#8b949e] text-base leading-relaxed mb-10 max-w-2xl">
          Ticketeer reads your codebase, understands your goal, and generates classified tickets matched to experience and priority levels. Removing headache for team leads managing contributors of different experience levels. 
        </p>

        {/* Form card */}
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[13px] font-semibold text-[#8b949e] uppercase tracking-widest block mb-2">Repository</label>
            <div className="flex items-center bg-[#0d1117] border-2 border-[#21262d] rounded-md px-3 focus-within:border-[#2da44e] transition">
              <svg className="w-3.5 h-3.5 text-[#484f58] mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                disabled={loading}
                className="flex-1 py-2.5 text-sm text-[#e6edf3] placeholder-[#484f58] bg-transparent focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          {/* Goal field */}
          <div>
            <label className="text-[13px] font-semibold text-[#8b949e] uppercase tracking-widest block mb-2">Goal</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Add OAuth2 login with Google and GitHub"
              disabled={loading}
              rows={3}
              className="w-full bg-[#0d1117] border-2 border-[#21262d] rounded-md px-3 py-2.5 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#2da44e] resize-none transition disabled:opacity-50"
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !url.trim() || !goal.trim()}
            className="w-full py-2.5 bg-[#2da44e] hover:bg-[#3fb950] disabled:bg-[#1a3a2a] disabled:text-[#484f58] text-white text-sm font-semibold rounded-md transition disabled:cursor-not-allowed"
          >
            {loading ? LOADING_STEPS[stepIndex] ?? 'Processing...' : 'Generate tickets'}
          </button>

          {/* Loading progress */}
          {loading && (
            <div className="flex gap-1.5">
              {LOADING_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-md transition-colors duration-500 ${
                    i <= stepIndex ? 'bg-[#2da44e]' : 'bg-[#21262d]'
                  }`}
                />
              ))}
            </div>
          )}

          {error && (
            <p className="text-xs text-[#f85149]">{error}</p>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex-1 flex flex-col justify-center px-16 h-full overflow-y-auto">
        <div className="relative">
          <div className="absolute left-[9px] top-3 bottom-8 w-px bg-[#21262d]" />

          {PIPELINE.map((step, i) => {
            const isDone = stepIndex > i
            const isActive = stepIndex === i

            return (
              <div key={i} className={`relative flex gap-4 ${i < PIPELINE.length - 1 ? 'mb-7' : ''}`}>
                {/* Dot */}
                <div className="shrink-0 mt-0.5 z-10">
                  {step.isTerminal ? (
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center ${isDone || stepIndex === -1 ? step.dotColor : 'bg-[#21262d]'} transition-colors duration-300`}>
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className={`w-5 h-5 rounded-md border-2 transition-all duration-300 ${
                      isActive
                        ? `${step.dotColor} border-transparent ring-4 ${step.ringColor} animate-pulse`
                        : isDone
                        ? `${step.dotColor} border-transparent`
                        : 'bg-[#0d1117] border-[#30363d]'
                    }`} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold mb-1 transition-colors duration-300 ${
                    step.isTerminal
                      ? 'text-[#2da44e]'
                      : isDone || isActive
                      ? 'text-[#e6edf3]'
                      : 'text-[#6e7681]'
                  }`}>
                    {step.label}
                  </p>
                  <p className={`text-xs leading-relaxed mb-2 transition-colors duration-300 ${
                    isDone || isActive || stepIndex === -1 ? 'text-[#8b949e]' : 'text-[#484f58]'
                  }`}>
                    {step.description}
                  </p>
                  {step.code && (
                    <div className={`bg-[#161b22] border rounded-md px-3 py-2 font-mono text-xs transition-colors duration-300 ${
                      isActive ? 'border-[#30363d] text-[#c9d1d9]' : 'border-[#21262d] text-[#6e7681]'
                    }`}>
                      {step.code}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </main>
  )
}

export default HomePage
