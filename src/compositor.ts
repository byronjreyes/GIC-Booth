export type Layout = {
  id: 'classic-2' | 'classic-3' | 'classic-4' | 'grid-4' | 'wide-4' | 'portrait-4'
  name: string
  requiredPhotos: number
  description?: string
}

export type Theme = {
  id: string
  name: string
  background: string
  accent: string
  category?: string
  frame?: string
  singleTemplate?: string
  doubleTemplate?: string
  layoutId?: Layout['id'] | ''
}

export type StripText = {
  title: string
  showBrand: boolean
  qrCode?: string
}

export type PhotoFilter = 'none' | 'bw' | 'warm' | 'vintage' | 'cool' | 'soft'

export type PlacedSticker = {
  id: string
  emoji: string
  x: number // px 0..600
  y: number // px 0..1800
  size: number
  rotation?: number // in degrees
}

export type DoodlePoint = { x: number; y: number }
export type DoodleStroke = {
  color: string
  size: number
  points: DoodlePoint[]
}

export type CustomizationOptions = {
  filter?: PhotoFilter
  stickers?: PlacedSticker[]
  doodles?: DoodleStroke[]
}

export const WIDTH = 600
export const HEIGHT = 1800
const SIDE = 42
const TOP = 132
const BOTTOM = 170
const GAP = 22

export function getCanvasFilter(filter: PhotoFilter): string {
  switch (filter) {
    case 'bw':
      return 'grayscale(100%) contrast(110%)'
    case 'warm':
      return 'sepia(30%) saturate(135%) contrast(105%) brightness(102%)'
    case 'vintage':
      return 'sepia(50%) contrast(115%) brightness(95%) hue-rotate(-10deg)'
    case 'cool':
      return 'hue-rotate(180deg) saturate(85%) contrast(105%)'
    case 'soft':
      return 'brightness(108%) contrast(92%) saturate(118%)'
    default:
      return 'none'
  }
}

export function getPhotoRegions(layout: Layout): Array<{ x: number; y: number; width: number; height: number }> {
  if (layout.id === 'grid-4') {
    const colW = (WIDTH - SIDE * 2 - GAP) / 2
    const rowH = (HEIGHT - TOP - BOTTOM - GAP) / 2
    return [
      { x: SIDE, y: TOP, width: colW, height: rowH },
      { x: SIDE + colW + GAP, y: TOP, width: colW, height: rowH },
      { x: SIDE, y: TOP + rowH + GAP, width: colW, height: rowH },
      { x: SIDE + colW + GAP, y: TOP + rowH + GAP, width: colW, height: rowH },
    ]
  }

  const count = layout.requiredPhotos
  const photoHeight = (HEIGHT - TOP - BOTTOM - GAP * (count - 1)) / count
  return Array.from({ length: count }, (_, index) => ({
    x: SIDE,
    y: TOP + index * (photoHeight + GAP),
    width: WIDTH - SIDE * 2,
    height: photoHeight,
  }))
}

export function getPhotoAspectRatio(layout: Layout): number {
  if (layout.id === 'grid-4') {
    const colW = (WIDTH - SIDE * 2 - GAP) / 2
    const rowH = (HEIGHT - TOP - BOTTOM - GAP) / 2
    return colW / rowH
  }
  const regions = getPhotoRegions(layout)
  return regions[0].width / regions[0].height
}

export function readableTextColor(background: string) {
  const channels = background.match(/[a-f\d]{2}/gi)?.map(value => parseInt(value, 16) / 255) ?? [1, 1, 1]
  const luminance = channels.map(value => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return .2126 * luminance[0] + .7152 * luminance[1] + .0722 * luminance[2] > .179 ? '#000000' : '#ffffff'
}

function cover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.width, height / image.height)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  ctx.drawImage(image, (image.width - sourceWidth) / 2, (image.height - sourceHeight) / 2, sourceWidth, sourceHeight, x, y, width, height)
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = source
  })
}

function drawPhotos(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  matte: string,
  layout: Layout,
  filter: PhotoFilter = 'none',
  offsetX = 0,
) {
  const regions = getPhotoRegions(layout)
  images.forEach((image, index) => {
    const region = regions[index]
    if (!region) return
    ctx.fillStyle = matte
    ctx.fillRect(offsetX + region.x, region.y, region.width, region.height)

    ctx.save()
    if (filter && filter !== 'none') {
      ctx.filter = getCanvasFilter(filter)
    }
    cover(ctx, image, offsetX + region.x, region.y, region.width, region.height)
    ctx.restore()
  })
}

