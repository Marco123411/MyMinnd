-- Seed: Profil Mental Athlète (PMA)
-- 1 test_definition · 6 domaines · 31 sous-compétences · 155 questions · 8 profils

DO $$
DECLARE
    pma_id uuid;
BEGIN

-- ============================================================
-- 1. TEST DEFINITION
-- ============================================================
INSERT INTO test_definitions (
    slug, name, description, context,
    scale_min, scale_max, clustering_algo, clustering_k,
    normative_n, is_active, levels
) VALUES (
    'pma',
    'Profil Mental Athlète',
    'Prêt à révéler votre potentiel ? Ce test vous aide à cerner vos forces mentales et à booster vos performances sportives.',
    'sport', 1, 10, 'kmeans', 8, 9203, true,
    '[
      {"slug":"discovery","name":"Découverte","price_cents":0,"question_filter":"discovery","includes_percentiles":false,"includes_profile":false,"includes_report":false,"includes_expert_session":false},
      {"slug":"complete","name":"Profil Complet","price_cents":1900,"question_filter":"complete","includes_percentiles":true,"includes_profile":true,"includes_report":true,"includes_expert_session":false},
      {"slug":"expert","name":"Profil + Analyse Expert","price_cents":7900,"question_filter":"complete","includes_percentiles":true,"includes_profile":true,"includes_report":true,"includes_expert_session":true}
    ]'::jsonb
) RETURNING id INTO pma_id;

-- ============================================================
-- 2. DOMAINES (depth=0, is_leaf=false)
-- ============================================================
INSERT INTO competency_tree (test_definition_id, parent_id, name, slug, depth, order_index, is_leaf)
VALUES
    (pma_id, NULL, 'Compétences de base',               'competences_de_base',       0, 1, false),
    (pma_id, NULL, 'Goût de la compétition',             'gout_competition',           0, 2, false),
    (pma_id, NULL, 'Gestion du stress et des émotions',  'gestion_stress_emotions',    0, 3, false),
    (pma_id, NULL, 'Capacités attentionnelles',          'capacites_attentionnelles',  0, 4, false),
    (pma_id, NULL, 'Capacités d''imagerie',              'capacites_imagerie',         0, 5, false),
    (pma_id, NULL, 'Gestion de l''énergie et du corps',  'gestion_energie_corps',      0, 6, false);

-- ============================================================
-- 3. SOUS-COMPÉTENCES (depth=1, is_leaf=true)
-- ============================================================

-- Compétences de base (6)
INSERT INTO competency_tree (test_definition_id, parent_id, name, slug, depth, order_index, is_leaf)
SELECT pma_id,
       (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'competences_de_base'),
       sc.name, sc.slug, 1, sc.ord, true
FROM (VALUES
    (1, 'engagement',              'Engagement'),
    (2, 'motivation_intrinseque',  'Motivation intrinsèque'),
    (3, 'motivation_extrinseque',  'Motivation extrinsèque'),
    (4, 'confiance_en_soi',        'Confiance en soi'),
    (5, 'estime_de_soi',           'Estime de soi'),
    (6, 'planification_objectifs', 'Planification des objectifs')
) AS sc(ord, slug, name);

-- Goût de la compétition (5)
INSERT INTO competency_tree (test_definition_id, parent_id, name, slug, depth, order_index, is_leaf)
SELECT pma_id,
       (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'gout_competition'),
       sc.name, sc.slug, 1, sc.ord, true
FROM (VALUES
    (1, 'attrait_competition',      'Attrait pour la compétition'),
    (2, 'capacites_performance',    'Capacités de performance en compétition'),
    (3, 'gout_effort',              'Goût de l''effort'),
    (4, 'locus_controle',           'Locus de contrôle'),
    (5, 'preparation_competitions', 'Préparation des compétitions')
) AS sc(ord, slug, name);

-- Gestion du stress et des émotions (6)
INSERT INTO competency_tree (test_definition_id, parent_id, name, slug, depth, order_index, is_leaf)
SELECT pma_id,
       (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'gestion_stress_emotions'),
       sc.name, sc.slug, 1, sc.ord, true
