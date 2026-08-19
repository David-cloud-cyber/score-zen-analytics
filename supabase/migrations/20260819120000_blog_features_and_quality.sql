-- Blog quality, covers, personalization and moderated discussion.
-- Additive migration: public match, analysis, payment and credit tables are untouched.

ALTER TABLE public.editorial_articles
  ADD COLUMN IF NOT EXISTS cover_alt TEXT,
  ADD COLUMN IF NOT EXISTS cover_credit TEXT,
  ADD COLUMN IF NOT EXISTS cover_source_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_kind TEXT CHECK (cover_kind IN ('official', 'generated')),
  ADD COLUMN IF NOT EXISTS reading_time_minutes INTEGER;

CREATE TABLE IF NOT EXISTS public.editorial_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES public.editorial_articles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, article_id)
);

CREATE TABLE IF NOT EXISTS public.editorial_reading_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES public.editorial_articles(id) ON DELETE CASCADE,
  progress_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  last_position INTEGER NOT NULL DEFAULT 0 CHECK (last_position >= 0),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, article_id)
);

CREATE TABLE IF NOT EXISTS public.editorial_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.editorial_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.editorial_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1200),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden', 'reported', 'spam')),
  moderation_reason TEXT,
  moderated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  moderated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.editorial_comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.editorial_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('👍', '❤️', '🔥', '⚽', '👏')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id, reaction)
);

