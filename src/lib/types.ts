export type AnnotationType = 'circle' | 'arrow'

export type AnnotationEffect = 'pulse' | 'ping' | 'spotlight' | 'glow'

export interface Annotation {
  type: AnnotationType
  x: number        // % from left
  y: number        // % from top
  color: string
  animated: boolean
  effect?: AnnotationEffect  // animation style when animated (default 'pulse')
  size: number     // px diameter for circle, px height for arrow (default 40)
  zoom: boolean    // whether to auto-zoom on this annotation
  zoomLevel?: number // zoom scale factor when zoom is enabled (default 2.2)
}

export interface Step {
  id: string
  imageUrl: string
  caption?: string
  annotation?: Annotation
}

export interface WalkthroughData {
  title: string
  steps: Step[]
  maxHeight?: number
}

export interface UploadFn {
  (file: File): Promise<string>  // returns the URL of the uploaded image
}
