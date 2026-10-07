import { invoke, isTauri } from '@tauri-apps/api/core'
import { queueForSync } from './sync'

export type Metadata = Record<string, string | number | boolean>
export type StoredEvent = { sessionId: string; eventType: string; metadata: Metadata; createdAt: string }
export type SessionSummary = {
  sessionId: string
  startedAt: string
  lastEventAt: string
  layoutId?: string
  themeId?: string
  captures: number
  downloaded: boolean
  printed: boolean
  status: 'Completed' | 'Abandoned' | 'Active'
}
export type StoredTheme = {
  id: string
  name: string
  category: string
  layoutId: string
  frameDataUrl: string
  active: boolean
  createdAt: string
}

export type DateRangeFilter = 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'all'

export interface BoothSettings {
  boothName: string
  brandTitle: string
  inactivityTimeout: number // seconds
  autoResetDelay: number // seconds
  availableTimers: number[]
  defaultTimer: number
  extraCaptures: number
  photoRetention: 'immediate' | '24h' | '7d'
  printMode: 'manual' | 'auto'
  defaultCopies: 1 | 2
  allowReprint: boolean
  printerName: string
  adminPin: string
}

export const defaultSettings: BoothSettings = {
  boothName: 'GIC Booth Main',
  brandTitle: 'GIC BOOTH',
  inactivityTimeout: 90,
  autoResetDelay: 45,
  availableTimers: [3, 5, 10],
  defaultTimer: 3,
  extraCaptures: 2,
  photoRetention: 'immediate',
  printMode: 'manual',
  defaultCopies: 1,
  allowReprint: true,
  printerName: '',
  adminPin: '1234',
}

const STORAGE_KEY = 'gic-booth-events'
const THEMES_KEY = 'gic-booth-themes'
const SETTINGS_KEY = 'gic-booth-settings'

export const createId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

export function getSettings(): BoothSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return defaultSettings
  }
}

export async function saveSettings(settings: BoothSettings): Promise<void> {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  if (isTauri()) {
    try {
      await invoke('save_settings', { settings })
    } catch {
      // Tauri command optional fallback
    }
  }
}

export function isDateInRange(isoString: string, range: DateRangeFilter): boolean {
  if (range === 'all') return true
  const date = new Date(isoString)
  const now = new Date()

  if (range === 'today') {
    return date.toDateString() === now.toDateString()
  }
  if (range === 'yesterday') {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return date.toDateString() === yesterday.toDateString()
  }
  if (range === '7days') {
    const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return date >= past7
  }
  if (range === '30days') {
    const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    return date >= past30
  }
  if (range === 'month') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  }
  return true
}

export async function recordEvent(sessionId: string, eventType: string, metadata: Metadata = {}) {
  const createdAt = new Date().toISOString()
  if (isTauri()) {
    try {
      await invoke('record_event', { sessionId, eventType, metadata })
    } catch {
      // Fallback to localStorage if invoke fails
      const events = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredEvent[]
      events.push({ sessionId, eventType, metadata, createdAt })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
    }
  } else {
    const events = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredEvent[]
    events.push({ sessionId, eventType, metadata, createdAt })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  }

  // Queue for cloud sync
  queueForSync('event', `${sessionId}-${Date.now()}`, {
    sessionId,
    eventType,
    metadata,
    createdAt,
  })
}

export async function getEventCounts(range: DateRangeFilter = 'all') {
  if (isTauri() && range === 'all') {
    try {
      return await invoke<{ eventType: string; count: number }[]>('event_counts')
    } catch {
      // fall back to localStorage
    }
  }
  const events = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredEvent[]
  const filtered = events.filter(e => isDateInRange(e.createdAt, range))
  const counts = new Map<string, number>()
  filtered.forEach(event => counts.set(event.eventType, (counts.get(event.eventType) ?? 0) + 1))
  return [...counts].map(([eventType, count]) => ({ eventType, count }))
}

