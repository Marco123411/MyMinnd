-- Étape 25 : Seed données intelligence profil
-- Met à jour les 8 profils PMA avec données enrichies
-- Insère la matrice de compatibilité 8×8 et les données de l'étude N=5705

-- ============================================================
-- 1. Enrichissement des 8 profils PMA
-- ============================================================

-- Le Maestro
UPDATE profiles SET
  tagline = 'L''excellence sur tous les tableaux',
  description = 'Le Maestro possède une maîtrise mentale exceptionnelle et homogène sur l''ensemble des dimensions. Il combine une confiance en soi élevée (8.23), un flow naturel (8.32), une capacité de reconcentration supérieure (8.40) et une excellente gestion corporelle (relaxation 8.08, activation 7.90). C''est l''athlète qui semble tout maîtriser — et qui maîtrise effectivement. Sa capacité à se régénérer mentalement après un échec et à retrouver son état optimal le distingue de tous les autres profils.',
  forces_details = '[
    {"label": "Reconcentration exceptionnelle", "z": 1.24, "sub_slug": "reconcentration"},
    {"label": "Confiance en soi élevée", "z": 1.13, "sub_slug": "confiance_en_soi"},
    {"label": "Activation corporelle maîtrisée", "z": 1.10, "sub_slug": "activation"},
    {"label": "Flow naturel et fréquent", "z": 1.06, "sub_slug": "flow"},
    {"label": "Relaxation à la demande", "z": 1.06, "sub_slug": "relaxation"}
  ]'::jsonb,
  faiblesses_details = '[
    {"label": "Motivation extrinsèque dans la moyenne", "z": -0.02, "sub_slug": "motivation_extrinseque"},
    {"label": "Lucidité émotionnelle dans la moyenne", "z": -0.00, "sub_slug": "lucidite_emotionnelle"}
  ]'::jsonb,
  celebrity_examples = '[
    {"name": "Roger Federer", "sport": "Tennis", "reason": "Maîtrise technique et mentale totale, capacité de reconcentration légendaire après un set perdu, sérénité apparente sous pression."},
    {"name": "Zinédine Zidane", "sport": "Football", "reason": "Flow naturel sur le terrain, vision du jeu exceptionnelle, capacité à élever son niveau dans les grands moments."},
    {"name": "Simone Biles", "sport": "Gymnastique", "reason": "Confiance en soi et activation corporelle au sommet, capacité à repousser les limites de son sport avec calme."},
    {"name": "Michael Jordan", "sport": "Basketball", "reason": "Reconcentration absolue — perdre un match ne faisait que renforcer sa détermination au suivant."}
  ]'::jsonb,
  coach_priority = 'Défis de maîtrise constants',
  coach_exercise = 'Varier les environnements, travail de lucidité émotionnelle',
  coach_trap = 'Routine et ennui',
  team_role = 'Capitaine / Mentor',
  team_contribution = 'Stabilise par l''exemple, guide les moins expérimentés',
  avg_compatibility = 6.9
WHERE name = 'Le Maestro'
  AND test_definition_id = (SELECT id FROM test_definitions WHERE slug = 'pma');

-- Le Conquérant
UPDATE profiles SET
  tagline = 'L''ambition au service de la performance',
  forces_details = '[
    {"label": "Flow intense", "z": 0.76, "sub_slug": "flow"},
    {"label": "Pratique mentale développée", "z": 0.68, "sub_slug": "pratique_mentale"},
    {"label": "Dépassement de soi", "z": 0.67, "sub_slug": "depassement_de_soi"},
    {"label": "Rêverie productive", "z": 0.65, "sub_slug": "reverie"},
    {"label": "Planification des objectifs", "z": 0.61, "sub_slug": "planification_objectifs"}
  ]'::jsonb,
  faiblesses_details = '[
    {"label": "Lâcher-prise difficile", "z": -0.48, "sub_slug": "lacher_prise"}
  ]'::jsonb,
  celebrity_examples = '[
    {"name": "Cristiano Ronaldo", "sport": "Football", "reason": "Ambition et dépassement de soi légendaires, planification méticuleuse de sa carrière, refus systématique de la défaite."},
    {"name": "Serena Williams", "sport": "Tennis", "reason": "Flow compétitif et pratique mentale au service d''une ambition sans limite, reconquête après chaque revers."},
    {"name": "Kobe Bryant", "sport": "Basketball", "reason": "Mamba Mentality — dépassement de soi absolu, travail acharné, objectifs clairs et non négociables."},
    {"name": "Conor McGregor", "sport": "Arts martiaux mixtes", "reason": "Visualisation intense, confiance affichée, planification de chaque combat comme une conquête."}
  ]'::jsonb,
  coach_priority = 'Lâcher-prise et acceptation',
  coach_exercise = 'Exercices de détachement du résultat, méditation de pleine conscience',
  coach_trap = 'Obsession du résultat',
  team_role = 'Moteur / Leader offensif',
  team_contribution = 'Tire le groupe vers le haut, insuffle l''énergie compétitive',
  avg_compatibility = 6.1
