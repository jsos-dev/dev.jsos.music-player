import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Disc3, RefreshCw, ExternalLink, Heart, Music } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipTrigger, TooltipPopup } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'

const STEP = 104

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function FavoritesWidget() {
  const { t } = useI18n()
  const [favoriteIds, setFavoriteIds] = useState([])
  const [allFiles, setAllFiles] = useState([])
  const [favorites, setFavorites] = useState([])
  const [currentTrack, setCurrentTrack] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [metadata, setMetadata] = useState(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [shuffle, setShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState('off')
  const [isExpanded, setIsExpanded] = useState(false)
  const audioRef = useRef(null)

  // ResizeObserver: detect iframe height changes to toggle expanded mode
  useEffect(() => {
    function checkSize() {
      const rows = Math.round(window.innerHeight / STEP)
      setIsExpanded(rows >= 2)
    }
    checkSize()
    const ro = new ResizeObserver(checkSize)
    ro.observe(document.documentElement)
    return () => ro.disconnect()
  }, [])

  // Load data
  useEffect(() => {
    async function load() {
      try {
        const [favRes, dbRes] = await Promise.all([
          fetch('/api/favorites'),
          fetch('/api/audio/db'),
        ])
        const favData = await favRes.json()
        const dbData = await dbRes.json()
        setFavoriteIds(favData.favorites || [])
        setAllFiles(dbData.files || [])
      } catch {}
    }
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [])

  const handleRefresh = useCallback(async () => {
    try {
      const [favRes, dbRes] = await Promise.all([
        fetch('/api/favorites'),
        fetch('/api/audio/db'),
      ])
      const favData = await favRes.json()
      const dbData = await dbRes.json()
      setFavoriteIds(favData.favorites || [])
      setAllFiles(dbData.files || [])
    } catch {}
  }, [])

  const handleOpenPlayer = useCallback(() => {
    window.JSOS?.openApp?.('dev.jsos.music-player')
  }, [])

  useEffect(() => {
    const favSet = new Set(favoriteIds)
    setFavorites(allFiles.filter(f => favSet.has(f.id)))
  }, [favoriteIds, allFiles])

  useEffect(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.play().catch(() => setIsPlaying(false))
    } else {
      audioRef.current.pause()
    }
  }, [isPlaying])

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

  const playTrack = useCallback((file, index) => {
    setCurrentTrack(file)
    setCurrentIndex(index)
    setCurrentTime(0)
    setDuration(0)
    setMetadata(null)
    loadMetadata(file)
    setIsPlaying(true)
  }, [loadMetadata])

  const togglePlay = useCallback(() => {
    if (!currentTrack && favorites.length > 0) {
      playTrack(favorites[0], 0)
      return
    }
    setIsPlaying(prev => !prev)
  }, [currentTrack, favorites, playTrack])

  const playPrev = useCallback(() => {
    if (favorites.length === 0) return
    if (shuffle) {
      const ri = Math.floor(Math.random() * favorites.length)
      playTrack(favorites[ri], ri)
    } else {
      const ni = currentIndex <= 0 ? favorites.length - 1 : currentIndex - 1
      playTrack(favorites[ni], ni)
    }
  }, [favorites, currentIndex, shuffle, playTrack])

  const playNext = useCallback(() => {
    if (favorites.length === 0) return
    if (shuffle) {
      const ri = Math.floor(Math.random() * favorites.length)
      playTrack(favorites[ri], ri)
    } else {
      const ni = (currentIndex + 1) % favorites.length
      playTrack(favorites[ni], ni)
    }
  }, [favorites, currentIndex, shuffle, playTrack])

  const handleTrackEnd = useCallback(() => {
    if (repeatMode === 'one') {
      setIsPlaying(true)
    } else if (repeatMode === 'all' || currentIndex < favorites.length - 1) {
      playNext()
    } else {
      setIsPlaying(false)
    }
  }, [repeatMode, currentIndex, favorites.length, playNext])

  const handleSeek = useCallback((value) => {
    if (audioRef.current && isFinite(value)) {
      audioRef.current.currentTime = value
      setCurrentTime(value)
    }
  }, [])

  const toggleRepeat = useCallback(() => {
    setRepeatMode(prev => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'))
  }, [])

  const toggleShuffle = useCallback(() => setShuffle(prev => !prev), [])

  const audioSrc = currentTrack
    ? `/api/audio/stream?id=${encodeURIComponent(currentTrack.id)}`
    : null

  const displayName = currentTrack
    ? (metadata?.title || currentTrack.name.replace(/\.[^/.]+$/, ''))
    : ''
  const displayArtist = metadata?.artist || ''

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
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

      {/* ===== Top section: Player controls (always visible) ===== */}
      <div className="shrink-0">
        {/* Track info */}
        <div className="flex items-center gap-2 px-2 pt-2 pb-0.5 min-w-0">
          <div className="size-7 rounded bg-muted flex items-center justify-center shrink-0">
            {metadata?.picture ? (
              <img
                src={`data:${metadata.picture.format};base64,${btoa(
                  new Uint8Array(metadata.picture.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
                )}`}
                alt=""
                className="size-7 rounded object-cover"
              />
            ) : (
              <Disc3 className={`size-3.5 text-muted-foreground ${isPlaying ? 'animate-spin' : ''}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {currentTrack ? (
              <>
                <p className="text-[11px] font-medium truncate leading-tight">{displayName}</p>
                {displayArtist && (
                  <p className="text-[9px] text-muted-foreground truncate leading-tight">{displayArtist}</p>
                )}
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">{t('noTrackPlaying')}</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-1 px-2 py-0.5">
          <span className="text-[9px] text-muted-foreground w-7 text-right tabular-nums">
            {formatTime(currentTime)}
          </span>
          <Slider
            value={isFinite(currentTime) ? [currentTime] : [0]}
            max={isFinite(duration) && duration > 0 ? duration : 100}
            step={0.1}
            onValueChange={(v) => handleSeek(Array.isArray(v) ? v[0] : v)}
            className="flex-1 [&_[data-slot=slider-thumb]]:size-3"
          />
          <span className="text-[9px] text-muted-foreground w-7 tabular-nums">
            {formatTime(duration)}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-0.5 px-2 pb-2">
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={toggleShuffle} className={`size-6 ${shuffle ? 'text-primary' : 'text-muted-foreground'}`} aria-label={t('shuffle')} />}>
              <Shuffle className="size-3" />
            </TooltipTrigger>
            <TooltipPopup>{shuffle ? t('shuffleOn') : t('shuffleOff')}</TooltipPopup>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={playPrev} disabled={favorites.length === 0} className="size-6" aria-label={t('prev')} />}>
              <SkipBack className="size-3" />
            </TooltipTrigger>
            <TooltipPopup>{t('prev')}</TooltipPopup>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={togglePlay} className="size-7" aria-label={isPlaying ? t('pause') : t('play')} />}>
              {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
            </TooltipTrigger>
            <TooltipPopup>{isPlaying ? t('pause') : t('play')}</TooltipPopup>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={playNext} disabled={favorites.length === 0} className="size-6" aria-label={t('next')} />}>
              <SkipForward className="size-3" />
            </TooltipTrigger>
            <TooltipPopup>{t('next')}</TooltipPopup>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={toggleRepeat} className={`size-6 ${repeatMode !== 'off' ? 'text-primary' : 'text-muted-foreground'}`} aria-label={t('repeat')} />}>
              <Repeat className="size-3" />
            </TooltipTrigger>
            <TooltipPopup>{repeatMode === 'one' ? t('repeatOne') : repeatMode === 'all' ? t('repeatAll') : t('repeatOff')}</TooltipPopup>
          </Tooltip>
        </div>
      </div>

      {/* ===== Bottom section: Header + Favorites list (only when expanded) ===== */}
      {isExpanded && (
        <div className="flex-1 min-h-0 flex flex-col border-t">
          {/* Header */}
          <div className="flex items-center justify-between px-2 pt-1.5 pb-0.5 shrink-0">
            <span className="text-[11px] font-medium text-muted-foreground truncate">{t('favorites')}</span>
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={handleRefresh} className="size-5" aria-label={t('refresh')} />}>
                  <RefreshCw className="size-3" />
                </TooltipTrigger>
                <TooltipPopup>{t('refresh')}</TooltipPopup>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={handleOpenPlayer} className="size-5" aria-label={t('openPlayer')} />}>
                  <ExternalLink className="size-3" />
                </TooltipTrigger>
                <TooltipPopup>{t('openPlayer')}</TooltipPopup>
              </Tooltip>
            </div>
          </div>

          {/* Favorites list */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {favorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-1 py-4">
                <Music className="size-6 opacity-40" />
                <span className="text-[10px]">{t('noFiles')}</span>
              </div>
            ) : (
              favorites.map((file, index) => (
                <div
                  key={file.id}
                  className={`flex items-center gap-2 px-2 py-1 cursor-default transition-colors hover:bg-accent/30 ${
                    currentTrack?.id === file.id ? 'bg-accent' : ''
                  }`}
                  onDoubleClick={() => playTrack(file, index)}
                >
                  <span className="text-[10px] text-muted-foreground w-4 text-right tabular-nums shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] truncate ${currentTrack?.id === file.id ? 'text-primary font-medium' : ''}`}>
                      {file.name.replace(/\.[^/.]+$/, '')}
                    </p>
                  </div>
                  <Heart className="size-3 text-primary fill-primary shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
