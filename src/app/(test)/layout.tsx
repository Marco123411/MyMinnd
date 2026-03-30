import Link from 'next/link'

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex h-14 shrink-0 items-center border-b px-4">
        <Link href="/client">
          <span className="text-lg font-bold text-[#20808D]">MINND</span>
        </Link>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
