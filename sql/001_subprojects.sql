-- =====================================================================
-- 001_subprojects.sql
-- Přidání podprojektů: subprojects + subproject_templates + tasks.subproject_id
-- Spusť v Supabase Dashboard → SQL Editor (jeden běh stačí)
-- =====================================================================

-- 1) Tabulka podprojektů (skupiny úkolů v rámci projektu)
CREATE TABLE IF NOT EXISTS public.subprojects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name       text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_subprojects_project
  ON public.subprojects(project_id, sort_order);

-- 2) Tabulka ručně spravovaných šablon (vedle 3DMax reference_items)
CREATE TABLE IF NOT EXISTS public.subproject_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  sort_order int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Sloupec v tasks – nullable, aby staré úkoly fungovaly
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS subproject_id uuid
  REFERENCES public.subprojects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_subproject
  ON public.tasks(subproject_id);

-- 4) Seed – Postprodukce je vždy v šablonách
INSERT INTO public.subproject_templates (name, sort_order)
VALUES ('Postprodukce', 999)
ON CONFLICT (name) DO NOTHING;

-- 5) Row-Level Security
ALTER TABLE public.subprojects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subproject_templates ENABLE ROW LEVEL SECURITY;

-- subprojects: vidí člen projektu nebo admin
DROP POLICY IF EXISTS "subprojects_select" ON public.subprojects;
CREATE POLICY "subprojects_select" ON public.subprojects
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = subprojects.project_id
        AND pm.user_id    = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- subprojects: zápis pouze admin
DROP POLICY IF EXISTS "subprojects_admin_write" ON public.subprojects;
CREATE POLICY "subprojects_admin_write" ON public.subprojects
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- subproject_templates: čte každý přihlášený
DROP POLICY IF EXISTS "subproject_templates_select" ON public.subproject_templates;
CREATE POLICY "subproject_templates_select" ON public.subproject_templates
  FOR SELECT TO authenticated USING (true);

-- subproject_templates: zápis pouze admin
DROP POLICY IF EXISTS "subproject_templates_admin_write" ON public.subproject_templates;
CREATE POLICY "subproject_templates_admin_write" ON public.subproject_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 6) Realtime – aby šly podprojekty živě synchronizovat
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.subprojects;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.subproject_templates;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
