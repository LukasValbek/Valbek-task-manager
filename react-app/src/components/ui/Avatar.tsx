import { avatarColor } from '@/lib/utils'

interface AvatarProps {
  name: string
  initials?: string | null
  color?: string | null
  small?: boolean
}

export function Avatar({ name, initials, color, small = false }: AvatarProps) {
  const text = (initials || name.slice(0, 2)).toUpperCase()
  const bg   = color || avatarColor(name)
  const size = small ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'

  return (
    <span
      title={name}
      className={`${size} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}
      style={{ backgroundColor: bg }}
    >
      {text}
    </span>
  )
}
