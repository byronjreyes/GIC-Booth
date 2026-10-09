import { getSupabaseClient, isSupabaseConfigured } from './supabase'

export type ShareData = {
  id: string
  updatedAt: string
  createdAt?: string
  expiresAt: string
  ready?: boolean
  progress?: number
  revision?: string
  videoError?: string
  image: { single: string; double: string }
  video: { single: string; double: string } | null
}

export type SaveSharePayload = {
  singleImage?: string
  doubleImage?: string
  singleVideo?: string
  doubleVideo?: string
  videoMime?: string
  generating?: boolean
  ready?: boolean
  progress?: number
  revision?: string
  videoError?: string
}

function decodeDataUrl(value: unknown): { mime: string; blob: Blob } | null {
  if (typeof value !== 'string' || !value.startsWith('data:')) return null
  const commaIndex = value.indexOf(',')
  if (commaIndex === -1) return null
  const header = value.slice(5, commaIndex) // e.g. "video/webm;codecs=vp8;base64" or "image/png;base64"
  if (!header.includes(';base64')) return null
  const mime = header.split(';')[0].trim() || 'application/octet-stream'
  const base64Data = value.slice(commaIndex + 1)
  try {
    const binaryString = atob(base64Data)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return { mime, blob: new Blob([bytes], { type: mime }) }
  } catch (err) {
    console.warn('Failed to decode data URL:', err)
    return null
  }
}

