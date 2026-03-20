import { useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar, MobileMenuButton } from '@/components/Sidebar'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import Home from '@/pages/Home'
import Library from '@/pages/Library'
import Reader from '@/pages/Reader'
import Settings from '@/pages/Settings'
import Login from '@/pages/Login'
import Landing from '@/pages/Landing'
import { useAuthStore } from '@/store/useAuthStore'

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Login page renders without sidebar
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <MobileMenuButton onClick={() => setMobileOpen(true)} />
      <main className="flex-1 overflow-auto bg-background relative">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
            <Route path="/" element={<ProtectedRoute><ErrorBoundary><PageWrapper><Home /></PageWrapper></ErrorBoundary></ProtectedRoute>} />
            <Route path="/library" element={<ProtectedRoute><ErrorBoundary><PageWrapper><Library /></PageWrapper></ErrorBoundary></ProtectedRoute>} />
            <Route path="/reader/:id" element={<ProtectedRoute><ErrorBoundary><PageWrapper><Reader /></PageWrapper></ErrorBoundary></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><ErrorBoundary><PageWrapper><Settings /></PageWrapper></ErrorBoundary></ProtectedRoute>} />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  )
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  )
}
