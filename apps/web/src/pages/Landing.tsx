import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, BookOpen, Sparkles, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-hidden relative">
      {/* Decorative blurred background shapes */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

      <main className="flex-1 flex flex-col items-center justify-center relative z-10 px-6 pb-24 pt-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center max-w-4xl max-auto"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
            className="flex justify-center mb-6"
          >
            <div className="p-4 bg-primary/10 rounded-2xl ring-1 ring-primary/20 shadow-lg mb-4 inline-flex">
              <BookOpen className="w-12 h-12 text-primary" />
            </div>
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
            Read without borders. <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-primary via-blue-500 to-purple-600">
              Translated by AI.
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            Upload any PDF and read it in your preferred language seamlessly. High-quality document translation preserving the original layout.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="h-14 px-8 text-lg rounded-full group">
              <Link to="/login">
                Get Started for Free
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Feature Highlights Grid */}
        <motion.div
          id="features"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 max-w-5xl w-full"
        >
          <div className="flex flex-col items-center text-center p-6 bg-card/50 backdrop-blur-sm border border-border rounded-2xl hover:border-primary/50 transition-colors">
            <div className="p-3 bg-blue-500/10 rounded-xl mb-4">
              <Globe className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Multilingual Support</h3>
            <p className="text-muted-foreground">Translate documents into over 50+ languages with high contextual accuracy.</p>
          </div>
          <div className="flex flex-col items-center text-center p-6 bg-card/50 backdrop-blur-sm border border-border rounded-2xl hover:border-primary/50 transition-colors">
            <div className="p-3 bg-primary/10 rounded-xl mb-4">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">AI-Powered Precision</h3>
            <p className="text-muted-foreground">Leverage the latest LLMs tailored to maintain the nuance and layout of your files.</p>
          </div>
          <div className="flex flex-col items-center text-center p-6 bg-card/50 backdrop-blur-sm border border-border rounded-2xl hover:border-primary/50 transition-colors">
            <div className="p-3 bg-purple-500/10 rounded-xl mb-4">
              <BookOpen className="w-6 h-6 text-purple-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Side-by-Side Reading</h3>
            <p className="text-muted-foreground">Compare the original text alongside the translated segments without missing a beat.</p>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
