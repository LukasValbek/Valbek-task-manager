-- =============================================================
-- TASK MANAGER – Supabase SQL Setup
-- Spustit celý soubor v Supabase Dashboard > SQL Editor
-- =============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TABULKY
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user'))
);

CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES profiles(id),
  status      TEXT NOT NULL DEFAULT 'neudělano'
    CHECK (status IN ('neudělano', 'rozpracováno', 'připraveno ke kontrole', 'hotovo')),
  priority    TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  due_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES profiles(id),
  updated_by  UUID REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES profiles(id),
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 2. INDEXY
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);

-- ────────────────────────────────────────────────────────────
-- 3. TRIGGER: auto updated_at na tasks
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- 4. HELPER FUNKCE pro RLS (SECURITY DEFINER)
-- ────────────────────────────────────────────────────────────

-- Zjistí, zda je přihlášený uživatel členem projektu
CREATE OR REPLACE FUNCTION is_project_member(proj_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = proj_id AND user_id = auth.uid()
  );
$$;

-- Zjistí, zda je přihlášený uživatel admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Vrátí project_id úkolu (pro RLS komentářů)
CREATE OR REPLACE FUNCTION task_project_id(t_id UUID)
RETURNS UUID LANGUAGE sql SECURITY DEFINER AS $$
  SELECT project_id FROM tasks WHERE id = t_id;
$$;

-- Veřejná funkce: převede username → email (pro login bez zobrazení emailu)
CREATE OR REPLACE FUNCTION get_email_by_username(p_username TEXT)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER AS $$
  SELECT u.email
  FROM auth.users u
  JOIN profiles p ON p.id = u.id
  WHERE p.username = p_username;
$$;
GRANT EXECUTE ON FUNCTION get_email_by_username(TEXT) TO anon;

-- ────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments        ENABLE ROW LEVEL SECURITY;

-- profiles: každý přihlášený vidí všechny profily (nutné pro zobrazení jmen)
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- projects
DROP POLICY IF EXISTS "projects_select" ON projects;
CREATE POLICY "projects_select" ON projects
  FOR SELECT TO authenticated USING (is_project_member(id));

DROP POLICY IF EXISTS "projects_insert" ON projects;
CREATE POLICY "projects_insert" ON projects
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "projects_update" ON projects;
CREATE POLICY "projects_update" ON projects
  FOR UPDATE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "projects_delete" ON projects;
CREATE POLICY "projects_delete" ON projects
  FOR DELETE TO authenticated USING (is_admin());

-- project_members
DROP POLICY IF EXISTS "pm_select" ON project_members;
CREATE POLICY "pm_select" ON project_members
  FOR SELECT TO authenticated USING (is_project_member(project_id));

DROP POLICY IF EXISTS "pm_insert" ON project_members;
CREATE POLICY "pm_insert" ON project_members
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "pm_delete" ON project_members;
CREATE POLICY "pm_delete" ON project_members
  FOR DELETE TO authenticated USING (is_admin());

-- tasks
DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT TO authenticated USING (is_project_member(project_id));

DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT TO authenticated WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE TO authenticated USING (is_admin());

-- comments
DROP POLICY IF EXISTS "comments_select" ON comments;
CREATE POLICY "comments_select" ON comments
  FOR SELECT TO authenticated
  USING (is_project_member(task_project_id(task_id)));

DROP POLICY IF EXISTS "comments_insert" ON comments;
CREATE POLICY "comments_insert" ON comments
  FOR INSERT TO authenticated
  WITH CHECK (is_project_member(task_project_id(task_id)));

DROP POLICY IF EXISTS "comments_delete" ON comments;
CREATE POLICY "comments_delete" ON comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR is_admin());

-- ────────────────────────────────────────────────────────────
-- 6. REALTIME – povolit pro tabulky
-- ────────────────────────────────────────────────────────────
-- Spustit ručně v Supabase Dashboard:
-- Database > Replication > zapnout pro: projects, project_members, tasks, comments
--
-- Nebo přes SQL (pokud je extension supabase_realtime dostupná):
-- ALTER PUBLICATION supabase_realtime ADD TABLE projects, project_members, tasks, comments;

-- ────────────────────────────────────────────────────────────
-- 7. SEED DATA – 4 uživatelé
-- ────────────────────────────────────────────────────────────
-- POSTUP:
-- 1. Nejprve vytvořte uživatele v Supabase Dashboard > Authentication > Users:
--    - tomas@[vas-email.cz]   heslo: [nastavit]  → zkopírujte UUID
--    - lukas@[vas-email.cz]   heslo: [nastavit]  → zkopírujte UUID
--    - nela@[vas-email.cz]    heslo: [nastavit]  → zkopírujte UUID
--    - lenka@[vas-email.cz]   heslo: [nastavit]  → zkopírujte UUID
--
-- 2. Nahraďte UUID níže a spusťte:

/*
INSERT INTO profiles (id, username, name, role) VALUES
  ('UUID-TOMAS', 'tomas', 'Tomáš', 'admin'),
  ('UUID-LUKAS', 'lukas', 'Lukáš', 'admin'),
  ('UUID-NELA',  'nela',  'Nela',  'user'),
  ('UUID-LENKA', 'lenka', 'Lenka', 'user')
ON CONFLICT (id) DO NOTHING;
*/
