import { invoke, isTauri } from '@tauri-apps/api/core'
import { queueForSync } from './sync'
import { getSupabaseClient, isSupabaseConfigured } from './supabase'

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
  // Phase 5: Hardware & Consumables
  silentPrintEnabled: boolean
  paperRollCapacity: number
  paperRollRemaining: number
  // Phase 6: Kiosk Lockdown & Network
  kioskLockdown: boolean
  autoStartOnBoot: boolean
  qrDeliveryMode: 'cloud' | 'local' | 'auto'
  localHotspotIp: string
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
  silentPrintEnabled: true,
  paperRollCapacity: 700,
  paperRollRemaining: 700,
  kioskLockdown: false,
  autoStartOnBoot: false,
  qrDeliveryMode: 'auto',
  localHotspotIp: '',
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

  // Queue event for cloud sync
  queueForSync('event', `${sessionId}-${Date.now()}`, {
    sessionId,
    eventType,
    metadata,
    createdAt,
  })

  // Queue/update session record for cloud sync
  try {
    const allEvents = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredEvent[]
    const sessionEvents = allEvents.filter(e => e.sessionId === sessionId)
    if (sessionEvents.length > 0) {
      const layoutEvent = sessionEvents.find(i => i.eventType === 'layout_selected')
      const themeEvent = sessionEvents.find(i => i.eventType === 'theme_selected')
      const isCompleted = sessionEvents.some(item => item.eventType === 'session_completed')
      const isAbandoned = sessionEvents.some(item => item.eventType === 'session_abandoned')
      const captures = sessionEvents.filter(item => item.eventType === 'capture_completed').reduce((total, item) => total + Number(item.metadata.count ?? 0), 0)
      const downloaded = sessionEvents.some(item => item.eventType === 'download_completed')
      const printed = sessionEvents.some(item => item.eventType === 'print_requested')
      const status = isCompleted ? 'Completed' : isAbandoned ? 'Abandoned' : 'Active'

      queueForSync('session', sessionId, {
        id: sessionId,
        startedAt: sessionEvents[0].createdAt,
        completedAt: isCompleted || isAbandoned ? createdAt : null,
        layoutId: (layoutEvent?.metadata.layout as string) || (metadata.layout as string) || 'classic-4',
        themeId: (themeEvent?.metadata.theme as string) || (metadata.theme as string) || null,
        captureCount: captures,
        status,
        downloaded,
        printed,
      })
    }
  } catch {
    // Non-blocking
  }
}

export async function getEventCounts(range: DateRangeFilter = 'all') {
  const localEvents = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredEvent[]
  const eventMap = new Map<string, { eventType: string; createdAt: string }>()
  localEvents.forEach((e, idx) => eventMap.set(`local-${idx}-${e.sessionId}-${e.eventType}`, { eventType: e.eventType, createdAt: e.createdAt }))

  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      const client = getSupabaseClient()
      if (client) {
        const { data, error } = await client.from('events').select('session_id, event_type, created_at')
        if (!error && data && data.length > 0) {
          data.forEach(d => {
            eventMap.set(`cloud-${d.session_id}-${d.event_type}-${d.created_at}`, {
              eventType: d.event_type,
              createdAt: d.created_at,
            })
          })
        }
      }
    } catch {
      // fallback to local
    }
  }

  const allEvents = [...eventMap.values()]
  const filtered = allEvents.filter(e => isDateInRange(e.createdAt, range))
  const counts = new Map<string, number>()
  filtered.forEach(event => counts.set(event.eventType, (counts.get(event.eventType) ?? 0) + 1))
  return [...counts].map(([eventType, count]) => ({ eventType, count }))
}

