import { getSupabaseClient, isSupabaseConfigured } from './supabase'
import { listThemes, saveTheme, type StoredTheme } from './platform'

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncStatus {
  state: SyncState
  pendingCount: number
  lastSyncedAt: string | null
  lastError: string | null
}

const SYNC_QUEUE_KEY = 'gic-sync-queue'
const LAST_SYNC_KEY = 'gic-last-synced-at'

export interface SyncQueueItem {
  id: string
  entityType: 'event' | 'session' | 'theme'
  entityId: string
  payload: Record<string, unknown>
  createdAt: string
  attempts: number
}

function getLocalQueue(): SyncQueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) ?? '[]') as SyncQueueItem[]
  } catch {
    return []
  }
}

function setLocalQueue(queue: SyncQueueItem[]) {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))
  notifyListeners()
}

export function queueForSync(entityType: 'event' | 'session' | 'theme', entityId: string, payload: Record<string, unknown>) {
  const queue = getLocalQueue()
  // Avoid exact duplicate in queue
  const exists = queue.some(item => item.entityType === entityType && item.entityId === entityId && JSON.stringify(item.payload) === JSON.stringify(payload))
  if (!exists) {
    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      entityType,
      entityId,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
    })
    setLocalQueue(queue)
  }
}

let syncStatus: SyncStatus = {
  state: navigator.onLine ? 'idle' : 'offline',
  pendingCount: getLocalQueue().length,
  lastSyncedAt: localStorage.getItem(LAST_SYNC_KEY),
  lastError: null,
}

const listeners = new Set<(status: SyncStatus) => void>()

function notifyListeners() {
  syncStatus = {
    ...syncStatus,
    pendingCount: getLocalQueue().length,
  }
  listeners.forEach(cb => cb(syncStatus))
}

export function subscribeSyncStatus(callback: (status: SyncStatus) => void): () => void {
  listeners.add(callback)
  callback(syncStatus)
  return () => listeners.delete(callback)
}

export function getSyncStatus(): SyncStatus {
  return syncStatus
}

export async function runSync(force = false): Promise<boolean> {
  if (!navigator.onLine) {
    syncStatus = { ...syncStatus, state: 'offline', lastError: null }
    notifyListeners()
    return false
  }

  if (!isSupabaseConfigured()) {
    syncStatus = { ...syncStatus, state: 'idle', lastError: null }
    notifyListeners()
    return false
  }

  const client = getSupabaseClient()
  if (!client) return false

  if (syncStatus.state === 'syncing' && !force) return false

  syncStatus = { ...syncStatus, state: 'syncing', lastError: null }
  notifyListeners()

  try {
    const queue = getLocalQueue()
    // 0. Update booth heartbeat
    try {
      await client.from('booths').upsert({
        id: 'booth-01',
        name: 'GIC Booth Main',
        last_seen_at: new Date().toISOString(),
        active: true,
      })
    } catch {
      // Non-blocking heartbeat
    }

    const remainingQueue: SyncQueueItem[] = []

    // 1. Flush queued items to Supabase
    for (const item of queue) {
      try {
        if (item.entityType === 'event') {
          const { error } = await client.from('events').insert({
            booth_id: 'booth-01',
            session_id: item.payload.sessionId,
            event_type: item.payload.eventType,
            metadata: item.payload.metadata ?? {},
            created_at: item.payload.createdAt ?? item.createdAt,
          })
          if (error) throw error
        } else if (item.entityType === 'session') {
          const { error } = await client.from('sessions').upsert({
            id: item.entityId,
            booth_id: 'booth-01',
            started_at: item.payload.startedAt,
            completed_at: item.payload.completedAt,
            layout_id: item.payload.layoutId ?? 'classic-4',
            theme_id: item.payload.themeId,
            capture_count: item.payload.captureCount ?? 0,
            status: item.payload.status ?? 'Active',
            downloaded: Boolean(item.payload.downloaded),
            printed: Boolean(item.payload.printed),
          })
          if (error) throw error
        } else if (item.entityType === 'theme') {
          const { error } = await client.from('themes').upsert({
            id: item.entityId,
            name: item.payload.name,
            category: item.payload.category ?? 'Custom',
            layout_id: item.payload.layoutId ?? 'classic-4',
            frame_url: item.payload.frameDataUrl ?? item.payload.frameUrl,
            active: item.payload.active !== false,
          })
          if (error) throw error
        }
      } catch (itemErr: unknown) {
        console.warn(`Failed to sync ${item.entityType} ${item.entityId}:`, itemErr)
        item.attempts += 1
        if (item.attempts < 5) {
          remainingQueue.push(item)
        }
      }
    }

    setLocalQueue(remainingQueue)

    // 2. Pull remote themes to local cache
    const { data: remoteThemes, error: themeErr } = await client
      .from('themes')
      .select('*')
      .eq('active', true)

    if (!themeErr && Array.isArray(remoteThemes)) {
      const localThemes = await listThemes()
      for (const remote of remoteThemes) {
        const existing = localThemes.find(lt => lt.id === remote.id)
        if (!existing) {
          await saveTheme({
            id: remote.id,
            name: remote.name,
            category: remote.category || 'Custom',
            layoutId: remote.layout_id || 'classic-4',
            frameDataUrl: remote.frame_url || '',
            active: remote.active !== false,
          })
        }
      }
    }

    const now = new Date().toISOString()
    localStorage.setItem(LAST_SYNC_KEY, now)
    syncStatus = {
      state: 'idle',
      pendingCount: remainingQueue.length,
      lastSyncedAt: now,
      lastError: null,
    }
    notifyListeners()
    return true
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    syncStatus = {
      ...syncStatus,
      state: 'error',
      lastError: message,
    }
    notifyListeners()
    return false
  }
}

// Background scheduler for sync
let syncTimer: number | null = null

export function initSyncEngine() {
  window.addEventListener('online', () => {
    syncStatus = { ...syncStatus, state: 'idle' }
    notifyListeners()
    void runSync()
  })

  window.addEventListener('offline', () => {
    syncStatus = { ...syncStatus, state: 'offline' }
    notifyListeners()
  })

  // Periodic sync every 60 seconds
  if (syncTimer) clearInterval(syncTimer)
  syncTimer = window.setInterval(() => {
    if (navigator.onLine && isSupabaseConfigured()) {
      void runSync()
    }
  }, 60000)

  // Initial trigger after short delay
  setTimeout(() => {
    if (navigator.onLine && isSupabaseConfigured()) {
      void runSync()
    }
  }, 2000)
}
