import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

const SHARE_LIFETIME = 14 * 60 * 60 * 1000
const shareRoot = resolve(process.cwd(), '.shares')
const shareIdPattern = /^[a-zA-Z0-9-]{12,80}$/
const assetPattern = /^(single|double)\.(png|webm|mp4)$/

type ShareMetadata = { id: string; createdAt: string; updatedAt: string; expiresAt: string; revision?: string; ready?: boolean; progress?: number; videoError?: string; videoExtension?: 'webm' | 'mp4' }

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(body))
}

function cleanExpiredShares() {
  mkdirSync(shareRoot, { recursive: true })
  for (const id of readdirSync(shareRoot)) {
    const metadataPath = resolve(shareRoot, id, 'metadata.json')
    try {
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as ShareMetadata
      if (Date.parse(metadata.expiresAt) <= Date.now()) rmSync(resolve(shareRoot, id), { recursive: true, force: true })
    } catch {
      rmSync(resolve(shareRoot, id), { recursive: true, force: true })
    }
  }
}

function decodeDataUrl(value: unknown) {
  if (typeof value !== 'string') return null
  const match = value.match(/^data:([^,]+);base64,([\s\S]+)$/)
  return match ? { mime: match[1], data: Buffer.from(match[2], 'base64') } : null
}

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolveBody, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', chunk => {
      size += chunk.length
      if (size > 80 * 1024 * 1024) request.destroy(new Error('Share is too large'))
      else chunks.push(chunk)
    })
    request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

