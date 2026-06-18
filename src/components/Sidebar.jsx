import { memo, useMemo } from 'react'
import { Music, FolderOpen, Heart } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useI18n } from '@/i18n'

const SidebarItem = memo(function SidebarItem({ icon: Icon, label, count, isActive, onClick }) {
  return (
    <button
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
        isActive
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      }`}
      onClick={onClick}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1 text-left truncate">{label}</span>
      {count > 0 && (
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      )}
    </button>
  )
})

export default function Sidebar({ files, categories, favorites, activeCategory, onSelectCategory }) {
  const { t } = useI18n()

  const items = useMemo(() => {
    const result = []

    for (const cat of categories) {
      if (cat.id === 'all') {
        result.push({ id: 'all', label: t('all'), icon: Music, count: cat.count })
      } else if (cat.id.startsWith('dir:')) {
        result.push({ id: cat.id, label: cat.label, icon: FolderOpen, count: cat.count })
      }
    }

    result.push({ id: 'favorites', label: t('favorites'), icon: Heart, count: favorites.length })

    return result
  }, [categories, favorites, t])

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t('library')}
        </span>
      </div>
      <ScrollArea className="flex-1 min-h-0 px-1">
        {items.map((item) => (
          <SidebarItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            count={item.count}
            isActive={activeCategory === item.id}
            onClick={() => onSelectCategory(item.id)}
          />
        ))}
      </ScrollArea>
    </div>
  )
}
