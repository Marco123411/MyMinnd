'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  updateAdminExerciseAction,
  updateAdminProfileAction,
  updateAdminQuestionAction,
  getAdminQuestionsAction,
} from '@/app/actions/admin'
import type { AdminContentExercise, AdminProfile, AdminQuestion } from '@/types'

type CognitiveTestItem = {
  id: string
  slug: string
  name: string
  description: string | null
  duration_minutes: number
  trial_based: boolean
  config: Record<string, unknown> | null
  is_active: boolean
}

// ============================================================
// Onglet Exercices
// ============================================================
function ExercisesTab({ initialExercises }: { initialExercises: AdminContentExercise[] }) {
  const [exercises, setExercises] = useState(initialExercises)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ titre: string; description: string; categorie: string }>({
    titre: '',
    description: '',
    categorie: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const FORMAT_LABELS: Record<string, string> = {
    video: 'Vidéo',
    document: 'Document',
    audio: 'Audio',
    questionnaire: 'Questionnaire',
    interactive: 'Interactif',
  }

  function startEdit(ex: AdminContentExercise) {
    setEditingId(ex.id)
    setEditForm({ titre: ex.titre, description: ex.description ?? '', categorie: ex.categorie ?? '' })
    setError(null)
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const result = await updateAdminExerciseAction(id, {
      titre: editForm.titre,
      description: editForm.description,
      categorie: editForm.categorie,
    })
    if (result.error) {
      setError(result.error)
    } else {
      setExercises((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, titre: editForm.titre, description: editForm.description, categorie: editForm.categorie }
            : e
        )
      )
      setEditingId(null)
    }
    setSaving(false)
  }

  async function togglePublic(id: string, current: boolean) {
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, is_public: !current } : e)))
    const result = await updateAdminExerciseAction(id, { is_public: !current })
    if (result.error) {
      setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, is_public: current } : e)))
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
          {error}
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Propriétaire</TableHead>
              <TableHead className="text-center">Actif (public)</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {exercises.map((ex) => (
              <TableRow key={ex.id}>
                <TableCell>
                  {editingId === ex.id ? (
                    <Input
                      value={editForm.titre}
                      onChange={(e) => setEditForm((f) => ({ ...f, titre: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  ) : (
                    <span className="font-medium text-sm">{ex.titre}</span>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === ex.id ? (
                    <Input
                      value={editForm.categorie}
                      onChange={(e) => setEditForm((f) => ({ ...f, categorie: e.target.value }))}
                      className="h-8 text-sm w-28"
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">{ex.categorie ?? '—'}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {FORMAT_LABELS[ex.format] ?? ex.format}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {ex.is_custom ? (ex.coach_nom ?? 'Coach') : 'MINND'}
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={ex.is_public}
                    onCheckedChange={() => togglePublic(ex.id, ex.is_public)}
                    disabled={ex.is_custom}
                    aria-label="Actif"
                  />
                </TableCell>
                <TableCell className="text-right">
                  {editingId === ex.id ? (
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" onClick={() => saveEdit(ex.id)} disabled={saving}>
                        {saving ? '...' : 'Sauvegarder'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Annuler
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => startEdit(ex)}>
                      Modifier
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ============================================================
// Onglet Profils mentaux
// ============================================================
function ProfilesTab({ initialProfiles }: { initialProfiles: AdminProfile[] }) {
  const [profiles, setProfiles] = useState(initialProfiles)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    description: string
    strengths: string
    weaknesses: string
    recommendations: string
  }>({ description: '', strengths: '', weaknesses: '', recommendations: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEdit(profile: AdminProfile) {
    setEditingId(profile.id)
    setEditForm({
      description: profile.description ?? '',
      strengths: profile.strengths ?? '',
      weaknesses: profile.weaknesses ?? '',
      recommendations: profile.recommendations ?? '',
    })
    setError(null)
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const result = await updateAdminProfileAction(id, editForm)
    if (result.error) {
      setError(result.error)
    } else {
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...editForm } : p))
      )
      setEditingId(null)
    }
    setSaving(false)
  }

  // Grouper par test_definition
  const grouped = profiles.reduce<Record<string, AdminProfile[]>>((acc, p) => {
    const key = p.test_definition_name
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
          {error}
        </div>
      )}
      {Object.entries(grouped).map(([testName, testProfiles]) => (
        <div key={testName} className="space-y-3">
          <h3 className="font-semibold text-[#141325] text-base border-b pb-2">{testName}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {testProfiles.map((profile) => (
              <Card key={profile.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: profile.color }}
                    />
                    <CardTitle className="text-sm font-medium">{profile.name}</CardTitle>
                    {profile.family && (
                      <Badge variant="outline" className="text-xs">{profile.family}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {editingId === profile.id ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Description</label>
                        <Textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                          rows={3}
                          className="text-sm resize-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Forces</label>
                        <Textarea
                          value={editForm.strengths}
                          onChange={(e) => setEditForm((f) => ({ ...f, strengths: e.target.value }))}
                          rows={2}
                          className="text-sm resize-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Faiblesses</label>
                        <Textarea
                          value={editForm.weaknesses}
                          onChange={(e) => setEditForm((f) => ({ ...f, weaknesses: e.target.value }))}
                          rows={2}
                          className="text-sm resize-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Recommandations</label>
                        <Textarea
                          value={editForm.recommendations}
                          onChange={(e) => setEditForm((f) => ({ ...f, recommendations: e.target.value }))}
                          rows={2}
                          className="text-sm resize-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(profile.id)} disabled={saving}>
                          {saving ? '...' : 'Sauvegarder'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          Annuler
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {profile.description ? (
                        <p className="text-xs text-muted-foreground line-clamp-3">{profile.description}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Aucune description</p>
                      )}
                      <Button size="sm" variant="outline" onClick={() => startEdit(profile)}>
                        Modifier les textes
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// Onglet Questions
// ============================================================
function QuestionsTab({
  initialQuestions,
  testDefinitions,
}: {
  initialQuestions: AdminQuestion[]
  testDefinitions: { id: string; slug: string; name: string }[]
}) {
  const [questions, setQuestions] = useState(initialQuestions)
  const [selectedTestId, setSelectedTestId] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function loadQuestions(testId: string) {
    setSelectedTestId(testId)
    setLoadError(null)
    setLoading(true)
    try {
      const result = await getAdminQuestionsAction(testId === 'all' ? undefined : testId)
      if (result.error) {
        setLoadError(result.error)
      } else {
        setQuestions(result.data)
      }
    } finally {
      setLoading(false)
    }
  }

  async function toggleReversed(id: string, current: boolean) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, is_reversed: !current } : q)))
    const result = await updateAdminQuestionAction(id, { is_reversed: !current })
    if (result.error) {
      setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, is_reversed: current } : q)))
    }
  }

  async function toggleActive(id: string, current: boolean) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, is_active: !current } : q)))
    const result = await updateAdminQuestionAction(id, { is_active: !current })
    if (result.error) {
      setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, is_active: current } : q)))
    }
  }

  async function saveText(id: string) {
    setSaving(true)
    setSaveError(null)
    const result = await updateAdminQuestionAction(id, { text_fr: editText })
    if (result.error) {
      setSaveError(result.error)
    } else {
      setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, text_fr: editText } : q)))
      setEditingId(null)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={selectedTestId} onValueChange={loadQuestions}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Sélectionner un test" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les questions</SelectItem>
            {testDefinitions.map((td) => (
              <SelectItem key={td.id} value={td.id}>{td.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {loading ? 'Chargement...' : `${questions.length} question${questions.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {(loadError || saveError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
          {loadError ?? saveError}
        </div>
      )}

      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
        ⚠️ Les questions ne peuvent pas être ajoutées ou supprimées (impact sur le scoring).
        Seules la formulation, le flag &quot;inversé&quot; et l&apos;activation sont modifiables.
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/2">Question</TableHead>
              <TableHead>Compétence</TableHead>
              <TableHead>Niveau</TableHead>
              <TableHead className="text-center">Inversée</TableHead>
              <TableHead className="text-center">Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.slice(0, 100).map((q) => (
              <TableRow key={q.id} className={!q.is_active ? 'opacity-50' : ''}>
                <TableCell className="max-w-xs">
                  {editingId === q.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={2}
                        className="text-sm resize-none"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveText(q.id)} disabled={saving}>
                          {saving ? '...' : 'OK'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          ✕
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm line-clamp-2">{q.text_fr}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {q.competency_node_name}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {q.level_required ?? '—'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={q.is_reversed}
                    onCheckedChange={() => toggleReversed(q.id, q.is_reversed)}
                    aria-label="Inversée"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={q.is_active}
                    onCheckedChange={() => toggleActive(q.id, q.is_active)}
                    aria-label="Active"
                  />
                </TableCell>
                <TableCell>
                  {editingId !== q.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => { setEditingId(q.id); setEditText(q.text_fr) }}
                    >
                      Éditer
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {questions.length > 100 && (
        <p className="text-xs text-muted-foreground text-center">
          Affichage limité à 100 questions. Utilisez le filtre par test pour accéder à toutes les questions.
        </p>
      )}
    </div>
  )
}

// ============================================================
// Onglet Tests cognitifs
// ============================================================
function CognitiveConfigTab({
  cognitiveTests,
}: {
  cognitiveTests: CognitiveTestItem[]
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {cognitiveTests.map((test) => (
        <Card key={test.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{test.name}</CardTitle>
              <Badge
                variant="outline"
                className={test.is_active ? 'bg-[#F1F0FE] text-[#7069F4] border-0' : 'bg-gray-100 text-gray-500 border-0'}
              >
                {test.is_active ? 'Actif' : 'Inactif'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{test.description ?? test.slug}</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Durée estimée</span>
                <span className="font-medium">{test.duration_minutes} min</span>
                <span className="text-muted-foreground">Trial-based</span>
                <span className="font-medium">{test.trial_based ? 'Oui' : 'Non'}</span>
              </div>
              {test.config && Object.keys(test.config).length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Configuration</p>
                  <pre className="text-xs bg-gray-50 rounded p-2 overflow-auto max-h-40 text-gray-700">
                    {JSON.stringify(test.config, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      {cognitiveTests.length === 0 && (
        <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">
          Aucun test cognitif configuré
        </div>
      )}
    </div>
  )
}

// ============================================================
// Composant principal
// ============================================================
interface Props {
  initialExercises: AdminContentExercise[]
  initialProfiles: AdminProfile[]
  initialQuestions: AdminQuestion[]
  testDefinitions: { id: string; slug: string; name: string }[]
  cognitiveTests: CognitiveTestItem[]
}

export function ContentPageClient({
  initialExercises,
  initialProfiles,
  initialQuestions,
  testDefinitions,
  cognitiveTests,
}: Props) {
  return (
    <Tabs defaultValue="exercises">
      <TabsList className="mb-6">
        <TabsTrigger value="exercises">Exercices</TabsTrigger>
        <TabsTrigger value="profiles">Profils mentaux</TabsTrigger>
        <TabsTrigger value="questions">Questions</TabsTrigger>
        <TabsTrigger value="cognitive">Tests cognitifs</TabsTrigger>
      </TabsList>

      <TabsContent value="exercises">
        <ExercisesTab initialExercises={initialExercises} />
      </TabsContent>

      <TabsContent value="profiles">
        <ProfilesTab initialProfiles={initialProfiles} />
      </TabsContent>

      <TabsContent value="questions">
        <QuestionsTab initialQuestions={initialQuestions} testDefinitions={testDefinitions} />
      </TabsContent>

      <TabsContent value="cognitive">
        <CognitiveConfigTab cognitiveTests={cognitiveTests} />
      </TabsContent>
    </Tabs>
  )
}
