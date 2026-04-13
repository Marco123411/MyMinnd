'use client'

type Phase = 'pre' | 'in' | 'post'

interface PhaseIndicatorProps {
  phase: Phase
}

const PHASE_COLORS: Record<Phase, string> = {
  pre: '#20808D',   // teal
  in: '#FFC553',    // gold
  post: '#944454',  // mauve
}

const PHASE_LABELS: Record<Phase, string> = {
  pre: 'PRÉ',
  in: 'IN',
  post: 'POST',
}

export function PhaseIndicator({ phase }: PhaseIndicatorProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold text-white"
      style={{ backgroundColor: PHASE_COLORS[phase] }}
    >
      {PHASE_LABELS[phase]}
    </span>
  )
}
