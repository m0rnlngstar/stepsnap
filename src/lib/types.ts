export type AnnotationType = 'circle' | 'arrow'

export interface Annotation {
  type: AnnotationType
  x: number        // % from left
  y: number        // % from top
  color: string
  animated: boolean
  size: number     // px diameter for circle, px height for arrow (default 40)
  zoom: boolean    // whether to auto-zoom on this annotation
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
}

export interface UploadFn {
  (file: File): Promise<string>  // returns the URL of the uploaded image
}
