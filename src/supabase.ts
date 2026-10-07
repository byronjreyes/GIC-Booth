import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL_KEY = 'gic-supabase-url'
const SUPABASE_KEY_KEY = 'gic-supabase-anon-key'

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || ''
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || ''
  const storedUrl = (localStorage.getItem(SUPABASE_URL_KEY) || '').trim()
  const storedKey = (localStorage.getItem(SUPABASE_KEY_KEY) || '').trim()

  return {
    url: storedUrl || envUrl,
    anonKey: storedKey || envKey,
  }
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (url.trim()) {
    localStorage.setItem(SUPABASE_URL_KEY, url.trim())
  } else {
    localStorage.removeItem(SUPABASE_URL_KEY)
  }
  if (anonKey.trim()) {
    localStorage.setItem(SUPABASE_KEY_KEY, anonKey.trim())
  } else {
    localStorage.removeItem(SUPABASE_KEY_KEY)
  }
  _cachedClient = null
}

let _cachedClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  if (_cachedClient) return _cachedClient
  const { url, anonKey } = getSupabaseCredentials()
  if (!url || !anonKey) return null

  try {
    _cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
    return _cachedClient
  } catch (error) {
    console.warn('Failed to initialize Supabase client:', error)
    return null
  }
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials()
  return Boolean(url && anonKey)
}

export async function uploadThemeAsset(blob: Blob, fileName: string): Promise<string | null> {
  const client = getSupabaseClient()
  if (!client) return null

  try {
    const cleanFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const { data, error } = await client.storage
      .from('gic-themes')
      .upload(`frames/${cleanFileName}`, blob, {
        contentType: blob.type || 'image/png',
        upsert: true,
      })

    if (error) {
      console.warn('Supabase storage upload error:', error.message)
      return null
    }

    const { data: publicData } = client.storage.from('gic-themes').getPublicUrl(data.path)
    return publicData.publicUrl
  } catch (err) {
    console.warn('Upload error:', err)
    return null
  }
}

export async function testSupabaseConnection(): Promise<{
  success: boolean
  message: string
  details?: {
    sessionsCount: number
    eventsCount: number
    themesCount: number
  }
}> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, message: 'Supabase credentials are not configured.' }
  }

  try {
    const [sessRes, evRes, thRes] = await Promise.all([
      client.from('sessions').select('*', { count: 'exact', head: true }),
      client.from('events').select('*', { count: 'exact', head: true }),
      client.from('themes').select('*', { count: 'exact', head: true }),
    ])

    if (sessRes.error) throw sessRes.error
    if (evRes.error) throw evRes.error
    if (thRes.error) throw thRes.error

    return {
      success: true,
      message: 'Connected to Supabase cloud successfully!',
      details: {
        sessionsCount: sessRes.count ?? 0,
        eventsCount: evRes.count ?? 0,
        themesCount: thRes.count ?? 0,
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Connection failed: ${msg}` }
  }
}

