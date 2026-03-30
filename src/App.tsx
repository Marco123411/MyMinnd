import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

function App() {
  return (
    <div className="min-h-svh bg-gradient-to-b from-background to-muted">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 sm:py-24">
        <div className="flex flex-col items-center text-center space-y-8">
          <Badge variant="secondary" className="px-4 py-1.5 text-sm">
            Powered by Vite + Tailwind v4 + shadcn/ui
          </Badge>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
            MINND
            <span className="text-primary"> Ready</span>
          </h1>

          <p className="max-w-2xl text-lg sm:text-xl text-muted-foreground">
            Plateforme de performance mentale — prêt à builder.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button size="lg" className="min-w-40">
              Commencer
            </Button>
            <Button size="lg" variant="outline" className="min-w-40">
              Documentation
            </Button>
          </div>

          <div className="pt-12 flex flex-wrap justify-center gap-8 text-muted-foreground">
            {[
              { color: "bg-yellow-500", label: "Vite" },
              { color: "bg-cyan-500", label: "Tailwind v4" },
              { color: "bg-blue-500", label: "React" },
              { color: "bg-neutral-500", label: "shadcn/ui" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`size-2 rounded-full ${color}`} />
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="container mx-auto px-4 pb-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: "Lightning Fast", desc: "Instant HMR et builds optimisés avec Vite" },
            { title: "Type Safe", desc: "TypeScript strict partout" },
            { title: "Beautiful UI", desc: "Composants shadcn/ui prêts à l'emploi" },
          ].map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border bg-card p-6 transition-colors hover:bg-accent"
            >
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="border-t py-8">
        <p className="text-center text-sm text-muted-foreground">
          Édite <code className="font-mono bg-muted px-1.5 py-0.5 rounded">src/App.tsx</code> pour démarrer
        </p>
      </footer>
    </div>
  )
}

export default App