WHERE name = 'Le Conquérant'
  AND test_definition_id = (SELECT id FROM test_definitions WHERE slug = 'pma');

-- Le Stratège
UPDATE profiles SET
  tagline = 'La tête froide qui fait la différence',
  forces_details = '[
    {"label": "Gestion du stress psychologique", "z": 0.76, "sub_slug": "stress_psychologique"},
    {"label": "Lâcher-prise naturel", "z": 0.73, "sub_slug": "lacher_prise"},
    {"label": "Résistance au stress quotidien", "z": 0.64, "sub_slug": "stress_quotidien"},
    {"label": "Gestion du stress somatique", "z": 0.62, "sub_slug": "stress_somatique"},
    {"label": "Reconcentration efficace", "z": 0.60, "sub_slug": "reconcentration"}
  ]'::jsonb,
  faiblesses_details = '[
    {"label": "Lucidité émotionnelle limitée", "z": -0.48, "sub_slug": "lucidite_emotionnelle"}
  ]'::jsonb,
  celebrity_examples = '[
    {"name": "Andrea Pirlo", "sport": "Football", "reason": "Calme olympien sous pression, lecture du jeu exceptionnelle, maîtrise totale de ses émotions en compétition."},
    {"name": "Nikola Jokić", "sport": "Basketball", "reason": "Gestion du stress et lâcher-prise uniques, décisions sous pression remarquablement stables."},
    {"name": "Alain Prost", "sport": "Formule 1", "reason": "Le Professeur — stratégie froide, gestion du stress et du risque calculée, résistance mentale sur la durée."},
    {"name": "Teddy Riner", "sport": "Judo", "reason": "Sérénité légendaire avant les compétitions, capacité à se reconcentrer après une erreur rare."}
  ]'::jsonb,
  coach_priority = 'Lucidité émotionnelle',
  coach_exercise = 'Journaling émotionnel, check-in corporel avant/après entraînement',
  coach_trap = 'Déconnexion des ressentis',
  team_role = 'Régulateur / Ancre',
  team_contribution = 'Stabilise le groupe sous pression, apporte la clarté dans les moments de stress',
  avg_compatibility = 7.3
WHERE name = 'Le Stratège'
  AND test_definition_id = (SELECT id FROM test_definitions WHERE slug = 'pma');

-- L'Instinctif
UPDATE profiles SET
  tagline = 'L''énergie brute au service de la compétition',
  forces_details = '[
    {"label": "Motivation extrinsèque forte", "z": 0.47, "sub_slug": "motivation_extrinseque"},
    {"label": "Attrait pour la compétition", "z": 0.42, "sub_slug": "attrait_competition"},
    {"label": "Engagement élevé", "z": 0.34, "sub_slug": "engagement"}
  ]'::jsonb,
  faiblesses_details = '[
    {"label": "Focus insuffisant", "z": -0.54, "sub_slug": "focus"},
    {"label": "Reconcentration difficile", "z": -0.35, "sub_slug": "reconcentration"},
    {"label": "Impulsivité non contrôlée", "z": -0.35, "sub_slug": "impulsivite"}
  ]'::jsonb,
  celebrity_examples = '[
    {"name": "Neymar Jr", "sport": "Football", "reason": "Énergie brute et créativité compétitive, mais parfois submergé par l''impulsivité sous pression."},
    {"name": "Nick Kyrgios", "sport": "Tennis", "reason": "Talent brut immense et attrait compétitif intense, mais focus et reconcentration souvent en défaut."},
    {"name": "Mario Balotelli", "sport": "Football", "reason": "Énergie compétitive explosive, motivation extrinsèque puissante, impulsivité qui limite le potentiel."},
    {"name": "John McEnroe", "sport": "Tennis", "reason": "Passion compétitive exceptionnelle, énergie brute transformée en performance, avec l''impulsivité comme double tranchant."}
  ]'::jsonb,
  coach_priority = 'Routines de concentration',
  coach_exercise = 'Protocoles de focus pré-compétition, travail de la respiration et de l''ancrage',
  coach_trap = 'Impulsivité non canalisée',
  team_role = 'Étincelle / Joker',
  team_contribution = 'Apporte l''énergie et l''imprévisibilité, déstabilise l''adversaire',
  avg_compatibility = 5.4
