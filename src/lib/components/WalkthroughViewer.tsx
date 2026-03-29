import { useState, useEffect, useRef } from 'react'
import type { WalkthroughData } from '../types'

interface Props {
  data: WalkthroughData
  accentColor?: string
  maxHeight?: number
  maxWidth?: number | string
}

const ArrowSVG = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: 'block', filter: `drop-shadow(0 2px 8px ${color}99)` }}>
    <path d="M12 2L5 12h4.5v9h5v-9H19L12 2z" />
  </svg>
)

const ZOOM_SCALE = 2.2
const ZOOM_DELAY = 380

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

  function navigate(dir: 'next' | 'prev') {
    if (transitioning) return
    setZoomed(false)
    setDirection(dir)
    setTransitioning(true)
    navRef.current = setTimeout(() => {
      setCurrentIndex(i => dir === 'next' ? Math.min(i + 1, total - 1) : Math.max(i - 1, 0))
      setTransitioning(false)
    }, 200)
  }

  function handleNext() {
    if (isLast) { setStarted(false); setCurrentIndex(0) }
    else navigate('next')
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
      const [{ default: jsPDF }] = await Promise.all([
        import('jspdf'),
      ])
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const margin = 32

      for (let i = 0; i < data.steps.length; i++) {
        const s = data.steps[i]
        // Draw slide number header
        if (i > 0) doc.addPage()
        doc.setFillColor(15, 15, 19)
        doc.rect(0, 0, pageW, pageH, 'F')

        // Load image
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = reject
          img.src = s.imageUrl
        })

        // Draw image
        const captionH = s.caption ? 48 : 0
        const availH = pageH - margin * 2 - captionH
        const availW = pageW - margin * 2
        const ratio = Math.min(availW / img.naturalWidth, availH / img.naturalHeight)
        const imgW = img.naturalWidth * ratio
        const imgH = img.naturalHeight * ratio
        const imgX = margin + (availW - imgW) / 2
        const imgY = margin

        // Use canvas to get image data
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const imgData = canvas.toDataURL('image/jpeg', 0.92)
        doc.addImage(imgData, 'JPEG', imgX, imgY, imgW, imgH)

        // Caption
        if (s.caption) {
          doc.setFontSize(12)
          doc.setTextColor(192, 192, 208)
          doc.text(s.caption, margin, imgY + imgH + 22, { maxWidth: availW })
        }

        // Slide counter
        doc.setFontSize(10)
        doc.setTextColor(80, 80, 100)
        doc.text(`${i + 1} / ${data.steps.length}`, pageW - margin, margin - 10, { align: 'right' })
      }

      doc.save('walkthrough.pdf')
    } catch (err) {
      console.error('PDF export failed', err)
    } finally {
      setPdfLoading(false)
    }
  }

  const maxWidthStyle: React.CSSProperties = {
    maxWidth: maxWidth ? (typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth) : '100%',
    margin: '0 auto',
  }

  if (!started) {
    return (
      <div style={maxWidthStyle}>
        <div style={v.intro}>
          <div style={{ ...v.introBar, background: accentColor }} />
          <div style={v.introPad}>
            <span style={{ ...v.introPill, color: accentColor, borderColor: `${accentColor}40`, background: `${accentColor}10` }}>
              {total} étape{total > 1 ? 's' : ''}
            </span>
            <h2 style={v.introH}>{data.title}</h2>
            <button style={{ ...v.introBtn, background: accentColor }} onClick={() => setStarted(true)}>
              Commencer
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  const sz = ann?.size ?? 40
  const slideAnim: React.CSSProperties = {
    opacity: transitioning ? 0 : 1,
    transform: transitioning ? `translateX(${direction === 'next' ? '-16px' : '16px'})` : 'translateX(0)',
    transition: transitioning ? 'none' : 'opacity 0.2s ease, transform 0.2s ease',
  }
  const zoomAnim: React.CSSProperties = ann?.zoom && zoomed
    ? { transform: `scale(${ZOOM_SCALE})`, transformOrigin: `${ann.x}% ${ann.y}%`, transition: 'transform 0.65s cubic-bezier(0.4,0,0.2,1)' }
    : { transform: 'scale(1)', transformOrigin: `${ann?.x ?? 50}% ${ann?.y ?? 50}%`, transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)' }

  return (
    <div style={maxWidthStyle}>
    <div ref={containerRef} style={{ ...v.shell, ...(isFullscreen ? v.shellFullscreen : {}) }}>
      {/* Top bar */}
      <div style={v.topBar}>
        <div style={v.topLeft}>
          <div style={{ ...v.dot, background: accentColor }} />
          <span style={v.topTitle}>{data.title}</span>
        </div>
        <div style={v.topRight}>
          <span style={v.counter}>{currentIndex + 1}<span style={v.counterSep}>/</span>{total}</span>
          <button
            style={v.iconBtn}
            title="Export PDF"
            onClick={exportPDF}
            disabled={pdfLoading}
          >
            {pdfLoading ? '…' : '⬇'}
          </button>
          <button
            style={v.iconBtn}
            title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? '⊡' : '⛶'}
          </button>
        </div>
      </div>

      {/* Image */}
      <div style={slideAnim}>
        <div style={{ ...v.imgWrap, cursor: 'pointer' }} onClick={handleNext}>
          <div style={{ overflow: 'hidden', maxHeight: resolvedMaxHeight, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ ...zoomAnim, width: '100%' }}>
              <img src={step.imageUrl} alt="" style={{ ...v.img, maxHeight: resolvedMaxHeight, objectFit: 'contain' }} draggable={false} />
              {ann && (
                ann.type === 'circle' ? (
                  <div style={{
                    position: 'absolute', borderRadius: '50%', border: '3px solid',
                    borderColor: ann.color, width: sz, height: sz,
                    left: `${ann.x}%`, top: `${ann.y}%`,
                    transform: 'translate(-50%,-50%)', pointerEvents: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: ann.animated
                      ? `vss-bounce .6s cubic-bezier(.36,.07,.19,.97) infinite alternate, vss-pulse 2s ease-out infinite`
                      : 'none',
                  }}>
                    <div style={{ width: sz * .22, height: sz * .22, borderRadius: '50%', background: ann.color, opacity: .85 }} />
                  </div>
                ) : (
                  <div style={{
                    position: 'absolute', left: `${ann.x}%`, top: `${ann.y}%`,
                    transform: 'translate(-50%,-50%)', pointerEvents: 'none',
                    animation: ann.animated ? 'vss-bob 1.2s ease-in-out infinite alternate' : 'none',
                  }}>
                    <ArrowSVG color={ann.color} size={sz} />
                  </div>
                )
              )}
            </div>
          </div>
          <div style={v.hint}>{isLast ? 'Terminer' : 'Suivant'} →</div>
        </div>

        {/* Caption */}
        {step.caption && (
          <div style={v.caption}>
            <div style={{ ...v.captionLine, background: accentColor }} />
            <span>{step.caption}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={v.footer}>
        <div style={v.pills}>
          {data.steps.map((_, i) => (
            <div key={i} style={{
              height: 4, flex: i === currentIndex ? 2 : 1,
              borderRadius: 99, transition: 'all .35s ease',
              background: i < currentIndex ? accentColor : i === currentIndex ? accentColor : '#2a2a35',
              opacity: i === currentIndex ? 1 : i < currentIndex ? .5 : .25,
            }} />
          ))}
        </div>
        <div style={v.navRow}>
          <button style={{ ...v.navGhost, opacity: isFirst ? .3 : 1 }} disabled={isFirst} onClick={() => navigate('prev')}>
            ← Précédent
          </button>
          <button style={{ ...v.navSolid, background: accentColor }} onClick={handleNext}>
            {isLast ? 'Terminer ✓' : 'Suivant →'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes vss-pulse {
          0%   { box-shadow: 0 0 0 0 ${accentColor}55; }
          70%  { box-shadow: 0 0 0 14px ${accentColor}00; }
          100% { box-shadow: 0 0 0 0 ${accentColor}00; }
        }
        @keyframes vss-bounce {
          from { transform: translate(-50%,-50%) scale(1); }
          to   { transform: translate(-50%,-50%) scale(1.18); }
        }
        @keyframes vss-bob {
          from { transform: translate(-50%,-50%) translateY(0); }
          to   { transform: translate(-50%,-50%) translateY(-7px); }
        }
      `}</style>
    </div>
    </div>
  )
}

const v: Record<string, React.CSSProperties> = {
  /* intro */
  intro: { borderRadius: 16, overflow: 'hidden', background: '#0f0f13', border: '1px solid #1e1e2a' },
  introBar: { height: 3 },
  introPad: { padding: '52px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center' },
  introPill: { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '4px 14px', borderRadius: 99, border: '1px solid' },
  introH: { margin: 0, fontSize: 24, fontWeight: 700, color: '#f0f0f5', lineHeight: 1.3 },
  introBtn: {
    marginTop: 8, display: 'flex', alignItems: 'center', gap: 8,
    padding: '11px 28px', color: '#fff', border: 'none', borderRadius: 10,
    fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: '.01em',
    boxShadow: '0 4px 20px rgba(0,0,0,.4)',
  },
  /* viewer shell */
  shell: { borderRadius: 16, overflow: 'hidden', background: '#0f0f13', border: '1px solid #1e1e2a' },
  shellFullscreen: { borderRadius: 0, height: '100vh', display: 'flex', flexDirection: 'column' },
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '11px 16px', borderBottom: '1px solid #1a1a24',
  },
  topLeft: { display: 'flex', alignItems: 'center', gap: 9 },
  topRight: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  topTitle: { fontSize: 13, fontWeight: 600, color: '#9090a8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 },
  counter: { fontSize: 13, fontWeight: 700, color: '#f0f0f5', letterSpacing: '.02em' },
  counterSep: { color: '#3a3a4a', margin: '0 3px' },
  iconBtn: {
    background: 'transparent', border: '1px solid #2a2a38', borderRadius: 6,
    color: '#888', fontSize: 13, cursor: 'pointer', padding: '3px 7px',
    lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  /* image */
  imgWrap: { position: 'relative', display: 'block', userSelect: 'none' },
  img: { width: '100%', display: 'block' },
  hint: {
    position: 'absolute', bottom: 12, right: 12,
    background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(6px)',
    color: '#fff', fontSize: 12, fontWeight: 600,
    padding: '5px 12px', borderRadius: 8, pointerEvents: 'none',
    border: '1px solid rgba(255,255,255,.08)',
  },
  /* caption */
  caption: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '14px 18px', background: '#13131a', borderTop: '1px solid #1a1a24',
    fontSize: 14, color: '#c0c0d0', lineHeight: 1.6,
  },
  captionLine: { width: 3, flexShrink: 0, borderRadius: 99, alignSelf: 'stretch', minHeight: 20 },
  /* footer */
  footer: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid #1a1a24', background: '#0f0f13' },
  pills: { display: 'flex', gap: 5, alignItems: 'center' },
  navRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  navGhost: {
    padding: '8px 16px', background: 'transparent', border: '1px solid #2a2a38',
    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#888',
  },
  navSolid: {
    padding: '8px 20px', color: '#fff', border: 'none', borderRadius: 8,
    fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,.4)',
  },
}
