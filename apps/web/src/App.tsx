import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Sidebar, MobileMenuButton } from '@/components/Sidebar'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Home from '@/pages/Home'
import Library from '@/pages/Library'
import Reader from '@/pages/Reader'
import Settings from '@/pages/Settings'
import Login from '@/pages/Login'
import { useAuthStore } from '@/store/useAuthStore'

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const [mobileOpen, setMobileOpen] = useState(false)

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
    <div className="flex h-screen bg-muted/30">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <MobileMenuButton onClick={() => setMobileOpen(true)} />
      <main className="flex-1 overflow-auto bg-muted/20">
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