WHERE name = 'L''Instinctif'
  AND test_definition_id = (SELECT id FROM test_definitions WHERE slug = 'pma');

-- Le Pilier
UPDATE profiles SET
  tagline = 'La force tranquille qui tient la structure',
  forces_details = '[
    {"label": "Lucidité émotionnelle élevée", "z": 0.69, "sub_slug": "lucidite_emotionnelle"},
    {"label": "Focus soutenu", "z": 0.49, "sub_slug": "focus"},
    {"label": "Imagerie mentale développée", "z": 0.39, "sub_slug": "imagerie"}
  ]'::jsonb,
  faiblesses_details = '[
    {"label": "Stress somatique élevé", "z": -0.74, "sub_slug": "stress_somatique"},
    {"label": "Faible attrait compétitif", "z": -0.64, "sub_slug": "attrait_competition"},
    {"label": "Stress psychologique important", "z": -0.62, "sub_slug": "stress_psychologique"},
    {"label": "Performance en compétition limitée", "z": -0.61, "sub_slug": "performance_competition"}
  ]'::jsonb,
  celebrity_examples = '[
    {"name": "Naomi Osaka", "sport": "Tennis", "reason": "Lucidité émotionnelle remarquable et courage de nommer ses difficultés, stress pré-compétitif comme défi personnel."},
    {"name": "Simone Biles", "sport": "Gymnastique", "reason": "Crise de 2021 — lucidité exemplaire sur ses limites, gestion du stress corporel comme priorité numéro un."},
    {"name": "Andrés Iniesta", "sport": "Football", "reason": "Lucidité émotionnelle et focus exceptionnel, but de la finale du Mondial malgré une période personnelle difficile."}
  ]'::jsonb,
  coach_priority = 'Gestion du stress pré-compétitif',
  coach_exercise = 'Cohérence cardiaque, routines de préparation physique et mentale avant compétition',
  coach_trap = 'Rumination excessive',
  team_role = 'Émotionnel / Empathique',
  team_contribution = 'Maintient la cohésion du groupe, détecte les tensions émotionnelles',
  avg_compatibility = 6.2
WHERE name = 'Le Pilier'
  AND test_definition_id = (SELECT id FROM test_definitions WHERE slug = 'pma');

-- Le Résilient
UPDATE profiles SET
  tagline = 'La constance dans la tempête',
  forces_details = '[
    {"label": "Lâcher-prise fonctionnel", "z": 0.21, "sub_slug": "lacher_prise"},
    {"label": "Résistance somatique", "z": 0.11, "sub_slug": "stress_somatique"}
  ]'::jsonb,
  faiblesses_details = '[
    {"label": "Planification des objectifs faible", "z": -0.90, "sub_slug": "planification_objectifs"},
    {"label": "Dépassement de soi limité", "z": -0.83, "sub_slug": "depassement_de_soi"},
    {"label": "Engagement réduit", "z": -0.77, "sub_slug": "engagement"},
    {"label": "Motivation intrinsèque faible", "z": -0.71, "sub_slug": "motivation_intrinseque"}
  ]'::jsonb,
  celebrity_examples = '[
    {"name": "Antoine Griezmann", "sport": "Football", "reason": "Constance et régularité remarquables, résistance aux critiques, mais parfois manque d''étincelle dans les grands soirs."},
    {"name": "Andy Murray", "sport": "Tennis", "reason": "Résilience physique et mentale hors norme, capacité à continuer malgré les obstacles — mais avec des hauts et des bas de motivation."},
    {"name": "Tony Parker", "sport": "Basketball", "reason": "Constance sur la durée, résilience face aux défis physiques, but parfois des cycles de remise en question."}
  ]'::jsonb,
  coach_priority = 'Objectifs clairs et motivants',
  coach_exercise = 'Définition d''objectifs SMART, connexion au sens personnel du sport',
  coach_trap = 'Perte de sens',
  team_role = 'Base / Équilibre',
  team_contribution = 'Apporte la stabilité et la continuité, limite les décisions impulsives du groupe',
  avg_compatibility = 5.9
