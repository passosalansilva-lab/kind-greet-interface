-- Criar tabela de notas de versão
CREATE TABLE IF NOT EXISTS release_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('feature', 'bugfix', 'improvement', 'breaking')),
  published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para ordenação por versão e data
CREATE INDEX IF NOT EXISTS idx_release_notes_created_at ON release_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_notes_version ON release_notes(version);

-- RLS policies
ALTER TABLE release_notes ENABLE ROW LEVEL SECURITY;

-- Super admins podem fazer tudo
CREATE POLICY "Super admins can manage release notes" ON release_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Leitura pública para notas publicadas (usuários autenticados)
CREATE POLICY "Authenticated users can read published release notes" ON release_notes
  FOR SELECT
  USING (published = true);
