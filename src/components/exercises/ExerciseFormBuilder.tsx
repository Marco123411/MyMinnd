'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { createCustomExerciseAction } from '@/app/actions/exercises'
import type { ExerciseQuestion, ExerciseQuestionType } from '@/types'

// ============================================================
// Types locaux
// ============================================================

interface ExerciseFormData {
  titre: string
  description: string
  categorie: string
  questions: ExerciseQuestion[]
}

const QUESTION_BADGE: Record<ExerciseQuestionType, { label: string; className: string }> = {
  open:  { label: '✏️ Question ouverte',  className: 'bg-[#F1F0FE] text-[#7069F4] border-[#7069F4]' },
  scale: { label: '📊 Notation 1-10',    className: 'bg-purple-50 text-[#3C3CD6] border-[#3C3CD6]' },
  mcq:   { label: '☑️ Choix multiples',  className: 'bg-amber-50 text-amber-700 border-amber-400' },
}

// ============================================================
// QuestionBuilderItem — rendu d'une question en édition
// ============================================================

interface QuestionBuilderItemProps {
  question: ExerciseQuestion
  index: number
  onUpdate: (index: number, field: keyof ExerciseQuestion, value: string | string[]) => void
  onRemove: (index: number) => void
}

function QuestionBuilderItem({ question, index, onUpdate, onRemove }: QuestionBuilderItemProps) {
  const badge = QUESTION_BADGE[question.type]

  return (
    <Card className="border border-border">
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* En-tête : badge type + bouton supprimer */}
        <div className="flex items-center justify-between">
          <Badge variant="outline" className={badge.className}>
            {badge.label}
          </Badge>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Supprimer la question"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Intitulé de la question */}
        <div>
          <Label htmlFor={`q-label-${index}`} className="text-xs text-muted-foreground mb-1">
            Intitulé de la question
          </Label>
          <Input
            id={`q-label-${index}`}
            value={question.label}
            onChange={e => onUpdate(index, 'label', e.target.value)}
            placeholder="Saisissez votre question..."
          />
        </div>

        {/* Options spécifiques au type */}
        {question.type === 'scale' && (
          <p className="text-xs text-muted-foreground">
            Échelle de notation : 1 à 10
          </p>
        )}

        {question.type === 'mcq' && (
          <div>
            <Label className="text-xs text-muted-foreground mb-1">
              Options (séparées par des virgules)
            </Label>
            <Input
              value={question.options?.join(', ') ?? ''}
              onChange={e => {
                const opts = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                onUpdate(index, 'options', opts)
              }}
              placeholder="Trop facile, Adapté, Trop difficile"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// ExerciseFormBuilder — formulaire principal
// ============================================================

interface ExerciseFormBuilderProps {
  onSuccess?: (exerciseId: string) => void
  onCancel?: () => void
}

export function ExerciseFormBuilder({ onSuccess, onCancel }: ExerciseFormBuilderProps) {
  const router = useRouter()

  const [formData, setFormData] = useState<ExerciseFormData>({
    titre:       '',
    description: '',
    categorie:   '',
    questions:   [],
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ajouter une question selon son type
  function addQuestion(type: ExerciseQuestionType) {
    const newQuestion: ExerciseQuestion = {
      id:      crypto.randomUUID(),
      type,
      label:   '',
      ...(type === 'scale' ? { min: 1, max: 10 } : {}),
      ...(type === 'mcq'   ? { options: [] }     : {}),
    }
    setFormData(prev => ({ ...prev, questions: [...prev.questions, newQuestion] }))
  }

  // Supprimer une question
  function removeQuestion(index: number) {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }))
  }

  // Mettre à jour un champ d'une question
  function updateQuestion(index: number, field: keyof ExerciseQuestion, value: string | string[]) {
    setFormData(prev => {
      const updated = [...prev.questions]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, questions: updated }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!formData.titre.trim()) {
      setError('Le titre est obligatoire.')
      return
    }
    if (!formData.categorie.trim()) {
      setError('La catégorie est obligatoire.')
      return
    }
    if (formData.questions.length === 0) {
      setError('Ajoutez au moins une question.')
      return
    }
    for (const q of formData.questions) {
      if (!q.label.trim()) {
        setError('Tous les intitulés de questions doivent être renseignés.')
        return
      }
      if (q.type === 'mcq' && (!q.options || q.options.length < 2)) {
        setError('Les questions à choix multiples nécessitent au moins 2 options.')
        return
      }
    }

    setIsLoading(true)
    try {
      const result = await createCustomExerciseAction({
        titre:       formData.titre.trim(),
        description: formData.description.trim() || undefined,
        categorie:   formData.categorie.trim(),
        questions:   formData.questions,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      if (result.data) {
        onSuccess?.(result.data.id)
        router.refresh()
      }
    } catch {
      setError('Une erreur inattendue est survenue. Veuillez réessayer.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Champs principaux */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="titre">Titre de l'exercice *</Label>
          <Input
            id="titre"
            value={formData.titre}
            onChange={e => setFormData(prev => ({ ...prev, titre: e.target.value }))}
            placeholder="Ex : Bilan émotionnel pré-match"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="categorie">Catégorie *</Label>
          <Input
            id="categorie"
            value={formData.categorie}
            onChange={e => setFormData(prev => ({ ...prev, categorie: e.target.value }))}
            placeholder="Ex : mental, physique, récupération..."
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Description optionnelle de l'exercice..."
            className="mt-1 resize-none"
            rows={3}
          />
        </div>
      </div>

      {/* Section questions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Questions ({formData.questions.length})</h3>
        </div>

        {formData.questions.length > 0 && (
          <div className="space-y-3">
            {formData.questions.map((q, i) => (
              <QuestionBuilderItem
                key={q.id}
                question={q}
                index={i}
                onUpdate={updateQuestion}
                onRemove={removeQuestion}
              />
            ))}
          </div>
        )}

        {/* Boutons d'ajout */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addQuestion('open')}
            className="text-[#7069F4] border-[#7069F4] hover:bg-[#F1F0FE]"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Question ouverte
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addQuestion('scale')}
            className="text-[#3C3CD6] border-[#3C3CD6] hover:bg-purple-50"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Notation 1-10
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addQuestion('mcq')}
            className="text-amber-700 border-amber-400 hover:bg-amber-50"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Choix multiples
          </Button>
        </div>
      </div>

      {/* Message d'erreur */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Annuler
          </Button>
        )}
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-[#7069F4] hover:bg-[#7069F4]/90 text-white"
        >
          {isLoading ? 'Création...' : 'Créer l\'exercice'}
        </Button>
      </div>
    </form>
  )
}
