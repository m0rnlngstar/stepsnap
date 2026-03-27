import { useState, useRef } from 'react'
import type { WalkthroughData, Step, AnnotationType, UploadFn } from '../types'

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
  size: 40,
  zoom: false,
})

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
    <div style={b.root}>
      {/* Title */}
      <div style={b.field}>
        <label style={b.label}>Titre</label>
        <input
          style={b.input}
          value={data.title}
          onChange={e => onChange({ ...data, title: e.target.value })}
          placeholder="Comment créer un utilisateur…"
        />
      </div>

      {/* Slide height */}
      <div style={b.field}>
        <label style={b.label}>Hauteur des diapositives</label>
        <div style={b.segGroup}>
          {([
            { label: 'Compact', value: 320 },
            { label: 'Moyen', value: 480 },
            { label: 'Large', value: 640 },
            { label: 'Plein', value: undefined },
          ] as { label: string; value: number | undefined }[]).map(({ label, value }) => {
            const isActive = value === undefined ? data.maxHeight === undefined : data.maxHeight === value
            return (
              <button
                key={label}
                style={{ ...b.seg, flex: 1, background: isActive ? accentColor : 'transparent', color: isActive ? '#fff' : '#666' }}
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

        return (
          <div key={step.id} style={{ ...b.card, ...(isOpen ? b.cardOpen : {}) }}>
            {/* Row */}
            <div style={b.row} onClick={() => { setOpenId(isOpen ? null : step.id); setPlacing(false) }}>
              <span style={{ ...b.num, background: isOpen ? accentColor : '#1e1e2c', color: isOpen ? '#fff' : '#555' }}>{idx + 1}</span>
              {step.imageUrl && <img src={step.imageUrl} style={b.thumb} alt="" />}
              <span style={b.rowLabel}>{step.caption || 'Sans légende'}</span>
              <div style={b.rowActions} onClick={e => e.stopPropagation()}>
                <button style={b.iconBtn} onClick={() => move(step.id, -1)} disabled={idx === 0}><IconUp /></button>
                <button style={b.iconBtn} onClick={() => move(step.id, 1)} disabled={idx === data.steps.length - 1}><IconDown /></button>
                <button style={{ ...b.iconBtn, color: '#ef4444' }} onClick={() => removeStep(step.id)}><IconX /></button>
              </div>
              <div style={{ ...b.chevron, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <IconDown />
              </div>
            </div>

            {/* Editor panel */}
            {isOpen && (
              <div style={b.panel}>

                {/* Image */}
                {!step.imageUrl ? (
                  <div
                    style={{ ...b.dropZone, borderColor: (compressing === step.id || uploading === step.id) ? accentColor : '#2a2a38' }}
                    onClick={() => !(compressing === step.id || uploading === step.id) && fileRefs.current[step.id]?.click()}
                  >
                    <IconUpload />
                    <span style={b.dropText}>{compressing === step.id ? 'Compression…' : uploading === step.id ? 'Upload…' : 'Uploader un screenshot'}</span>
                    <span style={b.dropHint}>PNG · JPG · WebP</span>
                    <input ref={el => { fileRefs.current[step.id] = el }} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => e.target.files?.[0] && uploadImage(step.id, e.target.files[0])} />
                  </div>
                ) : (
                  <div>
                    <div
                      style={{ ...b.imgWrap, cursor: placing ? 'crosshair' : 'default' }}
                      onClick={e => placeAnnotation(e, step)}
                    >
                      <img src={step.imageUrl} style={b.previewImg} alt="" draggable={false} />

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
                        <div style={b.placingOverlay}>🎯 Cliquez pour placer l'annotation</div>
                      )}
                    </div>
                    <button style={b.changeBtn} onClick={() => { update(step.id, { imageUrl: '', annotation: undefined }); setPlacing(false) }}>
                      Changer l'image
                    </button>
                  </div>
                )}

                {/* Annotation */}
                {step.imageUrl && (
                  <div style={b.section}>
                    <label style={b.label}>Annotation</label>
                    <div style={b.annotRow}>
                      {/* Type */}
                      <div style={b.segGroup}>
                        {(['circle', 'arrow'] as AnnotationType[]).map(t => (
                          <button
                            key={t}
                            style={{
                              ...b.seg,
                              background: (step.annotation?.type ?? 'circle') === t ? accentColor : 'transparent',
                              color: (step.annotation?.type ?? 'circle') === t ? '#fff' : '#666',
                            }}
                            onClick={() => update(step.id, {
                              annotation: { ...(step.annotation ?? defaultAnnotation(accentColor)), type: t },
                            })}
                          >
                            {t === 'circle' ? '⭕ Cercle' : '↑ Flèche'}
                          </button>
                        ))}
                      </div>

                      {/* Color */}
                      <div style={b.colorBox}>
                        <input type="color" style={b.colorInput}
                          value={step.annotation?.color ?? accentColor}
                          onChange={e => update(step.id, {
                            annotation: { ...(step.annotation ?? defaultAnnotation(accentColor)), color: e.target.value },
                          })} />
                      </div>

                      {/* Place button */}
                      <button
                        style={{ ...b.placeBtn, background: placing ? '#fef3c7' : 'transparent', color: placing ? '#92400e' : '#aaa', borderColor: placing ? '#f59e0b' : '#2a2a38' }}
                        onClick={() => setPlacing(p => !p)}
                      >
                        {placing ? '✕' : step.annotation ? '↖ Repo.' : '↖ Placer'}
                      </button>
                    </div>

                    {/* Size */}
                    <div style={b.sizeRow}>
                      <span style={b.sizeLabel}>Taille</span>
                      <input type="range" min={20} max={100} step={2}
                        value={step.annotation?.size ?? 40}
                        style={{ flex: 1, accentColor } as React.CSSProperties}
                        onChange={e => update(step.id, {
                          annotation: { ...(step.annotation ?? defaultAnnotation(accentColor)), size: Number(e.target.value) },
                        })} />
                      <span style={b.sizeVal}>{step.annotation?.size ?? 40}px</span>
                    </div>

                    {/* Toggles */}
                    <div style={b.toggles}>
                      {[
                        { key: 'animated', label: 'Animation' },
                        { key: 'zoom', label: 'Zoom auto' },
                      ].map(({ key, label }) => {
                        const val = step.annotation?.[key as 'animated' | 'zoom'] ?? false
                        const toggleBg = val ? (accentColor + '20') : 'transparent'
                        const toggleBorder = val ? (accentColor + '50') : '#2a2a38'
                        return (
                          <button
                            key={key}
                            style={{ ...b.toggle, background: toggleBg, color: val ? accentColor : '#555', borderColor: toggleBorder }}
                            onClick={() => update(step.id, {
                              annotation: { ...(step.annotation ?? defaultAnnotation(accentColor)), [key]: !val },
                            })}
                          >
                            <div style={{ ...b.toggleDot, background: val ? accentColor : '#333' }} />
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Caption */}
                <div style={b.section}>
                  <label style={b.label}>Légende</label>
                  <input
                    style={b.input}
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
      <button style={{ ...b.addBtn, borderColor: `${accentColor}40`, color: accentColor }} onClick={addStep}>
        <IconPlus /> Ajouter une étape
      </button>
    </div>
  )
}

const b: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'system-ui, sans-serif' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#555' },
  input: {
    padding: '10px 14px', borderRadius: 9, border: '1px solid #2a2a38',
    background: '#0f0f13', color: '#e0e0ec', fontSize: 14, outline: 'none',
    width: '100%', boxSizing: 'border-box',
  },
  /* step card */
  card: {
    border: '1px solid #1e1e2a', borderRadius: 11, overflow: 'hidden',
    background: '#0f0f13', transition: 'border-color .2s',
  },
  cardOpen: { borderColor: '#2e2e45', boxShadow: '0 0 0 1px #2e2e45' },
  row: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', cursor: 'pointer', userSelect: 'none',
  },
  num: {
    width: 22, height: 22, borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, flexShrink: 0, transition: 'all .2s',
  },
  thumb: { width: 38, height: 26, objectFit: 'cover', borderRadius: 5, border: '1px solid #2a2a38', flexShrink: 0 },
  rowLabel: { flex: 1, fontSize: 13, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowActions: { display: 'flex', gap: 2 },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: '5px', borderRadius: 6,
    color: '#555', display: 'flex', alignItems: 'center', transition: 'color .15s',
  },
  chevron: { color: '#444', display: 'flex', alignItems: 'center', transition: 'transform .2s' },
  /* editor panel */
  panel: { padding: '0 14px 16px', display: 'flex', flexDirection: 'column', gap: 16, borderTop: '1px solid #1a1a24' },
  dropZone: {
    marginTop: 14, border: '2px dashed', borderRadius: 10, padding: '28px 16px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    cursor: 'pointer', textAlign: 'center', transition: 'border-color .2s',
  },
  dropText: { fontSize: 14, fontWeight: 600, color: '#bbb' },
  dropHint: { fontSize: 12, color: '#444' },
  imgWrap: { position: 'relative', marginTop: 14, display: 'block' },
  previewImg: { width: '100%', display: 'block', borderRadius: 8, border: '1px solid #1e1e2a', maxHeight: 380, objectFit: 'contain' as const, background: '#000' },
  placingOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(2px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: 14, borderRadius: 8,
  },
  changeBtn: {
    marginTop: 8, padding: '4px 12px', background: 'transparent', border: '1px solid #2a2a38',
    borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#555',
  },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  annotRow: { display: 'flex', alignItems: 'center', gap: 8 },
  segGroup: { display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #2a2a38' },
  seg: { padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all .15s' },
  colorBox: { width: 34, height: 34, borderRadius: 8, overflow: 'hidden', border: '1px solid #2a2a38', flexShrink: 0 },
  colorInput: { width: 42, height: 42, border: 'none', padding: 0, cursor: 'pointer', marginTop: -4, marginLeft: -4 },
  placeBtn: {
    padding: '6px 11px', border: '1px solid', borderRadius: 8,
    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
  },
  sizeRow: { display: 'flex', alignItems: 'center', gap: 10 },
  sizeLabel: { fontSize: 12, color: '#555', minWidth: 40 },
  sizeVal: { fontSize: 12, color: '#555', minWidth: 34, textAlign: 'right' },
  toggles: { display: 'flex', gap: 8 },
  toggle: {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '6px 12px', border: '1px solid', borderRadius: 99,
    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
  },
  toggleDot: { width: 8, height: 8, borderRadius: '50%', transition: 'background .2s' },
  addBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 13, background: 'transparent', border: '2px dashed',
    borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
}
