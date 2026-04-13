'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTrialRecorder } from '@/hooks/useTrialRecorder'
import { interpolate } from '@/lib/cognitive/intensity-interpolation'
import { shuffle } from '@/lib/cognitive/shuffle'
import { TestTimer } from '@/components/cognitive/TestTimer'

interface DrillProps {
  sessionId: string
  durationSec: number
  intensityPercent: number
  onComplete: () => void
}

type ItemType = 'target' | 'distractor_L_blue' | 'distractor_T_red'

interface GridItem {
  id: number
  type: ItemType
  isTarget: boolean
}

// 70% target-present, 30% target-absent
const TARGET_PRESENT_RATIO = 0.7

function generateGrid(distractorCount: number): { items: GridItem[]; targetIndex: number; hasTarget: boolean } {
  const hasTarget = Math.random() < TARGET_PRESENT_RATIO
  const items: GridItem[] = []
  let targetIndex = -1

  if (hasTarget) {
    targetIndex = Math.floor(Math.random() * (distractorCount + 1))
    for (let i = 0; i <= distractorCount; i++) {
      if (i === targetIndex) {
        items.push({ id: i, type: 'target', isTarget: true })
      } else {
        const dtype: ItemType = Math.random() < 0.5 ? 'distractor_L_blue' : 'distractor_T_red'
        items.push({ id: i, type: dtype, isTarget: false })
      }
    }
  } else {
    // All distractors — no blue T present
    for (let i = 0; i <= distractorCount; i++) {
      const dtype: ItemType = Math.random() < 0.5 ? 'distractor_L_blue' : 'distractor_T_red'
      items.push({ id: i, type: dtype, isTarget: false })
    }
  }

  return { items: shuffle(items), targetIndex, hasTarget }
}

function ItemDisplay({ item, highlighted }: { item: GridItem; highlighted: boolean }) {
  const baseStyle: React.CSSProperties = {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    borderRadius: 4,
    border: highlighted ? '2px solid #ef4444' : '1px solid #374151',
    backgroundColor: highlighted ? '#ef444420' : 'transparent',
    transition: 'border-color 0.3s, background-color 0.3s',
  }

  if (item.type === 'target') {
    return <div style={{ ...baseStyle, color: '#2196F3' }}>T</div>
  }
  if (item.type === 'distractor_L_blue') {
    return <div style={{ ...baseStyle, color: '#2196F3' }}>L</div>
  }
  return <div style={{ ...baseStyle, color: '#ef4444' }}>T</div>
}

export function VisualSearch({ sessionId, durationSec, intensityPercent, onComplete }: DrillProps) {
  const { recordTrial, flush } = useTrialRecorder(sessionId)
  const flushRef = useRef(flush)
  flushRef.current = flush

  const distractorCount = interpolate(intensityPercent, [8, 24])

  const [grid, setGrid] = useState<GridItem[]>([])
  const [targetIndex, setTargetIndex] = useState(-1)
  const [highlightedItem, setHighlightedItem] = useState<number | null>(null)
  const [trialIndex, setTrialIndex] = useState(0)
  const [trialStarted, setTrialStarted] = useState(false)

  const trialIndexRef = useRef(0)
  const testStartRef = useRef(0)
  const trialStartRef = useRef(0)
  const respondedRef = useRef(false)
  const targetIndexRef = useRef(-1)
  const hasTargetRef = useRef(true)
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isCompletingRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const completeTest = useCallback(() => {
    if (isCompletingRef.current) return
    isCompletingRef.current = true
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current)
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    flushRef.current().then(() => onCompleteRef.current())
  }, [])

  const startNextTrial = useCallback(() => {
    if (isCompletingRef.current) return
    if ((performance.now() - testStartRef.current) >= durationSec * 1000) {
      completeTest()
      return
    }

    const { items, targetIndex: tIdx, hasTarget } = generateGrid(distractorCount)
    targetIndexRef.current = tIdx
    hasTargetRef.current = hasTarget
    setGrid(items)
    setTargetIndex(tIdx)
    setHighlightedItem(null)
    respondedRef.current = false
    trialStartRef.current = performance.now()
    setTrialStarted(true)

    // Timeout after 8s
    timeoutTimerRef.current = setTimeout(() => {
      if (respondedRef.current) return
      respondedRef.current = true

      recordTrial({
        trial_index: trialIndexRef.current,
        stimulus_type: 'visual_search',
        stimulus_data: { target_position: targetIndexRef.current, distractor_count: distractorCount },
        response_data: { response_position: null, correct: false },
        reaction_time_ms: null,
        is_correct: false,
        is_anticipation: false,
        is_lapse: true,
      })

      // Show target briefly
      setHighlightedItem(targetIndexRef.current)
      trialIndexRef.current += 1
      setTrialIndex(trialIndexRef.current)

      feedbackTimerRef.current = setTimeout(() => {
        if (!isCompletingRef.current) startNextTrial()
      }, 1000)
    }, 8000)
  }, [durationSec, distractorCount, recordTrial, completeTest])

  const handleItemClick = useCallback(
    (itemId: number, isActualTarget: boolean) => {
      if (respondedRef.current || !trialStarted) return
      respondedRef.current = true
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current)

      const rt = Math.round(performance.now() - trialStartRef.current)
      const isCorrect = isActualTarget

      recordTrial({
        trial_index: trialIndexRef.current,
        stimulus_type: 'visual_search',
        stimulus_data: { target_position: targetIndexRef.current, has_target: hasTargetRef.current, distractor_count: distractorCount },
        response_data: { response_position: itemId, correct: isCorrect, is_absent_response: itemId === -1 },
        reaction_time_ms: rt,
        is_correct: isCorrect,
        is_anticipation: false,
        is_lapse: false,
      })

      // Highlight the target for 1s feedback
      setHighlightedItem(targetIndexRef.current)
      trialIndexRef.current += 1
      setTrialIndex(trialIndexRef.current)

      feedbackTimerRef.current = setTimeout(() => {
        if (!isCompletingRef.current) startNextTrial()
      }, 1000)
    },
    [trialStarted, distractorCount, recordTrial, startNextTrial]
  )

  const handleAbsent = useCallback(() => {
    // Correct if there truly is no target in the current trial
    handleItemClick(-1, !hasTargetRef.current)
  }, [handleItemClick])

  useEffect(() => {
    testStartRef.current = performance.now()
    startNextTrial()
    return () => {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current)
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    }
  }, [startNextTrial])

  return (
    <div
      className="fixed inset-0 flex flex-col select-none overflow-y-auto"
      style={{ backgroundColor: '#1A1A2E' }}
    >
      <TestTimer durationSec={durationSec} onExpire={completeTest} />

      <div className="flex-1 flex flex-col items-center justify-center py-4 px-4 gap-4">
        <div className="text-center">
          <p className="text-gray-400 text-sm">Trouve le T bleu · Trial {trialIndex + 1}</p>
          <p className="text-gray-600 text-xs mt-1">
            {distractorCount + 1} éléments · {distractorCount} distracteurs
          </p>
        </div>

        {/* Grid */}
        <div
          className="flex flex-wrap gap-1 justify-center max-w-sm"
        >
          {grid.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id, item.isTarget)}
              className="active:scale-95 transition-transform"
              aria-label={item.type}
            >
              <ItemDisplay item={item} highlighted={highlightedItem === item.id} />
            </button>
          ))}
        </div>

        {/* Absent button */}
        <button
          onClick={handleAbsent}
          className="mt-2 px-6 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-sm active:scale-95 transition-transform"
        >
          Absent ✗
        </button>
      </div>
    </div>
  )
}
