import { Routes, Route } from 'react-router-dom'
import HomePage from './components/Home'
import Navbar from './components/NavBar'

function App() {
  return (
    <div className="min-h-screen bg-[#101214] flex flex-col">
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </div>
  )
}

export default App