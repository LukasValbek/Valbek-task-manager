import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useConfirm } from './ConfirmDialog'
import { Modal } from './Modal'
import { Button } from './Button'
import { PriorityBadge } from './Badge'
import { PRIORITY_LABELS } from '@/lib/utils'
import type { TaskTemplate, TaskPriority } from '@/lib/types'

const inputClass = 'w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500'

// ── Template Row ──────────────────────────────────────────────

function TemplateRow({ template, onEdit, onDelete }: {
  template: TaskTemplate
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{template.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{template.title}</p>
        {template.description && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{template.description}</p>
        )}
      </div>
      <PriorityBadge priority={template.priority} />
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onEdit}
          className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400">
          <Pencil size={13} />
        </button>
        <button onClick={onDelete}
          className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Template Form ─────────────────────────────────────────────

function TemplateForm({ template, onSave, onCancel }: {
  template?: TaskTemplate
  onSave: () => void
  onCancel: () => void
}) {
  const [name,        setName]        = useState(template?.name ?? '')
  const [title,       setTitle]       = useState(template?.title ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [priority,    setPriority]    = useState<TaskPriority>(template?.priority ?? 'medium')
  const [saving,      setSaving]      = useState(false)

  async function handleSave() {
    if (!name.trim() || !title.trim()) return
    setSaving(true)
    if (template) {
      await supabase.from('task_templates').update({
        name: name.trim(), title: title.trim(),
        description: description.trim() || null, priority,
      }).eq('id', template.id)
    } else {
      await supabase.from('task_templates').insert({
        name: name.trim(), title: title.trim(),
        description: description.trim() || null, priority,
      })
    }
    setSaving(false)
    toast.success(template ? 'Šablona uložena.' : 'Šablona přidána.')
    onSave()
  }

  return (
    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Název šablony *</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Zpracování výkresu" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Priorita</label>
          <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className={inputClass}>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Výchozí název úkolu *</label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Zpracovat výkres DWG" className={inputClass} />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Výchozí popis</label>
        <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
          className={`${inputClass} resize-none`} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel}
          className="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
          <X size={15} />
        </button>
        <Button variant="primary" size="sm" loading={saving}
          onClick={handleSave} disabled={!name.trim() || !title.trim()}>
          <Check size={14} /> {template ? 'Uložit' : 'Přidat'}
        </Button>
      </div>
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────

export function ManageTaskTemplatesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd,   setShowAdd]   = useState(false)

  const { data: templates = [] } = useQuery<TaskTemplate[]>({
    queryKey: ['task-templates'],
    queryFn: async () => {
      const { data } = await supabase.from('task_templates').select('*').order('name')
      return (data || []) as TaskTemplate[]
    },
    enabled: open,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['task-templates'] })
  }

  async function handleDelete(template: TaskTemplate) {
    if (!await confirm({
      message: `Smazat šablonu „${template.name}"?`,
      confirmLabel: 'Smazat',
      variant: 'danger',
    })) return
    await supabase.from('task_templates').delete().eq('id', template.id)
    invalidate()
  }

  return (
    <Modal open={open} onClose={onClose} title="Šablony úkolů" size="md">
      <div className="space-y-2">
        {templates.length === 0 && !showAdd && (
          <p className="text-sm text-gray-400 py-6 text-center">Zatím žádné šablony.</p>
        )}
        {templates.map(t =>
          editingId === t.id
            ? <TemplateForm key={t.id} template={t}
                onSave={() => { setEditingId(null); invalidate() }}
                onCancel={() => setEditingId(null)} />
            : <TemplateRow key={t.id} template={t}
                onEdit={() => { setEditingId(t.id); setShowAdd(false) }}
                onDelete={() => handleDelete(t)} />
        )}
        {showAdd
          ? <TemplateForm
              onSave={() => { setShowAdd(false); invalidate() }}
              onCancel={() => setShowAdd(false)} />
          : (
            <button onClick={() => { setShowAdd(true); setEditingId(null) }}
              className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium pt-1">
              <Plus size={15} /> Přidat šablonu
            </button>
          )
        }
      </div>
    </Modal>
  )
}
