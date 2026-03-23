import { useState } from 'react'


function HomePage() {
  const [url, setUrl] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleAnalyze = async () => {
    setLoading(true)
    const response = await fetch('/api/github/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_url: url }),
    })
    const data = await response.json()
    if (!response.ok) {
      console.error('API error:', data.detail)
      alert(data.detail)
      setLoading(false)
      return
    }
    setResult(data)
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen bg-[#101214] flex flex-col"
    >
      {/* Hero */}
      <main className="flex-1 flex flex-col items-center px-4 pt-20 text-center">
        <h1 className="text-5xl font-semibold text-[#ffffff] leading-tight tracking-tight mb-4 max-w-xl">
          <em className="not-italic text-[#2da44e]">Analyze</em> your codebase,<br />
          generate perfect tickets
        </h1>
        <p className="text-[#ffffff] text-base mb-10 max-w-sm">
          Paste a GitHub repo URL and let Ticketeer map out your project structure instantly.
        </p>

        {/* Input row */}
        <div className="w-full max-w-lg flex gap-2">
          <div className="flex-1 flex items-center bg-white border border-[#e5e7eb] rounded-full px-4 shadow-sm focus-within:border-[#2da44e] focus-within:ring-2 focus-within:ring-[#d4f0dc] transition">
            <svg className="w-4 h-4 text-[#9ca3af] mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && url.trim() && handleAnalyze()}
              placeholder="https://github.com/owner/repo"
              className="flex-1 py-2.5 text-sm text-[#24292f] placeholder-[#9ca3af] bg-transparent focus:outline-none"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !url.trim()}
            className="px-5 py-2.5 bg-[#2da44e] hover:bg-[#218a3e] disabled:bg-[#86d9a0] text-white text-sm font-medium rounded-full transition cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shadow-sm"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {/* Result card */}
        <div className="mt-6 w-full max-w-lg min-h-[120px]">
          {result ? (
            <div className="bg-white border border-[#e5e7eb] rounded-2xl p-5 text-left shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-[#24292f] text-sm">{result.repo}</span>
                <span className="text-xs bg-[#d4f0dc] text-[#2da44e] font-medium px-2.5 py-1 rounded-full">
                  {result.file_count} files
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.languages.map((lang: string) => (
                  <span
                    key={lang}
                    className="text-xs bg-[#f3f4f6] border border-[#e5e7eb] text-[#6b7280] px-2.5 py-1 rounded-full"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
            ) : (
              <div className="text-[#6b7280] text-sm text-center pt-8">
                Results will appear here
              </div>
            )}
        </div>
      </main>
    </div>
  )
}

export default HomePage
