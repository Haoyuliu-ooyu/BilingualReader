import FileUpload from '@/components/FileUpload'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-background text-foreground transition-colors duration-300">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex mb-12">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b bg-muted/50 pb-6 pt-8 backdrop-blur-2xl lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-muted lg:p-4">
          Project Prism&nbsp;
          <code className="font-mono font-bold">v0.1.0</code>
        </p>
      </div>

      <div className="relative flex place-items-center flex-col gap-8">
        <h1 className="text-4xl font-bold text-center tracking-tight text-foreground sm:text-6xl">
          Bilingual AI Reader
        </h1>
        <p className="text-lg text-muted-foreground text-center max-w-2xl">
          Upload any PDF and get an interactive, side-by-side translation powered by AI.
          Click on any paragraph to sync your view.
        </p>

        <div className="mt-8 w-full">
          <FileUpload />
        </div>
      </div>
    </main>
  )
}
