import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav className="bg-[#010409] px-8 py-4 border-b border-[#21262d] flex items-center gap-8">
      <Link to="/" className="text-2xl font-semibold text-white shrink-0">
        Ticket<span className="text-[#2da44e]">eer</span>
      </Link>

      <div className="flex items-center gap-1">
        <Link
          to="/"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            pathname === '/'
              ? 'bg-[#21262d] text-[#e6edf3]'
              : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'
          }`}
        >
          Home
        </Link>
        <Link
          to="/dashboard"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            pathname === '/dashboard'
              ? 'bg-[#21262d] text-[#e6edf3]'
              : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'
          }`}
        >
          Dashboard
        </Link>
      </div>
    </nav>
  )
}
