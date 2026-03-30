import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-light to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-teal">MINND</h1>
          <p className="text-muted-foreground text-sm mt-1">Performance Mentale</p>
        </div>
        <div className="bg-card border rounded-xl shadow-sm p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
