import React from 'react';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[GooseUltra] UI crash:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="h-screen w-screen bg-[#050505] text-zinc-100 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full border border-white/10 rounded-3xl bg-black/40 p-6 shadow-2xl">
          <div className="text-sm font-bold tracking-wide text-rose-200 mb-2">UI RECOVERED FROM CRASH</div>
          <div className="text-xl font-display font-bold mb-4">Something crashed in the renderer.</div>
          <pre className="text-xs text-zinc-300 bg-black/50 border border-white/10 rounded-2xl p-4 overflow-auto max-h-64 whitespace-pre-wrap">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors"
            >
              Reload App
            </button>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 bg-white/10 text-zinc-200 font-bold rounded-xl hover:bg-white/15 transition-colors border border-white/10"
            >
              Try Continue
            </button>
          </div>
          <div className="text-[10px] text-zinc-500 mt-4">
            Check DevTools console for the stack trace.
          </div>
        </div>
      </div>
    );
  }
}

