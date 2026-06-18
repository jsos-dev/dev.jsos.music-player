import { useEffect, useRef } from 'react'
import { Play, Heart, HeartOff, Trash2 } from 'lucide-react'
import { useI18n } from '@/i18n'

export default function ContextMenu({
  x,
  y,
  file,
  isFavorite,
  onClose,
  onPlay,
  onToggleFavorite,
  onDelete,
}) {
  const { t } = useI18n()
  const ref = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose()
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const menuItems = [
    { icon: <Play className="size-4" />, label: t('play'), action: onPlay },
    { type: 'separator' },
    {
      icon: isFavorite ? <HeartOff className="size-4" /> : <Heart className="size-4" />,
      label: isFavorite ? t('unfavorite') : t('favorite'),
      action: onToggleFavorite,
    },
    { type: 'separator' },
    {
      icon: <Trash2 className="size-4" />,
      label: t('delete'),
      action: onDelete,
      destructive: true,
    },
  ]

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-36 rounded-lg border bg-popover shadow-lg/5"
      style={{ left: x, top: y }}
    >
      <div className="p-1">
        {menuItems.map((item, i) =>
          item.type === 'separator' ? (
            <div key={i} className="mx-2 my-1 h-px bg-border" />
          ) : (
            <button
              key={i}
              className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent ${
                item.destructive
                  ? 'text-destructive hover:text-destructive'
                  : 'text-foreground'
              }`}
              onClick={() => {
                item.action()
                onClose()
              }}
            >
              {item.icon}
              {item.label}
            </button>
          )
        )}
      </div>
    </div>
  )
}