export async function saveShare(id: string, payload: SaveSharePayload): Promise<void> {
  let cloudSuccess = false
  let cloudError: Error | null = null

  // 1. If Supabase is configured and online, save directly to Supabase Cloud
  if (isSupabaseConfigured() && (typeof navigator === 'undefined' || navigator.onLine)) {
    const client = getSupabaseClient()
    if (client) {
      try {
        // Fetch existing metadata if any
        const { data: existingRow } = await client
          .from('settings')
          .select('value')
          .eq('key', `share:${id}`)
          .maybeSingle()

        const existing = (existingRow?.value as ShareData | undefined) || null

        let singleImageUrl = existing?.image?.single || ''
        let doubleImageUrl = existing?.image?.double || ''

        // Upload single image if provided
        if (payload.singleImage) {
          const decoded = decodeDataUrl(payload.singleImage)
          if (decoded) {
            const path = `shares/${id}/single.png`
            const { error: upErr } = await client.storage
              .from('gic-themes')
              .upload(path, decoded.blob, { contentType: 'image/png', upsert: true })
            if (!upErr) {
              const { data: pub } = client.storage.from('gic-themes').getPublicUrl(path)
              singleImageUrl = `${pub.publicUrl}?v=${Date.now()}`
            }
          }
        }

        // Upload double image if provided
        if (payload.doubleImage) {
          const decoded = decodeDataUrl(payload.doubleImage)
          if (decoded) {
            const path = `shares/${id}/double.png`
            const { error: upErr } = await client.storage
              .from('gic-themes')
              .upload(path, decoded.blob, { contentType: 'image/png', upsert: true })
            if (!upErr) {
              const { data: pub } = client.storage.from('gic-themes').getPublicUrl(path)
              doubleImageUrl = `${pub.publicUrl}?v=${Date.now()}`
            }
          }
        }

        // Upload video clips if provided
        let singleVideoUrl = existing?.video?.single || ''
        let doubleVideoUrl = existing?.video?.double || ''
        const videoExt = payload.videoMime?.includes('mp4') ? 'mp4' : 'webm'

        if (payload.singleVideo) {
          const decoded = decodeDataUrl(payload.singleVideo)
          if (decoded) {
            const path = `shares/${id}/single.${videoExt}`
            const { error: upErr } = await client.storage
              .from('gic-themes')
              .upload(path, decoded.blob, { contentType: decoded.mime, upsert: true })
            if (!upErr) {
              const { data: pub } = client.storage.from('gic-themes').getPublicUrl(path)
              singleVideoUrl = `${pub.publicUrl}?v=${Date.now()}`
            }
          }
        }

        if (payload.doubleVideo) {
          const decoded = decodeDataUrl(payload.doubleVideo)
          if (decoded) {
            const path = `shares/${id}/double.${videoExt}`
            const { error: upErr } = await client.storage
              .from('gic-themes')
              .upload(path, decoded.blob, { contentType: decoded.mime, upsert: true })
            if (!upErr) {
              const { data: pub } = client.storage.from('gic-themes').getPublicUrl(path)
              doubleVideoUrl = `${pub.publicUrl}?v=${Date.now()}`
            }
          }
        }

        const isReady = payload.ready === true
          ? true
          : payload.generating === true
          ? false
          : existing?.ready ?? true

        const progress = typeof payload.progress === 'number'
          ? Math.max(0, Math.min(100, payload.progress))
          : isReady
          ? 100
          : existing?.progress || 20

        const meta: ShareData = {
          id,
          updatedAt: new Date().toISOString(),
          createdAt: existing?.createdAt || new Date().toISOString(),
          expiresAt: existing?.expiresAt || new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString(),
          revision: typeof payload.revision === 'string' ? payload.revision : existing?.revision,
          ready: isReady,
          progress,
          videoError: payload.generating === true || payload.singleVideo
            ? undefined
            : typeof payload.videoError === 'string'
            ? payload.videoError
            : existing?.videoError,
          image: {
            single: singleImageUrl,
            double: doubleImageUrl,
          },
          video: (singleVideoUrl || doubleVideoUrl)
            ? { single: singleVideoUrl || doubleVideoUrl, double: doubleVideoUrl || singleVideoUrl }
            : existing?.video || null,
        }

        const { error: upsertErr } = await client.from('settings').upsert({
          booth_id: 'booth-01',
          key: `share:${id}`,
          value: meta,
        })

        if (!upsertErr) {
          cloudSuccess = true
        } else {
          cloudError = new Error(upsertErr.message)
        }
      } catch (err) {
        cloudError = err instanceof Error ? err : new Error(String(err))
      }
    }
  }

  // 2. Also save to local Vite dev server if running on localhost / LAN / local mode
  const isLocalHost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.port === '5173'
  )

  let localSuccess = false
  if (isLocalHost || !cloudSuccess) {
    try {
      const response = await fetch(`/api/shares/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (response.ok) {
        localSuccess = true
      }
    } catch {
      // Local dev server might not be running or handling this path
    }
  }

  // If both cloud and local failed, throw error
  if (!cloudSuccess && !localSuccess) {
    throw cloudError || new Error('Could not publish QR strip')
  }
}

export async function getShare(id: string): Promise<ShareData> {
  // 1. Try Supabase Cloud first if configured
  if (isSupabaseConfigured()) {
    const client = getSupabaseClient()
    if (client) {
      try {
        const { data, error } = await client
          .from('settings')
          .select('value')
          .eq('key', `share:${id}`)
          .maybeSingle()

        if (!error && data?.value) {
          return data.value as ShareData
        }
      } catch (err) {
        console.warn('Supabase getShare error, checking local fallback:', err)
      }
    }
  }

  // 2. Fall back to local dev server / API endpoint
  const response = await fetch(`/api/shares/${id}`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(response.status === 410 || response.status === 404 ? 'This strip has expired.' : 'This strip is unavailable.')
  }
  return (await response.json()) as ShareData
}

export async function notifyShareScanned(id: string): Promise<void> {
  if (!id) return

  // Notify Supabase Cloud if configured
  if (isSupabaseConfigured() && (typeof navigator === 'undefined' || navigator.onLine)) {
    const client = getSupabaseClient()
    if (client) {
      try {
        await client.from('settings').upsert({
          booth_id: 'booth-01',
          key: `scan:${id}`,
          value: { id, scannedAt: new Date().toISOString() },
        })
      } catch (err) {
        console.warn('Supabase notifyShareScanned error:', err)
      }
    }
  }

  // Also ping local dev server if available
  try {
    await fetch(`/api/shares/${id}/scan`, { method: 'POST' })
  } catch {}
}

export async function checkShareScanned(id: string): Promise<boolean> {
  if (!id) return false

  // Check Supabase Cloud if configured
  if (isSupabaseConfigured() && (typeof navigator === 'undefined' || navigator.onLine)) {
    const client = getSupabaseClient()
    if (client) {
      try {
        const { data } = await client
          .from('settings')
          .select('key')
          .eq('key', `scan:${id}`)
          .maybeSingle()
        if (data) return true
      } catch {}
    }
  }

  // Check local dev server fallback
  try {
    const res = await fetch(`/api/shares/${id}/scan`, { cache: 'no-store' })
    if (res.ok) {
      const data = (await res.json()) as { scanned?: boolean }
      return Boolean(data?.scanned)
    }
  } catch {}
  return false
}

