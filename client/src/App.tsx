import { Routes, Route } from 'react-router-dom'
import HomePage from './components/Home'
import Dashboard from './components/Dashboard'
import Navbar from './components/NavBar'
import { TicketProvider } from './context/TicketContext'

function App() {
  return (
    <TicketProvider>
      <div className="h-screen bg-[#0d1117] flex flex-col overflow-hidden">
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </TicketProvider>
  )
}

export default App
