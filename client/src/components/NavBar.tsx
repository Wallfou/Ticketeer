import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav className="bg-[#010409] px-8 py-3.5 border-b border-[#21262d] flex items-center gap-6">
      <Link to="/" className="text-2xl font-semibold tracking-tight text-[#e6edf3] shrink-0">
        Ticket<span className="text-[#2da44e]">eer</span>
      </Link>

      <div className="h-4 w-px bg-[#21262d]" />

      <div className="flex items-center gap-0.5">
        <Link
          to="/"
          className={`px-3 py-1.5 rounded-md text-sm transition ${
            pathname === '/'
              ? 'text-[#e6edf3] font-medium'
              : 'text-[#6e7681] hover:text-[#8b949e]'
          }`}
        >
          Home
        </Link>
        <Link
          to="/dashboard"
          className={`px-3 py-1.5 rounded-md text-sm transition ${
            pathname === '/dashboard'
              ? 'text-[#e6edf3] font-medium'
              : 'text-[#6e7681] hover:text-[#8b949e]'
          }`}
        >
          Board
        </Link>
      </div>
    </nav>
  )
}