function drawDecorations(
  ctx: CanvasRenderingContext2D,
  stickers: PlacedSticker[] = [],
  doodles: DoodleStroke[] = [],
  offsetX = 0,
) {
  // 1. Draw freehand doodles
  doodles.forEach(stroke => {
    if (stroke.points.length < 2) return
    ctx.save()
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(offsetX + stroke.points[0].x, stroke.points[0].y)
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(offsetX + stroke.points[i].x, stroke.points[i].y)
    }
    ctx.stroke()
    ctx.restore()
  })

  // 2. Draw placed stickers
  stickers.forEach(s => {
    ctx.save()
    ctx.translate(offsetX + s.x, s.y)
    if (s.rotation) {
      ctx.rotate((s.rotation * Math.PI) / 180)
    }
    ctx.font = `${s.size}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.emoji, 0, 0)
    ctx.restore()
  })
}

function drawText(ctx: CanvasRenderingContext2D, ink: string, text: StripText, offsetX = 0) {
  ctx.fillStyle = ink
  ctx.textAlign = 'center'
  ctx.font = '700 44px Archivo, sans-serif'
  ctx.fillText(text.title.trim(), offsetX + WIDTH / 2, 84, WIDTH - SIDE * 2)
}

async function drawFooter(ctx: CanvasRenderingContext2D, ink: string, text: StripText, offsetX = 0) {
  if (text.qrCode) {
    const qr = await loadImage(text.qrCode)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(offsetX + SIDE, HEIGHT - 150, 92, 92)
    ctx.drawImage(qr, offsetX + SIDE + 4, HEIGHT - 146, 84, 84)
  }
  if (text.showBrand) {
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.font = '700 44px Archivo, sans-serif'
    ctx.fillText('KODAKEI', offsetX + WIDTH / 2, HEIGHT - 92)
  }
}

export async function renderStrip(
  layout: Layout,
  theme: Theme,
  photos: string[],
  text: StripText = { title: 'GIC BOOTH', showBrand: true },
  customization: CustomizationOptions = {},
) {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')!
  const ink = readableTextColor(theme.background)
  if (theme.singleTemplate) ctx.drawImage(await loadImage(theme.singleTemplate), 0, 0, WIDTH, HEIGHT)
  else {
    ctx.fillStyle = theme.background
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  const images = await Promise.all(photos.slice(0, layout.requiredPhotos).map(loadImage))
  drawPhotos(ctx, images, theme.background, layout, customization.filter || 'none')

  // Draw decorations (doodles & stickers)
  if (customization.stickers?.length || customization.doodles?.length) {
    drawDecorations(ctx, customization.stickers, customization.doodles)
  }

  if (theme.frame) {
    const frame = await loadImage(theme.frame)
    ctx.drawImage(frame, 0, 0, WIDTH, HEIGHT)
  }

  if (!theme.frame) {
    if (!theme.singleTemplate) {
      ctx.fillStyle = theme.accent
      ctx.fillRect(0, 0, WIDTH, 26)
      ctx.fillRect(0, HEIGHT - 22, WIDTH, 22)
    }
    drawText(ctx, ink, text)
  }
  await drawFooter(ctx, ink, text)

  return canvas.toDataURL('image/png')
}

export async function renderThemedPrintCanvas(
  layout: Layout,
  theme: Theme,
  photos: string[],
  text: StripText,
  copies: 1 | 2,
  customization: CustomizationOptions = {},
) {
  if (copies === 1 || !theme.doubleTemplate) {
    return renderPrintCanvas(await renderStrip(layout, theme, photos, text, customization), copies)
  }

  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(await loadImage(theme.doubleTemplate), 0, 0, canvas.width, canvas.height)
  const images = await Promise.all(photos.slice(0, layout.requiredPhotos).map(loadImage))
  const ink = readableTextColor(theme.background)

  drawPhotos(ctx, images, theme.background, layout, customization.filter || 'none')
  drawPhotos(ctx, images, theme.background, layout, customization.filter || 'none', WIDTH)

  // Draw decorations (doodles & stickers) on both sides of 4x6 sheet
  if (customization.stickers?.length || customization.doodles?.length) {
    drawDecorations(ctx, customization.stickers, customization.doodles)
    drawDecorations(ctx, customization.stickers, customization.doodles, WIDTH)
  }

  drawText(ctx, ink, text)
  drawText(ctx, ink, text, WIDTH)
  await drawFooter(ctx, ink, text)
  await drawFooter(ctx, ink, text, WIDTH)
  return canvas.toDataURL('image/png')
}

export async function renderPrintCanvas(stripSource: string, copies: 1 | 2) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 1800
  const ctx = canvas.getContext('2d')!
  const strip = await loadImage(stripSource)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const startX = copies === 1 ? 300 : 0
  ctx.drawImage(strip, startX, 0, WIDTH, HEIGHT)
  if (copies === 2) ctx.drawImage(strip, WIDTH, 0, WIDTH, HEIGHT)
  return canvas.toDataURL('image/png')
}

export function makeDemoPhoto(index: number, aspectRatio = 3 / 4) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = Math.round(canvas.width / aspectRatio)
  const ctx = canvas.getContext('2d')!
  const center = canvas.width / 2
  const colors = ['#ef5b49', '#2464c6', '#8b8d91', '#2f8f70', '#cb5aa2', '#724fb5']
  ctx.fillStyle = colors[index % colors.length]
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#f8f7f2'
  ctx.beginPath()
  ctx.arc(center, canvas.height * .3, canvas.height * .14, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(center, canvas.height * .9, canvas.width * .27, canvas.height * .34, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#171717'
  ctx.font = `700 ${Math.round(canvas.height * .055)}px Archivo, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(`SHOT ${index + 1}`, center, canvas.height * .92)
  return canvas.toDataURL('image/jpeg', 0.92)
}

function recordCanvas(canvas: HTMLCanvasElement, mimeType: string, videoBitsPerSecond: number) {
  const chunks: Blob[] = []
  const stream = canvas.captureStream(24)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond })
  const done = new Promise<Blob>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop()
      stream.getTracks().forEach(track => track.stop())
      reject(new Error('Video encoder timed out. Keep the booth page open and try the theme again'))
    }, 20000)
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    recorder.onstop = () => {
      window.clearTimeout(timeout)
      stream.getTracks().forEach(track => track.stop())
      const blob = new Blob(chunks, { type: recorder.mimeType })
      if (blob.size) resolve(blob)
      else reject(new Error('Video encoder returned an empty recording'))
    }
    recorder.onerror = event => {
      window.clearTimeout(timeout)
      stream.getTracks().forEach(track => track.stop())
      reject((event as Event & { error?: DOMException }).error || new Error('Video recording failed'))
    }
  })
  void done.catch(() => {})
  recorder.start(250)
  return { recorder, done }
}

