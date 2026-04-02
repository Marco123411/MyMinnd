import type { ProgrammeAvecEtapes, ProgrammeStats } from '@/types'

// Calcul des statistiques d'avancement d'un programme
// Fonction pure — utilisable côté client et serveur sans 'use server'
export function computeProgrammeStats(programme: ProgrammeAvecEtapes): ProgrammeStats {
  const total = programme.etapes.length
  const completes = programme.etapes.filter((e) => e.est_complete).length
  return {
    programme_id:     programme.id,
    total_etapes:     total,
    etapes_completes: completes,
    taux_completion:  total > 0 ? Math.round((completes / total) * 100) : 0,
  }
}
