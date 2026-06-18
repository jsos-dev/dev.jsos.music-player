import { memo } from 'react'
import { Music, Pause, Heart } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useI18n } from '@/i18n'

function formatSize(bytes) {
  if (bytes == null || bytes === 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function getFileNameWithoutExt(filename) {
  return filename.replace(/\.[^/.]+$/, '')
}

const PlaylistItem = memo(function PlaylistItem({
  file,
  index,
  isCurrent,
  isPlaying,
  isFavorite,
  onDoubleClick,
  onContextMenu,
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 cursor-default transition-colors ${
        isCurrent ? 'bg-accent' : 'hover:bg-accent/30'
      }`}
      onDoubleClick={() => onDoubleClick(file, index)}
      onContextMenu={(e) => onContextMenu(e, file, index)}
    >
      <div className="w-8 h-8 flex items-center justify-center shrink-0">
        {isCurrent && isPlaying ? (
          <div className="flex items-end gap-0.5 h-4">
            <span className="w-0.5 bg-primary animate-pulse" style={{ height: '60%', animationDelay: '0ms' }} />
            <span className="w-0.5 bg-primary animate-pulse" style={{ height: '100%', animationDelay: '150ms' }} />
            <span className="w-0.5 bg-primary animate-pulse" style={{ height: '40%', animationDelay: '300ms' }} />
          </div>
        ) : isCurrent ? (
          <Pause className="size-4 text-primary" />
        ) : (
          <span className="text-xs text-muted-foreground tabular-nums">{index + 1}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${isCurrent ? 'text-primary font-medium' : ''}`}>
          {getFileNameWithoutExt(file.name)}
        </p>
      </div>
      <Heart
        className={`size-3.5 shrink-0 ${
          isFavorite ? 'text-primary fill-primary' : 'text-muted-foreground/40'
        }`}
      />
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatSize(file.size)}
      </span>
    </div>
  )
})

export default function Playlist({
  files,
  currentTrack,
  isPlaying,
  favorites,
  onPlay,
  onFavorite,
  onContextMenu,
}) {
  const { t } = useI18n()
  const favoriteSet = new Set(favorites)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <span className="text-sm font-medium">{t('playlist')}</span>
        <span className="text-xs text-muted-foreground">
          {t('trackCount', { count: files.length })}
        </span>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-12">
            <Music className="size-12 opacity-40" />
            <span className="text-sm">{t('noFiles')}</span>
          </div>
        ) : (
          files.map((file, index) => (
            <PlaylistItem
              key={file.id}
              file={file}
              index={index}
              isCurrent={currentTrack?.id === file.id}
              isPlaying={currentTrack?.id === file.id && isPlaying}
              isFavorite={favoriteSet.has(file.id)}
              onDoubleClick={onPlay}
              onContextMenu={onContextMenu}
            />
          ))
        )}
      </ScrollArea>
    </div>
  )
}
