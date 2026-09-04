import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, message: '' }
  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || 'Hitilafu isiyojulikana' }
  }
  render() {
    if (this.state.hasError) return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-white mb-2">Kitu kimevunjika</h2>
          <p className="text-slate-500 text-sm mb-6">{this.state.message}</p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}
            className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold text-sm hover:bg-blue-500 transition">
            🏠 Rudi Nyumbani
          </button>
        </div>
      </div>
    )
    return this.props.children
  }
}
