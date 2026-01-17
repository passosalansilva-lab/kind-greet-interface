-- Adicionar suporte a threads em comentários do portal
-- Adiciona coluna parent_id para permitir respostas em comentários

ALTER TABLE public.portal_post_comments
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.portal_post_comments(id) ON DELETE CASCADE;

-- Índice para melhorar performance ao buscar respostas
CREATE INDEX IF NOT EXISTS idx_portal_post_comments_parent_id ON public.portal_post_comments(parent_id);
