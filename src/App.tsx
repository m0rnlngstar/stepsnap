import { useState } from 'react'
import { WalkthroughBuilder } from './lib/components/WalkthroughBuilder'
import { WalkthroughViewer } from './lib/components/WalkthroughViewer'
import type { WalkthroughData } from './lib/types'

const ACCENT = '#6366f1'

const INITIAL: WalkthroughData = { title: '', steps: [] }

async function fakeUpload(file: File): Promise<string> {
  return URL.createObjectURL(file)
}

export default function App() {
  const [data, setData] = useState<WalkthroughData>(INITIAL)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')

  return (
    <div style={{
      minHeight: '100vh', background: '#07070b', color: '#e0e0ec',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f5', letterSpacing: '-.01em' }}>StepSnap</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#1a1a28', color: '#555', fontWeight: 600, letterSpacing: '.04em' }}>BETA</span>
          </div>

          {/* Mode toggle */}
          <div style={{ display: 'flex', background: '#0f0f13', border: '1px solid #1e1e2a', borderRadius: 10, padding: 3, gap: 2 }}>
            {(['edit', 'preview'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, transition: 'all .15s',
                background: mode === m ? '#1e1e2e' : 'transparent',
                color: mode === m ? '#e0e0ec' : '#444',
                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,.4)' : 'none',
              }}>
                {m === 'edit' ? 'Éditeur' : 'Aperçu'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {mode === 'edit' ? (
          <WalkthroughBuilder data={data} onChange={setData} onUpload={fakeUpload} accentColor={ACCENT} />
        ) : (
          <WalkthroughViewer data={data} accentColor={ACCENT} />
        )}
      </div>
    </div>
  )
}
