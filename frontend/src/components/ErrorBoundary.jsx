import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-100 dark:bg-red-900/30 text-red-900 min-h-screen">
          <h1 className="text-2xl font-bold">Crash en la UI</h1>
          <pre className="mt-4 p-4 bg-white dark:bg-slate-800 border border-red-300 overflow-auto text-xs">
            {this.state.error && this.state.error.toString()}
          </pre>
          <pre className="mt-4 p-4 bg-white dark:bg-slate-800 border border-red-300 overflow-auto text-xs">
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
