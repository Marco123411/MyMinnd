'use client'

import type { CognitiveTestPreset } from '@/types'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

interface PresetSelectorProps {
  presets: CognitiveTestPreset[]
  value: string
  onChange: (presetId: string) => void
}

export function PresetSelector({ presets, value, onChange }: PresetSelectorProps) {
  const selected = presets.find((p) => p.id === value)

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Choisir une version…" />
        </SelectTrigger>
        <SelectContent>
          {presets.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <div className="flex items-center gap-2">
                {p.is_validated ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                )}
                <span>{p.name}</span>
                {p.coach_id && (
                  <Badge variant="outline" className="text-xs ml-auto">
                    Personnel
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected && !selected.is_validated && (
        <p className="text-xs text-amber-600 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Ce preset n&apos;est pas validé scientifiquement pour le suivi longitudinal.
          Résultats à interpréter avec précaution.
        </p>
      )}
      {selected?.is_validated && selected.validation_reference && (
        <p className="text-xs text-muted-foreground">
          Référence : {selected.validation_reference}
        </p>
      )}
    </div>
  )
}