WHERE name = 'Le Résilient'
  AND test_definition_id = (SELECT id FROM test_definitions WHERE slug = 'pma');

-- L'Explorateur
UPDATE profiles SET
  tagline = 'Le potentiel qui cherche sa voie',
  forces_details = '[
    {"label": "Lucidité émotionnelle présente", "z": 0.47, "sub_slug": "lucidite_emotionnelle"}
  ]'::jsonb,
  faiblesses_details = '[
    {"label": "Reconcentration très difficile", "z": -1.21, "sub_slug": "reconcentration"},
    {"label": "Confiance en soi très basse", "z": -1.18, "sub_slug": "confiance_en_soi"},
    {"label": "Stress psychologique élevé", "z": -1.16, "sub_slug": "stress_psychologique"},
    {"label": "Stress somatique élevé", "z": -1.05, "sub_slug": "stress_somatique"},
    {"label": "Estime de soi fragilisée", "z": -1.01, "sub_slug": "estime_de_soi"}
  ]'::jsonb,
  celebrity_examples = '[
    {"name": "Gianluigi Donnarumma", "sport": "Football / Gardien", "reason": "Jeune talent sous pression immense, stress visible en compétition, mais lucidité sur ses forces en construction."},
    {"name": "Ben Simmons", "sport": "Basketball", "reason": "Talent pur en développement, anxiété compétitive documentée, confiance en soi fragilisée par les attentes."},
    {"name": "Marcus Rashford", "sport": "Football", "reason": "Potentiel immense mais périodes de doute profond, stress de la performance visible, reconstruction en cours."}
  ]'::jsonb,
  coach_priority = 'Gestion structurée du stress',
  coach_exercise = 'Exposition progressive, construction de petites victoires quotidiennes, techniques de relaxation',
  coach_trap = 'Pression excessive',
  team_role = 'Sensible / Vigie',
  team_contribution = 'Perçoit les signaux faibles du groupe, apporte une perspective émotionnelle fine',
  avg_compatibility = 4.7
WHERE name = 'L''Explorateur'
  AND test_definition_id = (SELECT id FROM test_definitions WHERE slug = 'pma');

-- Le Combattant
UPDATE profiles SET
  tagline = 'La reconstruction commence ici',
  forces_details = '[
    {"label": "Lâcher-prise résiduel", "z": 0.15, "sub_slug": "lacher_prise"}
  ]'::jsonb,
  faiblesses_details = '[
    {"label": "Goût de l''effort très bas", "z": -2.77, "sub_slug": "gout_effort"},
    {"label": "Motivation intrinsèque effondrée", "z": -2.74, "sub_slug": "motivation_intrinseque"},
    {"label": "Engagement minimal", "z": -2.38, "sub_slug": "engagement"},
    {"label": "Locus de contrôle externe", "z": -2.10, "sub_slug": "locus_controle"},
    {"label": "Attrait compétitif très faible", "z": -1.84, "sub_slug": "attrait_competition"}
  ]'::jsonb,
  celebrity_examples = '[
    {"name": "André Agassi (jeunesse)", "sport": "Tennis", "reason": "Periode de désengagement profond dans sa jeunesse, perte de sens du sport, reconstruction identitaire avant la renaissance."},
    {"name": "Adriano", "sport": "Football", "reason": "Talent immense confronté à une perte totale de motivation et d''engagement — témoignage d''un potentiel non réalisé."},
    {"name": "Lamar Odom", "sport": "Basketball", "reason": "Crises personnelles ayant conduit à une perte de motivation et d''engagement sportif, tentative de reconstruction."}
  ]'::jsonb,
  coach_priority = 'Retrouver le plaisir',
  coach_exercise = 'Activités ludiques sans enjeu, retour aux fondamentaux du plaisir de pratiquer',
  coach_trap = 'Exigences trop élevées',
  team_role = 'Résilient en devenir',
  team_contribution = 'Apporte une perspective humaine sur la vulnérabilité, peut inspirer par sa reconstruction',
  avg_compatibility = 3.8
