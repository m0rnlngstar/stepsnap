import { useState, useRef } from 'react'
import type { WalkthroughData, Step, AnnotationType, AnnotationEffect, UploadFn } from '../types'

interface Props {
  data: WalkthroughData
  onChange: (data: WalkthroughData) => void
  onUpload: UploadFn
  accentColor?: string
}

function uid() { return Math.random().toString(36).slice(2, 10) }

async function compressImage(file: File, maxWidth = 1920, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }) : file),
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

const defaultAnnotation = (accentColor: string) => ({
  type: 'circle' as AnnotationType,
  x: 50, y: 50,
  color: accentColor,
  animated: true,
  effect: 'pulse' as AnnotationEffect,
  size: 40,
  zoom: false,
})

const EFFECTS: { key: AnnotationEffect | 'none'; label: string }[] = [
  { key: 'none', label: 'Aucun' },
  { key: 'pulse', label: 'Pulse' },
  { key: 'ping', label: 'Ping' },
  { key: 'spotlight', label: 'Spot' },
  { key: 'glow', label: 'Glow' },
]

const HEIGHT_PRESETS: { label: string; value: number | undefined }[] = [
  { label: 'Compact', value: 320 },
  { label: 'Moyen', value: 480 },
  { label: 'Large', value: 640 },
  { label: 'Plein', value: undefined },
]

const IconUp = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6"/></svg>
const IconDown = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
const IconX = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
const IconPlus = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
const IconUpload = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)
const ArrowPreview = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: 'block' }}>
    <path d="M12 2L5 12h4.5v9h5v-9H19L12 2z" />
  </svg>
)

