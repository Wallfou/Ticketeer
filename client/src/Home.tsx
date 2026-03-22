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
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Ticketeer</h1>
      <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enter GitHub repository URL" />
      <button onClick={handleAnalyze} disabled={loading}>
        {loading ? "Analyzing..." : "Analyze"}
      </button>
      {result && (
        <div className="mt-4">
          <p>{result.repo} - {result.file_count} files</p>
          <p>{result.languages.join(", ")}</p>
        </div>
      )}
    </div>
  )
}

export default HomePage