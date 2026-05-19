import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { formatDate, isOverdue } from '@/lib/utils'

export function InlineSelect<T extends string>({ value, options, onChange, renderBadge }: {
  value: T
  options: Record<string, string>
  onChange: (val: T) => void
  renderBadge: () => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function outside(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [open])

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX })
    setOpen(o => !o)
  }

  return (
    <div ref={triggerRef} className="inline-block" onClick={handleOpen}>
      <span className="cursor-pointer hover:opacity-75 transition-opacity" title="Kliknutím změnit">
        {renderBadge()}
      </span>
      {open && createPortal(
        <div
          style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden min-w-36"
          onMouseDown={e => e.stopPropagation()}
        >
          {Object.entries(options).map(([v, label]) => (
            <button key={v}
              onClick={e => { e.stopPropagation(); onChange(v as T); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${v === value ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
              {label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

export function InlineDateInput({ value, onChange }: {
  value: string | null
  onChange: (val: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const overdue = isOverdue(value)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        defaultValue={value ?? ''}
        onClick={e => e.stopPropagation()}
        onChange={e => { onChange(e.target.value || null); setEditing(false) }}
        onBlur={() => setEditing(false)}
        className="px-2 py-0.5 text-sm border border-indigo-400 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    )
  }

  return (
    <span
      onClick={e => { e.stopPropagation(); setEditing(true) }}
      title="Kliknutím změnit"
      className={`cursor-pointer hover:opacity-75 transition-opacity text-sm ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}
    >
      {formatDate(value)}
    </span>
  )
}