export function WalkthroughBuilder({ data, onChange, onUpload, accentColor = '#6366f1' }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [compressing, setCompressing] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function update(id: string, patch: Partial<Step>) {
    onChange({ ...data, steps: data.steps.map(s => s.id === id ? { ...s, ...patch } : s) })
  }

  function addStep() {
    const s: Step = { id: uid(), imageUrl: '', caption: '' }
    onChange({ ...data, steps: [...data.steps, s] })
    setOpenId(s.id)
    setPlacing(false)
  }

  function removeStep(id: string) {
    onChange({ ...data, steps: data.steps.filter(s => s.id !== id) })
    if (openId === id) setOpenId(null)
  }

  function move(id: string, dir: -1 | 1) {
    const idx = data.steps.findIndex(s => s.id === id)
    const nx = idx + dir
    if (nx < 0 || nx >= data.steps.length) return
    const steps = [...data.steps];
    [steps[idx], steps[nx]] = [steps[nx], steps[idx]]
    onChange({ ...data, steps })
  }

  async function uploadImage(stepId: string, file: File) {
    setCompressing(stepId)
    const compressed = await compressImage(file)
    setCompressing(null)
    setUploading(stepId)
    try { update(stepId, { imageUrl: await onUpload(compressed) }) }
    finally { setUploading(null) }
  }

  function placeAnnotation(e: React.MouseEvent<HTMLDivElement>, step: Step) {
    if (!placing) return
    const r = e.currentTarget.getBoundingClientRect()
    update(step.id, {
      annotation: {
        ...(step.annotation ?? defaultAnnotation(accentColor)),
        x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10,
        y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10,
      },
    })
    setPlacing(false)
  }

  return (
    <div className="ssb-root" style={{ ['--ss-accent' as string]: accentColor }}>
      <style>{CSS}</style>

      {/* Title */}
      <div className="ssb-field">
        <label className="ssb-label">Titre</label>
        <input
          className="ssb-input"
          value={data.title}
          onChange={e => onChange({ ...data, title: e.target.value })}
          placeholder="Comment créer un utilisateur…"
        />
      </div>

      {/* Slide height */}
      <div className="ssb-field">
        <label className="ssb-label">Hauteur des diapositives</label>
        <div className="ssb-seggroup">
          {HEIGHT_PRESETS.map(({ label, value }) => {
            const isActive = data.maxHeight === value
            return (
              <button
                key={label}
                className="ssb-seg"
                style={{ flex: 1, background: isActive ? accentColor : undefined, color: isActive ? '#fff' : undefined }}
                onClick={() => onChange({ ...data, maxHeight: value })}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Steps */}
      {data.steps.map((step, idx) => {
        const isOpen = openId === step.id
        const sz = step.annotation?.size ?? 40
        const busy = compressing === step.id || uploading === step.id

        return (
          <div key={step.id} className={`ssb-card${isOpen ? ' ssb-card-open' : ''}`}>
            {/* Row */}
            <div className="ssb-row" onClick={() => { setOpenId(isOpen ? null : step.id); setPlacing(false) }}>
              <span className="ssb-num" style={{ background: isOpen ? accentColor : '#1e1e2c', color: isOpen ? '#fff' : '#555' }}>{idx + 1}</span>
              {step.imageUrl && <img src={step.imageUrl} className="ssb-thumb" alt="" />}
              <span className="ssb-rowlabel">{step.caption || 'Sans légende'}</span>
              <div className="ssb-rowactions" onClick={e => e.stopPropagation()}>
                <button className="ssb-iconbtn" aria-label="Monter" onClick={() => move(step.id, -1)} disabled={idx === 0}><IconUp /></button>
                <button className="ssb-iconbtn" aria-label="Descendre" onClick={() => move(step.id, 1)} disabled={idx === data.steps.length - 1}><IconDown /></button>
                <button className="ssb-iconbtn ssb-iconbtn-danger" aria-label="Supprimer" onClick={() => removeStep(step.id)}><IconX /></button>
              </div>
              <div className="ssb-chevron" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <IconDown />
              </div>
            </div>

            {/* Editor panel */}
            {isOpen && (
              <div className="ssb-panel">

                {/* Image */}
                {!step.imageUrl ? (
                  <div
                    className="ssb-drop"
                    style={busy ? { borderColor: accentColor } : undefined}
                    onClick={() => !busy && fileRefs.current[step.id]?.click()}
                  >
                    <IconUpload />
                    <span className="ssb-drop-text">{compressing === step.id ? 'Compression…' : uploading === step.id ? 'Upload…' : 'Uploader un screenshot'}</span>
                    <span className="ssb-drop-hint">PNG · JPG · WebP</span>
                    <input ref={el => { fileRefs.current[step.id] = el }} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => e.target.files?.[0] && uploadImage(step.id, e.target.files[0])} />
                  </div>
                ) : (
                  <div>
                    <div
                      className="ssb-imgwrap"
                      style={{ cursor: placing ? 'crosshair' : 'default' }}
                      onClick={e => placeAnnotation(e, step)}
                    >
                      <img src={step.imageUrl} className="ssb-preview" alt="" draggable={false} />

                      {step.annotation?.animated && step.annotation.effect === 'spotlight' && (
                        <div style={{
                          position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 8,
                          background: `radial-gradient(circle at ${step.annotation.x}% ${step.annotation.y}%, transparent ${sz * 1.1}px, rgba(0,0,0,.62) ${sz * 2.2}px)`,
                        }} />
                      )}

                      {step.annotation && (
                        step.annotation.type === 'circle' ? (
                          <div style={{
                            position: 'absolute', borderRadius: '50%', border: '3px solid',
                            borderColor: step.annotation.color, width: sz, height: sz,
                            left: `${step.annotation.x}%`, top: `${step.annotation.y}%`,
                            transform: 'translate(-50%,-50%)', pointerEvents: 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <div style={{ width: sz * .22, height: sz * .22, borderRadius: '50%', background: step.annotation.color, opacity: .85 }} />
                          </div>
                        ) : (
                          <div style={{ position: 'absolute', left: `${step.annotation.x}%`, top: `${step.annotation.y}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
                            <ArrowPreview color={step.annotation.color} size={sz} />
                          </div>
                        )
                      )}

                      {placing && (
                        <div className="ssb-placing">🎯 Cliquez pour placer l'annotation</div>
                      )}
                    </div>
                    <button className="ssb-change" onClick={() => { update(step.id, { imageUrl: '', annotation: undefined }); setPlacing(false) }}>
                      Changer l'image
                    </button>
                  </div>
                )}

                {/* Annotation */}
                {step.imageUrl && (
                  <div className="ssb-section">
                    <label className="ssb-label">Annotation</label>
                    <div className="ssb-annotrow">
                      {/* Type */}
                      <div className="ssb-seggroup">
                        {(['circle', 'arrow'] as AnnotationType[]).map(t => {
                          const isActive = (step.annotation?.type ?? 'circle') === t
                          return (
                            <button
                              key={t}
                              className="ssb-seg"
                              style={{ background: isActive ? accentColor : undefined, color: isActive ? '#fff' : undefined }}
                              onClick={() => update(step.id, {
                                annotation: { ...(step.annotation ?? defaultAnnotation(accentColor)), type: t },
                              })}
                            >
                              {t === 'circle' ? '⭕ Cercle' : '↑ Flèche'}
                            </button>
                          )
                        })}
                      </div>

                      {/* Color */}
                      <div className="ssb-colorbox">
                        <input type="color" className="ssb-colorinput" aria-label="Couleur de l'annotation"
                          value={step.annotation?.color ?? accentColor}
                          onChange={e => update(step.id, {
                            annotation: { ...(step.annotation ?? defaultAnnotation(accentColor)), color: e.target.value },
                          })} />
                      </div>

                      {/* Place button */}
                      <button
                        className="ssb-place"
                        style={placing ? { background: '#fef3c7', color: '#92400e', borderColor: '#f59e0b' } : undefined}
                        onClick={() => setPlacing(p => !p)}
                      >
                        {placing ? '✕' : step.annotation ? '↖ Repo.' : '↖ Placer'}
                      </button>

                      {/* Remove annotation */}
                      {step.annotation && (
                        <button
                          className="ssb-place ssb-remove-ann"
                          aria-label="Retirer l'annotation"
                          title="Retirer l'annotation"
                          onClick={() => { update(step.id, { annotation: undefined }); setPlacing(false) }}
                        >
                          <IconX />
                        </button>
                      )}
                    </div>

                    {/* Size */}
                    <div className="ssb-sizerow">
                      <span className="ssb-sizelabel">Taille</span>
                      <input type="range" min={20} max={100} step={2}
                        value={step.annotation?.size ?? 40}
                        style={{ flex: 1, accentColor }}
                        onChange={e => update(step.id, {
                          annotation: { ...(step.annotation ?? defaultAnnotation(accentColor)), size: Number(e.target.value) },
                        })} />
                      <span className="ssb-sizeval">{step.annotation?.size ?? 40}px</span>
                    </div>

                    {/* Effect */}
                    <div className="ssb-sizerow">
                      <span className="ssb-sizelabel">Effet</span>
                      <div className="ssb-seggroup" style={{ flex: 1 }}>
                        {EFFECTS.map(({ key, label }) => {
                          const a = step.annotation
                          const current = a ? (a.animated ? (a.effect ?? 'pulse') : 'none') : 'pulse'
                          const isActive = current === key
                          return (
                            <button
                              key={key}
                              className="ssb-seg"
                              style={{ flex: 1, background: isActive ? accentColor : undefined, color: isActive ? '#fff' : undefined }}
                              onClick={() => update(step.id, {
                                annotation: key === 'none'
                                  ? { ...(a ?? defaultAnnotation(accentColor)), animated: false }
                                  : { ...(a ?? defaultAnnotation(accentColor)), animated: true, effect: key },
                              })}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Zoom */}
                    <div className="ssb-toggles">
                      {(() => {
                        const zoomOn = step.annotation?.zoom ?? false
                        const level = step.annotation?.zoomLevel ?? 2.2
                        return (
                          <>
                            <button
                              className="ssb-toggle"
                              style={zoomOn ? { background: `${accentColor}20`, color: accentColor, borderColor: `${accentColor}50` } : undefined}
                              onClick={() => update(step.id, {
                                annotation: { ...(step.annotation ?? defaultAnnotation(accentColor)), zoom: !zoomOn },
                              })}
                            >
                              <div className="ssb-toggle-dot" style={{ background: zoomOn ? accentColor : '#333' }} />
                              Zoom auto
                            </button>
                            {zoomOn && (
                              <div className="ssb-sizerow" style={{ flex: 1, minWidth: 160 }}>
                                <input type="range" min={1.5} max={4} step={0.1}
                                  value={level}
                                  style={{ flex: 1, accentColor }}
                                  onChange={e => update(step.id, {
                                    annotation: { ...(step.annotation ?? defaultAnnotation(accentColor)), zoom: true, zoomLevel: Number(e.target.value) },
                                  })} />
                                <span className="ssb-sizeval">×{level.toFixed(1)}</span>
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}

                {/* Caption */}
                <div className="ssb-section">
                  <label className="ssb-label">Légende</label>
                  <input
                    className="ssb-input"
                    value={step.caption ?? ''}
                    onChange={e => update(step.id, { caption: e.target.value })}
                    placeholder="Cliquez sur l'onglet Paramètres…"
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Add */}
      <button className="ssb-add" style={{ borderColor: `${accentColor}40`, color: accentColor }} onClick={addStep}>
        <IconPlus /> Ajouter une étape
      </button>
    </div>
  )
}

const CSS = `
.ssb-root{display:flex;flex-direction:column;gap:10px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
.ssb-field{display:flex;flex-direction:column;gap:6px}
.ssb-label{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#555}
.ssb-input{padding:10px 14px;border-radius:9px;border:1px solid #2a2a38;background:#0f0f13;color:#e0e0ec;font-size:14px;outline:none;width:100%;box-sizing:border-box;transition:border-color .15s,box-shadow .15s}
.ssb-input:focus{border-color:var(--ss-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--ss-accent) 18%,transparent)}
.ssb-input::placeholder{color:#4a4a5a}
.ssb-card{border:1px solid #1e1e2a;border-radius:11px;overflow:hidden;background:#0f0f13;transition:border-color .2s,box-shadow .2s}
.ssb-card-open{border-color:#2e2e45;box-shadow:0 0 0 1px #2e2e45}
.ssb-row{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;user-select:none;-webkit-user-select:none}
.ssb-row:hover .ssb-rowlabel{color:#aaa}
.ssb-num{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;transition:all .2s}
.ssb-thumb{width:38px;height:26px;object-fit:cover;border-radius:5px;border:1px solid #2a2a38;flex-shrink:0}
.ssb-rowlabel{flex:1;min-width:0;font-size:13px;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:color .15s}
.ssb-rowactions{display:flex;gap:2px;flex-shrink:0}
.ssb-iconbtn{background:none;border:none;cursor:pointer;padding:5px;border-radius:6px;color:#555;display:flex;align-items:center;transition:color .15s,background .15s}
.ssb-iconbtn:hover:not(:disabled){color:#ccc;background:#1a1a26}
.ssb-iconbtn:disabled{opacity:.35;cursor:default}
.ssb-iconbtn-danger:hover:not(:disabled){color:#ef4444;background:rgba(239,68,68,.1)}
.ssb-chevron{color:#444;display:flex;align-items:center;transition:transform .2s;flex-shrink:0}
.ssb-panel{padding:0 14px 16px;display:flex;flex-direction:column;gap:16px;border-top:1px solid #1a1a24;animation:ssb-panel-in .25s cubic-bezier(.22,.61,.36,1)}
.ssb-drop{margin-top:14px;border:2px dashed #2a2a38;border-radius:10px;padding:28px 16px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;text-align:center;transition:border-color .2s,background .2s}
.ssb-drop:hover{border-color:var(--ss-accent);background:color-mix(in srgb,var(--ss-accent) 5%,transparent)}
.ssb-drop-text{font-size:14px;font-weight:600;color:#bbb}
.ssb-drop-hint{font-size:12px;color:#444}
.ssb-imgwrap{position:relative;margin-top:14px;display:block}
.ssb-preview{width:100%;display:block;border-radius:8px;border:1px solid #1e1e2a;max-height:380px;object-fit:contain;background:#000}
.ssb-placing{position:absolute;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;border-radius:8px}
.ssb-change{margin-top:8px;padding:5px 12px;background:transparent;border:1px solid #2a2a38;border-radius:6px;font-size:12px;cursor:pointer;color:#666;transition:color .15s,border-color .15s}
.ssb-change:hover{color:#bbb;border-color:#3a3a4e}
.ssb-section{display:flex;flex-direction:column;gap:10px}
.ssb-annotrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ssb-seggroup{display:flex;border-radius:8px;overflow:hidden;border:1px solid #2a2a38}
.ssb-seg{padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;border:none;transition:all .15s;background:transparent;color:#666}
.ssb-seg:hover{color:#aaa}
.ssb-colorbox{width:34px;height:34px;border-radius:8px;overflow:hidden;border:1px solid #2a2a38;flex-shrink:0;transition:border-color .15s}
.ssb-colorbox:hover{border-color:#3a3a4e}
.ssb-colorinput{width:42px;height:42px;border:none;padding:0;cursor:pointer;margin:-4px 0 0 -4px}
.ssb-place{padding:6px 11px;border:1px solid #2a2a38;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap;background:transparent;color:#aaa}
.ssb-place:hover{border-color:#3a3a4e;color:#ddd}
.ssb-remove-ann{display:flex;align-items:center;color:#666}
.ssb-remove-ann:hover{color:#ef4444;border-color:rgba(239,68,68,.5);background:rgba(239,68,68,.08)}
.ssb-sizerow{display:flex;align-items:center;gap:10px}
.ssb-sizelabel{font-size:12px;color:#555;min-width:40px}
.ssb-sizeval{font-size:12px;color:#555;min-width:34px;text-align:right}
.ssb-toggles{display:flex;gap:8px;flex-wrap:wrap}
.ssb-toggle{display:flex;align-items:center;gap:7px;padding:6px 12px;border:1px solid #2a2a38;border-radius:99px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;background:transparent;color:#555}
.ssb-toggle:hover{border-color:#3a3a4e}
.ssb-toggle-dot{width:8px;height:8px;border-radius:50%;transition:background .2s}
.ssb-add{display:flex;align-items:center;justify-content:center;gap:8px;padding:13px;background:transparent;border:2px dashed;border-radius:11px;font-size:14px;font-weight:700;cursor:pointer;transition:background .2s}
.ssb-add:hover{background:color-mix(in srgb,var(--ss-accent) 7%,transparent)}
@keyframes ssb-panel-in{from{opacity:0;transform:translateY(-4px)}}
@media (max-width:560px){
  .ssb-row{padding:9px 10px;gap:8px}
  .ssb-panel{padding:0 10px 14px}
  .ssb-drop{padding:22px 12px}
}
@media (prefers-reduced-motion:reduce){
  .ssb-root,.ssb-root *{animation-duration:.01ms!important;transition-duration:.01ms!important}
}
`