export async function getSessionHistory(range: DateRangeFilter = 'all', statusFilter = 'all'): Promise<SessionSummary[]> {
  let allSummaries: SessionSummary[] = []
  if (isTauri() && range === 'all' && statusFilter === 'all') {
    try {
      allSummaries = await invoke<SessionSummary[]>('session_history')
    } catch {
      allSummaries = []
    }
  }

  if (allSummaries.length === 0) {
    const events = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredEvent[]
    const sessions = new Map<string, StoredEvent[]>()
    events.forEach(event => sessions.set(event.sessionId, [...(sessions.get(event.sessionId) ?? []), event]))

    allSummaries = [...sessions].map(([sessionId, items]) => {
      const layoutEvent = items.find(i => i.eventType === 'layout_selected')
      const themeEvent = items.find(i => i.eventType === 'theme_selected')
      const isCompleted = items.some(item => item.eventType === 'session_completed')
      const isAbandoned = items.some(item => item.eventType === 'session_abandoned')
      return {
        sessionId,
        startedAt: items[0].createdAt,
        lastEventAt: items.at(-1)?.createdAt ?? items[0].createdAt,
        layoutId: (layoutEvent?.metadata.layout as string) || undefined,
        themeId: (themeEvent?.metadata.theme as string) || undefined,
        captures: items.filter(item => item.eventType === 'capture_completed').reduce((total, item) => total + Number(item.metadata.count ?? 0), 0),
        downloaded: items.some(item => item.eventType === 'download_completed'),
        printed: items.some(item => item.eventType === 'print_requested'),
        status: isCompleted ? 'Completed' : isAbandoned ? 'Abandoned' : 'Active',
      }
    })
  }

  return allSummaries
    .filter(session => isDateInRange(session.startedAt, range))
    .filter(session => statusFilter === 'all' || session.status.toLowerCase() === statusFilter.toLowerCase())
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export interface AnalyticsReport {
  sessionsTotal: number
  completedTotal: number
  abandonedTotal: number
  completionRate: number
  capturesTotal: number
  downloadsTotal: number
  printsTotal: number
  popularThemes: { theme: string; count: number }[]
  popularLayouts: { layout: string; count: number }[]
  sessionsByDay: { date: string; sessions: number; completed: number }[]
}

export async function getAnalyticsReport(range: DateRangeFilter = '7days'): Promise<AnalyticsReport> {
  const sessions = await getSessionHistory(range)
  const events = (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredEvent[])
    .filter(e => isDateInRange(e.createdAt, range))

  const sessionsTotal = sessions.length
  const completedTotal = sessions.filter(s => s.status === 'Completed').length
  const abandonedTotal = sessions.filter(s => s.status === 'Abandoned').length
  const completionRate = sessionsTotal > 0 ? Math.round((completedTotal / sessionsTotal) * 100) : 0

  const capturesTotal = events
    .filter(e => e.eventType === 'capture_completed')
    .reduce((sum, e) => sum + Number(e.metadata.count ?? 0), 0)

  const downloadsTotal = events.filter(e => e.eventType === 'download_completed').length
  const printsTotal = events.filter(e => e.eventType === 'print_requested').length

  // Popular themes
  const themeMap = new Map<string, number>()
  events.filter(e => e.eventType === 'theme_selected').forEach(e => {
    const t = String(e.metadata.theme ?? 'Unknown')
    themeMap.set(t, (themeMap.get(t) ?? 0) + 1)
  })
  const popularThemes = [...themeMap.entries()]
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Popular layouts
  const layoutMap = new Map<string, number>()
  events.filter(e => e.eventType === 'layout_selected').forEach(e => {
    const l = String(e.metadata.layout ?? 'Unknown')
    layoutMap.set(l, (layoutMap.get(l) ?? 0) + 1)
  })
  const popularLayouts = [...layoutMap.entries()]
    .map(([layout, count]) => ({ layout, count }))
    .sort((a, b) => b.count - a.count)

  // Sessions by day
  const dayMap = new Map<string, { sessions: number; completed: number }>()
  sessions.forEach(s => {
    const day = s.startedAt.slice(0, 10)
    const current = dayMap.get(day) ?? { sessions: 0, completed: 0 }
    current.sessions += 1
    if (s.status === 'Completed') current.completed += 1
    dayMap.set(day, current)
  })

  const sessionsByDay = [...dayMap.entries()]
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    sessionsTotal,
    completedTotal,
    abandonedTotal,
    completionRate,
    capturesTotal,
    downloadsTotal,
    printsTotal,
    popularThemes,
    popularLayouts,
    sessionsByDay,
  }
}

export async function listThemes(): Promise<StoredTheme[]> {
  if (isTauri()) {
    try {
      return await invoke<StoredTheme[]>('list_themes')
    } catch {
      // Fallback
    }
  }
  return JSON.parse(localStorage.getItem(THEMES_KEY) ?? '[]') as StoredTheme[]
}

export async function saveTheme(theme: Omit<StoredTheme, 'createdAt'>) {
  if (isTauri()) {
    try {
      await invoke('save_theme', { theme })
    } catch {
      // Fallback
    }
  }
  const themes = await listThemes()
  const updated = [{ ...theme, createdAt: new Date().toISOString() }, ...themes.filter(item => item.id !== theme.id)]
  localStorage.setItem(THEMES_KEY, JSON.stringify(updated))

  // Queue theme for cloud sync
  queueForSync('theme', theme.id, {
    id: theme.id,
    name: theme.name,
    category: theme.category,
    layoutId: theme.layoutId,
    frameDataUrl: theme.frameDataUrl,
    active: theme.active,
  })
}

export async function setThemeActive(id: string, active: boolean) {
  if (isTauri()) {
    try {
      await invoke('set_theme_active', { id, active })
    } catch {
      // Fallback
    }
  }
  const themes = await listThemes()
  const updated = themes.map(theme => theme.id === id ? { ...theme, active } : theme)
  localStorage.setItem(THEMES_KEY, JSON.stringify(updated))
}

