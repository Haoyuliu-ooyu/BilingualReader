import { Routes, Route } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Home from '@/pages/Home'
import Library from '@/pages/Library'
import Reader from '@/pages/Reader'
import Settings from '@/pages/Settings'
import Login from '@/pages/Login'
import { useAuthStore } from '@/store/useAuthStore'

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())

  // Login page renders without sidebar
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50/50">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-slate-50/30">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
          <Route path="/reader/:id" element={<ProtectedRoute><Reader /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  )
}
