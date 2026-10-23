import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected rendering error occurred.',
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ResumeIQ rendering error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ maxWidth: 720, margin: '64px auto', padding: 24, fontFamily: 'system-ui, sans-serif', color: '#20211d' }}>
          <h1 style={{ fontSize: 28 }}>ResumeIQ could not load</h1>
          <p>The page encountered a rendering error instead of showing a blank screen.</p>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: 16, borderRadius: 8, background: '#f3f3ef' }}>{this.state.message}</pre>
          <p>Open the browser console for details, then refresh the page after fixing the reported issue.</p>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 16px', border: 0, borderRadius: 8, background: '#1d1d1b', color: '#fff', cursor: 'pointer' }}>Reload app</button>
        </main>
      )
    }
    return this.props.children
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root was not found. Check index.html.')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
)
