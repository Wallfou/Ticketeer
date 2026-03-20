import React from 'react'
import { useEffect, useState } from 'react'

function App() {
  const [health, setHealth] = useState<string>('')

  useEffect(() => {
    fetch('/api/health')
    .then(response => response.json())
    .then(data => setHealth(data.status))
  }, [])

  return (
    <div>
      <h1>Ticketeer</h1>
      <p>Health: {health}</p>
    </div>
  )
}

export default App