async function shareMiddleware(request: IncomingMessage, response: ServerResponse, next: () => void) {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname
  if (!pathname.startsWith('/api/shares/')) return next()
  cleanExpiredShares()
  const parts = pathname.split('/').filter(Boolean)
  const id = parts[2]
  if (!shareIdPattern.test(id || '')) return json(response, 400, { error: 'Invalid share' })
  const directory = resolve(shareRoot, id)
  const metadataPath = resolve(directory, 'metadata.json')

  if (parts.length === 4 && parts[3] === 'scan') {
    const scanFile = resolve(directory, 'scan.json')
    if (request.method === 'POST') {
      mkdirSync(directory, { recursive: true })
      writeFileSync(scanFile, JSON.stringify({ scannedAt: new Date().toISOString() }))
      return json(response, 200, { ok: true })
    }
    if (request.method === 'GET') {
      return json(response, 200, { scanned: existsSync(scanFile) })
    }
  }

  if (request.method === 'POST' && parts.length === 3) {
    try {
      const payload = JSON.parse(await readBody(request)) as Record<string, unknown>
      mkdirSync(directory, { recursive: true })
      const existing = existsSync(metadataPath) ? JSON.parse(readFileSync(metadataPath, 'utf8')) as ShareMetadata : null
      if (payload.generating !== true && existing?.revision && payload.revision !== existing.revision) return json(response, 409, { error: 'Strip has changed' })
      const createdAt = existing?.createdAt || new Date().toISOString()
      const requestedProgress = typeof payload.progress === 'number' ? Math.max(0, Math.min(100, payload.progress)) : existing?.progress || 0
      const metadata: ShareMetadata = {
        id,
        createdAt,
        updatedAt: new Date().toISOString(),
        revision: typeof payload.revision === 'string' ? payload.revision : existing?.revision,
        expiresAt: existing?.expiresAt || new Date(Date.parse(createdAt) + SHARE_LIFETIME).toISOString(),
        ready: payload.generating === true ? false : payload.ready === true ? true : existing?.ready ?? true,
        progress: payload.generating === true ? requestedProgress : payload.ready === true || existing?.ready === true ? 100 : Math.max(existing?.progress || 0, requestedProgress),
        videoError: payload.generating === true || payload.singleVideo ? undefined : typeof payload.videoError === 'string' ? payload.videoError.slice(0, 300) : existing?.videoError,
        videoExtension: typeof payload.videoMime === 'string' ? (payload.videoMime.split(';')[0] === 'video/mp4' ? 'mp4' : 'webm') : existing?.videoExtension || 'webm',
      }
      if (payload.singleImage || payload.doubleImage) {
        for (const extension of ['mp4', 'webm']) {
          rmSync(resolve(directory, `single.${extension}`), { force: true })
          rmSync(resolve(directory, `double.${extension}`), { force: true })
        }
      }
      for (const [field, filename] of [['singleImage', 'single.png'], ['doubleImage', 'double.png']] as const) {
        const asset = decodeDataUrl(payload[field])
        if (asset?.mime === 'image/png') writeFileSync(resolve(directory, filename), asset.data)
      }
      const videoExtension = metadata.videoExtension || 'webm'
      for (const [field, name] of [['singleVideo', 'single'], ['doubleVideo', 'double']] as const) {
        const asset = decodeDataUrl(payload[field])
        if (asset?.mime.startsWith('video/')) writeFileSync(resolve(directory, `${name}.${videoExtension}`), asset.data)
      }
      writeFileSync(metadataPath, JSON.stringify(metadata))
      return json(response, 200, metadata)
    } catch (error) {
      return json(response, 400, { error: error instanceof Error ? error.message : 'Could not save share' })
    }
  }

  if (!existsSync(metadataPath)) return json(response, 404, { error: 'This strip has expired' })
  const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as ShareMetadata
  if (Date.parse(metadata.expiresAt) <= Date.now()) {
    rmSync(directory, { recursive: true, force: true })
    return json(response, 410, { error: 'This strip has expired' })
  }
  if (request.method === 'GET' && parts.length === 3) {
    if (metadata.ready === false && Date.now() - Date.parse(metadata.updatedAt) > 60_000) {
      metadata.videoError = `Video is still processing. Keep the booth page open until it finishes.`
      metadata.ready = true
      metadata.progress = 100
      metadata.updatedAt = new Date().toISOString()
      writeFileSync(metadataPath, JSON.stringify(metadata))
    }
    const extension = metadata.videoExtension || 'webm'
    const version = encodeURIComponent(metadata.updatedAt || metadata.createdAt)
    return json(response, 200, {
      ...metadata,
      image: { single: `/api/shares/${id}/single.png?v=${version}`, double: `/api/shares/${id}/double.png?v=${version}` },
      video: ['single', 'double'].every(name => existsSync(resolve(directory, `${name}.${extension}`))) ? { single: `/api/shares/${id}/single.${extension}?v=${version}`, double: `/api/shares/${id}/double.${extension}?v=${version}` } : null,
    })
  }
  if (request.method === 'GET' && parts.length === 4 && assetPattern.test(parts[3])) {
    const path = resolve(directory, parts[3])
    if (!existsSync(path)) return json(response, 404, { error: 'Media is not ready' })
    const extension = parts[3].split('.').pop()
    const type = extension === 'png' ? 'image/png' : extension === 'mp4' ? 'video/mp4' : 'video/webm'
    const size = statSync(path).size
    const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' }
    if (request.headers.range) {
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range)
      const start = range?.[1] ? Number(range[1]) : range?.[2] ? Math.max(0, size - Number(range[2])) : 0
      const end = range?.[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
      if (!range || start > end || start >= size) {
        response.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` })
        return response.end()
      }
      response.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${size}` })
      return createReadStream(path, { start, end }).pipe(response)
    }
    response.writeHead(200, { ...headers, 'Content-Length': size })
    return createReadStream(path).pipe(response)
  }
  return json(response, 405, { error: 'Method not allowed' })
}

const sharePlugin = {
  name: 'gic-booth-shares',
  configureServer(server: { middlewares: { use: (handler: typeof shareMiddleware) => void } }) { server.middlewares.use(shareMiddleware) },
  configurePreviewServer(server: { middlewares: { use: (handler: typeof shareMiddleware) => void } }) { server.middlewares.use(shareMiddleware) },
}

export default defineConfig(() => {
  const enableHttps = process.env.HTTPS === 'true' || process.argv.includes('--https')
  return {
    plugins: [
      react(),
      sharePlugin,
      ...(enableHttps ? [basicSsl()] : []),
    ],
    preview: { allowedHosts: ['.trycloudflare.com'] },
  }
})
