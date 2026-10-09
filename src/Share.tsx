import { useCallback, useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { getShare, notifyShareScanned, type ShareData } from './shares'

export default function Share() {
  const id = window.location.pathname.split('/')[2] || ''
  const [share, setShare] = useState<ShareData | null>(null)
  const [kind, setKind] = useState<'image' | 'video'>('image')
  const [layout, setLayout] = useState<'single' | 'double'>('single')
  const [error, setError] = useState('')
  const [mediaError, setMediaError] = useState('')
  const openedAt = useRef(Date.now())

  const load = useCallback(async () => {
    try {
      const data = await getShare(id)
      setError('')
      setShare(data)
    } catch (err) {
      if (Date.now() - openedAt.current < 30_000) return
      setError(err instanceof Error ? err.message : 'This strip is unavailable.')
    }
  }, [id])

  useEffect(() => {
    if (id) {
      void notifyShareScanned(id)
    }
    void load()
  }, [id, load])

  useEffect(() => {
    if (share?.video || Date.now() - openedAt.current > 120_000) return
    const timer = window.setInterval(() => void load(), 2000)
    return () => window.clearInterval(timer)
  }, [load, share?.ready, Boolean(share?.video), Boolean(share)])

  if (error) return <main className="share-error"><strong>{error}</strong><button type="button" onClick={() => window.location.reload()}>Try again</button></main>
  if (!share || share.ready === false) {
    const progress = share?.progress ?? 5
    return <main className="share-loading" aria-busy="true" aria-live="polite"><strong>Generating strip...</strong><div className="share-loading-bar" role="progressbar" aria-label="Strip generation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></div><b>{progress}%</b></main>
  }

  const source = kind === 'image' ? share.image[layout] : share.video?.[layout]
  const download = async () => {
    if (!source) return
    const extension = new URL(source, window.location.href).pathname.split('.').pop() || (kind === 'image' ? 'png' : 'mp4')
    const fileName = `gic-booth-${layout}-${kind}.${extension}`
    try {
      const resp = await fetch(source)
      const blob = await resp.blob()
      const blobUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = fileName
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)
    } catch {
      const anchor = document.createElement('a')
      anchor.href = source
      anchor.target = '_blank'
      anchor.download = fileName
      anchor.click()
    }
  }

  return (
    <main className="share-page" aria-labelledby="share-title">
      <h1 id="share-title" className="sr-only">Your KODAKEI photo strip</h1>
      <section className={`share-output ${layout}`} aria-label={`${layout} strip preview`}>
        {kind === 'image'
          ? <img src={source} alt={`${layout} photo strip`} />
          : source && <video key={source} src={source} poster={share.image[layout]} aria-label={`${layout} animated photo strip`} autoPlay muted loop playsInline controls preload="auto" onPlay={() => setMediaError('')} onError={() => setMediaError('This video cannot play in your browser. You can still download it.')} />}
        {mediaError && <p className="share-media-error" role="alert">{mediaError}</p>}
      </section>
      <div className="share-controls" aria-label="Strip options">
        <div className="share-toggle" role="group" aria-label="Download format">
          <button type="button" className={kind === 'image' ? 'active' : ''} aria-pressed={kind === 'image'} onClick={() => { setKind('image'); setMediaError('') }}>Image</button>
          <button type="button" className={kind === 'video' ? 'active' : ''} aria-pressed={kind === 'video'} aria-label={share.video ? 'Video' : 'Video unavailable'} disabled={!share.video} onClick={() => { setKind('video'); setMediaError('') }}>Video</button>
        </div>
        <div className="share-toggle" role="group" aria-label="Strip layout">
          <button type="button" className={layout === 'single' ? 'active' : ''} aria-pressed={layout === 'single'} onClick={() => { setLayout('single'); setMediaError('') }}>Single</button>
          <button type="button" className={layout === 'double' ? 'active' : ''} aria-pressed={layout === 'double'} onClick={() => { setLayout('double'); setMediaError('') }}>Double</button>
        </div>
        <button type="button" className="share-download" disabled={!source} onClick={download}><Download aria-hidden="true" />Download {kind}</button>
      </div>
      {!share.video && <p role="status" style={{ margin: 0, textAlign: 'center' }}>{share.videoError || 'Video was not uploaded'}. Your image is available.</p>}
    </main>
  )
}