WHERE name = 'Le Combattant'
  AND test_definition_id = (SELECT id FROM test_definitions WHERE slug = 'pma');

-- ============================================================
-- 2. Matrice de compatibilité 8×8 (36 paires : 28 uniques + 8 diagonales)
-- ============================================================

-- Fonction d'aide pour retrouver un profil par nom (évite la répétition)
-- On utilise des sous-requêtes directement dans les INSERT

-- Diagonales (profil avec lui-même)
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, p.id, p.id,
  CASE p.name
    WHEN 'Le Maestro'    THEN 7
    WHEN 'Le Conquérant' THEN 6
    WHEN 'Le Stratège'   THEN 7
    WHEN 'L''Instinctif' THEN 5
    WHEN 'Le Pilier'     THEN 6
    WHEN 'Le Résilient'  THEN 6
    WHEN 'L''Explorateur' THEN 4
    WHEN 'Le Combattant' THEN 3
  END
FROM test_definitions td
JOIN profiles p ON p.test_definition_id = td.id
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Paires uniques (A × B avec A ≠ B, ordre alphabétique par name pour éviter les doublons)
-- Maestro × Conquérant
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score, synergie, friction, conseil)
SELECT td.id, pa.id, pb.id, 9,
  'Le duo le plus puissant — la maîtrise du Maestro stabilise l''ambition du Conquérant',
  'Faible — motivations différentes mais compatibles',
  'Le Conquérant tire le duo vers le haut, le Maestro maintient le cap'
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Maestro'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Conquérant'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Maestro × Stratège
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 8
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Maestro'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Stratège'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Maestro × Instinctif
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score, synergie, friction, conseil)
SELECT td.id, pa.id, pb.id, 8,
  'Le Maestro canalise l''énergie brute de l''Instinctif',
  'Le Maestro peut percevoir l''Instinctif comme indiscipliné',
  'Le Maestro joue le rôle de mentor naturel'
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Maestro'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'L''Instinctif'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Maestro × Pilier
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 7
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Maestro'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Pilier'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Maestro × Résilient
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 6
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Maestro'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Résilient'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Maestro × Explorateur
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 6
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Maestro'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'L''Explorateur'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Maestro × Combattant
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 5
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Maestro'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Combattant'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Conquérant × Stratège
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score, synergie, friction, conseil)
SELECT td.id, pa.id, pb.id, 8,
  'Le Stratège tempère l''intensité du Conquérant par son calme',
  'Le Conquérant peut trouver le Stratège trop passif',
  'Le Stratège est l''ancre, le Conquérant est le moteur'
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Conquérant'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Stratège'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Conquérant × Instinctif
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 7
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Conquérant'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'L''Instinctif'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Conquérant × Pilier
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 5
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Conquérant'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Pilier'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Conquérant × Résilient
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 5
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Conquérant'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Résilient'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Conquérant × Explorateur
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score, synergie, friction, conseil)
SELECT td.id, pa.id, pb.id, 4,
  'L''ambition du Conquérant peut inspirer',
  'L''intensité peut aggraver l''anxiété de l''Explorateur',
  'Prudence — le Conquérant doit adapter son intensité'
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Conquérant'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'L''Explorateur'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Conquérant × Combattant
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 3
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Conquérant'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Combattant'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Stratège × Instinctif
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score, synergie, friction, conseil)
SELECT td.id, pa.id, pb.id, 9,
  'Le meilleur duo complémentaire — le calme du Stratège canalise l''énergie de l''Instinctif',
  'Faible si les rôles sont clairs',
  'Duo mentor-protégé naturel, le Stratège structure, l''Instinctif exécute'
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Stratège'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'L''Instinctif'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Stratège × Pilier
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 7
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Stratège'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Pilier'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Stratège × Résilient
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 7
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Stratège'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Résilient'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Stratège × Explorateur
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score, synergie, friction, conseil)
SELECT td.id, pa.id, pb.id, 8,
  'La sérénité du Stratège apaise naturellement l''anxiété de l''Explorateur',
  'Faible',
  'Excellent tandem pour reconstruire la confiance de l''Explorateur'
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Stratège'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'L''Explorateur'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Stratège × Combattant
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 6
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Stratège'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Combattant'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Instinctif × Pilier
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 6
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'L''Instinctif'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Pilier'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Instinctif × Résilient
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 6
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'L''Instinctif'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Résilient'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Instinctif × Explorateur
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 4
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'L''Instinctif'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'L''Explorateur'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Instinctif × Combattant
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 4
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'L''Instinctif'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Combattant'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Pilier × Résilient
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 7
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Pilier'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Résilient'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Pilier × Explorateur
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 7
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Pilier'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'L''Explorateur'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Pilier × Combattant
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 5
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Pilier'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Combattant'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Résilient × Explorateur
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 6
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Résilient'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'L''Explorateur'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Résilient × Combattant
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 5
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'Le Résilient'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Combattant'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- Explorateur × Combattant
INSERT INTO profile_compatibility (test_definition_id, profile_a_id, profile_b_id, score)
SELECT td.id, pa.id, pb.id, 3
FROM test_definitions td
JOIN profiles pa ON pa.test_definition_id = td.id AND pa.name = 'L''Explorateur'
JOIN profiles pb ON pb.test_definition_id = td.id AND pb.name = 'Le Combattant'
WHERE td.slug = 'pma'
ON CONFLICT (test_definition_id, profile_a_id, profile_b_id) DO NOTHING;

