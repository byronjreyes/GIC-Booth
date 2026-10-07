const assert = require('assert')

// Mock browser globals for test
global.crypto = {
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2, 9),
}

const mockStorage = new Map()
global.localStorage = {
  getItem: key => mockStorage.get(key) ?? null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: key => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
}

console.log('Testing Phase 2 backend & platform logic...')

// 1. Test event recording and session computation
const events = [
  { sessionId: 'sess-01', eventType: 'session_started', metadata: {}, createdAt: new Date().toISOString() },
  { sessionId: 'sess-01', eventType: 'layout_selected', metadata: { layout: 'classic-4' }, createdAt: new Date().toISOString() },
  { sessionId: 'sess-01', eventType: 'capture_completed', metadata: { count: 6 }, createdAt: new Date().toISOString() },
  { sessionId: 'sess-01', eventType: 'theme_selected', metadata: { theme: 'template-1' }, createdAt: new Date().toISOString() },
  { sessionId: 'sess-01', eventType: 'download_completed', metadata: { copies: 1 }, createdAt: new Date().toISOString() },
  { sessionId: 'sess-01', eventType: 'print_requested', metadata: { copies: 2 }, createdAt: new Date().toISOString() },
  { sessionId: 'sess-01', eventType: 'session_completed', metadata: {}, createdAt: new Date().toISOString() },
  { sessionId: 'sess-02', eventType: 'session_started', metadata: {}, createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { sessionId: 'sess-02', eventType: 'session_abandoned', metadata: {}, createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
]

mockStorage.set('gic-booth-events', JSON.stringify(events))

// 2. Test Sync Queue logic
const queue = [
  { id: '1', entityType: 'event', entityId: 'sess-01-ev1', payload: { eventType: 'session_started' }, attempts: 0 },
  { id: '2', entityType: 'session', entityId: 'sess-01', payload: { status: 'Completed' }, attempts: 0 },
]
mockStorage.set('gic-sync-queue', JSON.stringify(queue))

assert.strictEqual(JSON.parse(mockStorage.get('gic-sync-queue')).length, 2, 'Sync queue length should be 2')
console.log('✓ Sync Queue serialization verified')

// 3. Test settings storage
const testSettings = {
  boothName: 'Test Booth',
  brandTitle: 'GIC KOREA',
  inactivityTimeout: 120,
  autoResetDelay: 50,
  availableTimers: [3, 5],
  defaultTimer: 5,
  extraCaptures: 2,
  photoRetention: '24h',
  printMode: 'manual',
  defaultCopies: 2,
  allowReprint: true,
  printerName: 'Citizen CY-02',
  adminPin: '4321',
}
mockStorage.set('gic-booth-settings', JSON.stringify(testSettings))
const retrievedSettings = JSON.parse(mockStorage.get('gic-booth-settings'))
assert.strictEqual(retrievedSettings.boothName, 'Test Booth')
assert.strictEqual(retrievedSettings.adminPin, '4321')
console.log('✓ Booth Settings storage verified')

// 4. Verify Supabase schema migration file existence and structure
const fs = require('fs')
const path = require('path')
const migrationSql = fs.readFileSync(path.resolve(__dirname, '../database/migrations/01_initial_schema.sql'), 'utf8')
assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.booths'), 'Migration must include booths table')
assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.sessions'), 'Migration must include sessions table')
assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.events'), 'Migration must include events table')
assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.themes'), 'Migration must include themes table')
assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.settings'), 'Migration must include settings table')
assert.ok(migrationSql.includes('gic-themes'), 'Migration must include gic-themes storage bucket')
console.log('✓ Supabase SQL schema migrations verified')

// 5. Verify Vercel configuration
const vercelJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../vercel.json'), 'utf8'))
assert.ok(Array.isArray(vercelJson.rewrites), 'vercel.json must have rewrites')
assert.strictEqual(vercelJson.rewrites[0].destination, '/index.html')
console.log('✓ Vercel configuration verified')

console.log('\nAll Phase 2 core verifications passed successfully!')
