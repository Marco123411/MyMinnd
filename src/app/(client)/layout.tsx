import { Suspense, type ReactNode } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ClientNavWrapper } from '@/components/client/ClientNavWrapper'

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-2xl pb-24">
        {children}
      </main>
      <Footer />
      <Suspense fallback={<nav className="fixed bottom-0 left-0 right-0 z-50 h-14 border-t bg-background" />}>
        <ClientNavWrapper />
      </Suspense>
    </div>
  )
}
