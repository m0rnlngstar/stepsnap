import type { WalkthroughData, Step, Annotation, AnnotationType, AnnotationEffect } from './types'

// Colors are interpolated into inline styles and CSS gradients; only accept
// plain hex, named colors, or rgb()/hsl() with numeric arguments.
const COLOR_RE = /^(#[0-9a-f]{3,8}|[a-z]{2,25}|(?:rgb|rgba|hsl|hsla)\(\s*[\d.,%\s/-]+\s*\))$/i

const EFFECTS: AnnotationEffect[] = ['pulse', 'ping', 'spotlight', 'glow']

export function sanitizeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && COLOR_RE.test(value.trim()) ? value.trim() : fallback
}

/**
 * Only allow http(s), blob:, data:image/* and relative URLs as image sources.
 * Anything with another scheme (javascript:, data:text/html, …) is dropped.
 */
export function sanitizeImageUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  const url = value.trim()
  if (!url) return ''
  if (/^(https?:|blob:|data:image\/)/i.test(url)) return url
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return ''
  return url // relative URL
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

function sanitizeAnnotation(input: unknown): Annotation | undefined {
  if (typeof input !== 'object' || input === null) return undefined
  const a = input as Record<string, unknown>
  const type: AnnotationType = a.type === 'arrow' ? 'arrow' : 'circle'
  const effect = EFFECTS.includes(a.effect as AnnotationEffect) ? (a.effect as AnnotationEffect) : 'pulse'
  return {
    type,
    x: clamp(a.x, 0, 100, 50),
    y: clamp(a.y, 0, 100, 50),
    color: sanitizeColor(a.color, '#6366f1'),
    animated: a.animated !== false,
    effect,
    size: clamp(a.size, 8, 300, 40),
    zoom: a.zoom === true,
    zoomLevel: a.zoomLevel === undefined ? undefined : clamp(a.zoomLevel, 1, 8, 2.2),
  }
}

function sanitizeStep(input: unknown, index: number): Step | null {
  if (typeof input !== 'object' || input === null) return null
  const s = input as Record<string, unknown>
  return {
    id: typeof s.id === 'string' && s.id ? s.id.slice(0, 64) : `step-${index}`,
    imageUrl: sanitizeImageUrl(s.imageUrl),
    caption: typeof s.caption === 'string' ? s.caption.slice(0, 2000) : undefined,
    annotation: sanitizeAnnotation(s.annotation),
  }
}

/**
 * Validate and normalize walkthrough data coming from an untrusted source
 * (web-component attribute, embed options, stored JSON). Never throws.
 */
export function sanitizeWalkthroughData(input: unknown): WalkthroughData {
  if (typeof input !== 'object' || input === null) return { title: '', steps: [] }
  const d = input as Record<string, unknown>
  const rawSteps = Array.isArray(d.steps) ? d.steps : []
  return {
    title: typeof d.title === 'string' ? d.title.slice(0, 300) : '',
    steps: rawSteps
      .slice(0, 200)
      .map((s, i) => sanitizeStep(s, i))
      .filter((s): s is Step => s !== null),
    maxHeight: d.maxHeight === undefined ? undefined : clamp(d.maxHeight, 120, 4000, 480),
  }
}