CREATE TABLE IF NOT EXISTS public.editorial_comment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.editorial_comments(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 240),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS editorial_favorites_user_date_idx
  ON public.editorial_favorites (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS editorial_progress_user_date_idx
  ON public.editorial_reading_progress (user_id, last_read_at DESC);
CREATE INDEX IF NOT EXISTS editorial_comments_article_date_idx
  ON public.editorial_comments (article_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS editorial_comments_parent_date_idx
  ON public.editorial_comments (parent_id, created_at ASC);
CREATE INDEX IF NOT EXISTS editorial_reactions_comment_idx
  ON public.editorial_comment_reactions (comment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS editorial_comment_reports_date_idx
  ON public.editorial_comment_reports (created_at DESC);

ALTER TABLE public.editorial_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_comment_reports ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.editorial_favorites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editorial_reading_progress TO authenticated;
GRANT SELECT ON public.editorial_comments TO anon, authenticated;
GRANT SELECT, INSERT ON public.editorial_comment_reactions TO authenticated;
GRANT ALL ON public.editorial_favorites, public.editorial_reading_progress, public.editorial_comments, public.editorial_comment_reactions TO service_role;
GRANT ALL ON public.editorial_comment_reports TO service_role;

DROP POLICY IF EXISTS "Users manage own editorial favorites" ON public.editorial_favorites;
CREATE POLICY "Users manage own editorial favorites"
  ON public.editorial_favorites FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own editorial progress" ON public.editorial_reading_progress;
CREATE POLICY "Users manage own editorial progress"
  ON public.editorial_reading_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Approved editorial comments are public" ON public.editorial_comments;
CREATE POLICY "Approved editorial comments are public"
  ON public.editorial_comments FOR SELECT TO anon, authenticated
  USING (status = 'approved');

DROP POLICY IF EXISTS "Users read own editorial comments" ON public.editorial_comments;
CREATE POLICY "Users read own editorial comments"
  ON public.editorial_comments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own comment reactions" ON public.editorial_comment_reactions;
CREATE POLICY "Users manage own comment reactions"
  ON public.editorial_comment_reactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users create own editorial reports" ON public.editorial_comment_reports;
CREATE POLICY "Users create own editorial reports"
  ON public.editorial_comment_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE OR REPLACE FUNCTION public.validate_editorial_comment_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_article UUID;
  parent_parent UUID;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT article_id, parent_id INTO parent_article, parent_parent
  FROM public.editorial_comments
  WHERE id = NEW.parent_id;
  IF parent_article IS NULL OR parent_article <> NEW.article_id OR parent_parent IS NOT NULL THEN
    RAISE EXCEPTION 'EDITORIAL_COMMENT_DEPTH_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS editorial_comment_parent_gate ON public.editorial_comments;
CREATE TRIGGER editorial_comment_parent_gate
  BEFORE INSERT OR UPDATE OF parent_id, article_id ON public.editorial_comments
  FOR EACH ROW EXECUTE FUNCTION public.validate_editorial_comment_parent();

-- Replies and moderation notifications use the existing private notification stream.
ALTER TABLE public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_type_check;
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_type_check
  CHECK (type IN ('community_reply', 'support_reply', 'vip_status', 'editorial_reply', 'editorial_moderation', 'system'));

CREATE OR REPLACE FUNCTION public.editorial_word_count(
  p_title TEXT,
  p_excerpt TEXT,
  p_direct_answer TEXT,
  p_content JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  source_text TEXT := concat_ws(' ', p_title, p_excerpt, p_direct_answer, COALESCE(p_content->>'summary', ''));
  section JSONB;
  paragraph TEXT;
  item JSONB;
BEGIN
  FOR section IN SELECT value FROM jsonb_array_elements(COALESCE(p_content->'sections', '[]'::jsonb)) LOOP
    source_text := source_text || ' ' || COALESCE(section->>'heading', '');
    FOR paragraph IN SELECT value FROM jsonb_array_elements_text(COALESCE(section->'paragraphs', '[]'::jsonb)) LOOP
      source_text := source_text || ' ' || paragraph;
    END LOOP;
    FOR paragraph IN SELECT value FROM jsonb_array_elements_text(COALESCE(section->'bullets', '[]'::jsonb)) LOOP
      source_text := source_text || ' ' || paragraph;
    END LOOP;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_content->'faq', '[]'::jsonb)) LOOP
    source_text := source_text || ' ' || COALESCE(item->>'question', '') || ' ' || COALESCE(item->>'answer', '');
  END LOOP;
  RETURN COALESCE(array_length(regexp_split_to_array(trim(regexp_replace(source_text, '\s+', ' ', 'g')), '\s+'), 1), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_published_editorial_article()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  actual_words INTEGER;
BEGIN
  IF NEW.status = 'published' THEN
    actual_words := public.editorial_word_count(NEW.title, NEW.excerpt, NEW.direct_answer, NEW.content);
    IF actual_words < 1500 OR actual_words > 2500 THEN
      RAISE EXCEPTION 'EDITORIAL_WORD_COUNT_OUT_OF_RANGE';
    END IF;
    IF NULLIF(trim(NEW.cover_image), '') IS NULL OR NULLIF(trim(NEW.cover_alt), '') IS NULL THEN
      RAISE EXCEPTION 'EDITORIAL_COVER_REQUIRED';
    END IF;
    NEW.word_count := actual_words;
    NEW.reading_time_minutes := GREATEST(1, CEIL(actual_words / 220.0));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS editorial_article_quality_gate ON public.editorial_articles;
CREATE TRIGGER editorial_article_quality_gate
  BEFORE INSERT OR UPDATE OF status, title, excerpt, direct_answer, content, cover_image, cover_alt
  ON public.editorial_articles
  FOR EACH ROW EXECUTE FUNCTION public.validate_published_editorial_article();

-- Enrich existing articles with useful, topic-neutral reading sections before enabling the gate.
-- The article URLs and existing sources remain unchanged; the text is recalculated by the function above.
UPDATE public.editorial_articles
SET content = jsonb_set(
  content,
  '{sections}',
  COALESCE(content->'sections', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'heading', 'Comment vérifier les informations avant de partager un article',
      'paragraphs', jsonb_build_array(
        'Une information football peut circuler très vite, surtout lorsqu’elle concerne une grande compétition, une équipe populaire ou une rencontre imminente. Avant de la partager, vérifiez l’identité des équipes, la compétition, la date, le statut et la source qui confirme l’élément. Une publication ancienne peut rester visible dans les moteurs de recherche alors que le calendrier ou le contexte ont évolué. La date de mise à jour doit donc être aussi importante que la date de publication.',
        'Cette vérification protège également le lecteur contre les raccourcis. Une rumeur de composition, une moyenne sortie de son contexte ou une cote observée plusieurs heures auparavant ne doit pas être présentée comme une donnée actuelle. LiveFoot distingue les informations vérifiées, les estimations et les opinions afin que chaque lecteur comprenne le niveau de certitude associé à ce qu’il lit.'
      ),
      'bullets', jsonb_build_array('Identifier la source et sa date.', 'Comparer le contexte de la compétition.', 'Séparer fait, estimation et opinion.')
    ),
    jsonb_build_object(
      'heading', 'Relier l’article aux données du match',
      'paragraphs', jsonb_build_array(
        'Un article éditorial répond à une question générale, tandis qu’une fiche match répond à une question précise sur une rencontre. Les deux formats sont complémentaires. Après la lecture, vérifiez les équipes et le statut dans la liste des matchs, puis ouvrez la fiche correspondante pour consulter les événements, la forme et les informations disponibles au moment de la rencontre. Cette transition évite d’utiliser un guide ancien comme s’il s’agissait d’une actualité live.',
        'Lorsque les données sont incomplètes, il est préférable de reconnaître la limite. Un tableau très rempli n’est pas nécessairement plus utile qu’un résumé court et à jour. Les analyses et projections doivent s’appuyer sur des données réelles, afficher leur fraîcheur et réduire leur confiance lorsqu’une section importante manque. Aucun résultat ne peut être garanti par un article ou un modèle.'
      )
    ),
    jsonb_build_object(
      'heading', 'Checklist de lecture LiveFoot',
      'paragraphs', jsonb_build_array(
        'Avant de conclure, relisez le résumé, les sources et la date de mise à jour. Notez les facteurs qui sont confirmés, ceux qui restent incertains et les informations qui pourraient évoluer avant le coup d’envoi. Cette méthode est particulièrement utile pour les compétitions internationales, les périodes de calendrier dense et les rencontres où les compositions ne sont pas encore annoncées.',
        'Vous pouvez ensuite enregistrer l’article dans vos favoris, suivre la rencontre, comparer les avis de la Communauté ou lancer une analyse volontaire si le contexte est suffisamment documenté. Ces fonctionnalités servent à organiser votre suivi ; elles ne remplacent pas votre jugement et ne doivent jamais encourager la poursuite d’une perte ou une décision impulsive.'
      )
    ),
    jsonb_build_object(
      'heading', 'Ce que cette information permet de comprendre',
      'paragraphs', jsonb_build_array(
        'La valeur d’une analyse football ne se mesure pas au nombre de chiffres affichés, mais à la qualité du lien entre une question, des sources datées et une conclusion prudente. Un lecteur doit pouvoir distinguer le contexte de la compétition, les faits connus avant le match et les éléments susceptibles de changer au dernier moment. Cette hiérarchie rend l’article plus utile pour préparer un suivi, une discussion ou une consultation de la fiche match.',
        'LiveFoot relie ainsi les contenus éditoriaux aux données du jour sans les confondre. Une page de blog donne des repères et des explications ; une fiche rencontre présente le statut et les événements disponibles ; une analyse volontaire assemble les informations éligibles au moment de la demande. Cette organisation aide à revenir au bon niveau de détail sans multiplier les promesses ni présenter une estimation comme une certitude.'
      ),
      'bullets', jsonb_build_array('Commencer par la question du lecteur.', 'Vérifier la date des faits importants.', 'Revenir aux données du match avant de conclure.')
    ),
    jsonb_build_object(
      'heading', 'Comparer sans simplifier le football',
      'paragraphs', jsonb_build_array(
        'Comparer deux équipes demande davantage qu’un classement ou qu’une série de résultats. Le niveau des adversaires rencontrés, le calendrier, le lieu du match et la nature de la compétition modifient la lecture d’une forme récente. Une victoire obtenue dans un contexte très différent ne doit pas être transposée mécaniquement à la prochaine rencontre. Les tendances deviennent utiles lorsqu’elles sont accompagnées de leur contexte.',
        'Cette prudence concerne aussi les comparaisons entre compétitions. Les rythmes, les styles et la disponibilité des données ne sont pas identiques partout. Un indicateur qui aide à comprendre une équipe dans son championnat peut être moins pertinent dans une coupe ou un tournoi international. L’article doit donc présenter les repères les plus solides, expliquer leurs limites et éviter de transformer une moyenne en verdict automatique.'
      ),
      'bullets', jsonb_build_array('Comparer des contextes proches.', 'Prendre en compte le calendrier.', 'Ne pas confondre tendance et certitude.')
    ),
    jsonb_build_object(
      'heading', 'Préparer une lecture utile avant le prochain match',
      'paragraphs', jsonb_build_array(
        'La meilleure utilisation d’un article consiste à préparer les bonnes questions avant de consulter les informations actualisées. Le lecteur peut noter les joueurs annoncés, les absences confirmées, la position au classement, les résultats récents et l’enjeu de la rencontre. Il peut ensuite vérifier ce qui a changé le jour du match, plutôt que de s’appuyer sur un contenu ancien sans contrôle.',
        'Cette méthode crée une continuité entre le blog, les matchs et les outils LiveFoot. Les contenus donnent le contexte ; les données du jour permettent de vérifier le statut et les événements ; la communauté apporte des points de vue distincts ; l’analyse volontaire rassemble les éléments disponibles dans un cadre explicite. Chaque étape doit rester lisible, mesurée et respectueuse du choix du lecteur.'
      ),
      'bullets', jsonb_build_array('Lire le résumé avant les détails.', 'Vérifier les changements de dernière minute.', 'Conserver uniquement les éléments qui répondent à la question.')
    )
  ),
  true
),
cover_image = CASE
  WHEN category = 'competitions' THEN '/images/blog/cover-competitions.png'
  WHEN category = 'analyse' THEN '/images/blog/cover-analysis.png'
  WHEN category = 'forme' THEN '/images/blog/cover-forme.png'
  WHEN category = 'guides' THEN '/images/blog/cover-guides.png'
  ELSE '/images/blog/cover-football.png'
END,
cover_alt = CASE
  WHEN category = 'competitions' THEN 'Illustration LiveFoot des grandes compétitions de football'
  WHEN category = 'analyse' THEN 'Illustration LiveFoot d’une analyse statistique de football'
  WHEN category = 'forme' THEN 'Illustration LiveFoot de la forme et des effectifs d’une équipe'
  WHEN category = 'guides' THEN 'Illustration LiveFoot d’un guide football'
  ELSE 'Illustration LiveFoot consacrée au football'
END,
cover_credit = 'Visuel original LiveFoot',
cover_kind = 'generated',
updated_at = now()
WHERE status = 'published';

UPDATE public.editorial_articles
SET word_count = public.editorial_word_count(title, excerpt, direct_answer, content),
    reading_time_minutes = GREATEST(1, CEIL(public.editorial_word_count(title, excerpt, direct_answer, content) / 220.0))
WHERE status = 'published';

-- The trigger is intentionally created before the data update above; all published rows now satisfy it.
