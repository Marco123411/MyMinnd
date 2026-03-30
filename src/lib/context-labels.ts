export const contextLabels = {
  sport: {
    title: 'Performance sportive',
    profileLabel: "Profil d'athlète",
    ctaTest: 'Évaluez votre potentiel mental',
  },
  wellbeing: {
    title: 'Équilibre émotionnel',
    profileLabel: 'Profil personnel',
    ctaTest: 'Évaluez votre équilibre mental',
  },
  corporate: {
    title: 'Efficacité professionnelle',
    profileLabel: 'Profil professionnel',
    ctaTest: 'Évaluez votre profil mental',
  },
  coaching: {
    title: 'Développement personnel',
    profileLabel: 'Profil de développement',
    ctaTest: 'Évaluez votre potentiel',
  },
} as const

export type ContextKey = keyof typeof contextLabels
