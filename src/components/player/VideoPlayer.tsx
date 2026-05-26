import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  Subtitles,
  Settings,
  PictureInPicture2,
  ChevronRight,
  List,
  X,
  Gauge,
  MonitorPlay,
  Mic2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Movie } from '@/types'

interface VideoPlayerProps {
  movie: Movie
  onBack: () => void
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const QUALITIES = ['Auto', '4K', '1080p', '720p', '480p']
const SUBTITLES = ['Off', 'English', 'Spanish', 'French', 'German', 'Japanese']
const AUDIO_TRACKS = ['English', 'Spanish', 'French', 'Original']

interface ShortcutHint {
  key: string
  label: string
}

export function VideoPlayer({ movie, onBack }: VideoPlayerProps) {
  const totalDuration = movie.duration * 60

  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [showEpisodeSidebar, setShowEpisodeSidebar] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [quality, setQuality] = useState('Auto')
  const [subtitle, setSubtitle] = useState('Off')
  const [audioTrack, setAudioTrack] = useState('English')
  const [isDragging, setIsDragging] = useState(false)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState(0)
  const [openMenu, setOpenMenu] = useState<'speed' | 'quality' | 'subtitle' | 'audio' | null>(null)
  const [shortcutHint, setShortcutHint] = useState<ShortcutHint | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const shortcutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isSeries = movie.type === 'series'
  const showSkipIntro = currentTime < 90
  const showNextEpisode = progress > 95

  // Auto-progress when playing
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + playbackSpeed
          if (next >= totalDuration) {
            setIsPlaying(false)
            return totalDuration
          }
          return next
        })
      }, 1000)
    } else {
      if (playTimerRef.current) clearInterval(playTimerRef.current)
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current)
    }
  }, [isPlaying, playbackSpeed, totalDuration])

  // Sync progress from currentTime
  useEffect(() => {
    setProgress((currentTime / totalDuration) * 100)
  }, [currentTime, totalDuration])

  // Controls auto-hide
  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setShowControls(true)
    hideTimerRef.current = setTimeout(() => {
      if (!openMenu && !isDragging) setShowControls(false)
    }, 3000)
  }, [openMenu, isDragging])

  useEffect(() => {
    resetHideTimer()
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [resetHideTimer])

  // Re-arm timer when menus close
  useEffect(() => {
    if (!openMenu) resetHideTimer()
  }, [openMenu, resetHideTimer])

  // Keyboard shortcuts
  useEffect(() => {
    const showHint = (hint: ShortcutHint) => {
      setShortcutHint(hint)
      if (shortcutTimerRef.current) clearTimeout(shortcutTimerRef.current)
      shortcutTimerRef.current = setTimeout(() => setShortcutHint(null), 1500)
    }

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          setIsPlaying(p => !p)
          showHint({ key: 'Space', label: isPlaying ? 'Pause' : 'Play' })
          resetHideTimer()
          break
        case 'ArrowLeft':
          e.preventDefault()
          setCurrentTime(t => Math.max(0, t - 10))
          showHint({ key: '←', label: 'Rewind 10s' })
          resetHideTimer()
          break
        case 'ArrowRight':
          e.preventDefault()
          setCurrentTime(t => Math.min(totalDuration, t + 10))
          showHint({ key: '→', label: 'Forward 10s' })
          resetHideTimer()
          break
        case 'KeyM':
          setIsMuted(m => !m)
          showHint({ key: 'M', label: isMuted ? 'Unmute' : 'Mute' })
          resetHideTimer()
          break
        case 'KeyF':
          handleFullscreen()
          showHint({ key: 'F', label: isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' })
          resetHideTimer()
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isPlaying, isMuted, isFullscreen, totalDuration, resetHideTimer])

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setCurrentTime(ratio * totalDuration)
  }

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setHoverTime(ratio * totalDuration)
    setHoverX(e.clientX - rect.left)
    if (isDragging) setCurrentTime(ratio * totalDuration)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
    handleProgressClick(e)
  }

  useEffect(() => {
    const up = () => setIsDragging(false)
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  const effectiveVolume = isMuted ? 0 : volume
  const VolumeIcon = effectiveVolume === 0 ? VolumeX : effectiveVolume < 0.5 ? Volume1 : Volume2

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden select-none"
      onMouseMove={resetHideTimer}
      onClick={() => {
        setOpenMenu(null)
        resetHideTimer()
      }}
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      {/* Backdrop as mock video */}
      <img
        src={movie.backdrop}
        alt={movie.title}
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* Cinematic vignette */}
      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-black/40 pointer-events-none" />
      <div className="absolute inset-0 bg-linear-to-r from-black/20 via-transparent to-black/20 pointer-events-none" />

      {/* Paused overlay */}
      <AnimatePresence>
        {!isPlaying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Keyboard shortcut hint */}
      <AnimatePresence>
        {shortcutHint && (
          <motion.div
            key={shortcutHint.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50"
          >
            <div className="glass rounded-2xl px-8 py-5 text-center">
              <div className="text-3xl font-bold text-white">{shortcutHint.key}</div>
              <div className="text-sm text-white/70 mt-1">{shortcutHint.label}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip Intro button */}
      <AnimatePresence>
        {showSkipIntro && showControls && (
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute bottom-28 right-8 z-30 px-5 py-2.5 border border-white/60 text-white font-semibold text-sm rounded hover:bg-white hover:text-black transition-colors duration-200"
            onClick={e => { e.stopPropagation(); setCurrentTime(90) }}
          >
            Skip Intro
          </motion.button>
        )}
      </AnimatePresence>

      {/* Next Episode button */}
      <AnimatePresence>
        {showNextEpisode && showControls && (
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute bottom-28 right-8 z-30 flex items-center gap-2 px-5 py-2.5 bg-white text-black font-semibold text-sm rounded hover:bg-white/90 transition-colors duration-200"
            onClick={e => e.stopPropagation()}
          >
            Next Episode
            <ChevronRight size={16} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Episode sidebar */}
      <AnimatePresence>
        {showEpisodeSidebar && isSeries && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute top-0 right-0 h-full w-80 z-40 glass-dark border-l border-white/10 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="font-bold text-white text-lg">Episodes</h3>
              <button
                onClick={() => setShowEpisodeSidebar(false)}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={18} className="text-white/70" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar">
              {movie.episodes?.map(ep => (
                <button
                  key={ep.id}
                  className="w-full flex gap-3 rounded-xl overflow-hidden hover:bg-white/10 transition-colors p-2 text-left group"
                >
                  <div className="relative w-28 h-16 shrink-0 rounded-lg overflow-hidden">
                    <img src={ep.thumbnail} alt={ep.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 transition-opacity">
                      <Play size={20} className="text-white fill-white" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-white/50 mb-0.5">E{ep.number}</p>
                    <p className="text-sm font-medium text-white truncate">{ep.title}</p>
                    <p className="text-xs text-white/50 mt-0.5">{ep.duration}m</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-20 flex flex-col justify-between"
            onClick={e => e.stopPropagation()}
          >
            {/* Top bar */}
            <div className="flex items-center gap-4 px-6 pt-6 pb-10 bg-linear-to-b from-black/80 to-transparent">
              <button
                onClick={onBack}
                className="p-2 rounded-full hover:bg-white/15 transition-colors shrink-0"
              >
                <ArrowLeft size={22} className="text-white" />
              </button>
              <div className="min-w-0">
                <h1 className="text-white font-bold text-lg leading-tight truncate">{movie.title}</h1>
                {isSeries && movie.episodes && movie.episodes.length > 0 && (
                  <p className="text-white/60 text-sm">
                    S{movie.episodes[0].season} · E{movie.episodes[0].number} · {movie.episodes[0].title}
                  </p>
                )}
              </div>
            </div>

            {/* Center controls */}
            <div className="flex items-center justify-center gap-8">
              <button
                onClick={() => setCurrentTime(t => Math.max(0, t - 10))}
                className="group flex flex-col items-center gap-1"
              >
                <div className="p-3 rounded-full hover:bg-white/15 transition-colors">
                  <SkipBack size={28} className="text-white fill-white" />
                </div>
                <span className="text-white/50 text-xs">10</span>
              </button>

              <button
                onClick={() => setIsPlaying(p => !p)}
                className="p-5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/20 transition-all hover:scale-105 active:scale-95"
              >
                {isPlaying
                  ? <Pause size={36} className="text-white fill-white" />
                  : <Play size={36} className="text-white fill-white ml-1" />
                }
              </button>

              <button
                onClick={() => setCurrentTime(t => Math.min(totalDuration, t + 10))}
                className="group flex flex-col items-center gap-1"
              >
                <div className="p-3 rounded-full hover:bg-white/15 transition-colors">
                  <SkipForward size={28} className="text-white fill-white" />
                </div>
                <span className="text-white/50 text-xs">10</span>
              </button>
            </div>

            {/* Bottom controls */}
            <div className="px-6 pb-6 pt-16 bg-linear-to-t from-black/90 to-transparent">
              {/* Progress bar */}
              <div
                ref={progressBarRef}
                className="relative h-1 group/progress cursor-pointer mb-4"
                onMouseMove={handleProgressMouseMove}
                onMouseLeave={() => setHoverTime(null)}
                onMouseDown={handleMouseDown}
                onClick={handleProgressClick}
              >
                <div className="absolute inset-0 h-1 group-hover/progress:h-1.5 transition-all duration-150 rounded-full bg-white/25 top-0 group-hover/progress:-top-0.5">
                  {/* Buffered */}
                  <div className="absolute inset-0 bg-white/15 rounded-full" style={{ width: `${Math.min(100, progress + 15)}%` }} />
                  {/* Progress fill */}
                  <div
                    className="absolute inset-0 bg-orange-500 rounded-full transition-none"
                    style={{ width: `${progress}%` }}
                  />
                  {/* Scrubber thumb */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-orange-500 rounded-full -translate-x-1/2 opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg"
                    style={{ left: `${progress}%` }}
                  />
                </div>

                {/* Hover time tooltip */}
                <AnimatePresence>
                  {hoverTime !== null && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute -top-9 pointer-events-none"
                      style={{ left: hoverX, transform: 'translateX(-50%)' }}
                    >
                      <div className="glass rounded px-2 py-1 text-xs text-white font-mono whitespace-nowrap">
                        {formatTime(hoverTime)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Controls row */}
              <div className="flex items-center justify-between">
                {/* Left: play controls + time + volume */}
                <div className="flex items-center gap-3">
                  {/* Play/Pause small */}
                  <button
                    onClick={() => setIsPlaying(p => !p)}
                    className="p-1.5 hover:text-orange-400 transition-colors"
                  >
                    {isPlaying
                      ? <Pause size={20} className="text-white fill-white" />
                      : <Play size={20} className="text-white fill-white ml-0.5" />
                    }
                  </button>

                  {/* Skip buttons small */}
                  <button onClick={() => setCurrentTime(t => Math.max(0, t - 10))} className="p-1.5 hover:text-orange-400 transition-colors">
                    <SkipBack size={18} className="text-white/80" />
                  </button>
                  <button onClick={() => setCurrentTime(t => Math.min(totalDuration, t + 10))} className="p-1.5 hover:text-orange-400 transition-colors">
                    <SkipForward size={18} className="text-white/80" />
                  </button>

                  {/* Volume */}
                  <div className="flex items-center gap-2 group/vol">
                    <button onClick={() => setIsMuted(m => !m)} className="p-1.5 hover:text-orange-400 transition-colors">
                      <VolumeIcon size={20} className="text-white/80" />
                    </button>
                    <div className="w-0 group-hover/vol:w-24 overflow-hidden transition-all duration-300">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={effectiveVolume}
                        onChange={e => {
                          const v = parseFloat(e.target.value)
                          setVolume(v)
                          setIsMuted(v === 0)
                        }}
                        onClick={e => e.stopPropagation()}
                        className="w-20 h-1 appearance-none bg-white/30 rounded-full cursor-pointer accent-orange-500"
                      />
                    </div>
                  </div>

                  {/* Time */}
                  <span className="text-white/70 text-sm font-mono ml-1 whitespace-nowrap">
                    {formatTime(currentTime)} / {formatTime(totalDuration)}
                  </span>
                </div>

                {/* Right: utility controls */}
                <div className="flex items-center gap-1 relative">
                  {/* Subtitles */}
                  <ControlMenuButton
                    icon={<Subtitles size={18} />}
                    label="CC"
                    isOpen={openMenu === 'subtitle'}
                    onClick={e => { e.stopPropagation(); setOpenMenu(o => o === 'subtitle' ? null : 'subtitle') }}
                  >
                    <DropdownMenu
                      title="Subtitles"
                      options={SUBTITLES}
                      selected={subtitle}
                      onSelect={v => { setSubtitle(v); setOpenMenu(null) }}
                    />
                  </ControlMenuButton>

                  {/* Audio */}
                  <ControlMenuButton
                    icon={<Mic2 size={18} />}
                    label=""
                    isOpen={openMenu === 'audio'}
                    onClick={e => { e.stopPropagation(); setOpenMenu(o => o === 'audio' ? null : 'audio') }}
                  >
                    <DropdownMenu
                      title="Audio Track"
                      options={AUDIO_TRACKS}
                      selected={audioTrack}
                      onSelect={v => { setAudioTrack(v); setOpenMenu(null) }}
                    />
                  </ControlMenuButton>

                  {/* Playback speed */}
                  <ControlMenuButton
                    icon={<Gauge size={18} />}
                    label={`${playbackSpeed}x`}
                    isOpen={openMenu === 'speed'}
                    onClick={e => { e.stopPropagation(); setOpenMenu(o => o === 'speed' ? null : 'speed') }}
                  >
                    <DropdownMenu
                      title="Playback Speed"
                      options={SPEEDS.map(String)}
                      selected={String(playbackSpeed)}
                      onSelect={v => { setPlaybackSpeed(parseFloat(v)); setOpenMenu(null) }}
                      formatLabel={v => `${v}x`}
                    />
                  </ControlMenuButton>

                  {/* Quality */}
                  <ControlMenuButton
                    icon={<MonitorPlay size={18} />}
                    label={quality}
                    isOpen={openMenu === 'quality'}
                    onClick={e => { e.stopPropagation(); setOpenMenu(o => o === 'quality' ? null : 'quality') }}
                  >
                    <DropdownMenu
                      title="Quality"
                      options={QUALITIES}
                      selected={quality}
                      onSelect={v => { setQuality(v); setOpenMenu(null) }}
                    />
                  </ControlMenuButton>

                  {/* Episode list (series only) */}
                  {isSeries && (
                    <button
                      onClick={e => { e.stopPropagation(); setShowEpisodeSidebar(s => !s) }}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        showEpisodeSidebar ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-white/10 text-white/80'
                      )}
                    >
                      <List size={18} />
                    </button>
                  )}

                  {/* Picture in picture */}
                  <button
                    onClick={e => e.stopPropagation()}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/80 transition-colors"
                  >
                    <PictureInPicture2 size={18} />
                  </button>

                  {/* Settings */}
                  <button
                    onClick={e => e.stopPropagation()}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/80 transition-colors"
                  >
                    <Settings size={18} />
                  </button>

                  {/* Fullscreen */}
                  <button
                    onClick={e => { e.stopPropagation(); handleFullscreen() }}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/80 transition-colors"
                  >
                    {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ControlMenuButtonProps {
  icon: React.ReactNode
  label: string
  isOpen: boolean
  onClick: (e: React.MouseEvent) => void
  children: React.ReactNode
}

function ControlMenuButton({ icon, label, isOpen, onClick, children }: ControlMenuButtonProps) {
  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={cn(
          'flex items-center gap-1 px-2 py-2 rounded-lg transition-colors text-sm',
          isOpen ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-white/10 text-white/80'
        )}
      >
        {icon}
        {label && <span className="text-xs font-medium">{label}</span>}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 mb-2 z-50"
            onClick={e => e.stopPropagation()}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface DropdownMenuProps {
  title: string
  options: string[]
  selected: string
  onSelect: (value: string) => void
  formatLabel?: (value: string) => string
}

function DropdownMenu({ title, options, selected, onSelect, formatLabel }: DropdownMenuProps) {
  return (
    <div className="glass rounded-xl overflow-hidden min-w-36 shadow-2xl">
      <div className="px-4 py-2.5 border-b border-white/10">
        <p className="text-white/50 text-xs font-medium uppercase tracking-wider">{title}</p>
      </div>
      <div className="py-1">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={cn(
              'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-4',
              opt === selected
                ? 'text-orange-400 bg-orange-500/10'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            )}
          >
            <span>{formatLabel ? formatLabel(opt) : opt}</span>
            {opt === selected && (
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
