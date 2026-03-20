/**
 * StepSnap — standalone embed
 * Usage:
 *   <div id="my-walkthrough"></div>
 *   <script src="stepsnap-embed.js"></script>
 *   <script>
 *     StepSnap.mount('#my-walkthrough', {
 *       accentColor: '#6366f1',
 *       data: {
 *         title: 'Mon guide',
 *         steps: [{ id: '1', imageUrl: '...', caption: '...', annotation: { type: 'circle', x: 50, y: 30, color: '#6366f1', animated: true, size: 40, zoom: true } }]
 *       }
 *     })
 *   </script>
 */
import { createRoot } from 'react-dom/client'
import { WalkthroughViewer } from './lib/components/WalkthroughViewer'
import type { WalkthroughData } from './lib/types'

interface MountOptions {
  data: WalkthroughData
  accentColor?: string
}

const roots = new WeakMap<Element, ReturnType<typeof createRoot>>()

function mount(selector: string | Element, options: MountOptions) {
  const el = typeof selector === 'string'
    ? document.querySelector(selector)
    : selector

  if (!el) {
    console.error('[StepSnap] Element not found:', selector)
    return
  }

  let root = roots.get(el)
  if (!root) {
    root = createRoot(el)
    roots.set(el, root)
  }

  root.render(
    <WalkthroughViewer
      data={options.data}
      accentColor={options.accentColor}
    />
  )
}

function unmount(selector: string | Element) {
  const el = typeof selector === 'string'
    ? document.querySelector(selector)
    : selector
  if (!el) return
  roots.get(el)?.unmount()
  roots.delete(el)
}

declare global {
  interface Window {
    StepSnap: { mount: typeof mount; unmount: typeof unmount }
  }
}

window.StepSnap = { mount, unmount }
