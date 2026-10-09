import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Camera,
  Download,
  Edit3,
  Eraser,
  Maximize2,
  Palette,
  Printer,
  RefreshCw,
  RotateCw,
  Smile,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react'
import QRCode from 'qrcode'
import {
  getPhotoAspectRatio,
  makeDemoPhoto,
  renderLiveStripVideos,
  renderStrip,
  renderThemedPrintCanvas,
  type CustomizationOptions,
  type DoodlePoint,
  type DoodleStroke,
  type Layout,
  type PhotoFilter,
  type PlacedSticker,
  type Theme,
} from './compositor'
import {
  createId,
  getLocalIp,
  getSettings,
  listThemes,
  recordEvent,
  setKioskMode,
  silentPrint,
  type BoothSettings,
} from './platform'
import { saveShare } from './shares'

type Step = 'welcome' | 'layout' | 'timer' | 'camera' | 'photos' | 'result'
type CustomTab = 'themes' | 'filters' | 'stickers' | 'doodles'
type CapturedMoment = { photo: string; clip: Blob | null; mirrored: boolean }

const layouts: Layout[] = [
  { id: 'classic-4', name: 'Classic 4 Cut', requiredPhotos: 4, description: '4 moments · 2 × 6 in' },
  { id: 'classic-3', name: 'Classic 3 Cut', requiredPhotos: 3, description: '3 moments · 2 × 6 in' },
  { id: 'classic-2', name: 'Classic 2 Cut', requiredPhotos: 2, description: '2 large moments · 2 × 6 in' },
  { id: 'grid-4', name: '2×2 Grid', requiredPhotos: 4, description: '4 moments · 2×2 grid' },
]

const templateThemes: Theme[] = Array.from({ length: 9 }, (_, index) => {
  const number = index + 1
  return {
    id: `template-${number}`,
    name: `Template ${number}`,
    background: '#ffffff',
    accent: '#171717',
    category: 'Templates',
    singleTemplate: `/single/${number}.png`,
    doubleTemplate: `/double/${number}.png`,
  }
})

const colorThemes: Theme[] = [
  { id: 'color-red', name: 'Proof Red', background: '#e43d30', accent: '#e43d30', category: 'Colors' },
  { id: 'color-blue', name: 'Studio Blue', background: '#2464c6', accent: '#2464c6', category: 'Colors' },
  { id: 'color-black', name: 'Night Print', background: '#171717', accent: '#171717', category: 'Colors' },
  { id: 'color-green', name: 'Mint Contact', background: '#2f8f70', accent: '#2f8f70', category: 'Colors' },
  { id: 'color-pink', name: 'Pop Pink', background: '#cb5aa2', accent: '#cb5aa2', category: 'Colors' },
  { id: 'color-violet', name: 'Violet Flash', background: '#724fb5', accent: '#724fb5', category: 'Colors' },
]

const builtInThemes = [...templateThemes, ...colorThemes]

const filterOptions: { id: PhotoFilter; label: string; previewBg: string }[] = [
  { id: 'none', label: 'Natural', previewBg: '#ffffff' },
  { id: 'bw', label: 'B & W', previewBg: '#555555' },
  { id: 'warm', label: 'Warm Glow', previewBg: '#e59866' },
  { id: 'vintage', label: 'Vintage 90s', previewBg: '#b7950b' },
  { id: 'cool', label: 'Cool Nordic', previewBg: '#5dade2' },
  { id: 'soft', label: 'Soft Idol', previewBg: '#f1948a' },
]

const stickerLibrary = ['❤️', '💖', '✨', '🎀', '👑', '⭐', '🐱', '🦋', '🧸', '🍒', '🌸', '🕶️', '📷', '🔥', '🎉', '🍀']
const penColors = ['#ffffff', '#171717', '#e43d30', '#cb5aa2', '#f4d03f', '#2f8f70', '#2464c6']

const timers = [3, 5, 10]
const isUltraWideCamera = (label: string) => /ultra[\s-]?wide|0[.,]5\s*[x×]?/i.test(label)
const isBackCamera = (label: string) => /back|rear|environment|ultra[\s-]?wide|0[.,]5/i.test(label)

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function Progress({ step }: { step: Step }) {
  const order: Step[] = ['layout', 'timer', 'camera', 'photos', 'result']
  const current = order.indexOf(step)
  if (step === 'welcome') return null
  return (
    <div className="progress" aria-label={`Step ${current + 1} of ${order.length}`}>
      {order.map((item, index) => <span key={item} className={index <= current ? 'done' : ''} />)}
    </div>
  )
}

function StripDiagram({ layout }: { layout: Layout }) {
  if (layout.id === 'grid-4') {
    return (
      <div className="strip-diagram grid">
        <i /><i />
        <i /><i />
      </div>
    )
  }
  return (
    <div className="strip-diagram">
      {Array.from({ length: layout.requiredPhotos }, (_, index) => <i key={index} />)}
    </div>
  )
}

