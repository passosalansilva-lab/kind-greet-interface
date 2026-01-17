-- Tabela de posts do portal (gerenciado pelo admin)
CREATE TABLE IF NOT EXISTS public.portal_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  video_url TEXT, -- link do YouTube ou URL pública do vídeo
  video_type TEXT CHECK (video_type IN ('youtube', 'upload', NULL)),
  image_url TEXT,
  is_published BOOLEAN DEFAULT true,
  pinned BOOLEAN DEFAULT false, -- para destacar no topo
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_portal_posts_published ON public.portal_posts(is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_posts_pinned ON public.portal_posts(pinned DESC, created_at DESC);

-- Tabela de reações (curtidas) nos posts
CREATE TABLE IF NOT EXISTS public.portal_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.portal_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT DEFAULT 'like' CHECK (reaction_type IN ('like', 'love', 'celebrate')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_portal_reactions_post ON public.portal_post_reactions(post_id);

-- Tabela de comentários nos posts
CREATE TABLE IF NOT EXISTS public.portal_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.portal_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_comments_post ON public.portal_post_comments(post_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.portal_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_post_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies para portal_posts
-- Todos autenticados podem ver posts publicados
CREATE POLICY "Anyone can view published posts"
ON public.portal_posts FOR SELECT
TO authenticated
USING (is_published = true);

-- Apenas admins podem inserir/atualizar/deletar
CREATE POLICY "Admins can manage posts"
ON public.portal_posts FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies para portal_post_reactions
-- Todos autenticados podem ver reações
CREATE POLICY "Anyone can view reactions"
ON public.portal_post_reactions FOR SELECT
TO authenticated
USING (true);

-- Usuários podem adicionar/remover suas próprias reações
CREATE POLICY "Users can manage own reactions"
ON public.portal_post_reactions FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS Policies para portal_post_comments
-- Todos autenticados podem ver comentários
CREATE POLICY "Anyone can view comments"
ON public.portal_post_comments FOR SELECT
TO authenticated
USING (true);

-- Usuários podem adicionar seus próprios comentários
CREATE POLICY "Users can insert own comments"
ON public.portal_post_comments FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Usuários podem atualizar/deletar seus próprios comentários
CREATE POLICY "Users can manage own comments"
ON public.portal_post_comments FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own comments"
ON public.portal_post_comments FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Admins podem deletar qualquer comentário
CREATE POLICY "Admins can delete any comment"
ON public.portal_post_comments FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Bucket para vídeos do portal
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('portal-videos', 'portal-videos', true, 524288000) -- 500MB limit
ON CONFLICT (id) DO NOTHING;

-- Storage policies para portal-videos
CREATE POLICY "Anyone can view portal videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'portal-videos');

CREATE POLICY "Admins can upload portal videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'portal-videos' 
  AND public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Admins can update portal videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'portal-videos' 
  AND public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Admins can delete portal videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'portal-videos' 
  AND public.has_role(auth.uid(), 'super_admin')
);
