import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  RefreshCw,
  Disc3,
  FolderOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipTrigger, TooltipPopup, TooltipProvider } from '@/components/ui/tooltip'
import Sidebar from '@/components/Sidebar'
import Playlist from '@/components/Playlist'
import ContextMenu from '@/components/ContextMenu'
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog'
import FavoritesWidget from '@/components/FavoritesWidget'
import { useI18n } from '@/i18n'

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function App() {
  const { t } = useI18n()
  const [route, setRoute] = useState(() => {
    const hash = window.location.hash
    if (hash.startsWith('#/widget/')) return 'widget'
    return 'player'
  })
  const [files, setFiles] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentTrack, setCurrentTrack] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [repeatMode, setRepeatMode] = useState('off')
  const [shuffle, setShuffle] = useState(false)
  const [metadata, setMetadata] = useState(null)
  const [favorites, setFavorites] = useState([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [contextMenu, setContextMenu] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const audioRef = useRef(null)

  // Theme init
  useEffect(() => {
    async function init() {
      try {
        const mode = await window.JSOS?.getTheme()
        const effective = mode === 'dark' || mode === 'light' ? mode : 'dark'
        document.documentElement.classList.toggle('dark', effective === 'dark')
      } catch (e) {}
    }
    init()
    const unsub = window.JSOS?.onThemeChange?.(mode => {
      const effective = mode === 'dark' || mode === 'light' ? mode : 'dark'
      document.documentElement.classList.toggle('dark', effective === 'dark')
    })
    return () => unsub?.()
  }, [])

  // Hash routing
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash
      if (hash.startsWith('#/widget/')) {
        setRoute('widget')
      } else {
        setRoute('player')
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (route === 'widget') {
      document.body.classList.add('widget-mode')
      return () => document.body.classList.remove('widget-mode')
    }
  }, [route])

  // Audio play/pause sync
  useEffect(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.play().catch(() => setIsPlaying(false))
    } else {
      audioRef.current.pause()
    }
  }, [isPlaying])

  // Sync volume to audio element
  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = isMuted ? 0 : (isFinite(volume) ? volume : 0.8)
  }, [volume, isMuted])

  // Scan files (POST = force rescan)
  const scanFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/audio/scan', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to scan audio files')
      const data = await res.json()
      setFiles(data.files)
      setCategories(data.categories || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch cached DB (fast, no rescan)
  const fetchDb = useCallback(async () => {
    try {
      const res = await fetch('/api/audio/db')
      if (!res.ok) return
      const data = await res.json()
      if (data.files) setFiles(data.files)
      if (data.categories) setCategories(data.categories)
    } catch {}
  }, [])

  // Load favorites
  const loadFavorites = useCallback(async () => {
    try {
      const res = await fetch('/api/favorites')
      if (!res.ok) return
      const data = await res.json()
      setFavorites(data.favorites || [])
    } catch {}
  }, [])

  // Initial load from cache + polling
  useEffect(() => {
    fetchDb()
    loadFavorites()
    const timer = setInterval(fetchDb, 30000)
    return () => clearInterval(timer)
  }, [fetchDb, loadFavorites])

  // Filter files by category
  const displayFiles = useMemo(() => {
    if (activeCategory === 'all') return files
    if (activeCategory === 'favorites') {
      const favSet = new Set(favorites)
      return files.filter(f => favSet.has(f.id))
    }
    if (activeCategory.startsWith('dir:')) {
      const cat = categories.find(c => c.id === activeCategory)
      if (!cat?.dirName) return []
      return files.filter(f => f.category === cat.dirName)
    }
    return files
  }, [files, activeCategory, favorites, categories])

  // Metadata loading
  const loadMetadata = useCallback(async (file) => {
    try {
      const res = await fetch(`/api/audio/metadata?id=${encodeURIComponent(file.id)}`)
      if (!res.ok) return
      const data = await res.json()
      setMetadata(data)
    } catch {
      setMetadata(null)
    }
  }, [])

  // Play a track
  const playTrack = useCallback((file, index) => {
    setCurrentTrack(file)
    setCurrentIndex(index)
    setCurrentTime(0)
    setMetadata(null)
    loadMetadata(file)
    setIsPlaying(true)
  }, [loadMetadata])

  // Player controls
  const togglePlay = useCallback(() => {
    if (!currentTrack) {
      if (displayFiles.length > 0) {
        playTrack(displayFiles[0], 0)
      }
      return
    }
    setIsPlaying(prev => !prev)
  }, [currentTrack, displayFiles, playTrack])

  const playPrev = useCallback(() => {
    if (displayFiles.length === 0) return
    if (shuffle) {
      const ri = Math.floor(Math.random() * displayFiles.length)
      playTrack(displayFiles[ri], ri)
    } else {
      const ni = currentIndex <= 0 ? displayFiles.length - 1 : currentIndex - 1
      playTrack(displayFiles[ni], ni)
    }
  }, [displayFiles, currentIndex, shuffle, playTrack])

  const playNext = useCallback(() => {
    if (displayFiles.length === 0) return
    if (shuffle) {
      const ri = Math.floor(Math.random() * displayFiles.length)
      playTrack(displayFiles[ri], ri)
    } else {
      const ni = (currentIndex + 1) % displayFiles.length
      playTrack(displayFiles[ni], ni)
    }
  }, [displayFiles, currentIndex, shuffle, playTrack])

  const handleTrackEnd = useCallback(() => {
    if (repeatMode === 'one') {
      setCurrentTime(0)
      setIsPlaying(true)
    } else if (repeatMode === 'all' || currentIndex < displayFiles.length - 1) {
      playNext()
    } else {
      setIsPlaying(false)
    }
  }, [repeatMode, currentIndex, displayFiles.length, playNext])

  const handleSeek = useCallback((value) => {
    if (audioRef.current && isFinite(value)) {
      audioRef.current.currentTime = value
      setCurrentTime(value)
    }
  }, [])

  const handleVolumeChange = useCallback((value) => {
    const v = isFinite(value) ? value : 0.8
    setVolume(v)
    setIsMuted(false)
  }, [])

  const toggleMute = useCallback(() => setIsMuted(prev => !prev), [])

  const toggleRepeat = useCallback(() => {
    setRepeatMode(prev => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'))
  }, [])

  const toggleShuffle = useCallback(() => setShuffle(prev => !prev), [])

  // Favorites toggle
  const toggleFavorite = useCallback(async (id) => {
    const isFav = favorites.includes(id)
    try {
      if (isFav) {
        const res = await fetch(`/api/favorites?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        })
        if (!res.ok) return
        const data = await res.json()
        setFavorites(data.favorites)
      } else {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        if (!res.ok) return
        const data = await res.json()
        setFavorites(data.favorites)
      }
    } catch {}
  }, [favorites])

  // Delete file
  const handleDelete = useCallback(async (file) => {
    try {
      const res = await fetch(`/api/audio/delete?id=${encodeURIComponent(file.id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) return
      if (currentTrack?.id === file.id) {
        setCurrentTrack(null)
        setCurrentIndex(-1)
        setIsPlaying(false)
        setMetadata(null)
      }
      await scanFiles()
      await loadFavorites()
    } catch {}
  }, [currentTrack, scanFiles, loadFavorites])

  // Context menu handlers
  const handleContextMenu = useCallback((e, file, index) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, file, index })
  }, [])

  const handlePlayFromContextMenu = useCallback(() => {
    if (contextMenu) {
      playTrack(contextMenu.file, contextMenu.index)
    }
  }, [contextMenu, playTrack])

  const handleFavoriteFromContextMenu = useCallback(() => {
    if (contextMenu) {
      toggleFavorite(contextMenu.file.id)
    }
  }, [contextMenu, toggleFavorite])

  const handleDeleteFromContextMenu = useCallback(() => {
    if (contextMenu) {
      setDeleteTarget(contextMenu.file)
    }
  }, [contextMenu])

  // Open folder
  const handleOpenFolder = useCallback(async () => {
    try {
      const res = await fetch('/api/config')
      const config = await res.json()
      const dataDir = config.dataDir || '/'
      window.JSOS?.openApp?.('dev.jsos.filemanager', { route: dataDir })
    } catch {}
  }, [])

  // Widget route
  if (route === 'widget') {
    return <FavoritesWidget />
  }

  const audioSrc = currentTrack
    ? `/api/audio/stream?id=${encodeURIComponent(currentTrack.id)}`
    : null

  return (
    <TooltipProvider>
    <div className="flex h-full flex-col bg-background">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onCanPlay={() => {
          if (isPlaying && audioRef.current?.paused) {
            audioRef.current.play().catch(() => setIsPlaying(false))
          }
        }}
        onEnded={handleTrackEnd}
        onError={() => setIsPlaying(false)}
      />

      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <Music className="size-5 text-primary" />
          <h1 className="text-lg font-semibold">{t('appTitle')}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={handleOpenFolder} aria-label={t('openFolder')} />}>
              <FolderOpen className="size-4" />
            </TooltipTrigger>
            <TooltipPopup>{t('openFolder')}</TooltipPopup>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={scanFiles} disabled={loading} aria-label={t('refresh')} />}>
              <RefreshCw className={loading ? 'animate-spin' : ''} />
            </TooltipTrigger>
            <TooltipPopup>{t('refresh')}</TooltipPopup>
          </Tooltip>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar
          files={files}
          categories={categories}
          favorites={favorites}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
        />

        {/* Playlist area */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
              <span className="size-4 rounded-full border-2 border-border border-t-foreground animate-spin" />
              <span className="text-sm">{t('loading')}</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-destructive text-sm">
              {error}
            </div>
          ) : (
            <Playlist
              files={displayFiles}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              favorites={favorites}
              onPlay={playTrack}
              onFavorite={toggleFavorite}
              onContextMenu={handleContextMenu}
            />
          )}
        </div>
      </div>

      {/* Fixed bottom player bar — always visible */}
      <div className="border-t bg-card px-4 py-2 shrink-0">
        <div className="flex items-center gap-4">
          {/* Track info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="size-10 rounded-md bg-muted flex items-center justify-center shrink-0">
              {metadata?.picture ? (
                <img
                  src={`data:${metadata.picture.format};base64,${btoa(
                    new Uint8Array(metadata.picture.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
                  )}`}
                  alt="Album cover"
                  className="size-10 rounded-md object-cover"
                />
              ) : (
                <Disc3 className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              {currentTrack ? (
                <>
                  <p className="text-sm font-medium truncate">
                    {metadata?.title || currentTrack.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {metadata?.artist || t('unknownArtist')}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t('noTrackPlaying')}</p>
              )}
            </div>
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={toggleShuffle} className={shuffle ? 'text-primary' : ''} aria-label={t('shuffle')} />}>
                <Shuffle className="size-4" />
              </TooltipTrigger>
              <TooltipPopup>{shuffle ? t('shuffleOn') : t('shuffleOff')}</TooltipPopup>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={playPrev} aria-label={t('prev')} />}>
                <SkipBack className="size-4" />
              </TooltipTrigger>
              <TooltipPopup>{t('prev')}</TooltipPopup>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={togglePlay} aria-label={isPlaying ? t('pause') : t('play')} />}>
                {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
              </TooltipTrigger>
              <TooltipPopup>{isPlaying ? t('pause') : t('play')}</TooltipPopup>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={playNext} aria-label={t('next')} />}>
                <SkipForward className="size-4" />
              </TooltipTrigger>
              <TooltipPopup>{t('next')}</TooltipPopup>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={toggleRepeat} className={repeatMode !== 'off' ? 'text-primary' : ''} aria-label={t('repeat')} />}>
                <Repeat className="size-4" />
                {repeatMode === 'one' && <span className="absolute text-[8px] font-bold">1</span>}
              </TooltipTrigger>
              <TooltipPopup>{repeatMode === 'one' ? t('repeatOne') : repeatMode === 'all' ? t('repeatAll') : t('repeatOff')}</TooltipPopup>
            </Tooltip>
          </div>

          {/* Progress + volume */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
              {formatTime(currentTime)}
            </span>
            <Slider value={isFinite(currentTime) ? [currentTime] : [0]} max={isFinite(duration) && duration > 0 ? duration : 100} step={0.1} onValueChange={handleSeek} className="w-32 [&_[data-slot=slider-thumb]]:size-3.5" />
            <span className="text-xs text-muted-foreground w-10 tabular-nums">
              {formatTime(duration)}
            </span>
            <div className="flex items-center gap-1 ml-2">
              <Tooltip>
                <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={toggleMute} aria-label={isMuted ? t('unmute') : t('mute')} />}>
                  {isMuted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                </TooltipTrigger>
                <TooltipPopup>{isMuted ? t('unmute') : t('mute')}</TooltipPopup>
              </Tooltip>
              <Slider value={[isFinite(volume) ? volume : 0.8]} max={1} step={0.01} onValueChange={handleVolumeChange} className="w-20 [&_[data-slot=slider-thumb]]:size-3" />
            </div>
          </div>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          isFavorite={favorites.includes(contextMenu.file.id)}
          onClose={() => setContextMenu(null)}
          onPlay={handlePlayFromContextMenu}
          onToggleFavorite={handleFavoriteFromContextMenu}
          onDelete={handleDeleteFromContextMenu}
        />
      )}

      {/* Delete confirm dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          fileName={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
    </TooltipProvider>
  )
}
