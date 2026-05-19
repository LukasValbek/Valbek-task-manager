import { useState, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { GripVertical, Trash2, Plus } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { PageLayout } from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import type { ReferenceItem } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────

type Section = 'layers' | 'model_subs' | 'object_ids'

const SECTION_LABELS: Record<Section, string> = {
  layers:     'Hladiny',
  model_subs: 'Model – kategorie (003)',
  object_ids: 'Object ID',
}

// ── Data fetching ─────────────────────────────────────────────

async function fetchItems(): Promise<ReferenceItem[]> {
  const { data, error } = await supabase
    .from('reference_items')
    .select('*')
    .eq('page', '3dmax')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ── Inline editable cell ──────────────────────────────────────

function EditableCell({ itemId, field, value, monospace, onSaved }: {
  itemId: string
  field: 'code' | 'name'
  value: string | null
  monospace?: boolean
  onSaved: (id: string, field: 'code' | 'name', val: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setDraft(value ?? '')
    setEditing(true)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 0)
  }

  async function save() {
    if (!editing) return
    setEditing(false)
    const val = draft.trim() || null
    if (field === 'name' && !val) return
    if (val === value) return
    setSaving(true)
    const { error } = await supabase.from('reference_items').update({ [field]: val }).eq('id', itemId)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    onSaved(itemId, field, val)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur() }
    if (e.key === 'Escape') { setEditing(false) }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={onKeyDown}
        onClick={e => e.stopPropagation()}
        className={`w-full px-1 py-0.5 text-sm border border-indigo-400 rounded outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${monospace ? 'font-mono font-bold text-indigo-600 dark:text-indigo-400' : ''}`}
      />
    )
  }

  return (
    <span
      onClick={startEdit}
      className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 py-0.5 -mx-1 transition-colors ${saving ? 'opacity-50' : ''} ${monospace ? 'font-mono font-bold text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-gray-100'}`}
      title="Kliknutím upravit"
    >
      {value ?? '–'}
    </span>
  )
}

// ── Sortable row ──────────────────────────────────────────────

function SortableRow({ item, canEdit, idsOnRight, onDelete, onCellSaved }: {
  item: ReferenceItem
  canEdit: boolean
  idsOnRight: boolean
  onDelete: (id: string) => void
  onCellSaved: (id: string, field: 'code' | 'name', val: string | null) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  const codeCell = (
    <td className="px-3 py-2 w-24">
      {canEdit
        ? <EditableCell itemId={item.id} field="code" value={item.code} monospace onSaved={onCellSaved} />
        : <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">{item.code ?? '–'}</span>
      }
    </td>
  )

  const nameCell = (
    <td className="px-3 py-2">
      {canEdit
        ? <EditableCell itemId={item.id} field="name" value={item.name} onSaved={onCellSaved} />
        : <span className="text-sm text-gray-900 dark:text-gray-100">{item.name}</span>
      }
    </td>
  )

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group">
      {canEdit && (
        <td className="pl-2 pr-1 py-2 w-6">
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical size={14} />
          </button>
        </td>
      )}
      {idsOnRight ? <>{nameCell}{codeCell}</> : <>{codeCell}{nameCell}</>}
      {canEdit && (
        <td className="px-2 py-2 w-8">
          <button
            onClick={e => { e.stopPropagation(); onDelete(item.id) }}
            className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Smazat"
          >
            <Trash2 size={14} />
          </button>
        </td>
      )}
    </tr>
  )
}

// ── Section ───────────────────────────────────────────────────

function ReferenceSection({ section, title, items, canEdit, idsOnRight, onAdd, onDelete, onCellSaved, onReorder }: {
  section: Section
  title: string
  items: ReferenceItem[]
  canEdit: boolean
  idsOnRight: boolean
  onAdd: (section: Section) => void
  onDelete: (id: string) => void
  onCellSaved: (id: string, field: 'code' | 'name', val: string | null) => void
  onReorder: (section: Section, newItems: ReferenceItem[]) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(section, arrayMove(items, oldIndex, newIndex))
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
        <h2 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{title}</h2>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                {canEdit && <th className="pl-2 pr-1 py-2 w-6"></th>}
                {idsOnRight
                  ? <><th className="text-left px-3 py-2 font-medium">Název</th><th className="text-left px-3 py-2 font-medium w-24">ID</th></>
                  : <><th className="text-left px-3 py-2 font-medium w-24">Vrstva</th><th className="text-left px-3 py-2 font-medium">Název</th></>
                }
                {canEdit && <th className="px-2 py-2 w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 4 : 2} className="px-4 py-4 text-center text-sm text-gray-400">
                    Žádné položky.
                  </td>
                </tr>
              ) : items.map(item => (
                <SortableRow
                  key={item.id}
                  item={item}
                  canEdit={canEdit}
                  idsOnRight={idsOnRight}
                  onDelete={onDelete}
                  onCellSaved={onCellSaved}
                />
              ))}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>

      {canEdit && (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => onAdd(section)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <Plus size={13} /> Přidat
          </button>
        </div>
      )}
    </div>
  )
}

// ── Add item modal ────────────────────────────────────────────

function AddItemModal({ section, onClose, onAdded }: {
  section: Section | null
  onClose: () => void
  onAdded: () => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setError('')
    if (!name.trim()) { setError('Název je povinný.'); return }
    if (!section) return
    setSaving(true)
    const { error: err } = await supabase.from('reference_items').insert({
      page: '3dmax',
      section,
      code: code.trim() || null,
      name: name.trim(),
      sort_order: 9999,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    toast.success('Přidáno.')
    onAdded()
    onClose()
  }

  const inputClass = "w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"

  return (
    <Modal open={!!section} onClose={onClose} title={`Přidat – ${section ? SECTION_LABELS[section] : ''}`} size="sm">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Kód / číslo</label>
          <input className={inputClass} value={code} onChange={e => setCode(e.target.value)} placeholder="např. 008" autoFocus />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Název <span className="text-red-500">*</span></label>
          <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="název" onKeyDown={e => e.key === 'Enter' && handleSave()} />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={onClose}>Zrušit</Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>Přidat</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────────────

export function ThreeDMaxPage() {
  const { isAdmin } = useAuthStore()
  const canEdit = isAdmin()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [addSection, setAddSection] = useState<Section | null>(null)

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['reference-3dmax'],
    queryFn: fetchItems,
  })

  const itemsBySection = {
    layers:     allItems.filter(i => i.section === 'layers'),
    model_subs: allItems.filter(i => i.section === 'model_subs'),
    object_ids: allItems.filter(i => i.section === 'object_ids'),
  }

  const handleCellSaved = useCallback((id: string, field: 'code' | 'name', val: string | null) => {
    queryClient.setQueryData<ReferenceItem[]>(['reference-3dmax'], prev =>
      prev?.map(item => item.id === id ? { ...item, [field]: val } : item) ?? []
    )
  }, [queryClient])

  async function handleDelete(id: string) {
    if (!await confirm({ message: 'Smazat položku?', confirmLabel: 'Smazat', variant: 'danger' })) return
    const { error } = await supabase.from('reference_items').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Smazáno.')
    queryClient.invalidateQueries({ queryKey: ['reference-3dmax'] })
  }

  async function handleReorder(section: Section, newItems: ReferenceItem[]) {
    // Optimistic update
    queryClient.setQueryData<ReferenceItem[]>(['reference-3dmax'], prev => {
      if (!prev) return prev
      const otherItems = prev.filter(i => i.section !== section)
      return [...otherItems, ...newItems]
    })
    // Persist
    const updates = newItems.map((item, i) =>
      supabase.from('reference_items').update({ sort_order: i * 10 }).eq('id', item.id)
    )
    const results = await Promise.all(updates)
    if (results.some(r => r.error)) {
      toast.error('Chyba při ukládání pořadí.')
      queryClient.invalidateQueries({ queryKey: ['reference-3dmax'] })
    }
  }

  const sections: Array<{ key: Section; idsOnRight: boolean }> = [
    { key: 'layers',     idsOnRight: false },
    { key: 'model_subs', idsOnRight: false },
    { key: 'object_ids', idsOnRight: true  },
  ]

  return (
    <PageLayout>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">3ds Max – reference</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">Načítám…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {sections.map(({ key, idsOnRight }) => (
            <ReferenceSection
              key={key}
              section={key}
              title={SECTION_LABELS[key]}
              items={itemsBySection[key]}
              canEdit={canEdit}
              idsOnRight={idsOnRight}
              onAdd={setAddSection}
              onDelete={handleDelete}
              onCellSaved={handleCellSaved}
              onReorder={handleReorder}
            />
          ))}
        </div>
      )}

      <AddItemModal
        section={addSection}
        onClose={() => setAddSection(null)}
        onAdded={() => queryClient.invalidateQueries({ queryKey: ['reference-3dmax'] })}
      />
    </PageLayout>
  )
}