FROM (VALUES
    (1, 'stress_somatique',        'Symptômes de stress somatique'),
    (2, 'stress_psychologique',    'Symptômes de stress psychologique'),
    (3, 'stress_quotidien',        'Stress au quotidien'),
    (4, 'lucidite_emotionnelle',   'Lucidité envers ses émotions'),
    (5, 'lacher_prise',            'Lâcher-prise'),
    (6, 'regulation_emotionnelle', 'Régulation et expression de ses émotions')
) AS sc(ord, slug, name);

-- Capacités attentionnelles (5)
INSERT INTO competency_tree (test_definition_id, parent_id, name, slug, depth, order_index, is_leaf)
SELECT pma_id,
       (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'capacites_attentionnelles'),
       sc.name, sc.slug, 1, sc.ord, true
FROM (VALUES
    (1, 'concentration',       'Concentration'),
    (2, 'reconcentration',     'Reconcentration'),
    (3, 'gestion_impulsivite', 'Gestion de l''impulsivité'),
    (4, 'focus',               'Focus'),
    (5, 'flow',                'Flow')
) AS sc(ord, slug, name);

-- Capacités d'imagerie (3)
INSERT INTO competency_tree (test_definition_id, parent_id, name, slug, depth, order_index, is_leaf)
SELECT pma_id,
       (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'capacites_imagerie'),
       sc.name, sc.slug, 1, sc.ord, true
FROM (VALUES
    (1, 'imagerie',        'Imagerie'),
    (2, 'pratique_mentale','Pratique mentale'),
    (3, 'reverie',         'Rêverie')
) AS sc(ord, slug, name);

-- Gestion de l'énergie et du corps (6)
INSERT INTO competency_tree (test_definition_id, parent_id, name, slug, depth, order_index, is_leaf)
SELECT pma_id,
       (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'gestion_energie_corps'),
       sc.name, sc.slug, 1, sc.ord, true
FROM (VALUES
    (1, 'relaxation',       'Relaxation'),
    (2, 'activation',       'Activation'),
    (3, 'depassement_soi',  'Dépassement de soi'),
    (4, 'gestion_douleur',  'Gestion de la douleur'),
    (5, 'gestion_blessure', 'Gestion de la blessure'),
    (6, 'alimentation',     'Alimentation')
) AS sc(ord, slug, name);

-- ============================================================
-- 4. QUESTIONS (155 questions)
--    Q1-40 = discovery · Q41-155 = complete
--    is_reversed = true → score = 11 - réponse
-- ============================================================

-- ENGAGEMENT (Q1-5)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'engagement'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (1,  'Dans mon sport, je suis déterminé à ne rien lâcher',                                  false, 'discovery'),
    (2,  'Je suis décidé(e) à exploiter toutes mes capacités dans mon sport',                   false, 'discovery'),
    (3,  'Des fois je me demande si je ne serais pas mieux à faire autre chose que mon sport',  true,  'discovery'),
    (4,  'Rien ne me motive plus que mon sport',                                                 false, 'discovery'),
    (5,  'Je suis prêt à faire énormément de sacrifices pour mon sport',                         false, 'discovery')
) AS q(ord, txt, rev, lvl);

-- MOTIVATION INTRINSEQUE (Q6-10)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'motivation_intrinseque'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (6,  'Je suis motivé avant tout par le fait de progresser',                                  false, 'discovery'),
    (7,  'Je prends plaisir à m''entrainer, même lorsque les conditions sont difficiles',        false, 'discovery'),
    (8,  'J''aime me dépasser et donner le meilleur de moi-même',                               false, 'discovery'),
    (9,  'Je joue pour moi plus que pour mon entraineur, mes parents ou mes amis',               false, 'discovery'),
    (10, 'Je suis en recherche constante d''amélioration',                                       false, 'discovery')
) AS q(ord, txt, rev, lvl);

-- MOTIVATION EXTRINSEQUE (Q11-15)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'motivation_extrinseque'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (11, 'Je me sens plus fort quand je gagne',                                false, 'discovery'),
    (12, 'Je joue beaucoup pour l''argent, les trophées ou le prestige',       false, 'discovery'),
    (13, 'J''aime être reconnu pour mes performances',                         false, 'discovery'),
    (14, 'Le sport est un moyen pour moi de devenir célèbre',                  false, 'discovery'),
    (15, 'Les médailles et le palmarès ne m''intéressent pas',                 true,  'discovery')
) AS q(ord, txt, rev, lvl);