function App() {
  const currentSettings = useRef<BoothSettings>(getSettings())
  const [step, setStep] = useState<Step>('welcome')
  const [layout, setLayout] = useState<Layout>(layouts[0])
  const [timer, setTimer] = useState(() => currentSettings.current.defaultTimer || 3)
  const [availableThemes, setAvailableThemes] = useState<Theme[]>(builtInThemes)
  const [photos, setPhotos] = useState<string[]>([])
  const [clips, setClips] = useState<Array<{ blob: Blob | null; mirrored: boolean }>>([])
  const [selected, setSelected] = useState<number[]>([])
  const [preview, setPreview] = useState('')
  const [cleanPreview, setCleanPreview] = useState('')
  const [copies, setCopies] = useState<1 | 2>(() => currentSettings.current.defaultCopies || 1)
  const [result, setResult] = useState('')
  const [singlePrint, setSinglePrint] = useState('')
  const [doublePrint, setDoublePrint] = useState('')
  const [activeTheme, setActiveTheme] = useState<Theme | null>(null)
  const [stripTitle, setStripTitle] = useState(() => currentSettings.current.brandTitle || 'GIC BOOTH')
  const [hasPrinted, setHasPrinted] = useState(false)
  const [showBrand, setShowBrand] = useState(true)

  // Phase 3 Customization States
  const [customTab, setCustomTab] = useState<CustomTab>('themes')
  const [selectedFilter, setSelectedFilter] = useState<PhotoFilter>('none')
  const [stickers, setStickers] = useState<PlacedSticker[]>([])
  const [doodles, setDoodles] = useState<DoodleStroke[]>([])
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null)
  const [themeCategory, setThemeCategory] = useState<string>('All')
  const [selectedPenColor, setSelectedPenColor] = useState<string>('#ffffff')
  const [selectedPenSize, setSelectedPenSize] = useState<number>(8)

  const [error, setError] = useState('')
  const [shareProgress, setShareProgress] = useState<number | null>(null)
  const lastAction = useRef(Date.now())
  const sessionId = useRef('')
  const renderVersion = useRef(0)
  const shareId = useRef('')
  const shareQr = useRef('')
  const previewWrapperRef = useRef<HTMLDivElement>(null)
  const doodleCanvasRef = useRef<HTMLCanvasElement>(null)
  const activeStroke = useRef<DoodlePoint[]>([])
  const isPointerDrawing = useRef(false)
  const videoDebounceTimer = useRef<number | null>(null)
  const latestStickersRef = useRef<PlacedSticker[]>([])
  const draggingSticker = useRef<{
    id: string
    startX: number
    startY: number
    pointerStartX: number
    pointerStartY: number
    hasMoved: boolean
  } | null>(null)
  const rotatingSticker = useRef<{
    id: string
    centerClientX: number
    centerClientY: number
    initialAngle: number
    startRotation: number
    hasMoved: boolean
  } | null>(null)
  const resizingSticker = useRef<{
    id: string
    centerClientX: number
    centerClientY: number
    initialDist: number
    startSize: number
    hasMoved: boolean
  } | null>(null)

  const hasAutoPrinted = useRef(false)
  const adminTapCount = useRef(0)
  const lastAdminTap = useRef(0)

  const [wrapperWidth, setWrapperWidth] = useState(240)

  // Enforce kiosk lockdown on initial mount if enabled
  useEffect(() => {
    if (currentSettings.current.kioskLockdown) {
      void setKioskMode(true)
    }
  }, [])

  // Admin access secret keyboard shortcut (Ctrl + Alt + A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        window.location.href = '/admin'
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleBrandTap = (e: React.MouseEvent) => {
    e.stopPropagation()
    const now = Date.now()
    if (now - lastAdminTap.current < 1000) {
      adminTapCount.current += 1
      if (adminTapCount.current >= 5) {
        adminTapCount.current = 0
        window.location.href = '/admin'
      }
    } else {
      adminTapCount.current = 1
    }
    lastAdminTap.current = now
  }

  useEffect(() => {
    latestStickersRef.current = stickers
  }, [stickers])

  useEffect(() => {
    const el = previewWrapperRef.current
    if (!el) return
    const update = () => {
      if (el.clientWidth > 0) {
        setWrapperWidth(el.clientWidth)
      }
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [step, copies, preview, cleanPreview])

  const track = useCallback((eventType: string, metadata: Record<string, string | number | boolean> = {}) => {
    if (sessionId.current) void recordEvent(sessionId.current, eventType, metadata).catch(() => {})
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  useEffect(() => {
    void listThemes().then(saved => setAvailableThemes([
      ...builtInThemes,
      ...saved.filter(theme => theme.active).map(theme => ({
        id: theme.id,
        name: theme.name,
        background: '#f7f6f0',
        accent: '#171717',
        category: theme.category || 'Custom',
        frame: theme.frameDataUrl,
        layoutId: theme.layoutId as Layout['id'],
      })),
    ])).catch(() => {})
  }, [step])

  const reset = useCallback(() => {
    currentSettings.current = getSettings()
    setStep('welcome')
    setPhotos([])
    setClips([])
    setSelected([])
    setPreview('')
    setCleanPreview('')
    setCopies(currentSettings.current.defaultCopies || 1)
    setResult('')
    setSinglePrint('')
    setDoublePrint('')
    setActiveTheme(null)
    setStripTitle(currentSettings.current.brandTitle || 'GIC BOOTH')
    setShowBrand(true)
    setSelectedFilter('none')
    setStickers([])
    setDoodles([])
    setSelectedStickerId(null)
    setCustomTab('themes')
    setError('')
    setHasPrinted(false)
    hasAutoPrinted.current = false
    if (videoDebounceTimer.current) {
      window.clearTimeout(videoDebounceTimer.current)
      videoDebounceTimer.current = null
    }
    renderVersion.current += 1
    shareId.current = ''
    shareQr.current = ''
    sessionId.current = ''
  }, [])

  const beginSession = () => {
    currentSettings.current = getSettings()
    sessionId.current = createId()
    track('session_started')
    setStep('layout')
  }

  useEffect(() => {
    const markActive = () => { lastAction.current = Date.now() }
    const timeoutSec = step === 'result'
      ? (currentSettings.current.autoResetDelay || 45)
      : (currentSettings.current.inactivityTimeout || 90)
    const timeoutMs = timeoutSec * 1000

    const check = window.setInterval(() => {
      if (step !== 'welcome' && Date.now() - lastAction.current > timeoutMs) {
        track('session_abandoned')
        reset()
      }
    }, 3_000)
    window.addEventListener('pointerdown', markActive)
    window.addEventListener('keydown', markActive)
    return () => {
      window.clearInterval(check)
      window.removeEventListener('pointerdown', markActive)
      window.removeEventListener('keydown', markActive)
    }
  }, [reset, step, track])

  const goBack = () => {
    const previous: Partial<Record<Step, Step>> = { layout: 'welcome', timer: 'layout', camera: 'timer', photos: 'timer', result: 'photos' }
    setStep(previous[step] ?? 'welcome')
  }

  const togglePhoto = (index: number) => {
    setSelected(current => current.includes(index)
      ? current.filter(item => item !== index)
      : current.length < layout.requiredPhotos ? [...current, index] : current)
  }

  const composeResult = async (
    theme: Theme,
    title: string,
    brand: boolean,
    nextCopies: 1 | 2,
    filter = selectedFilter,
    currentStickers = stickers,
    currentDoodles = doodles,
    debounceVideoMs = 0,
  ) => {
    const version = ++renderVersion.current
    const revision = createId()
    const chosenPhotos = selected.map(index => photos[index])
    if (!shareId.current) shareId.current = createId()
    if (!shareQr.current) {
      let baseUrl = `${window.location.origin}`
      const mode = currentSettings.current.qrDeliveryMode || 'auto'
      const localPort = window.location.port ? `:${window.location.port}` : ':5173'
      if (mode === 'local') {
        const localIp = currentSettings.current.localHotspotIp || (await getLocalIp())
        baseUrl = `http://${localIp}${localPort}`
      } else if (mode === 'cloud') {
        baseUrl = 'https://gic-booth.vercel.app'
      } else if (mode === 'auto') {
        if (!navigator.onLine) {
          const localIp = currentSettings.current.localHotspotIp || (await getLocalIp())
          baseUrl = `http://${localIp}${localPort}`
        } else {
          baseUrl = 'https://gic-booth.vercel.app'
        }
      }
      shareQr.current = await QRCode.toDataURL(`${baseUrl}/share/${shareId.current}`, { width: 256, margin: 1 })
    }
    const text = { title, showBrand: brand, qrCode: shareQr.current }
    const customization: CustomizationOptions = {
      filter,
      stickers: currentStickers,
      doodles: currentDoodles,
    }

    // Render clean preview (without stickers for the interactive DOM overlay) and full preview
    const [nextCleanPreview, nextPreview, nextSinglePrint, nextDoublePrint] = await Promise.all([
      renderStrip(layout, theme, chosenPhotos, text, { filter, doodles: currentDoodles, stickers: [] }),
      renderStrip(layout, theme, chosenPhotos, text, customization),
      renderThemedPrintCanvas(layout, theme, chosenPhotos, text, 1, customization),
      renderThemedPrintCanvas(layout, theme, chosenPhotos, text, 2, customization),
    ])
    if (version !== renderVersion.current) return false

    setCleanPreview(nextCleanPreview)
    setPreview(nextPreview)
    setSinglePrint(nextSinglePrint)
    setDoublePrint(nextDoublePrint)
    setCopies(nextCopies)
    setResult(nextCopies === 1 ? nextSinglePrint : nextDoublePrint)

    // Clear previous pending video generation
    if (videoDebounceTimer.current) {
      window.clearTimeout(videoDebounceTimer.current)
      videoDebounceTimer.current = null
    }

    // If initial load or video is not ready yet, set starting progress
    if (debounceVideoMs === 0 && shareProgress === null) {
      setShareProgress(15)
    }

    const executeShareAndVideo = async () => {
      try {
        if (version !== renderVersion.current) return
        await saveShare(shareId.current, {
          singleImage: nextPreview,
          doubleImage: nextDoublePrint,
          generating: true,
          progress: 20,
          revision,
        })
      } catch {
        if (version === renderVersion.current) {
          setError('QR sharing is unavailable. The strip can still be downloaded.')
        }
        return
      }

      const selectedClips = selected.map(index => clips[index])
      const hasLiveClips = selectedClips.some(clip => clip?.blob)

      if (!hasLiveClips) {
        if (version === renderVersion.current) {
          setShareProgress(100)
          void saveShare(shareId.current, { ready: true, progress: 100, revision, videoError: 'Live photo clips not available' }).catch(() => {})
        }
        return
      }

      try {
        if (version !== renderVersion.current) return
        setShareProgress(25)
        void saveShare(shareId.current, { progress: 25, revision }).catch(() => {})

        const videos = await renderLiveStripVideos(
          layout,
          theme,
          selectedClips,
          chosenPhotos,
          text,
          progress => {
            if (version === renderVersion.current) {
              setShareProgress(progress)
              void saveShare(shareId.current, { progress, revision }).catch(() => {})
            }
          },
          customization,
        )

        if (version !== renderVersion.current) return
        if (!videos) throw new Error('Video encoding is unavailable')

        const [singleVideo, doubleVideo] = await Promise.all([blobToDataUrl(videos.single), blobToDataUrl(videos.double)])
        if (version !== renderVersion.current) return

        await saveShare(shareId.current, { progress: 90, revision })
        setShareProgress(90)
        await saveShare(shareId.current, { singleVideo, doubleVideo, videoMime: videos.mimeType, ready: true, revision })
        if (version === renderVersion.current) setShareProgress(100)
      } catch (reason) {
        if (version !== renderVersion.current) return
        const videoError = reason instanceof Error ? reason.message : 'Video generation failed'
        setShareProgress(100)
        void saveShare(shareId.current, { ready: true, progress: 100, revision, videoError }).catch(() => {})
      }
    }

    if (debounceVideoMs > 0) {
      videoDebounceTimer.current = window.setTimeout(() => {
        void executeShareAndVideo()
      }, debounceVideoMs)
    } else {
      void executeShareAndVideo()
    }

    return true
  }

  const chooseTheme = async (theme: Theme, nextCopies: 1 | 2 = 1) => {
    setError('')
    setActiveTheme(theme)
    track('theme_selected', { theme: theme.id })
    try {
      if (!await composeResult(theme, stripTitle, showBrand, nextCopies, selectedFilter, stickers, doodles, step === 'result' ? 1200 : 0)) return
      track('strip_generated', { layout: layout.id, theme: theme.id })
      setStep('result')
    } catch {
      setError('The strip could not be generated. Choose the theme again.')
    }
  }

  const chooseCopies = (nextCopies: 1 | 2) => {
    setCopies(nextCopies)
    setResult(nextCopies === 1 ? singlePrint : doublePrint)
  }

  const customizeStrip = (title: string, brand: boolean) => {
    setStripTitle(title)
    setShowBrand(brand)
    if (activeTheme) void composeResult(activeTheme, title, brand, copies, selectedFilter, stickers, doodles, 1200).catch(() => setError('The strip could not be updated.'))
  }

  const handleFilterChange = (filter: PhotoFilter) => {
    setSelectedFilter(filter)
    if (activeTheme) {
      void composeResult(activeTheme, stripTitle, showBrand, copies, filter, stickers, doodles, 1200)
    }
  }

  const handleAddSticker = (emoji: string) => {
    const newSticker: PlacedSticker = {
      id: createId(),
      emoji,
      x: 300,
      y: 900 + (Math.random() * 200 - 100),
      size: 72,
      rotation: 0,
    }
    const nextStickers = [...stickers, newSticker]
    setStickers(nextStickers)
    setSelectedStickerId(newSticker.id)
    if (activeTheme) {
      void composeResult(activeTheme, stripTitle, showBrand, copies, selectedFilter, nextStickers, doodles, 1200)
    }
  }

  const handleRemoveSticker = (id: string) => {
    const nextStickers = stickers.filter(s => s.id !== id)
    setStickers(nextStickers)
    if (selectedStickerId === id) setSelectedStickerId(null)
    if (activeTheme) {
      void composeResult(activeTheme, stripTitle, showBrand, copies, selectedFilter, nextStickers, doodles, 1200)
    }
  }

  const handleStickerPointerDown = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (customTab === 'doodles') return
    e.stopPropagation()
    e.preventDefault()
    setSelectedStickerId(id)

    const sticker = stickers.find(s => s.id === id)
    if (!sticker || !previewWrapperRef.current) return

    const target = e.currentTarget
    try {
      target.setPointerCapture(e.pointerId)
    } catch {}

    draggingSticker.current = {
      id,
      startX: sticker.x,
      startY: sticker.y,
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      hasMoved: false,
    }
  }

  const handleStickerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingSticker.current || !previewWrapperRef.current) return
    const drag = draggingSticker.current
    const dx = e.clientX - drag.pointerStartX
    const dy = e.clientY - drag.pointerStartY

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      drag.hasMoved = true
    }

    const rect = previewWrapperRef.current.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    const scaleX = 600 / rect.width
    const scaleY = 1800 / rect.height

    const nextX = Math.round(Math.max(25, Math.min(575, drag.startX + dx * scaleX)))
    const nextY = Math.round(Math.max(25, Math.min(1775, drag.startY + dy * scaleY)))

    setStickers(prev => prev.map(s => s.id === drag.id ? { ...s, x: nextX, y: nextY } : s))
  }

  const handleStickerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingSticker.current) return
    const drag = draggingSticker.current
    draggingSticker.current = null
    try {
      const target = e.currentTarget
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId)
      }
    } catch {}

    if (drag.hasMoved && activeTheme) {
      void composeResult(activeTheme, stripTitle, showBrand, copies, selectedFilter, latestStickersRef.current, doodles, 1200)
    }
  }

  const handleRotatePointerDown = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation()
    e.preventDefault()
    const sticker = stickers.find(s => s.id === id)
    if (!sticker || !previewWrapperRef.current) return

    const target = e.currentTarget
    try {
      target.setPointerCapture(e.pointerId)
    } catch {}

    const rect = previewWrapperRef.current.getBoundingClientRect()
    const centerClientX = rect.left + (sticker.x / 600) * rect.width
    const centerClientY = rect.top + (sticker.y / 1800) * rect.height

    const initialAngle = Math.atan2(e.clientY - centerClientY, e.clientX - centerClientX) * (180 / Math.PI)
    const startRotation = sticker.rotation || 0

    rotatingSticker.current = {
      id,
      centerClientX,
      centerClientY,
      initialAngle,
      startRotation,
      hasMoved: false,
    }
  }

  const handleRotatePointerMove = (e: React.PointerEvent) => {
    if (!rotatingSticker.current) return
    const { id, centerClientX, centerClientY, initialAngle, startRotation } = rotatingSticker.current
    const currentAngle = Math.atan2(e.clientY - centerClientY, e.clientX - centerClientX) * (180 / Math.PI)
    const deltaAngle = currentAngle - initialAngle

    if (Math.abs(deltaAngle) > 1) {
      rotatingSticker.current.hasMoved = true
    }

    let newRotation = Math.round(startRotation + deltaAngle)
    while (newRotation > 180) newRotation -= 360
    while (newRotation < -180) newRotation += 360

    setStickers(prev => prev.map(s => s.id === id ? { ...s, rotation: newRotation } : s))
  }

  const handleRotatePointerUp = (e: React.PointerEvent) => {
    if (!rotatingSticker.current) return
    const hadMoved = rotatingSticker.current.hasMoved
    rotatingSticker.current = null
    try {
      const target = e.currentTarget as HTMLElement
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId)
      }
    } catch {}

    if (hadMoved && activeTheme) {
      void composeResult(activeTheme, stripTitle, showBrand, copies, selectedFilter, latestStickersRef.current, doodles, 1200)
    }
  }

  const handleResizePointerDown = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation()
    e.preventDefault()
    const sticker = stickers.find(s => s.id === id)
    if (!sticker || !previewWrapperRef.current) return

    const target = e.currentTarget
    try {
      target.setPointerCapture(e.pointerId)
    } catch {}

    const rect = previewWrapperRef.current.getBoundingClientRect()
    const centerClientX = rect.left + (sticker.x / 600) * rect.width
    const centerClientY = rect.top + (sticker.y / 1800) * rect.height
    const initialDist = Math.hypot(e.clientX - centerClientX, e.clientY - centerClientY)

    resizingSticker.current = {
      id,
      centerClientX,
      centerClientY,
      initialDist: Math.max(10, initialDist),
      startSize: sticker.size,
      hasMoved: false,
    }
  }

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!resizingSticker.current) return
    const { id, centerClientX, centerClientY, initialDist, startSize } = resizingSticker.current
    const currentDist = Math.hypot(e.clientX - centerClientX, e.clientY - centerClientY)
    const ratio = currentDist / initialDist

    if (Math.abs(ratio - 1) > 0.02) {
      resizingSticker.current.hasMoved = true
    }

    const newSize = Math.round(Math.max(36, Math.min(180, startSize * ratio)))
    setStickers(prev => prev.map(s => s.id === id ? { ...s, size: newSize } : s))
  }

  const handleResizePointerUp = (e: React.PointerEvent) => {
    if (!resizingSticker.current) return
    const hadMoved = resizingSticker.current.hasMoved
    resizingSticker.current = null
    try {
      const target = e.currentTarget as HTMLElement
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId)
      }
    } catch {}

    if (hadMoved && activeTheme) {
      void composeResult(activeTheme, stripTitle, showBrand, copies, selectedFilter, latestStickersRef.current, doodles, 1200)
    }
  }

  // Doodle drawing handlers
  const handleDoodlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = doodleCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (600 / rect.width)
    const y = (e.clientY - rect.top) * (1800 / rect.height)
    isPointerDrawing.current = true
    activeStroke.current = [{ x, y }]

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.strokeStyle = selectedPenColor
      ctx.lineWidth = selectedPenSize * (canvas.width / 600)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(x * (canvas.width / 600), y * (canvas.height / 1800))
    }
  }

  const handleDoodlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDrawing.current) return
    const canvas = doodleCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (600 / rect.width)
    const y = (e.clientY - rect.top) * (1800 / rect.height)
    activeStroke.current.push({ x, y })

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.lineTo(x * (canvas.width / 600), y * (canvas.height / 1800))
      ctx.stroke()
    }
  }

  const handleDoodlePointerUp = () => {
    if (!isPointerDrawing.current) return
    isPointerDrawing.current = false
    if (activeStroke.current.length > 1) {
      const nextDoodles = [...doodles, { color: selectedPenColor, size: selectedPenSize, points: activeStroke.current }]
      setDoodles(nextDoodles)
      if (activeTheme) {
        void composeResult(activeTheme, stripTitle, showBrand, copies, selectedFilter, stickers, nextDoodles, 1500)
      }
    }
    activeStroke.current = []
    // Clear overlay scratchpad
    const canvas = doodleCanvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  const handleUndoDoodle = () => {
    if (doodles.length === 0) return
    const nextDoodles = doodles.slice(0, -1)
    setDoodles(nextDoodles)
    if (activeTheme) {
      void composeResult(activeTheme, stripTitle, showBrand, copies, selectedFilter, stickers, nextDoodles, 1500)
    }
  }

  const handleClearDoodles = () => {
    if (doodles.length === 0) return
    setDoodles([])
    if (activeTheme) {
      void composeResult(activeTheme, stripTitle, showBrand, copies, selectedFilter, stickers, [], 1500)
    }
  }

  const download = () => {
    const anchor = document.createElement('a')
    anchor.href = copies === 1 ? preview : result
    anchor.download = `gic-booth-${copies === 1 ? '2x6-single' : '4x6-double'}-${Date.now()}.png`
    anchor.click()
    track('download_completed', { copies })
  }

  const print = useCallback(async () => {
    track('print_requested', { copies })
    setHasPrinted(true)
    try {
      if (currentSettings.current.silentPrintEnabled) {
        await silentPrint(result, currentSettings.current.printerName, copies)
      } else {
        window.print()
      }
    } catch (err) {
      console.warn('Silent print error, falling back to window.print:', err)
      window.print()
    }
  }, [copies, result, track])

  // Automatically print when entering 'result' step if printMode is configured to 'auto'
  useEffect(() => {
    if (
      step === 'result' &&
      currentSettings.current.printMode === 'auto' &&
      result &&
      !hasAutoPrinted.current &&
      !hasPrinted
    ) {
      hasAutoPrinted.current = true
      void print()
    }
  }, [step, result, hasPrinted, print])

  const startOver = () => {
    track('session_completed')
    reset()
  }

  const extraCount = currentSettings.current.extraCaptures ?? 2
  const timerOptions = currentSettings.current.availableTimers?.length
    ? currentSettings.current.availableTimers
    : timers

  // Theme categories
  const themeCategories = ['All', ...new Set(availableThemes.map(t => t.category || 'Custom'))]

  return (
    <main className={`app step-${step}`}>
      <Progress step={step} />
      {step !== 'welcome' && (
        <button className="icon-button back" onClick={goBack} aria-label="Go back" title="Go back"><ArrowLeft /></button>
      )}

      {step === 'welcome' && (
        <button className="welcome" onClick={beginSession}>
          <span className="brand" onClick={handleBrandTap} title="GIC BOOTH">
            {currentSettings.current.brandTitle || 'GIC BOOTH'}
          </span>
          <span className="welcome-strip" aria-hidden="true"><b /><b /><b /><b /></span>
          <strong>Make your<br />photo strip.</strong>
          <span className="start-prompt">Touch anywhere to start</span>
        </button>
      )}

      {step === 'layout' && (
        <section className="screen selection-screen">
          <header><h1>How many moments?</h1></header>
          <div className="layout-options">
            {layouts.map(item => (
              <button key={item.id} className="layout-option" onClick={() => { track('layout_selected', { layout: item.id }); setLayout(item); setStep('timer') }}>
                <StripDiagram layout={item} />
                <span><strong>{item.name}</strong><small>{item.description || `${item.requiredPhotos} photos`}</small></span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 'timer' && (
        <section className="screen timer-screen">
          <header><h1>Ready between shots?</h1></header>
          <div className="timer-options">
            {timerOptions.map(seconds => (
              <button key={seconds} onClick={() => { setTimer(seconds); setStep('camera') }}>
                <strong>{seconds}</strong><span>seconds</span>
              </button>
            ))}
          </div>
          <p className="hint">We take {layout.requiredPhotos + extraCount} photos. You keep your best {layout.requiredPhotos}.</p>
        </section>
      )}

      {step === 'camera' && (
        <CaptureScreen
          timer={timer}
          total={layout.requiredPhotos + extraCount}
          aspectRatio={getPhotoAspectRatio(layout)}
          onDone={(captures) => { track('capture_completed', { count: captures.length }); setPhotos(captures.map(capture => capture.photo)); setClips(captures.map(capture => ({ blob: capture.clip, mirrored: capture.mirrored }))); setSelected([]); setStep('photos') }}
        />
      )}

      {step === 'photos' && (
        <section className="screen photo-screen">
          <header><h1>Keep the good ones.</h1></header>
          <div className="photo-grid">
            {photos.map((photo, index) => {
              const active = selected.includes(index)
              return (
                <div className={`photo-choice ${active ? 'selected' : ''}`} key={index}>
                  <button style={{ aspectRatio: getPhotoAspectRatio(layout) }} className={active ? 'selected' : ''} onClick={() => togglePhoto(index)} aria-pressed={active}>
                    <img src={photo} alt={`Capture ${index + 1}`} />
                  </button>
                  <span>Photo {index + 1}</span>
                </div>
              )
            })}
          </div>
          <footer className="action-bar">
            <strong>Selected {selected.length} / {layout.requiredPhotos}</strong>
            <button className="primary" disabled={selected.length !== layout.requiredPhotos} onClick={() => void chooseTheme(templateThemes[0])}>Next</button>
          </footer>
        </section>
      )}

      {step === 'result' && (
        <section className="screen result-screen">
          <div className="result-copy"><Sparkles /><h1>Edit your<br />strip.</h1></div>
          <div className="result-viewer">

            {/* Sub-tabs for Themes, Filters, Stickers, Doodles */}
            <div className="result-editor-panel">
              <div className="result-tabs" role="tablist">
                <button className={`result-tab ${customTab === 'themes' ? 'active' : ''}`} onClick={() => setCustomTab('themes')}><Palette /> Themes</button>
                <button className={`result-tab ${customTab === 'filters' ? 'active' : ''}`} onClick={() => setCustomTab('filters')}><Sparkles /> Filters</button>
                <button className={`result-tab ${customTab === 'stickers' ? 'active' : ''}`} onClick={() => setCustomTab('stickers')}><Smile /> Stickers</button>
                <button className={`result-tab ${customTab === 'doodles' ? 'active' : ''}`} onClick={() => setCustomTab('doodles')}><Edit3 /> Doodle</button>
              </div>

              {/* 1. THEMES TAB */}
              {customTab === 'themes' && (
                <div className="tab-pane">
                  <div className="theme-category-pills">
                    {themeCategories.map(cat => (
                      <button
                        key={cat}
                        className={`pill-mini ${themeCategory === cat ? 'active' : ''}`}
                        onClick={() => setThemeCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="result-theme-swatches" role="group" aria-label="Choose theme">
                    {availableThemes
                      .filter(theme => !theme.layoutId || theme.layoutId === layout.id)
                      .filter(theme => themeCategory === 'All' || theme.category === themeCategory)
                      .map(theme => (
                        <button
                          key={theme.id}
                          className={activeTheme?.id === theme.id ? 'active' : ''}
                          style={{ backgroundColor: theme.background, backgroundImage: `url(${theme.frame || theme.singleTemplate || ''})` }}
                          onClick={() => void chooseTheme(theme, copies)}
                          aria-label={theme.name}
                          aria-pressed={activeTheme?.id === theme.id}
                          title={theme.name}
                        />
                      ))}
                  </div>
                </div>
              )}

              {/* 2. FILTERS TAB */}
              {customTab === 'filters' && (
                <div className="tab-pane">
                  <div className="filter-options-grid">
                    {filterOptions.map(f => (
                      <button
                        key={f.id}
                        className={`filter-card ${selectedFilter === f.id ? 'active' : ''}`}
                        onClick={() => handleFilterChange(f.id)}
                      >
                        <span className="filter-chip" style={{ background: f.previewBg }} />
                        <strong>{f.label}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. STICKERS TAB */}
              {customTab === 'stickers' && (
                <div className="tab-pane">
                  <p className="hint">Tap an emoji to place it. Drag stickers directly on your photo strip to reposition them.</p>
                  <div className="sticker-tray">
                    {stickerLibrary.map(emoji => (
                      <button
                        key={emoji}
                        className="sticker-btn"
                        onClick={() => handleAddSticker(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  {stickers.length > 0 && (
                    <div className="placed-stickers-list">
                      <small>Placed stickers ({stickers.length}) · tap to select:</small>
                      <div className="placed-chips">
                        {stickers.map(s => (
                          <span
                            key={s.id}
                            className={`placed-chip ${selectedStickerId === s.id ? 'active' : ''}`}
                            onClick={e => {
                              e.stopPropagation()
                              setSelectedStickerId(s.id)
                            }}
                          >
                            {s.emoji}
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation()
                                handleRemoveSticker(s.id)
                              }}
                            >
                              <X />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. DOODLES TAB */}
              {customTab === 'doodles' && (
                <div className="tab-pane">
                  <p className="hint">Draw directly on your photo strip using your finger or mouse.</p>
                  <div className="doodle-toolbar">
                    <div className="pen-colors">
                      {penColors.map(c => (
                        <button
                          key={c}
                          className={`pen-color ${selectedPenColor === c ? 'active' : ''}`}
                          style={{ backgroundColor: c }}
                          onClick={() => setSelectedPenColor(c)}
                        />
                      ))}
                    </div>
                    <div className="pen-sizes">
                      {[4, 8, 14].map(size => (
                        <button
                          key={size}
                          className={`pen-size ${selectedPenSize === size ? 'active' : ''}`}
                          onClick={() => setSelectedPenSize(size)}
                        >
                          <i style={{ width: size, height: size }} />
                        </button>
                      ))}
                    </div>
                    <div className="doodle-actions">
                      <button className="icon-action-btn" title="Undo stroke" onClick={handleUndoDoodle} disabled={doodles.length === 0}><Undo2 /></button>
                      <button className="icon-action-btn" title="Clear all" onClick={handleClearDoodles} disabled={doodles.length === 0}><Eraser /></button>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* PREVIEW STAGE WITH INTERACTIVE DRAWING & STICKERS */}
            <div className="result-preview" onClick={() => setSelectedStickerId(null)}>
              <div
                className="preview-canvas-wrapper"
                ref={previewWrapperRef}
                onClick={() => setSelectedStickerId(null)}
              >
                <img
                  className={`result-strip ${copies === 2 ? 'double' : ''}`}
                  src={copies === 2 ? result : (cleanPreview || preview)}
                  alt={`${copies === 2 ? 'Double 4 by 6' : 'Single 2 by 6'} photo strip preview`}
                  draggable={false}
                />

                {/* Interactive Draggable Stickers Layer (Single strip view) */}
                {copies === 1 && (
                  <div
                    className="stickers-overlay"
                    style={{ pointerEvents: customTab === 'doodles' ? 'none' : 'auto' }}
                    onPointerMove={e => {
                      handleStickerPointerMove(e)
                      handleRotatePointerMove(e)
                      handleResizePointerMove(e)
                    }}
                    onPointerUp={e => {
                      handleStickerPointerUp(e)
                      handleRotatePointerUp(e)
                      handleResizePointerUp(e)
                    }}
                  >
                    {stickers.map(sticker => (
                      <div
                        key={sticker.id}
                        className={`draggable-sticker ${selectedStickerId === sticker.id ? 'active' : ''}`}
                        style={{
                          left: `${(sticker.x / 600) * 100}%`,
                          top: `${(sticker.y / 1800) * 100}%`,
                          transform: `translate(-50%, -50%) rotate(${sticker.rotation || 0}deg)`,
                        }}
                        onPointerDown={e => handleStickerPointerDown(e, sticker.id)}
                        onPointerMove={handleStickerPointerMove}
                        onPointerUp={handleStickerPointerUp}
                        onClick={e => {
                          e.stopPropagation()
                          setSelectedStickerId(sticker.id)
                        }}
                      >
                        <span
                          className="sticker-emoji"
                          style={{
                            fontSize: `${Math.max(16, Math.round(sticker.size * (wrapperWidth / 600)))}px`,
                          }}
                        >
                          {sticker.emoji}
                        </span>

                        {selectedStickerId === sticker.id && customTab !== 'doodles' && (
                          <>
                            {/* Rotate stem & handle at top */}
                            <div className="sticker-rotate-stem" />
                            <button
                              type="button"
                              className="sticker-handle sticker-rotate-handle"
                              title="Drag to rotate sticker"
                              aria-label="Rotate sticker"
                              onPointerDown={e => handleRotatePointerDown(e, sticker.id)}
                              onPointerMove={handleRotatePointerMove}
                              onPointerUp={handleRotatePointerUp}
                              onClick={e => {
                                e.stopPropagation()
                                e.preventDefault()
                              }}
                            >
                              <RotateCw size={13} />
                            </button>

                            {/* Delete button at top-left */}
                            <button
                              type="button"
                              className="sticker-handle sticker-delete-badge"
                              title="Delete sticker"
                              aria-label="Delete sticker"
                              onPointerDown={e => {
                                e.stopPropagation()
                                e.preventDefault()
                              }}
                              onClick={e => {
                                e.stopPropagation()
                                e.preventDefault()
                                handleRemoveSticker(sticker.id)
                              }}
                            >
                              <X size={13} />
                            </button>

                            {/* Resize handle at bottom-right */}
                            <button
                              type="button"
                              className="sticker-handle sticker-resize-badge"
                              title="Drag to resize sticker"
                              aria-label="Resize sticker"
                              onPointerDown={e => handleResizePointerDown(e, sticker.id)}
                              onPointerMove={handleResizePointerMove}
                              onPointerUp={handleResizePointerUp}
                              onClick={e => {
                                e.stopPropagation()
                                e.preventDefault()
                              }}
                            >
                              <Maximize2 size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Doodle scratchpad overlay when in Doodle tab */}
                {customTab === 'doodles' && copies === 1 && (
                  <canvas
                    ref={doodleCanvasRef}
                    className="doodle-overlay-canvas"
                    width={600}
                    height={1800}
                    onPointerDown={handleDoodlePointerDown}
                    onPointerMove={handleDoodlePointerMove}
                    onPointerUp={handleDoodlePointerUp}
                    onPointerLeave={handleDoodlePointerUp}
                  />
                )}
              </div>
            </div>
          </div>

          <img className="print-canvas" src={result} alt="" aria-hidden="true" />
          <div className="result-actions">
            <div className="strip-customization">
              <label>Top text<input type="text" maxLength={30} value={stripTitle} onChange={event => customizeStrip(event.target.value, showBrand)} /></label>
              <label className="brand-option"><input type="checkbox" checked={showBrand} onChange={event => customizeStrip(stripTitle, event.target.checked)} />Show KODAKEI brand</label>
            </div>
            <div className="print-options">
              <span><strong>4×6 print</strong><small>1200 × 1800 · 300 DPI</small></span>
              <div>
                <button className={copies === 1 ? 'active' : ''} aria-pressed={copies === 1} onClick={() => chooseCopies(1)}>Single</button>
                <button className={copies === 2 ? 'active' : ''} aria-pressed={copies === 2} onClick={() => chooseCopies(2)}>Double</button>
              </div>
            </div>
            <button className="primary" onClick={download}><Download />Download</button>
            <button
              className="secondary print-button"
              disabled={hasPrinted && !currentSettings.current.allowReprint}
              onClick={print}
            >
              <Printer />
              {hasPrinted ? (currentSettings.current.allowReprint ? 'Print again' : 'Printed') : 'Print'}
            </button>
            <button className="secondary" onClick={startOver}><RefreshCw />Start over</button>
            {error && <p className="error" role="alert">{error}</p>}
            {shareProgress !== null && <p role="status">{shareProgress === 100 ? 'QR image and video ready' : `Preparing QR downloads: ${shareProgress}%. Keep this page open.`}</p>}
            {error && activeTheme && <button className="secondary" onClick={() => void chooseTheme(activeTheme, copies)}><RefreshCw />Retry QR generation</button>}
          </div>
        </section>
      )}
    </main>
  )
}

function CaptureScreen({ timer, total, aspectRatio, onDone }: { timer: number; total: number; aspectRatio: number; onDone: (captures: CapturedMoment[]) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const countdownAudio = useRef<HTMLAudioElement | null>(null)
  const mounted = useRef(true)
  const captures = useRef<CapturedMoment[]>([])
  const clipRecorder = useRef<{ recorder: MediaRecorder; chunks: Blob[] } | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'shooting' | 'error'>('loading')
  const [cameraError, setCameraError] = useState('')
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCamera, setSelectedCamera] = useState('')
  const [mirrored, setMirrored] = useState(true)
  const [countdown, setCountdown] = useState(timer)
  const [shot, setShot] = useState(0)
  const [flash, setFlash] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const ultraWideCamera = cameras.find(camera => isUltraWideCamera(camera.label))

  const playCountdownSound = useCallback(() => {
    if (!soundEnabled) return
    const audio = countdownAudio.current ?? new Audio(`/sounds/female_retro_combo_${timer}s.wav`)
    countdownAudio.current = audio
    audio.pause()
    audio.currentTime = 0
    void audio.play().catch(() => {})
  }, [soundEnabled, timer])

  const openCamera = useCallback(async (deviceId?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      if (!window.isSecureContext) {
        setCameraError('Camera requires a Secure Context (HTTPS or localhost). If opening over LAN IP (http://192.168.x.x), run "npm run dev:https" or add the IP to chrome://flags/#unsafely-treat-insecure-origin-as-secure')
      } else {
        setCameraError('This browser does not provide camera access.')
      }
      return setStatus('error')
    }
    setStatus('loading')
    setCameraError('')
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
    if (video.current) video.current.srcObject = null
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1200 }, height: { ideal: Math.round(1200 / aspectRatio) }, aspectRatio: { ideal: aspectRatio }, ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }) },
        audio: false,
      })
      if (!mounted.current) return media.getTracks().forEach(track => track.stop())
      stream.current = media
      if (video.current) video.current.srcObject = media
      const available = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput')
      const track = media.getVideoTracks()[0]
      const activeDeviceId = track?.getSettings().deviceId || deviceId || available[0]?.deviceId || ''
      const activeCamera = available.find(camera => camera.deviceId === activeDeviceId)
      setCameras(available)
      setSelectedCamera(activeDeviceId)
      setMirrored(track?.getSettings().facingMode === 'user' || (!track?.getSettings().facingMode && !isBackCamera(activeCamera?.label || '')))
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      setCameraError(name === 'NotAllowedError' ? 'Camera permission was blocked. Allow it in your browser settings, then try again.' : name === 'NotFoundError' ? 'No active camera was found.' : 'The camera could not be opened.')
      setStatus('error')
    }
  }, [aspectRatio])

  useEffect(() => {
    mounted.current = true
    void openCamera()
    return () => {
      mounted.current = false
      if (clipRecorder.current?.recorder.state !== 'inactive') clipRecorder.current?.recorder.stop()
      stream.current?.getTracks().forEach(track => track.stop())
      countdownAudio.current?.pause()
    }
  }, [openCamera])

  const captureFrame = useCallback(() => {
    if (!video.current?.videoWidth) return makeDemoPhoto(captures.current.length, aspectRatio)
    const source = video.current
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = Math.round(canvas.width / aspectRatio)
    const targetRatio = aspectRatio
    const sourceRatio = source.videoWidth / source.videoHeight
    const sourceWidth = sourceRatio > targetRatio ? source.videoHeight * targetRatio : source.videoWidth
    const sourceHeight = sourceRatio > targetRatio ? source.videoHeight : source.videoWidth / targetRatio
    const sourceX = (source.videoWidth - sourceWidth) / 2
    const sourceY = (source.videoHeight - sourceHeight) / 2
    const ctx = canvas.getContext('2d')!
    if (mirrored) {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.92)
  }, [aspectRatio, mirrored])

  const startClip = useCallback(() => {
    if (!stream.current || clipRecorder.current || !('MediaRecorder' in window)) return
    const mimeType = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type))
    if (!mimeType) return
    try {
      const chunks: Blob[] = []
      const recorder = new MediaRecorder(stream.current, { mimeType, videoBitsPerSecond: 6_000_000 })
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder.start()
      clipRecorder.current = { recorder, chunks }
    } catch {
      clipRecorder.current = null
    }
  }, [])

  const stopClip = useCallback(() => new Promise<Blob | null>(resolve => {
    const active = clipRecorder.current
    clipRecorder.current = null
    if (!active || active.recorder.state === 'inactive') return resolve(null)
    active.recorder.onstop = () => resolve(new Blob(active.chunks, { type: active.recorder.mimeType }))
    try { active.recorder.stop() } catch { resolve(null) }
  }), [])

  useEffect(() => {
    if (status !== 'shooting') return
    if (countdown > 0) {
      if (countdown === 2) startClip()
      const id = window.setTimeout(() => setCountdown(value => value - 1), 1000)
      return () => window.clearTimeout(id)
    }
    const photo = captureFrame()
    setFlash(true)
    const nextShot = shot + 1
    const id = window.setTimeout(async () => {
      captures.current.push({ photo, clip: await stopClip(), mirrored })
      setFlash(false)
      if (nextShot >= total) onDone([...captures.current])
      else {
        setShot(nextShot)
        setCountdown(timer)
        playCountdownSound()
      }
    }, 650)
    return () => window.clearTimeout(id)
  }, [captureFrame, countdown, mirrored, onDone, playCountdownSound, shot, startClip, status, stopClip, timer, total])

  const startDemo = () => {
    stream.current?.getTracks().forEach(track => track.stop())
    setStatus('ready')
  }

  const startCapture = () => {
    captures.current = []
    setShot(0)
    setCountdown(timer)
    playCountdownSound()
    setStatus('shooting')
  }

  return (
    <section className="capture-screen">
      <div className="camera-toolbar" style={{ width: `min(calc(100vw - 44px), calc((100dvh - 210px) * ${aspectRatio}))` }}>
        {cameras.length > 0 && <div className="camera-picker"><label>Camera<select value={selectedCamera} disabled={status === 'shooting'} onChange={event => void openCamera(event.target.value)}>{cameras.map((camera, index) => <option key={camera.deviceId} value={camera.deviceId}>{isUltraWideCamera(camera.label) ? `0.5× · ${camera.label}` : camera.label || `Camera ${index + 1}`}</option>)}</select></label>{ultraWideCamera && <button type="button" disabled={status === 'shooting'} className={selectedCamera === ultraWideCamera.deviceId ? 'active' : ''} onClick={() => void openCamera(ultraWideCamera.deviceId)}>0.5×</button>}</div>}
        <span className="shot-count">Photo {Math.min(shot + 1, total)} / {total}</span>
      </div>
      <div className="camera-stage" style={{ width: `min(calc(100vw - 44px), calc((100dvh - 210px) * ${aspectRatio}))`, aspectRatio }}>
        <video className={mirrored ? 'mirrored' : ''} ref={video} autoPlay muted playsInline onPlaying={() => setStatus(current => current === 'loading' ? 'ready' : current)} />
        {status === 'loading' && <div className="camera-message"><Camera /><strong>Opening camera</strong></div>}
        {status === 'error' && <div className="camera-message"><Camera /><strong>Camera unavailable</strong><span>{cameraError}</span><div className="camera-message-actions"><button onClick={() => void openCamera(selectedCamera || undefined)}>Allow camera access</button><button onClick={startDemo}>Use demo camera</button></div></div>}
        {status === 'shooting' && <div className="countdown" aria-live="assertive">{countdown || ''}</div>}
        {flash && <div className="flash" />}
      </div>
      <div className="capture-controls" style={{ width: `min(calc(100vw - 44px), calc((100dvh - 210px) * ${aspectRatio}))` }}>
        <label className="sound-toggle"><input type="checkbox" checked={soundEnabled} disabled={status === 'shooting'} onChange={event => { setSoundEnabled(event.target.checked); if (!event.target.checked) countdownAudio.current?.pause() }} />Countdown sound</label>
        {status === 'ready' && <button className="camera-start" onClick={startCapture}><Camera />Start</button>}
      </div>
    </section>
  )
}

export default App