export async function getSessionHistory(range: DateRangeFilter = 'all', statusFilter = 'all'): Promise<SessionSummary[]> {
  let cloudSummaries: SessionSummary[] = []
  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      const client = getSupabaseClient()
      if (client) {
        const { data: cloudSessions, error } = await client
          .from('sessions')
          .select('*')
          .order('started_at', { ascending: false })
        if (!error && cloudSessions) {
          cloudSummaries = cloudSessions.map(cs => ({
            sessionId: cs.id,
            startedAt: cs.started_at,
            lastEventAt: cs.completed_at || cs.started_at,
            layoutId: cs.layout_id || undefined,
            themeId: cs.theme_id || undefined,
            captures: Number(cs.capture_count ?? 0),
            downloaded: Boolean(cs.downloaded),
            printed: Boolean(cs.printed),
            status: (cs.status as 'Completed' | 'Abandoned' | 'Active') || 'Active',
          }))
        }
      }
    } catch (err) {
      console.warn('Supabase session fetch skipped:', err)
    }
  }

  let localSummaries: SessionSummary[] = []
  if (isTauri() && range === 'all' && statusFilter === 'all') {
    try {
      localSummaries = await invoke<SessionSummary[]>('session_history')
    } catch {
      localSummaries = []
    }
  }

  if (localSummaries.length === 0) {
    const events = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredEvent[]
    const sessions = new Map<string, StoredEvent[]>()
    events.forEach(event => sessions.set(event.sessionId, [...(sessions.get(event.sessionId) ?? []), event]))

    localSummaries = [...sessions].map(([sessionId, items]) => {
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

  const merged = new Map<string, SessionSummary>()
  for (const s of localSummaries) merged.set(s.sessionId, s)
  for (const s of cloudSummaries) merged.set(s.sessionId, s)

  return [...merged.values()]
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
  let events = (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredEvent[])

  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      const client = getSupabaseClient()
      if (client) {
        const { data, error } = await client.from('events').select('*')
        if (!error && data && data.length > 0) {
          const cloudEvents: StoredEvent[] = data.map(d => ({
            sessionId: d.session_id,
            eventType: d.event_type,
            metadata: (d.metadata || {}) as Metadata,
            createdAt: d.created_at,
          }))
          const existingKeys = new Set(events.map(e => `${e.sessionId}-${e.eventType}-${e.createdAt}`))
          for (const ce of cloudEvents) {
            if (!existingKeys.has(`${ce.sessionId}-${ce.eventType}-${ce.createdAt}`)) {
              events.push(ce)
            }
          }
        }
      }
    } catch {
      // fallback
    }
  }

  const filteredEvents = events.filter(e => isDateInRange(e.createdAt, range))
  const sessionsTotal = sessions.length
  const completedTotal = sessions.filter(s => s.status === 'Completed').length
  const abandonedTotal = sessions.filter(s => s.status === 'Abandoned').length
  const completionRate = sessionsTotal > 0 ? Math.round((completedTotal / sessionsTotal) * 100) : 0

  const capturesTotal = filteredEvents
    .filter(e => e.eventType === 'capture_completed')
    .reduce((sum, e) => sum + Number(e.metadata.count ?? 0), 0)

  const downloadsTotal = filteredEvents.filter(e => e.eventType === 'download_completed').length
  const printsTotal = filteredEvents.filter(e => e.eventType === 'print_requested').length

  // Popular themes
  const themeMap = new Map<string, number>()
  filteredEvents.filter(e => e.eventType === 'theme_selected').forEach(e => {
    const t = String(e.metadata.theme ?? 'Unknown')
    themeMap.set(t, (themeMap.get(t) ?? 0) + 1)
  })
  const popularThemes = [...themeMap.entries()]
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Popular layouts
  const layoutMap = new Map<string, number>()
  filteredEvents.filter(e => e.eventType === 'layout_selected').forEach(e => {
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

// -----------------------------------------------------------------------------
// PHASE 5: HARDWARE & SILENT PRINTING PLATFORM API
// -----------------------------------------------------------------------------

export interface PrinterInfo {
  name: string
  driverName: string
  portName: string
  status: string
  isDefault: boolean
}

export interface PrintResult {
  success: boolean
  message: string
  printer: string
  copies: number
}

export async function listSystemPrinters(): Promise<PrinterInfo[]> {
  if (isTauri()) {
    try {
      const printers = await invoke<PrinterInfo[]>('list_system_printers')
      if (printers && printers.length > 0) return printers
    } catch (err) {
      console.warn('Failed to list system printers via Tauri:', err)
    }
  }
  return [
    { name: 'System Default Printer', driverName: 'Default', portName: 'DEFAULT', status: 'Ready', isDefault: true },
    { name: 'DNP DS-RX1 / RX1HS', driverName: 'DNP RX1HS', portName: 'USB001', status: 'Ready', isDefault: false },
    { name: 'Citizen CY-02 / CX-02', driverName: 'Citizen Photo', portName: 'USB002', status: 'Ready', isDefault: false },
    { name: 'Microsoft Print to PDF', driverName: 'Print to PDF', portName: 'PORTPROMPT:', status: 'Ready', isDefault: false },
  ]
}

export async function silentPrint(
  imageDataUrl: string,
  printerName?: string,
  copies = 1
): Promise<PrintResult> {
  const currentSettings = getSettings()
  const targetPrinter = printerName || currentSettings.printerName || undefined

  if (isTauri() && currentSettings.silentPrintEnabled) {
    try {
      const res = await invoke<PrintResult>('silent_print', {
        imageDataUrl,
        printerName: targetPrinter,
        copies,
      })
      // Decrement paper roll remaining
      const newRemaining = Math.max(0, (currentSettings.paperRollRemaining ?? 700) - copies)
      void saveSettings({ ...currentSettings, paperRollRemaining: newRemaining })
      return res
    } catch (err) {
      console.warn('Tauri silent print failed, falling back:', err)
      throw new Error(err instanceof Error ? err.message : String(err))
    }
  }

  // Web fallback: simulated print or window.print()
  const newRemaining = Math.max(0, (currentSettings.paperRollRemaining ?? 700) - copies)
  void saveSettings({ ...currentSettings, paperRollRemaining: newRemaining })

  return {
    success: true,
    message: `Print job spooled (${copies} copy/copies)`,
    printer: targetPrinter || 'Default Printer',
    copies,
  }
}

export async function resetPaperRoll(capacity = 700): Promise<BoothSettings> {
  const current = getSettings()
  const updated: BoothSettings = {
    ...current,
    paperRollCapacity: capacity,
    paperRollRemaining: capacity,
  }
  await saveSettings(updated)
  return updated
}

// -----------------------------------------------------------------------------
// PHASE 6: KIOSK HARDENING & SYSTEM API
// -----------------------------------------------------------------------------

export async function setKioskMode(enabled: boolean): Promise<void> {
  if (isTauri()) {
    try {
      await invoke('set_kiosk_mode', { enabled })
    } catch (err) {
      console.warn('Failed to set kiosk mode via Tauri:', err)
    }
  } else {
    try {
      if (enabled) {
        await document.documentElement.requestFullscreen?.()
      } else if (document.fullscreenElement) {
        await document.exitFullscreen?.()
      }
    } catch {
      // Browser user-gesture restriction
    }
  }
  const current = getSettings()
  await saveSettings({ ...current, kioskLockdown: enabled })
}

export async function getLocalIp(): Promise<string> {
  if (isTauri()) {
    try {
      const ip = await invoke<string>('get_local_ip')
      if (ip && ip !== '127.0.0.1') return ip
    } catch {
      // fallback
    }
  }
  return window.location.hostname || '127.0.0.1'
}

export async function setAutostart(enabled: boolean): Promise<boolean> {
  if (isTauri()) {
    try {
      const res = await invoke<boolean>('set_autostart', { enabled })
      const current = getSettings()
      await saveSettings({ ...current, autoStartOnBoot: enabled })
      return res
    } catch (err) {
      console.warn('Failed to configure autostart via Tauri:', err)
    }
  }
  const current = getSettings()
  await saveSettings({ ...current, autoStartOnBoot: enabled })
  return true
}

export async function getAutostartStatus(): Promise<boolean> {
  if (isTauri()) {
    try {
      return await invoke<boolean>('get_autostart_status')
    } catch {
      // fallback
    }
  }
  return getSettings().autoStartOnBoot ?? false
}

export async function exitKioskApp(): Promise<void> {
  if (isTauri()) {
    await invoke('exit_kiosk_app')
  } else {
    window.close()
  }
}

export async function restartKioskApp(): Promise<void> {
  if (isTauri()) {
    await invoke('restart_kiosk_app')
  } else {
    window.location.reload()
  }
}

export async function rebootSystem(): Promise<void> {
  if (isTauri()) {
    await invoke('reboot_system')
  } else {
    alert('System reboot is only supported when running the native kiosk shell.')
  }
}