-- CONFIANCE EN SOI (Q16-20)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'confiance_en_soi'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (16, 'Malgré la difficulté je suis sûr de pouvoir réussir dans mon sport',                 false, 'discovery'),
    (17, 'Je suis confiant même dans les moments difficiles',                                   false, 'discovery'),
    (18, 'Il m''arrive d''avoir de longues périodes de doute sur mes capacités à performer',    true,  'discovery'),
    (19, 'J''ai confiance en mes capacités à surmonter les difficultés',                        false, 'discovery'),
    (20, 'J''ai confiance en mes compétences techniques, physiques et mentales',                false, 'discovery')
) AS q(ord, txt, rev, lvl);

-- ESTIME DE SOI (Q21-25)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'estime_de_soi'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (21, 'Dans l''ensemble, je pense que j''ai un certain nombre de qualités',     false, 'discovery'),
    (22, 'Je suis fier des efforts que je réalise en match et à l''entrainement',  false, 'discovery'),
    (23, 'Parfois je me sens sans valeur',                                          true,  'discovery'),
    (24, 'Je pense que je vaux mieux que beaucoup de mes adversaires',             false, 'discovery'),
    (25, 'J''ai une opinion positive de moi-même',                                 false, 'discovery')
) AS q(ord, txt, rev, lvl);

-- PLANIFICATION DES OBJECTIFS (Q26-30)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'planification_objectifs'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (26, 'Je vais à l''entrainement avec des objectifs bien précis',                                 false, 'discovery'),
    (27, 'Je me fixe des objectifs difficiles mais réalisables',                                      false, 'discovery'),
    (28, 'Je n''ai pas de problème en ce moment pour me fixer des objectifs',                        false, 'discovery'),
    (29, 'Je vais souvent à l''entrainement pour me défouler, sans objectifs bien précis',           true,  'discovery'),
    (30, 'Je me fixe des objectifs pour constamment progresser',                                      false, 'discovery')
) AS q(ord, txt, rev, lvl);

-- ATTRAIT POUR LA COMPETITION (Q31-35)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'attrait_competition'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (31, 'Fondamentalement, j''adore la compétition',                                        false, 'discovery'),
    (32, 'La compétition me permet d''apprendre sur moi et de m''améliorer',                 false, 'discovery'),
    (33, 'Je préfère m''entrainer plutôt que d''être en compétition',                        true,  'discovery'),
    (34, 'Je m''épanouis lorsque je suis en compétition',                                    false, 'discovery'),
    (35, 'Faire du sport sans compétition n''a pas beaucoup de sens pour moi',              false, 'discovery')
) AS q(ord, txt, rev, lvl);

-- CAPACITES DE PERFORMANCE EN COMPETITION (Q36-40)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'capacites_performance'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (36, 'Je ne suis jamais aussi performant qu''en compétition',                      false, 'discovery'),
    (37, 'Quand je suis en match, en compétition, rien ne peut m''arrêter',            false, 'discovery'),
    (38, 'J''ai l''impression de ne jamais être à mon niveau en compétition',          true,  'discovery'),
    (39, 'Je suis souvent déçu par ce que je réalise en compétition',                  true,  'discovery'),
    (40, 'J''arrive à atteindre le meilleur de moi-même en compétition',              false, 'discovery')
) AS q(ord, txt, rev, lvl);

-- GOUT DE L'EFFORT (Q41-45)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'gout_effort'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (41, 'Je donne toujours le meilleur de moi-même en compétition',                                      false, 'complete'),
    (42, 'Même si je ne suis pas dans un grand jour j''essaye de faire au mieux en match',                false, 'complete'),
    (43, 'Il est très important pour moi de donner tout ce que je peux dans un match ou un concours',    false, 'complete'),
    (44, 'J''ai souvent l''impression d''atteindre mes limites dans une compétition',                    false, 'complete'),
    (45, 'Se donner à fond dans une compétition est très important pour moi',                             false, 'complete')
) AS q(ord, txt, rev, lvl);

