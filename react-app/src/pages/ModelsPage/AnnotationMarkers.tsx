import { Html } from '@react-three/drei'
import type { ModelAnnotation } from '@/lib/types'

export function AnnotationMarkers({ annotations, onDelete, canDelete, visible, hiddenIds }: {
  annotations: ModelAnnotation[]
  onDelete: (id: string) => void
  canDelete: boolean
  visible: boolean
  hiddenIds: Set<string>
}) {
  return (
    <>
      {annotations.map(ann => (
        <Html key={ann.id} position={[ann.x, ann.y, ann.z]} style={{ pointerEvents: 'none' }}>
          <div style={{
            transform: 'translateX(-50%) translateY(-100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            pointerEvents: visible && !hiddenIds.has(ann.id) ? 'auto' : 'none',
            opacity: visible && !hiddenIds.has(ann.id) ? 1 : 0,
            transition: 'opacity 0.9s ease',
          }}>
            <div style={{
              background: 'rgba(10,12,20,0.95)',
              border: '1px solid rgba(99,102,241,0.5)',
              borderRadius: 6,
              overflow: 'hidden',
              width: 200,
              boxShadow: '0 3px 12px rgba(0,0,0,0.6)',
            }}>
              {ann.object_name && (
                <div style={{
                  background: 'rgba(99,102,241,0.25)',
                  borderBottom: '1px solid rgba(99,102,241,0.3)',
                  padding: '2px 8px',
                  fontSize: 9,
                  color: '#a5b4fc',
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                  overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200,
                }}>
                  {ann.object_name}
                </div>
              )}
              <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span style={{ color: '#e5e7eb', fontSize: 11, flex: 1, wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{ann.text}</span>
                {canDelete && (
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); onDelete(ann.id) }}
                    style={{ color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 2px', fontSize: 14, lineHeight: 1, flexShrink: 0 }}
                  >×</button>
                )}
              </div>
            </div>
            <div style={{ width: 1, height: 16, background: 'linear-gradient(to bottom, rgba(129,140,248,0.8), rgba(129,140,248,0.3))' }} />
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#818cf8', boxShadow: '0 0 6px rgba(129,140,248,0.9)', flexShrink: 0 }} />
          </div>
        </Html>
      ))}
    </>
  )
}
