import { Component, lazy, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { queryClient } from './core/query';
import { request } from './core/api';
import { Welcome } from './features/auth/Welcome';
const Studio = lazy(() =>
  import('./features/studio/Studio').then(({ Studio }) => ({ default: Studio })),
);
import { Logo, Spinner } from './common/ui';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './styles.css';
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="boot-screen">
        <Logo />
        <h1>Let’s try that again.</h1>
        <p>The studio hit an unexpected error.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload studio
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => request('/auth/get-session'),
    staleTime: 60000,
    retry: 1,
  });
  if (session.isLoading)
    return (
      <main className="boot-screen">
        <Logo />
        <Spinner />
      </main>
    );
  if (session.error)
    return (
      <main className="boot-screen">
        <Logo />
        <h1>The studio is taking a moment.</h1>
        <p>{session.error.message}</p>
        <button className="button primary" onClick={() => void session.refetch()}>
          Try again
        </button>
      </main>
    );
  return session.data ? (
    <Suspense
      fallback={
        <main className="boot-screen">
          <Logo />
          <Spinner />
        </main>
      }
    >
      <Studio />
    </Suspense>
  ) : (
    <Welcome />
  );
}
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MotionConfig>
  </ErrorBoundary>,
);