-- LOCUS DE CONTROLE (Q46-50)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'locus_controle'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (46, 'Je pense que mes succès sont avant tout le fruit de mon travail',                                               false, 'complete'),
    (47, 'Quand je perds je m''en veux avant tout à moi avant d''en vouloir aux autres',                                 false, 'complete'),
    (48, 'Je suis rapidement capable d''analyser tout ce qui n''a pas marché en match et de le travailler par la suite', false, 'complete'),
    (49, 'Je travaille tout ce que je peux maitriser mais il y a toujours une part de hasard ou de chance',               false, 'complete'),
    (50, 'J''attribue souvent mes succès au hasard ou à la chance',                                                       true,  'complete')
) AS q(ord, txt, rev, lvl);

-- PREPARATION DES COMPETITIONS (Q51-55)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'preparation_competitions'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (51, 'Je planifie une série de chose à mettre en place avant une compétition',                                false, 'complete'),
    (52, 'Il m''arrive souvent de faire mon sac juste avant de partir en compétition',                           true,  'complete'),
    (53, 'Mon trajet et les déplacements sont toujours bien organisés pour les compétitions',                     false, 'complete'),
    (54, 'Moi-même, je sais toujours parfaitement où va se dérouler la compétition et dans quel lieu',           false, 'complete'),
    (55, 'Je me renseigne souvent sur les adversaires que je vais rencontrer ou les lieux de la compétition',     false, 'complete')
) AS q(ord, txt, rev, lvl);

-- STRESS SOMATIQUE (Q56-60)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'stress_somatique'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (56, 'J''ai souvent mal au ventre avant une compétition',                                               true,  'complete'),
    (57, 'Je n''ai pas de tension particulière avant une compétition',                                       false, 'complete'),
    (58, 'Lors de compétitions importantes il m''est déjà arrivé de vomir à cause du stress',               true,  'complete'),
    (59, 'Je ne suis pas particulièrement agité ou nerveux avant un match ou une compétition',               false, 'complete'),
    (60, 'Dans certaines compétitions je suis tellement stressé que je suis fatigué avant de commencer',     true,  'complete')
) AS q(ord, txt, rev, lvl);

-- STRESS PSYCHOLOGIQUE (Q61-65)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'stress_psychologique'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (61, 'J''ai souvent peur avant une compétition importante',                                           true,  'complete'),
    (62, 'Mon stress varie beaucoup en fonction de l''enjeu de la compétition et de mes adversaires',     true,  'complete'),
    (63, 'J''ai peur de décevoir mes parents, mon entraineur ou mes amis en compétition',                 true,  'complete'),
    (64, 'Je n''ai pas particulièrement peur de perdre en compétition',                                   false, 'complete'),
    (65, 'Quelques fois, il m''arrive de me laisser envahir par la peur en compétition',                  true,  'complete')
) AS q(ord, txt, rev, lvl);

-- STRESS AU QUOTIDIEN (Q66-70)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'stress_quotidien'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (66, 'Je me préoccupe souvent pour mon travail ou l''école',                     true,  'complete'),
    (67, 'Je ne ressens pas beaucoup de stress au quotidien',                         false, 'complete'),
    (68, 'Je suis quelqu''un de serein et calme',                                     false, 'complete'),
    (69, 'Beaucoup de choses me stressent au quotidien',                               true,  'complete'),
    (70, 'Je me préoccupe souvent pour ma santé et la santé de mes proches',           true,  'complete')
) AS q(ord, txt, rev, lvl);

-- LUCIDITE EMOTIONNELLE (Q71-75)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'lucidite_emotionnelle'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (71, 'Je ressens beaucoup d''émotions positives et négatives de façon générale',                false, 'complete'),
    (72, 'En match, je ressens très vite quand je suis débordé par mes émotions',                   false, 'complete'),
    (73, 'En match, j''ai tendance à ne pas remarquer mes tensions ou ma nervosité',                true,  'complete'),
    (74, 'Je suis une personne plutôt émotive',                                                     false, 'complete'),
    (75, 'Je sais parfaitement décrire les émotions que je ressens quand je les ressens',           false, 'complete')
) AS q(ord, txt, rev, lvl);

