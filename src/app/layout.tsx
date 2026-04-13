import type { Metadata } from 'next'
import './globals.css'
import { AuthHashHandler } from '@/components/auth/AuthHashHandler'

export const metadata: Metadata = {
  title: 'MINND — Performance Mentale',
  description: 'Plateforme SaaS de performance mentale',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AuthHashHandler />
        {children}
      </body>
    </html>
  )
}