export async function deleteTheme(id: string) {
  if (isTauri()) {
    try {
      await invoke('delete_theme', { id })
    } catch {
      // Fallback
    }
  }
  const themes = await listThemes()
  const updated = themes.filter(theme => theme.id !== id)
  localStorage.setItem(THEMES_KEY, JSON.stringify(updated))
}

// Generate a 4x6 inch 300 DPI (1200x1800) printer calibration sheet
export function generateCalibrationSheetUrl(): string {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 1800
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // White base
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 1200, 1800)

  // Outer border & bleed margin (0.25 inch = 75px at 300 DPI)
  ctx.lineWidth = 4
  ctx.strokeStyle = '#171717'
  ctx.strokeRect(30, 30, 1140, 1740)

  // Bleed safety line (dashed)
  ctx.setLineDash([12, 12])
  ctx.strokeStyle = '#e43d30'
  ctx.strokeRect(75, 75, 1050, 1650)
  ctx.setLineDash([])

  // Center vertical cut guide line (for 2x6 strip cutting at 600px)
  ctx.strokeStyle = '#2464c6'
  ctx.lineWidth = 3
  ctx.setLineDash([10, 8])
  ctx.beginPath()
  ctx.moveTo(600, 0)
  ctx.lineTo(600, 1800)
  ctx.stroke()
  ctx.setLineDash([])

  // Cut line indicators
  ctx.fillStyle = '#2464c6'
  ctx.font = 'bold 20px "Barlow Condensed", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('✂ 2×6 CUT LINE (600px) ✂', 600, 60)
  ctx.fillText('✂ 2×6 CUT LINE (600px) ✂', 600, 1760)

  // Header Title
  ctx.fillStyle = '#171717'
  ctx.font = '800 48px "Barlow Condensed", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('GIC BOOTH — PRINTER CALIBRATION SHEET', 600, 160)

  ctx.font = 'bold 24px sans-serif'
  ctx.fillStyle = '#55524e'
  ctx.fillText(`Target: 4×6 inch (1200 × 1800 px @ 300 DPI) · Generated: ${new Date().toLocaleString()}`, 600, 205)

  // CMYK / RGB Color Test Blocks
  const colors = [
    { name: 'Cyan', color: '#00ffff' },
    { name: 'Magenta', color: '#ff00ff' },
    { name: 'Yellow', color: '#ffff00' },
    { name: 'Red', color: '#e43d30' },
    { name: 'Green', color: '#2f8f70' },
    { name: 'Blue', color: '#2464c6' },
    { name: 'Black', color: '#171717' },
  ]
  const blockW = 130
  const startX = 600 - (colors.length * blockW) / 2
  colors.forEach((col, idx) => {
    ctx.fillStyle = col.color
    ctx.fillRect(startX + idx * blockW, 260, blockW - 10, 80)
    ctx.fillStyle = '#171717'
    ctx.font = 'bold 16px sans-serif'
    ctx.fillText(col.name, startX + idx * blockW + (blockW - 10) / 2, 365)
  })

  // Grayscale ramp (10 steps from 10% to 100%)
  const graySteps = 10
  const grayW = 90
  const grayStartX = 600 - (graySteps * grayW) / 2
  for (let i = 0; i < graySteps; i++) {
    const val = Math.round(255 - (i / (graySteps - 1)) * 255)
    ctx.fillStyle = `rgb(${val},${val},${val})`
    ctx.fillRect(grayStartX + i * grayW, 400, grayW - 6, 70)
    ctx.fillStyle = '#171717'
    ctx.font = 'bold 14px sans-serif'
    ctx.fillText(`${Math.round(((i + 1) / graySteps) * 100)}%`, grayStartX + i * grayW + (grayW - 6) / 2, 495)
  }

  // Left & Right Sample Strips Mock Preview to verify photo placement
  for (const side of [120, 720]) {
    ctx.fillStyle = '#f7f6f0'
    ctx.fillRect(side, 530, 360, 1080)
    ctx.strokeStyle = '#d8d6cf'
    ctx.lineWidth = 2
    ctx.strokeRect(side, 530, 360, 1080)

    // 4 sample photo frames
    for (let p = 0; p < 4; p++) {
      const py = 560 + p * 240
      ctx.fillStyle = '#e8e6df'
      ctx.fillRect(side + 24, py, 312, 210)
      ctx.strokeStyle = '#c9c7c0'
      ctx.strokeRect(side + 24, py, 312, 210)
      ctx.fillStyle = '#888'
      ctx.font = 'bold 20px sans-serif'
      ctx.fillText(`Sample Frame ${p + 1}`, side + 180, py + 115)
    }

    ctx.fillStyle = '#e43d30'
    ctx.font = 'bold 22px "Barlow Condensed", sans-serif'
    ctx.fillText('GIC BOOTH 4-CUT', side + 180, 1565)
  }

  // Footer instructions
  ctx.fillStyle = '#171717'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('Inspection: Ensure outer solid border is visible (no clip) and red dashed line is intact.', 600, 1680)

  return canvas.toDataURL('image/png')
}
