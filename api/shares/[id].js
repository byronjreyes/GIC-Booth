import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://xkfnyjlocyaatkpzyhgm.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrZm55amxvY3lhYXRrcHp5aGdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNjQyMzUsImV4cCI6MjEwNjg0MDIzNX0.cMupAFL-6N_B6AajiPNoS25X-QVX40g-XdKQ561aQc8'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { id } = req.query
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid share ID' })
  }

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `share:${id}`)
        .maybeSingle()

      if (error || !data?.value) {
        return res.status(404).json({ error: 'Share not found or expired' })
      }

      return res.status(200).json(data.value)
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Server error' })
    }
  }

  if (req.method === 'POST') {
    try {
      const payload = req.body || {}
      const { data: existingRow } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `share:${id}`)
        .maybeSingle()

      const existing = existingRow?.value || {}
      const meta = {
        ...existing,
        ...payload,
        id,
        updatedAt: new Date().toISOString(),
      }

      await supabase.from('settings').upsert({
        booth_id: 'booth-01',
        key: `share:${id}`,
        value: meta,
      })

      return res.status(200).json(meta)
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