-- ============================================================
-- 3. Données de l'étude statistique N=5705
-- ============================================================

INSERT INTO study_reference_data (test_definition_id, key, value)
SELECT id, 'elite_markers', '[
  {"sub_slug": "attrait_competition", "label": "Attrait pour la compétition", "delta": 1.58},
  {"sub_slug": "motivation_extrinseque", "label": "Motivation extrinsèque", "delta": 1.44},
  {"sub_slug": "planification_objectifs", "label": "Planification des objectifs", "delta": 1.11},
  {"sub_slug": "engagement", "label": "Engagement", "delta": 0.95},
  {"sub_slug": "confiance_en_soi", "label": "Confiance en soi", "delta": 0.78},
  {"sub_slug": "activation", "label": "Activation", "delta": 0.77}
]'::jsonb
FROM test_definitions WHERE slug = 'pma'
ON CONFLICT (test_definition_id, key) DO NOTHING;

INSERT INTO study_reference_data (test_definition_id, key, value)
SELECT id, 'global_predictors', '[
  {"sub_slug": "flow", "label": "Flow", "r": 0.708},
  {"sub_slug": "confiance_en_soi", "label": "Confiance en soi", "r": 0.702},
  {"sub_slug": "activation", "label": "Activation", "r": 0.651},
  {"sub_slug": "reconcentration", "label": "Reconcentration", "r": 0.619},
  {"sub_slug": "pratique_mentale", "label": "Pratique mentale", "r": 0.610}
]'::jsonb
FROM test_definitions WHERE slug = 'pma'
ON CONFLICT (test_definition_id, key) DO NOTHING;

INSERT INTO study_reference_data (test_definition_id, key, value)
SELECT id, 'key_correlations', '[
  {"pair": ["stress_somatique", "stress_psychologique"], "r": 0.586, "label": "Stress somatique ↔ Stress psychologique"},
  {"pair": ["confiance_en_soi", "estime_de_soi"], "r": 0.581, "label": "Confiance en soi ↔ Estime de soi"},
  {"pair": ["engagement", "motivation_intrinseque"], "r": 0.581, "label": "Engagement ↔ Motivation intrinsèque"},
  {"pair": ["flow", "activation"], "r": 0.555, "label": "Flow ↔ Activation"},
  {"pair": ["confiance_en_soi", "flow"], "r": 0.532, "label": "Confiance en soi ↔ Flow"}
]'::jsonb
FROM test_definitions WHERE slug = 'pma'
ON CONFLICT (test_definition_id, key) DO NOTHING;

