import { useState, useEffect, useRef } from 'react'
import type { WalkthroughData, Annotation } from '../types'

interface Props {
  data: WalkthroughData
  accentColor?: string
  maxHeight?: number
  maxWidth?: number | string
}

const ZOOM_SCALE = 2.2
const ZOOM_DELAY = 380
const SWIPE_THRESHOLD = 40
// reference display width used to scale annotations into the PDF's native-resolution canvas
const PDF_REF_WIDTH = 800

const ArrowSVG = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: 'block', filter: `drop-shadow(0 2px 8px ${color}99)` }}>
    <path d="M12 2L5 12h4.5v9h5v-9H19L12 2z" />
  </svg>
)
const IconDownload = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const IconExpand = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
  </svg>
)
const IconCompress = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/>
  </svg>
)

function AnnotationOverlay({ ann }: { ann: Annotation }) {
  const sz = ann.size ?? 40
  const effect = ann.animated ? (ann.effect ?? 'pulse') : 'none'
  const markerAnim =
    effect === 'pulse'
      ? (ann.type === 'circle'
          ? 'ssv-bounce .6s cubic-bezier(.36,.07,.19,.97) infinite alternate, ssv-pulse 2s ease-out infinite'
          : 'ssv-bob 1.2s ease-in-out infinite alternate')
      : effect === 'glow'
        ? (ann.type === 'circle' ? 'ssv-glow 1.4s ease-in-out infinite alternate' : 'ssv-glow-arrow 1.4s ease-in-out infinite alternate')
        : 'none'

  return (
    <>
      {effect === 'spotlight' && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(circle at ${ann.x}% ${ann.y}%, transparent ${sz * 1.1}px, rgba(0,0,0,.62) ${sz * 2.2}px)`,
          animation: 'ssv-spot-breathe 2.4s ease-in-out infinite alternate',
        }} />
      )}
      {effect === 'ping' && [0, 1].map(i => (
        <span key={i} style={{
          position: 'absolute', left: `${ann.x}%`, top: `${ann.y}%`,
          width: sz, height: sz, borderRadius: '50%',
          border: `2px solid ${ann.color}`, pointerEvents: 'none',
          transform: 'translate(-50%,-50%)', opacity: 0,
          animation: `ssv-ping 1.6s cubic-bezier(0,0,.2,1) ${i * 0.8}s infinite`,
        }} />
      ))}
      {ann.type === 'circle' ? (
        <div style={{
          position: 'absolute', borderRadius: '50%', border: '3px solid',
          borderColor: ann.color, color: ann.color, width: sz, height: sz,
          left: `${ann.x}%`, top: `${ann.y}%`,
          transform: 'translate(-50%,-50%)', pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: markerAnim,
        }}>
          <div style={{ width: sz * .22, height: sz * .22, borderRadius: '50%', background: ann.color, opacity: .85 }} />
        </div>
      ) : (
        <div style={{
          position: 'absolute', left: `${ann.x}%`, top: `${ann.y}%`, color: ann.color,
          transform: 'translate(-50%,-50%)', pointerEvents: 'none',
          animation: markerAnim,
        }}>
          <ArrowSVG color={ann.color} size={sz} />
        </div>
      )}
    </>
  )
}

function drawAnnotationOnCanvas(ctx: CanvasRenderingContext2D, a: Annotation, imgW: number, imgH: number) {
  const scale = imgW / PDF_REF_WIDTH
  const cx = (a.x / 100) * imgW
  const cy = (a.y / 100) * imgH
  const sz = a.size * scale
  ctx.strokeStyle = a.color
  ctx.fillStyle = a.color
  if (a.type === 'circle') {
    ctx.lineWidth = 3 * scale
    ctx.beginPath()
    ctx.arc(cx, cy, sz / 2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    ctx.arc(cx, cy, sz * 0.11, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  } else {
    // same shape as ArrowSVG (24-unit viewBox), centered on (cx, cy)
    const u = sz / 24
    ctx.save()
    ctx.translate(cx - 12 * u, cy - 12 * u)
    ctx.beginPath()
    ctx.moveTo(12 * u, 2 * u)
    ctx.lineTo(5 * u, 12 * u)
    ctx.lineTo(9.5 * u, 12 * u)
    ctx.lineTo(9.5 * u, 21 * u)
    ctx.lineTo(14.5 * u, 21 * u)
    ctx.lineTo(14.5 * u, 12 * u)
    ctx.lineTo(19 * u, 12 * u)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}

export function WalkthroughViewer({ data, accentColor = '#6366f1', maxHeight, maxWidth }: Props) {
  const resolvedMaxHeight = maxHeight ?? 480
  const [started, setStarted] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const [zoomed, setZoomed] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const navRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const zoomRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchX = useRef<number | null>(null)

  const total = data.steps.length
  const step = data.steps[currentIndex]
  const ann = step?.annotation

  useEffect(() => {
    if (!started) return
    setZoomed(false)
    if (zoomRef.current) clearTimeout(zoomRef.current)
    if (ann?.zoom) zoomRef.current = setTimeout(() => setZoomed(true), ZOOM_DELAY)
    return () => { if (zoomRef.current) clearTimeout(zoomRef.current) }
  }, [currentIndex, started])

  useEffect(() => () => {
    if (navRef.current) clearTimeout(navRef.current)
    if (zoomRef.current) clearTimeout(zoomRef.current)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    if (!started) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        if (currentIndex > 0) navigate('prev')
      } else if (e.key === 'Escape') {
        if (isFullscreen) document.exitFullscreen()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [started, currentIndex, isFullscreen, transitioning])

  // Fullscreen sync
  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  if (!total) return null

  const isFirst = currentIndex === 0
  const isLast = currentIndex === total - 1

  function goTo(index: number) {
    if (transitioning || index === currentIndex || index < 0 || index >= total) return
    setZoomed(false)
    setDirection(index > currentIndex ? 'next' : 'prev')
    setTransitioning(true)
    navRef.current = setTimeout(() => {
      setCurrentIndex(index)
      setTransitioning(false)
    }, 180)
  }

  function navigate(dir: 'next' | 'prev') {
    goTo(currentIndex + (dir === 'next' ? 1 : -1))
  }

  function handleNext() {
    if (isLast) { setStarted(false); setCurrentIndex(0) }
    else navigate('next')
  }

  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0].clientX
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD) return
    if (dx < 0) { if (!isLast) navigate('next') }
    else if (!isFirst) navigate('prev')
  }

  function toggleFullscreen() {
    if (isFullscreen) {
      document.exitFullscreen()
    } else {
      containerRef.current?.requestFullscreen()
    }
  }

  async function exportPDF() {
    setPdfLoading(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const margin = 32

      for (let i = 0; i < data.steps.length; i++) {
        const s = data.steps[i]
        if (i > 0) doc.addPage()
        doc.setFillColor(15, 15, 19)
        doc.rect(0, 0, pageW, pageH, 'F')

        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = reject
          img.src = s.imageUrl
        })

        const captionH = s.caption ? 48 : 0
        const availH = pageH - margin * 2 - captionH
        const availW = pageW - margin * 2
        const ratio = Math.min(availW / img.naturalWidth, availH / img.naturalHeight)
        const imgW = img.naturalWidth * ratio
        const imgH = img.naturalHeight * ratio
        const imgX = margin + (availW - imgW) / 2
        const imgY = margin

        // Render image + annotation at native resolution
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        if (s.annotation) drawAnnotationOnCanvas(ctx, s.annotation, img.naturalWidth, img.naturalHeight)
        const imgData = canvas.toDataURL('image/jpeg', 0.92)
        doc.addImage(imgData, 'JPEG', imgX, imgY, imgW, imgH)

        if (s.caption) {
          doc.setFontSize(12)
          doc.setTextColor(192, 192, 208)
          doc.text(s.caption, margin, imgY + imgH + 22, { maxWidth: availW })
        }

        doc.setFontSize(10)
        doc.setTextColor(80, 80, 100)
        if (data.title) doc.text(data.title, margin, margin - 10)
        doc.text(`${i + 1} / ${data.steps.length}`, pageW - margin, margin - 10, { align: 'right' })
      }

      const filename = (data.title || 'walkthrough').replace(/[\\/:*?"<>|]/g, '').trim() || 'walkthrough'
      doc.save(`${filename}.pdf`)
    } catch (err) {
      console.error('PDF export failed', err)
    } finally {
      setPdfLoading(false)
    }
  }

  const rootStyle: React.CSSProperties = {
    maxWidth: maxWidth ?? '100%',
    ['--ss-accent' as string]: accentColor,
  }

  const frameMaxHeight = isFullscreen ? 'calc(100vh - 220px)' : resolvedMaxHeight
  const slideClass = transitioning
    ? (direction === 'next' ? 'ssv-exit-next' : 'ssv-exit-prev')
    : (direction === 'next' ? 'ssv-enter-next' : 'ssv-enter-prev')
  const zoomScale = ann?.zoomLevel ?? ZOOM_SCALE
  const zoomStyle: React.CSSProperties = ann?.zoom && zoomed
    ? { transform: `scale(${zoomScale})`, transformOrigin: `${ann.x}% ${ann.y}%`, transition: 'transform 0.65s cubic-bezier(0.4,0,0.2,1)' }
    : { transform: 'scale(1)', transformOrigin: `${ann?.x ?? 50}% ${ann?.y ?? 50}%`, transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)' }

  return (
    <div className="ssv-root" style={rootStyle}>
      <style>{CSS}</style>

      {!started ? (
        <div className="ssv-intro">
          <div className="ssv-intro-bar" style={{ background: accentColor }} />
          <div className="ssv-intro-pad" style={{ background: `radial-gradient(120% 100% at 50% 0%, ${accentColor}14, transparent 60%)` }}>
            <span className="ssv-intro-pill" style={{ color: accentColor, borderColor: `${accentColor}40`, background: `${accentColor}10` }}>
              {total} étape{total > 1 ? 's' : ''}
            </span>
            <h2 className="ssv-intro-h">{data.title}</h2>
            <button className="ssv-start" style={{ background: accentColor }} onClick={() => setStarted(true)}>
              Commencer
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className={`ssv-shell${isFullscreen ? ' ssv-fs' : ''}`}>
          {/* Top bar */}
          <div className="ssv-top">
            <div className="ssv-top-left">
              <div className="ssv-dot" style={{ background: accentColor }} />
              <span className="ssv-title">{data.title}</span>
            </div>
            <div className="ssv-top-right">
              <span className="ssv-counter">{currentIndex + 1}<span className="ssv-counter-sep">/</span>{total}</span>
              <button className="ssv-iconbtn" aria-label="Exporter en PDF" title="Export PDF" onClick={exportPDF} disabled={pdfLoading}>
                {pdfLoading ? '…' : <IconDownload />}
              </button>
              <button
                className="ssv-iconbtn"
                aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                onClick={toggleFullscreen}
              >
                {isFullscreen ? <IconCompress /> : <IconExpand />}
              </button>
            </div>
          </div>

          {/* Slide */}
          <div key={currentIndex} className={`ssv-slidearea ${slideClass}`}>
            <div className="ssv-imgwrap" onClick={handleNext} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              <div className="ssv-frame" style={{ maxHeight: frameMaxHeight }}>
                <div style={{ ...zoomStyle, width: '100%', position: 'relative' }}>
                  <img className="ssv-img" src={step.imageUrl} alt={step.caption || `Étape ${currentIndex + 1}`} style={{ maxHeight: frameMaxHeight }} draggable={false} />
                  {ann && <AnnotationOverlay ann={ann} />}
                </div>
              </div>
              <div className="ssv-hint">{isLast ? 'Terminer' : 'Suivant'} →</div>
            </div>

            {/* Caption */}
            {step.caption && (
              <div className="ssv-caption">
                <div className="ssv-caption-line" style={{ background: accentColor }} />
                <span>{step.caption}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="ssv-footer">
            <div className="ssv-dots">
              {data.steps.map((_, i) => (
                <button
                  key={i}
                  className="ssv-dotbtn"
                  aria-label={`Aller à l'étape ${i + 1}`}
                  aria-current={i === currentIndex}
                  style={{ flex: i === currentIndex ? 2 : 1 }}
                  onClick={() => goTo(i)}
                >
                  <span style={{
                    background: i <= currentIndex ? accentColor : undefined,
                    opacity: i === currentIndex ? 1 : i < currentIndex ? .5 : undefined,
                  }} />
                </button>
              ))}
            </div>
            <div className="ssv-nav">
              <button className="ssv-ghost" disabled={isFirst} onClick={() => navigate('prev')}>
                ← Précédent
              </button>
              <button className="ssv-solid" style={{ background: accentColor }} onClick={handleNext}>
                {isLast ? 'Terminer ✓' : 'Suivant →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const CSS = `
.ssv-root{margin:0 auto;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
.ssv-shell{border-radius:16px;overflow:hidden;background:#0f0f13;border:1px solid #1e1e2a}
.ssv-fs{border-radius:0;height:100vh;display:flex;flex-direction:column}
.ssv-fs .ssv-slidearea{flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0}
.ssv-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 16px;border-bottom:1px solid #1a1a24}
.ssv-top-left{display:flex;align-items:center;gap:9px;min-width:0;flex:1}
.ssv-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.ssv-title{font-size:13px;font-weight:600;color:#9090a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ssv-top-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
.ssv-counter{font-size:13px;font-weight:700;color:#f0f0f5;letter-spacing:.02em}
.ssv-counter-sep{color:#3a3a4a;margin:0 3px}
.ssv-iconbtn{background:transparent;border:1px solid #2a2a38;border-radius:7px;color:#888;cursor:pointer;padding:5px 7px;line-height:1;display:flex;align-items:center;justify-content:center;transition:color .15s,border-color .15s,background .15s}
.ssv-iconbtn:hover:not(:disabled){color:#d0d0e0;border-color:#3a3a4e;background:#16161e}
.ssv-iconbtn:disabled{opacity:.5;cursor:default}
.ssv-imgwrap{position:relative;display:block;user-select:none;-webkit-user-select:none;cursor:pointer;touch-action:pan-y}
.ssv-frame{overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center}
.ssv-img{width:100%;display:block;object-fit:contain}
.ssv-hint{position:absolute;bottom:12px;right:12px;background:rgba(0,0,0,.65);backdrop-filter:blur(6px);color:#fff;font-size:12px;font-weight:600;padding:5px 12px;border-radius:8px;pointer-events:none;border:1px solid rgba(255,255,255,.08)}
.ssv-caption{display:flex;align-items:flex-start;gap:12px;padding:14px 18px;background:#13131a;border-top:1px solid #1a1a24;font-size:14px;color:#c0c0d0;line-height:1.6}
.ssv-caption-line{width:3px;flex-shrink:0;border-radius:99px;align-self:stretch;min-height:20px}
.ssv-footer{padding:14px 16px;display:flex;flex-direction:column;gap:8px;border-top:1px solid #1a1a24;background:#0f0f13}
.ssv-dots{display:flex;gap:5px;align-items:center}
.ssv-dotbtn{display:flex;align-items:center;background:none;border:none;padding:5px 0;margin:0;cursor:pointer;transition:flex .35s ease}
.ssv-dotbtn>span{display:block;width:100%;height:4px;border-radius:99px;background:#2a2a35;opacity:.6;transition:background .35s ease,opacity .35s ease}
.ssv-dotbtn:hover>span{opacity:1}
.ssv-nav{display:flex;justify-content:space-between;align-items:center;gap:10px}
.ssv-ghost{padding:8px 16px;background:transparent;border:1px solid #2a2a38;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;color:#888;transition:color .15s,border-color .15s,opacity .15s}
.ssv-ghost:hover:not(:disabled){color:#ccc;border-color:#3a3a4e}
.ssv-ghost:disabled{opacity:.3;cursor:default}
.ssv-solid{padding:8px 20px;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.4);transition:transform .15s,filter .15s}
.ssv-solid:hover{filter:brightness(1.12);transform:translateY(-1px)}
.ssv-solid:active{transform:translateY(0)}
.ssv-intro{position:relative;border-radius:16px;overflow:hidden;background:#0f0f13;border:1px solid #1e1e2a;animation:ssv-fade-up .45s cubic-bezier(.22,.61,.36,1)}
.ssv-intro-bar{height:3px}
.ssv-intro-pad{padding:52px 40px;display:flex;flex-direction:column;align-items:center;gap:18px;text-align:center}
.ssv-intro-pill{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:4px 14px;border-radius:99px;border:1px solid}
.ssv-intro-h{margin:0;font-size:24px;font-weight:700;color:#f0f0f5;line-height:1.3}
.ssv-start{margin-top:8px;display:flex;align-items:center;gap:8px;padding:11px 28px;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:.01em;box-shadow:0 4px 20px rgba(0,0,0,.4);transition:transform .18s,filter .18s,box-shadow .18s}
.ssv-start:hover{transform:translateY(-2px);filter:brightness(1.1);box-shadow:0 8px 28px rgba(0,0,0,.5)}
.ssv-start svg{transition:transform .18s}
.ssv-start:hover svg{transform:translateX(3px)}
.ssv-enter-next{animation:ssv-in-next .3s cubic-bezier(.22,.61,.36,1)}
.ssv-enter-prev{animation:ssv-in-prev .3s cubic-bezier(.22,.61,.36,1)}
.ssv-exit-next{animation:ssv-out-next .18s ease forwards}
.ssv-exit-prev{animation:ssv-out-prev .18s ease forwards}
@keyframes ssv-in-next{from{opacity:0;transform:translateX(20px)}}
@keyframes ssv-in-prev{from{opacity:0;transform:translateX(-20px)}}
@keyframes ssv-out-next{to{opacity:0;transform:translateX(-14px)}}
@keyframes ssv-out-prev{to{opacity:0;transform:translateX(14px)}}
@keyframes ssv-fade-up{from{opacity:0;transform:translateY(10px)}}
@keyframes ssv-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,currentcolor 45%,transparent)}70%{box-shadow:0 0 0 14px transparent}100%{box-shadow:0 0 0 0 transparent}}
@keyframes ssv-bounce{from{transform:translate(-50%,-50%) scale(1)}to{transform:translate(-50%,-50%) scale(1.18)}}
@keyframes ssv-bob{from{transform:translate(-50%,-50%) translateY(0)}to{transform:translate(-50%,-50%) translateY(-7px)}}
@keyframes ssv-ping{0%{transform:translate(-50%,-50%) scale(.5);opacity:.9}80%,100%{transform:translate(-50%,-50%) scale(2.1);opacity:0}}
@keyframes ssv-glow{from{box-shadow:0 0 6px 1px color-mix(in srgb,currentcolor 70%,transparent)}to{box-shadow:0 0 24px 8px color-mix(in srgb,currentcolor 40%,transparent)}}
@keyframes ssv-glow-arrow{from{filter:drop-shadow(0 0 3px currentcolor)}to{filter:drop-shadow(0 0 12px currentcolor)}}
@keyframes ssv-spot-breathe{from{opacity:.88}to{opacity:1}}
@media (max-width:560px){
  .ssv-top{padding:9px 12px}
  .ssv-caption{padding:12px 14px;font-size:13px}
  .ssv-footer{padding:12px}
  .ssv-ghost{padding:8px 12px;font-size:12px}
  .ssv-solid{padding:8px 16px;font-size:12px}
  .ssv-hint{display:none}
  .ssv-intro-pad{padding:36px 20px}
  .ssv-intro-h{font-size:20px}
}
@media (prefers-reduced-motion:reduce){
  .ssv-root,.ssv-root *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
}
`
