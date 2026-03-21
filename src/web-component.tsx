import { createRoot } from 'react-dom/client'
import { WalkthroughViewer } from './lib/components/WalkthroughViewer'
import type { WalkthroughData } from './lib/types'

class StepSnapViewer extends HTMLElement {
  private root: ReturnType<typeof createRoot> | null = null

  static get observedAttributes() {
    return ['data', 'accent-color']
  }

  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' })
    const container = document.createElement('div')
    shadow.appendChild(container)
    this.root = createRoot(container)
    this.render()
  }

  attributeChangedCallback() {
    this.render()
  }

  disconnectedCallback() {
    this.root?.unmount()
  }

  private render() {
    if (!this.root) return
    const rawData = this.getAttribute('data')
    const accentColor = this.getAttribute('accent-color') ?? '#6366f1'
    let data: WalkthroughData = { title: '', steps: [] }
    try {
      if (rawData) data = JSON.parse(rawData)
    } catch {}
    this.root.render(<WalkthroughViewer data={data} accentColor={accentColor} />)
  }
}

if (!customElements.get('stepsnap-viewer')) {
  customElements.define('stepsnap-viewer', StepSnapViewer)
}