type LiveClip = { blob: Blob | null; mirrored: boolean }

function loadVideo(clip: LiveClip) {
  if (!clip.blob) return Promise.resolve(null)
  return new Promise<{ video: HTMLVideoElement; mirrored: boolean; url: string } | null>((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(clip.blob!)
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.preload = 'auto'
    const timeout = window.setTimeout(() => fail('Captured video could not load within 15 seconds'), 15000)
    const fail = (message: string) => {
      video.pause()
      video.removeAttribute('src')
      URL.revokeObjectURL(url)
      reject(new Error(message))
    }
    video.onloadeddata = () => {
      window.clearTimeout(timeout)
      resolve({ video, mirrored: clip.mirrored, url })
    }
    video.onerror = () => fail('Captured video could not be decoded')
    video.src = url
    video.load()
    void video.play().catch(() => {})
  })
}

function coverVideo(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  mirrored: boolean,
  x: number,
  y: number,
  width: number,
  height: number,
  filter: PhotoFilter = 'none',
) {
  const scale = Math.max(width / video.videoWidth, height / video.videoHeight)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  const sourceX = (video.videoWidth - sourceWidth) / 2
  const sourceY = (video.videoHeight - sourceHeight) / 2
  ctx.save()
  if (filter && filter !== 'none') {
    ctx.filter = getCanvasFilter(filter)
  }
  if (mirrored) {
    ctx.translate(x + width, y)
    ctx.scale(-1, 1)
    ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height)
  } else {
    ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height)
  }
  ctx.restore()
}

function drawLivePhotos(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  clips: Array<Awaited<ReturnType<typeof loadVideo>>>,
  filter: PhotoFilter = 'none',
  offsetX = 0,
) {
  const regions = getPhotoRegions(layout)
  clips.forEach((clip, index) => {
    if (!clip) return
    const region = regions[index]
    if (!region) return
    coverVideo(ctx, clip.video, clip.mirrored, offsetX + region.x, region.y, region.width, region.height, filter)
  })
}