INSERT INTO study_reference_data (test_definition_id, key, value)
SELECT id, 'scores_by_level', '[
  {"level": "Départemental", "n": 796, "score": 6.31},
  {"level": "Régional", "n": 987, "score": 6.50},
  {"level": "National", "n": 1461, "score": 6.55},
  {"level": "International", "n": 457, "score": 6.75}
]'::jsonb
FROM test_definitions WHERE slug = 'pma'
ON CONFLICT (test_definition_id, key) DO NOTHING;

INSERT INTO study_reference_data (test_definition_id, key, value)
SELECT id, 'non_discriminant_subs', '["stress_psychologique", "lacher_prise", "regulation_emotionnelle", "concentration", "gestion_blessure", "reverie"]'::jsonb
FROM test_definitions WHERE slug = 'pma'
ON CONFLICT (test_definition_id, key) DO NOTHING;

INSERT INTO study_reference_data (test_definition_id, key, value)
SELECT id, 'conditional_insights', '[
  {
    "id": "cercle_vertueux",
    "title": "Cercle vertueux Confiance-Flow",
    "condition": {"min": {"confiance_en_soi": 7, "flow": 7}},
    "text_positive": "Votre confiance élevée alimente naturellement vos états de flow. Ce cercle vertueux est votre principal avantage compétitif (corrélation r=0.532). Continuez à nourrir cette dynamique.",
    "text_negative": "La confiance en soi et le flow sont fortement corrélés (r=0.532). Travailler votre confiance pourrait débloquer vos capacités de flow en cascade."
  },
  {
    "id": "piege_lucidite",
    "title": "Le piège de la lucidité émotionnelle",
    "condition": {"min": {"lucidite_emotionnelle": 7}, "max": {"stress_quotidien": 5}},
    "text_positive": "Attention : votre forte lucidité émotionnelle est associée à un stress élevé. La lucidité sans outils de gestion amplifie le ressenti du stress (corrélation négative r=-0.313). Priorité : techniques de régulation.",
    "text_negative": null
  },
  {
    "id": "double_stress",
    "title": "Double vulnérabilité stress",
    "condition": {"max": {"stress_somatique": 5, "stress_psychologique": 5}},
    "text_positive": "Vos scores de stress somatique et psychologique sont corrélés (r=0.586). Un travail global sur la gestion du stress est recommandé plutôt qu''un travail séparé sur chaque dimension.",
    "text_negative": null
  },
  {
    "id": "socle_motivationnel",
    "title": "Socle motivationnel solide",
    "condition": {"min": {"engagement": 8, "motivation_intrinseque": 8}},
    "text_positive": "Engagement et motivation intrinsèque élevés et corrélés (r=0.581). C''est le fondement d''une progression durable. Ce socle est votre meilleur atout.",
    "text_negative": null
  },
  {
    "id": "synergie_flow_activation",
    "title": "Synergie Flow-Activation",
    "condition": {"min": {"flow": 7, "activation": 7}},
    "text_positive": "Flow et activation se renforcent mutuellement (r=0.555). Votre capacité d''activation soutient vos états de flow. Exploitez cette synergie dans vos routines pré-compétition.",
    "text_negative": null
  },
  {
    "id": "marqueurs_elite",
    "title": "Profil élite détecté",
    "condition": {"min": {"attrait_competition": 8, "planification_objectifs": 7, "confiance_en_soi": 7, "activation": 7}},
    "text_positive": "Vous possédez 4 des 6 marqueurs qui distinguent les athlètes internationaux des départementaux. C''est un profil de haut niveau.",
    "text_negative": null
  },
  {
    "id": "age_no_factor",
    "title": "L''âge n''est pas un facteur",
    "condition": "always",
    "text_positive": "Le profil mental est stable de 15 à 65+ ans (variation < 0.2 point). La performance mentale est un ensemble de compétences développables, pas un trait lié à l''âge.",
    "text_negative": null
  }
]'::jsonb
FROM test_definitions WHERE slug = 'pma'
ON CONFLICT (test_definition_id, key) DO NOTHING;
