# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from `react-app/` directory:

```bash
npm run dev      # dev server (Vite)
npm run build    # TypeScript check + Vite build
npm run lint     # ESLint
npm run preview  # preview production build
```

There are no tests. The build (`tsc -b && vite build`) is the primary correctness check — TypeScript errors will fail CI.

## Architecture

**Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Supabase (auth + DB + storage), TanStack Query, Zustand, React Router v7 (HashRouter), Sonner toasts, dnd-kit, Three.js / React Three Fiber.

**Deployment:** GitHub Pages via `.github/workflows/deploy.yml`. Env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON` are GitHub secrets.

### Auth & permissions

- `src/stores/authStore.ts` — Zustand store holding `user` (Supabase auth), `profile` (from `profiles` table), and `isAdmin()`.
- `isAdmin()` returns `true` when `profile.role === 'admin'`.
- Login uses username → Supabase RPC `get_email_by_username` → `signInWithPassword`.
- `AuthGuard` / `AdminGuard` components in `App.tsx` protect routes.
- Per-task permissions in `ProjectPage`: `canFullEdit = admin || isCreator`, `canChangeStatus = admin || isCreator || isAssigned`, `canDelete = admin || isCreator`.

### Data fetching

All server state uses **TanStack Query** (`useQuery`, `useQueryClient`). Global `staleTime` is 30 s. After mutations, always call `queryClient.invalidateQueries({ queryKey: [...] })` — never mutate cache directly.

Realtime updates use Supabase channels (`supabase.channel(...).on('postgres_changes', ...).subscribe()`). These invalidate the same query keys so the UI stays in sync.

### Page structure

Large pages are split into `src/pages/PageName/` folders with `index.tsx` as the entry point:

- `src/pages/ProjectPage/` — main task management page. `index.tsx` holds `ProjectPage`, sub-components in separate files (`TaskDetailModal`, `CreateTaskModal`, `SortableTaskRow`, `TaskGroup`, `ManageSubprojectsModal`, `EditProjectModal`, `BulkCreateTasksModal`). Shared CSS class `inputClass` and small utilities live in `shared.ts`.
- `src/pages/ModelsPage/` — 3D model viewer. `Viewer.tsx` is the full-screen 3D viewer (~430 lines). `ModelWithReveal.tsx` handles GLTF loading + reveal animation. Camera helpers in `CameraControls.tsx`. Vegetation system in `Vegetation.tsx`. `shared.ts` exports `BUCKET`, `SceneNode`, `CameraState`, `setMeshGlow`.

Single-file pages: `DashboardPage`, `MyTasksPage`, `ReportsPage`, `ThreeDMaxPage`, `ReviewPage`, `InspiracePage`.

### Key data model notes

- **Task assignees** use two fields: `tasks.assigned_to` (legacy single user) and `task_assignees` table (multi-user). Both are checked when evaluating `isAssigned`. When self-assigning, only `task_assignees` is updated — `assigned_to` is not changed.
- **`selectedTask` in ProjectPage** is derived from `tasks.find(t => t.id === selectedTaskId)`, not stored as a snapshot, so it always reflects the latest query data.
- **3D model data** (annotations, vegetation) links to `model_files.id`. Re-uploading a model file keeps the same `id`, preserving all linked data.

### UI components (`src/components/ui/`)

- `Modal` — wraps Radix Dialog, sizes: `sm | md | lg | xl`
- `Button` — variants: `primary | secondary | danger | ghost`, sizes: `sm | md`
- `StatusBadge` / `PriorityBadge` — read-only colored chips
- `InlineSelect` / `InlineDateInput` — click-to-edit cells in task table
- `useConfirm()` — imperative confirm dialog, returns a Promise
- `Avatar` — colored initials avatar, prop `small` for 24px size

### Supabase storage buckets

- `models` — 3D model files (`.glb`/`.gltf`) and their thumbnails (`thumbs/`)
- `attachments` — task file attachments (`task-files/<task_id>/`) and comment images (`comment-images/<task_id>/`)

### TypeScript

`verbatimModuleSyntax` is enabled — types imported from other project files must use `import type { ... }` syntax.
