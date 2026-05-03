'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createTestAction } from '@/app/actions/test'

interface PmaStartButtonProps {
  testDefinitionId: string
}

export function PmaStartButton({ testDefinitionId }: PmaStartButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStart() {
    setLoading(true)
    setError(null)
    const result = await createTestAction(testDefinitionId, 'complete')
    if (result.error || !result.data) {
      setError(result.error ?? 'Erreur inattendue')
      setLoading(false)
      return
    }
    router.push(`/test/pma/pass/${result.data.testId}`)
  }

  return (
    <div className="w-full max-w-md space-y-3">
      <Button
        onClick={handleStart}
        disabled={loading}
        className="w-full h-12 text-base bg-[#20808D] hover:bg-[#1a6b76] text-white"
      >
        {loading ? 'Chargement…' : 'Commencer le test'}
      </Button>
      {error && <p className="text-center text-sm text-red-500">{error}</p>}
    </div>
  )
}