export async function renderLiveStripVideos(
  layout: Layout,
  theme: Theme,
  selectedClips: LiveClip[],
  selectedPhotos: string[],
  text: StripText,
  onProgress?: (progress: number) => void,
  customization: CustomizationOptions = {},
) {
  if (!('MediaRecorder' in window) || !HTMLCanvasElement.prototype.captureStream) return null
  const mimeType = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type))
  if (!mimeType) return null

  const [singleBase, doubleBase, clips, frame] = await Promise.all([
    renderStrip(layout, theme, selectedPhotos, text, customization).then(loadImage),
    renderThemedPrintCanvas(layout, theme, selectedPhotos, text, 2, customization).then(loadImage),
    Promise.all(selectedClips.map(loadVideo)),
    theme.frame ? loadImage(theme.frame) : Promise.resolve(null),
  ])
  if (!clips.some(Boolean)) throw new Error('No captured video is available')
  const singleCanvas = document.createElement('canvas')
  singleCanvas.width = WIDTH
  singleCanvas.height = HEIGHT
  const doubleCanvas = document.createElement('canvas')
  doubleCanvas.width = WIDTH * 2
  doubleCanvas.height = HEIGHT
  const singleContext = singleCanvas.getContext('2d')!
  const doubleContext = doubleCanvas.getContext('2d')!

  const drawSingle = () => {
    singleContext.drawImage(singleBase, 0, 0, WIDTH, HEIGHT)
    drawLivePhotos(singleContext, layout, clips, customization.filter || 'none')
    if (customization.stickers?.length || customization.doodles?.length) {
      drawDecorations(singleContext, customization.stickers, customization.doodles)
    }
    if (frame) singleContext.drawImage(frame, 0, 0, WIDTH, HEIGHT)
  }

  const drawDouble = () => {
    doubleContext.drawImage(doubleBase, 0, 0, WIDTH * 2, HEIGHT)
    drawLivePhotos(doubleContext, layout, clips, customization.filter || 'none')
    drawLivePhotos(doubleContext, layout, clips, customization.filter || 'none', WIDTH)
    if (customization.stickers?.length || customization.doodles?.length) {
      drawDecorations(doubleContext, customization.stickers, customization.doodles)
      drawDecorations(doubleContext, customization.stickers, customization.doodles, WIDTH)
    }
    if (frame) {
      doubleContext.drawImage(frame, 0, 0, WIDTH, HEIGHT)
      doubleContext.drawImage(frame, WIDTH, 0, WIDTH, HEIGHT)
    }
  }

  const encode = async (canvas: HTMLCanvasElement, bitrate: number, drawMotion: () => void, drawFinal: () => void) => {
    clips.forEach(clip => { if (clip) clip.video.currentTime = 0 })
    clips.forEach(clip => { if (clip) void clip.video.play().catch(() => {}) })
    const nextFrame = () => new Promise<void>(resolve => {
      let finished = false
      const finish = () => { if (!finished) { finished = true; resolve() } }
      requestAnimationFrame(finish)
      window.setTimeout(finish, 50)
    })
    drawMotion()
    const recording = recordCanvas(canvas, mimeType, bitrate)
    const startedAt = performance.now()
    while (performance.now() - startedAt < 2800) {
      await nextFrame()
      drawMotion()
    }
    const finalStartedAt = performance.now()
    while (performance.now() - finalStartedAt < 1200) {
      await nextFrame()
      drawFinal()
    }
    recording.recorder.stop()
    return recording.done
  }

  try {
    const single = await encode(singleCanvas, 8_000_000, drawSingle, () => singleContext.drawImage(singleBase, 0, 0, WIDTH, HEIGHT))
    onProgress?.(55)
    const double = await encode(doubleCanvas, 12_000_000, drawDouble, () => doubleContext.drawImage(doubleBase, 0, 0, WIDTH * 2, HEIGHT))
    onProgress?.(85)
    return { single, double, mimeType: single.type }
  } finally {
    clips.forEach(clip => {
      if (clip) {
        clip.video.pause()
        clip.video.removeAttribute('src')
        clip.video.load()
        URL.revokeObjectURL(clip.url)
      }
    })
  }
}