-- LACHER-PRISE (Q76-80)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'lacher_prise'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (76, 'J''ai l''impression quelques fois, d''être prisonnier de mes pensées',           true,  'complete'),
    (77, 'Il est important pour moi de contrôler les moindres éléments de ma vie',         true,  'complete'),
    (78, 'Avec le temps, j''accepte les échecs et les contre-performances',                false, 'complete'),
    (79, 'Je m''en veux souvent de ne pas atteindre les objectifs que je m''étais fixés',  true,  'complete'),
    (80, 'J''ai tendance à contrôler les autres pour leur bien',                           true,  'complete')
) AS q(ord, txt, rev, lvl);

-- REGULATION EMOTIONNELLE (Q81-85)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'regulation_emotionnelle'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (81, 'Face à un problème je mets beaucoup de stratégies en place pour le résoudre',        false, 'complete'),
    (82, 'Quand je suis stressé, je cherche surtout à me relaxer',                             false, 'complete'),
    (83, 'J''exprime souvent mes émotions à des amis ou à des proches en qui j''ai confiance', false, 'complete'),
    (84, 'Je panique ou m''énerve quand je suis débordé par mes émotions',                     true,  'complete'),
    (85, 'Je me dis souvent que chaque problème a sa solution',                                 false, 'complete')
) AS q(ord, txt, rev, lvl);

-- CONCENTRATION (Q86-90)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'concentration'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (86, 'Je perds facilement ma concentration en compétition',                         true,  'complete'),
    (87, 'Je sais rester concentré pendant tout un entrainement',                       false, 'complete'),
    (88, 'Je n''ai aucun problème de concentration en cours ou au travail',             false, 'complete'),
    (89, 'Rien ne peut me faire sortir de mon match quand je suis concentré',           false, 'complete'),
    (90, 'Je me déconcentre facilement face à la difficulté',                           true,  'complete')
) AS q(ord, txt, rev, lvl);

-- RECONCENTRATION (Q91-95)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'reconcentration'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (91, 'Je pense sans cesse à mes erreurs à l''entrainement',                                                                        true,  'complete'),
    (92, 'En match ou en compétition j''ai de longs moments d''absence, où je pense à autre chose',                                    true,  'complete'),
    (93, 'Si je rate quelque chose de facile en compétition je me reconcentre très vite',                                              false, 'complete'),
    (94, 'En compétition, je reste longtemps bloqué sur une erreur que j''ai commise',                                                 true,  'complete'),
    (95, 'En compétition quand je me rends compte que je suis tendu, je suis capable de me reconcentrer sur ce que j''ai à faire',     false, 'complete')
) AS q(ord, txt, rev, lvl);

-- GESTION DE L'IMPULSIVITE (Q96-100)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'gestion_impulsivite'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (96,  'Je m''énerve très facilement à l''entrainement',                                          true,  'complete'),
    (97,  'Je sais garder mon calme même dans les situations difficiles',                             false, 'complete'),
    (98,  'Il m''arrive de jeter mon matériel quand je suis énervé',                                 true,  'complete'),
    (99,  'Je peux contrôler ma colère quand je le veux',                                             false, 'complete'),
    (100, 'Je ne supporte pas qu''un adversaire ou que quelqu''un me provoque',                       true,  'complete')
) AS q(ord, txt, rev, lvl);

-- FOCUS (Q101-105)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'focus'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (101, 'Je peux lire toute une après-midi sans m''arrêter',                                                        false, 'complete'),
    (102, 'Au travail ou à l''école on me trouve souvent inattentif',                                                  true,  'complete'),
    (103, 'Quand je dois faire quelque chose qui demande beaucoup de réflexion, je le remets souvent à plus tard',     true,  'complete'),
    (104, 'On me dit souvent que je ne tiens pas en place',                                                            false, 'complete'),
    (105, 'Je n''ai aucun problème à me concentrer s''il y a du bruit autour',                                        false, 'complete')
) AS q(ord, txt, rev, lvl);

-- FLOW (Q106-110)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'flow'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (106, 'En compétition, il m''arrive régulièrement d''être en parfaite harmonie entre mon corps et mon esprit',   false, 'complete'),
    (107, 'Quand je me sens bien, je réalise facilement des choses pourtant difficiles',                              false, 'complete'),
    (108, 'A l''entrainement, il m''arrive souvent d''être dans un état de plénitude, où tout réussi',               false, 'complete'),
    (109, 'En compétition, il m''arrive souvent d''être pleinement concentré et focalisé sur l''instant présent',    false, 'complete'),
    (110, 'Je sais comment atteindre un état de parfait relâchement, concentré et lucide',                            false, 'complete')
) AS q(ord, txt, rev, lvl);

