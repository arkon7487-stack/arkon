import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  resetKey?: string;
}
interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: '' });
    }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center" dir="rtl">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-50">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger-500">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 className="font-display text-xl font-700 text-slate-900">حدث خطأ غير متوقع</h1>
        <p className="max-w-md text-sm text-slate-500">
          تعذّر تحميل هذه الصفحة. يرجى المحاولة مرة أخرى، وإذا استمرت المشكلة تواصل مع الدعم الفني.
        </p>
        <div className="flex gap-2">
          <button onClick={this.reset} className="btn-primary">
            إعادة المحاولة
          </button>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="btn-secondary"
          >
            العودة للصفحة الرئيسية
          </button>
        </div>
      </div>
    );
  }
}
