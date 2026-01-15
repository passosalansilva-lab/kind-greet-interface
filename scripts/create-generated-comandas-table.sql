-- Create table to store generated/printed comanda numbers
CREATE TABLE IF NOT EXISTS generated_comandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  comanda_id UUID REFERENCES comandas(id) ON DELETE SET NULL,
  UNIQUE(company_id, number)
);

-- Enable RLS
ALTER TABLE generated_comandas ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their company generated comandas"
  ON generated_comandas FOR SELECT
  USING (
    company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
      UNION
      SELECT company_id FROM company_staff WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert generated comandas for their company"
  ON generated_comandas FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
      UNION
      SELECT company_id FROM company_staff WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update generated comandas for their company"
  ON generated_comandas FOR UPDATE
  USING (
    company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
      UNION
      SELECT company_id FROM company_staff WHERE user_id = auth.uid()
    )
  );

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_generated_comandas_company_unused 
  ON generated_comandas(company_id, number) 
  WHERE used_at IS NULL;
