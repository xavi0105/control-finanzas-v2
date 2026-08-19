import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, message: '' }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Error inesperado' }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page">
          <div className="card">
            <h2>Algo salió mal</h2>
            <p className="muted">{this.state.message}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Recargar la aplicación
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}