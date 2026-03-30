'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createTestAction } from '@/app/actions/test'

interface TestStartButtonProps {
  testDefinitionId: string
  levelSlug: string
  testSlug: string
}

export function TestStartButton({ testDefinitionId, levelSlug, testSlug }: TestStartButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStart() {
    setLoading(true)
    setError(null)
    const result = await createTestAction(testDefinitionId, levelSlug)
    if (result.error || !result.data) {
      setError(result.error ?? 'Erreur inattendue')
      setLoading(false)
      return
    }
    router.push(`/test/${testSlug}/pass/${result.data.testId}`)
  }

  return (
    <div className="mt-4 space-y-2">
      <Button onClick={handleStart} disabled={loading} className="w-full bg-[#20808D] hover:bg-[#186870]">
        {loading ? 'Chargement…' : 'Commencer'}
      </Button>
      {error && <p className="text-center text-sm text-red-500">{error}</p>}
    </div>
  )
}