-- IMAGERIE (Q111-115)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'imagerie'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (111, 'Je peux créer facilement des images dans ma tête',                                                                  false, 'complete'),
    (112, 'Mes images mentales sont floues',                                                                                    true,  'complete'),
    (113, 'En plus des images, j''arrive facilement à ressentir les odeurs, les bruits, le toucher juste mentalement',         false, 'complete'),
    (114, 'Je peux visualiser mon matériel dans les moindres détails',                                                          false, 'complete'),
    (115, 'Je suis capable d''imaginer une chaise et de la faire changer de couleur',                                          false, 'complete')
) AS q(ord, txt, rev, lvl);

-- PRATIQUE MENTALE (Q116-120)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'pratique_mentale'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (116, 'Je pratique très rarement mon sport dans ma tête',                                                            true,  'complete'),
    (117, 'Quand j''apprends une nouvelle technique j''aime aussi la pratiquer mentalement',                             false, 'complete'),
    (118, 'Quand j''ai fait une erreur, il m''arrive souvent de refaire l''action dans ma tête mais en la réussissant',  false, 'complete'),
    (119, 'Je peux ressentir les mouvements lorsque je m''imagine faisant mon sport',                                     false, 'complete'),
    (120, 'Comme ma pratique physique, ma pratique mentale est organisée',                                                false, 'complete')
) AS q(ord, txt, rev, lvl);

-- REVERIE (Q121-125)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'reverie'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (121, 'Il m''arrive souvent d''imaginer des choses positives qui pourraient m''arriver',                 false, 'complete'),
    (122, 'Quand je suis dans une mauvaise période je pense à des choses positives',                          false, 'complete'),
    (123, 'Quand je suis blessé je cherche à avoir des images de moi en train de courir ou de faire du sport',false, 'complete'),
    (124, 'On me dit souvent que je n''ai pas beaucoup d''imagination ou que je suis terre à terre',          true,  'complete'),
    (125, 'Quand je suis dans une file d''attente il m''arrive souvent de rêver ou de m''évader mentalement', false, 'complete')
) AS q(ord, txt, rev, lvl);

-- RELAXATION (Q126-130)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'relaxation'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (126, 'Je sais me relaxer tout seul',                                                                     false, 'complete'),
    (127, 'Je n''ai jamais vraiment appris à me relaxer',                                                     true,  'complete'),
    (128, 'Quand je suis tendu, j''essaye de souffler ou de me concentrer sur ma respiration',                false, 'complete'),
    (129, 'Je sais parfaitement relâcher mes muscles et détendre mon corps quand je le veux',                 false, 'complete'),
    (130, 'Je me demande comment font les autres pour se relaxer quand ils sont tendus ou énervés',            true,  'complete')
) AS q(ord, txt, rev, lvl);

-- ACTIVATION (Q131-135)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'activation'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (131, 'Je peux élever mon niveau d''énergie quand je suis fatigué à l''entrainement',       false, 'complete'),
    (132, 'Je sais me booster avant une compétition si je sens que je suis trop calme',          false, 'complete'),
    (133, 'Quand je suis trop excité je sais me calmer',                                         false, 'complete'),
    (134, 'Il est difficile pour moi de me remettre dans une compétition quand je suis fatigué', true,  'complete'),
    (135, 'Je sais atteindre le meilleur niveau d''énergie pour être performant',                false, 'complete')
) AS q(ord, txt, rev, lvl);

-- DEPASSEMENT DE SOI (Q136-140)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'depassement_soi'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (136, 'Je suis capable de repousser mes limites sans cesse',                                                                                false, 'complete'),
    (137, 'Il m''est déjà arrivé(e) en compétition d''avancer comme un robot, comme si je n''écoutais plus ma tête',                          false, 'complete'),
    (138, 'J''ai du mal à comprendre les gens qui font des marathons ou des ironmans',                                                         true,  'complete'),
    (139, 'J''adore cette sensation que l''on a des fois de se dépasser, d''être maitre de son corps',                                         false, 'complete'),
    (140, 'Dépasser mes limites en compétition me procure un plaisir intense, incomparable',                                                   false, 'complete')
) AS q(ord, txt, rev, lvl);

