import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: 24, color: '#EF4444', fontFamily: 'monospace' }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>应用出错了</h2>
          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', opacity: 0.8 }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: 12, padding: '6px 16px', cursor: 'pointer' }}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
