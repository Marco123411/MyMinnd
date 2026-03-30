import type { Metadata } from 'next'
import './globals.css'
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { AuthHashHandler } from '@/components/auth/AuthHashHandler'

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'MINND — Performance Mentale',
  description: 'Plateforme SaaS de performance mentale',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={cn("font-sans", geist.variable)}>
      <body>
        <AuthHashHandler />
        {children}
      </body>
    </html>
  )
}