-- GESTION DE LA DOULEUR (Q141-145)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'gestion_douleur'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (141, 'Je m''inquiète énormément quand je ressens une douleur',                               true,  'complete'),
    (142, 'En match, je suis capable de dépasser la douleur pour me recentrer sur ma performance', false, 'complete'),
    (143, 'Quand je ressens une douleur, je ne pense qu''à cette douleur',                         true,  'complete'),
    (144, 'Je sais m''arrêter quand il le faut, quand une douleur me semble préoccupante',         false, 'complete'),
    (145, 'Quand je suis très fatigué je préfère me mettre au repos plutôt que de me blesser',     false, 'complete')
) AS q(ord, txt, rev, lvl);

-- GESTION DE LA BLESSURE (Q146-150)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'gestion_blessure'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (146, 'Je sais que la blessure est le quotidien du sportif',                                                           false, 'complete'),
    (147, 'Je profite de mon temps quand je suis blessé pour faire des choses que je ne ferais pas autrement',             false, 'complete'),
    (148, 'J''ai du mal à m''arrêter ou à ne pas faire de sport quand je suis blessé',                                    true,  'complete'),
    (149, 'Il m''arrive souvent d''être en colère quand je suis blessé',                                                   true,  'complete'),
    (150, 'Je suis à la lettre les recommandations des médecins quand je suis blessé',                                     false, 'complete')
) AS q(ord, txt, rev, lvl);

-- ALIMENTATION (Q151-155)
INSERT INTO questions (test_definition_id, competency_node_id, text_fr, is_reversed, is_active, level_required, order_index)
SELECT pma_id, (SELECT id FROM competency_tree WHERE test_definition_id = pma_id AND slug = 'alimentation'),
       q.txt, q.rev, true, q.lvl, q.ord
FROM (VALUES
    (151, 'De manière générale, je fais attention à ce que je mange',                                                         false, 'complete'),
    (152, 'J''ai des connaissances assez précises en diététique',                                                              false, 'complete'),
    (153, 'Il m''est difficile de restreindre ou de surveiller mon alimentation',                                              true,  'complete'),
    (154, 'Régulièrement, je me prive de sorties au restaurant ou avec des amis pour les besoins de mon sport',               false, 'complete'),
    (155, 'Mon entourage trouve que je contrôle trop mon alimentation, que c''est presque obsessionnel',                      true,  'complete')
) AS q(ord, txt, rev, lvl);

-- ============================================================
-- 5. PROFILES (8 profils mentaux PMA)
-- ============================================================
INSERT INTO profiles (test_definition_id, name, family, color, population_pct, avg_score)
VALUES
    (pma_id, 'Le Maestro',     'Les Dominants',  '#20808D', 12.6, 7.68),
    (pma_id, 'Le Conquérant',  'Les Dominants',  '#20808D', 14.8, 6.98),
    (pma_id, 'Le Stratège',    'Les Moteurs',    '#A84B2F', 17.3, 6.82),
    (pma_id, 'L''Instinctif',  'Les Moteurs',    '#A84B2F', 16.7, 6.36),
    (pma_id, 'Le Pilier',      'Les Équilibrés', '#FFC553', 11.3, 6.36),
    (pma_id, 'Le Résilient',   'Les Équilibrés', '#FFC553', 13.0, 5.90),
    (pma_id, 'L''Explorateur', 'Les Émergents',  '#944454', 11.3, 5.56),
    (pma_id, 'Le Combattant',  'Les Émergents',  '#944454',  2.9, 5.00);

-- ============================================================
-- 6. NORMATIVE STATS (placeholders — données réelles à fournir)
--    mean=5.5, std_dev=1.5, sample_size=9203 pour chaque feuille
--    Attribution de profil non fonctionnelle jusqu'aux vraies données centroïdes
-- ============================================================
INSERT INTO normative_stats (test_definition_id, competency_node_id, mean, std_dev, sample_size)
SELECT pma_id, ct.id, 5.5, 1.5, 9203
FROM competency_tree ct
WHERE ct.test_definition_id = pma_id AND ct.is_leaf = true;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Seed PMA failed at: %', SQLERRM;
    RAISE;
END $$;
