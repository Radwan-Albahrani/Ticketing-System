import { ThemeMenu } from '../theme/ThemeMenu';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Inbox,
  LogOut,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
  CircleAlert,
  Clock3,
} from 'lucide-react';
import { useStudio } from './studio.store';
import { useTickets, useLoadSamples } from '../tickets/tickets.queries';
import { Inspector } from '../tickets/Inspector';
import { Composer } from '../tickets/Composer';
import { Guide } from './Guide';
import { Category, Priority, Status, Logo, Spinner } from '../../common/ui';
import { post } from '../../core/api';
import { queryClient } from '../../core/query';
export function Studio() {
  const state = useStudio();
  const { notice, notify } = state;
  const query = useTickets();
  const load = useLoadSamples();
  const counts = query.data?.counts ?? { total: 0, classified: 0, pending: 0, failed: 0 };
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => notify(null), 6500);
      return () => clearTimeout(timer);
    }
  }, [notice, notify]);
  return (
    <div className={`app-shell ${state.selectedId ? 'has-selection' : ''}`}>
      <aside className="sidebar">
        <Logo />
        <div className="workspace-switch">
          <span className="workspace-avatar">L</span>
          <div>
            <strong>Loura workspace</strong>
            <span>Demo environment</span>
          </div>
          <ChevronDown size={13} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          <button
            className={!state.status ? 'active' : ''}
            onClick={() => state.filter('status', '')}
          >
            <Inbox size={17} />
            All tickets<span>{counts.total}</span>
          </button>
          <button
            className={state.status === 'pending' ? 'active' : ''}
            onClick={() => state.filter('status', 'pending')}
          >
            <Activity size={17} />
            Processing
            {counts.pending > 0 && <span className="pending-count">{counts.pending}</span>}
          </button>
          <button
            className={state.status === 'failed' ? 'active' : ''}
            onClick={() => state.filter('status', 'failed')}
          >
            <CircleAlert size={17} />
            Needs review{counts.failed > 0 && <span>{counts.failed}</span>}
          </button>
          <button
            className={state.status === 'classified' ? 'active' : ''}
            onClick={() => state.filter('status', 'classified')}
          >
            <CheckCheck size={17} />
            Classified
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="jev-card">
            <span className="jev-spark">
              <Sparkles size={16} />
            </span>
            <div>
              <strong>Jev is on your team.</strong>
              <p>
                A local classifier.
                <br />A transparent workflow.
              </p>
              <button onClick={() => state.guide(true)}>
                How it works <ArrowUpRight size={12} />
              </button>
            </div>
            <span className="live-dot" />
          </div>
          <button className="help-button" onClick={() => state.guide(true)}>
            <CircleHelp size={16} />
            Explore the workflow
            <ArrowUpRight size={13} />
          </button>
          <div className="profile">
            <span className="profile-avatar">AM</span>
            <div>
              <strong>Alex Morgan</strong>
              <span>Demo account</span>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={() => {
                void post('/auth/sign-out', {})
                  .then(() => {
                    queryClient.clear();
                    location.reload();
                  })
                  .catch((error: Error) => state.notify(error.message));
              }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>Classification studio</strong>
          </div>
          <div className="topbar-right">
            <ThemeMenu />
            <span className="local-badge">
              <span className="live-dot" /> Local demo
            </span>
            <button
              className="icon-button"
              aria-label="About this demo"
              onClick={() => state.guide(true)}
            >
              <Bell size={17} />
            </button>
          </div>
        </header>
        <main className="studio-main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">LESS SORTING. MORE SUPPORT.</div>
              <h1>
                Your inbox, with clarity<span>.</span>
              </h1>
              <p>From incoming questions to the right next step. See it all happen.</p>
            </div>
            <button
              id="new-ticket-trigger"
              className="button primary"
              onClick={() => state.compose(true)}
            >
              <Plus size={16} />
              New ticket
            </button>
          </div>
          <section className="hero">
            <div>
              <span className="hero-label">
                <Sparkles size={13} /> A LITTLE INTELLIGENCE GOES A LONG WAY
              </span>
              <h2>
                Good support starts
                <br />
                with understanding.
              </h2>
              <p>
                Meet Jev, your ticket-sorting sidekick. Follow every
                <br className="desktop-break" /> classification, validation, and second chance.
              </p>
              <button onClick={() => state.guide(true)}>
                Explore the workflow <ArrowRight size={15} />
              </button>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="hero-orbit one" />
              <div className="hero-orbit two" />
              <div className="hero-orbit three" />
              <div className="hero-orb">
                <Sparkles size={44} strokeWidth={1} />
              </div>
              <span className="orbit-pill pill-billing">
                <span className="pill-dot" />
                Billing <CheckCheck size={12} />
              </span>
              <span className="orbit-pill pill-technical">
                <span className="pill-dot" />
                Technical
              </span>
              <span className="orbit-pill pill-account">
                <span className="pill-dot" />
                Account <CheckCheck size={12} />
              </span>
            </div>
            <span className="hero-model">JEV / LOCAL MODEL</span>
          </section>
          <section className="stats" aria-label="Classification statistics">
            {[
              {
                label: 'Total tickets',
                value: counts.total,
                icon: Inbox,
                note: 'Every conversation counts',
                className: '',
              },
              {
                label: 'Classified',
                value: counts.classified,
                icon: CheckCheck,
                note: 'Validated and ready',
                className: 'green',
              },
              {
                label: 'Processing',
                value: counts.pending,
                icon: Clock3,
                note: 'Jev is on it',
                className: 'amber',
              },
              {
                label: 'Needs review',
                value: counts.failed,
                icon: CircleAlert,
                note: 'A second look helps',
                className: 'rose',
              },
            ].map(({ label, value, icon: Icon, note, className }) => (
              <div className={`stat ${className}`} key={label}>
                <div>
                  <span>{label}</span>
                  <Icon size={16} />
                </div>
                <strong>
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={value}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                    >
                      {value.toString().padStart(2, '0')}
                    </motion.span>
                  </AnimatePresence>
                </strong>
                <small>
                  <span className="stat-dot" />
                  {note}
                </small>
              </div>
            ))}
          </section>
          <section className="inbox-section">
            <div className="inbox-heading">
              <div>
                <h2>
                  {state.status === 'failed'
                    ? 'Needs review'
                    : state.status === 'pending'
                      ? 'Processing'
                      : state.status === 'classified'
                        ? 'Classified tickets'
                        : 'All tickets'}{' '}
                  <span className="count-chip">{query.data?.total ?? 0}</span>
                </h2>
                <span className="live-updates">
                  <span className="live-dot" />
                  Live updates
                </span>
              </div>
              <button
                className="button secondary compact"
                onClick={() => load.mutate()}
                disabled={load.isPending}
              >
                {load.isPending ? <Spinner /> : <ArrowDownToLine size={14} />}Load sample tickets
              </button>
            </div>
            <div className="filters">
              <label>
                <span className="sr-only">Filter by category</span>
                <select
                  aria-label="Filter by category"
                  value={state.category}
                  onChange={(event) => state.filter('category', event.target.value)}
                >
                  <option value="">All categories</option>
                  {['billing', 'technical', 'account', 'other'].map((value) => (
                    <option key={value} value={value}>
                      {value[0]!.toUpperCase() + value.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Filter by priority</span>
                <select
                  aria-label="Filter by priority"
                  value={state.priority}
                  onChange={(event) => state.filter('priority', event.target.value)}
                >
                  <option value="">All priorities</option>
                  {['high', 'medium', 'low'].map((value) => (
                    <option key={value} value={value}>
                      {value[0]!.toUpperCase() + value.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              {(state.category || state.priority || state.status) && (
                <button
                  className="text-button"
                  onClick={() => {
                    state.filter('category', '');
                    state.filter('priority', '');
                    state.filter('status', '');
                  }}
                >
                  Clear filters <X size={12} />
                </button>
              )}
              <span className="filter-note">
                <ShieldCheck size={12} />
                Only validated results are saved
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {query.tickets.map((ticket) => (
                    <motion.tr
                      key={ticket.id}
                      initial={{ opacity: 0, y: 7 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className={state.selectedId === ticket.id ? 'selected' : ''}
                      onClick={() => state.select(ticket.id)}
                    >
                      <td>
                        <button
                          className="ticket-open"
                          onClick={(event) => {
                            event.stopPropagation();
                            state.select(ticket.id);
                          }}
                        >
                          <span>{ticket.subject || 'Untitled ticket'}</span>
                          <small>
                            {ticket.id}
                            <span>·</span>
                            {ticket.classification?.summary ??
                              (ticket.status === 'failed'
                                ? 'Ready for a fresh start'
                                : 'Waiting for a clear next step…')}
                          </small>
                        </button>
                      </td>
                      <td>
                        <Category value={ticket.classification?.category} />
                      </td>
                      <td>
                        <Priority value={ticket.classification?.priority} />
                      </td>
                      <td>
                        <Status status={ticket.status} />
                      </td>
                      <td>
                        <ChevronRight size={14} />
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {query.isLoading && (
              <div className="empty-state">
                <Spinner />
                <h3>Opening your inbox…</h3>
              </div>
            )}
            {query.error && (
              <div className="empty-state" role="alert">
                <CircleAlert size={25} />
                <h3>We couldn’t load the inbox.</h3>
                <p>{query.error.message}</p>
                <button className="button" onClick={() => void query.refetch()}>
                  Try again
                </button>
              </div>
            )}
            {!query.isLoading && !query.error && !query.tickets.length && (
              <div className="empty-state">
                <div className="empty-icon">
                  <Inbox size={24} />
                </div>
                <h3>
                  {counts.total
                    ? 'A little peace and quiet.'
                    : 'Your first ticket is a fresh start.'}
                </h3>
                <p>
                  {counts.total
                    ? 'No tickets match these filters. Try another view.'
                    : 'Load the 10 sample tickets or write one of your own.'}
                </p>
                {!counts.total && (
                  <button
                    className="text-button"
                    onClick={() => load.mutate()}
                    disabled={load.isPending}
                  >
                    Bring in the sample inbox <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}
            <div className="table-footer">
              <span>
                {query.data?.total
                  ? `${(state.page - 1) * 8 + 1}–${Math.min(state.page * 8, query.data.total)} of ${query.data.total} tickets`
                  : 'No tickets to show'}
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label="Previous page"
                  disabled={state.page === 1}
                  onClick={() => state.setPage(state.page - 1)}
                >
                  <ChevronLeft size={15} />
                </button>
                <span>Page {state.page}</span>
                <button
                  className="icon-button"
                  aria-label="Next page"
                  disabled={state.page * 8 >= (query.data?.total ?? 0)}
                  onClick={() => state.setPage(state.page + 1)}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </section>
          <footer className="main-footer">
            <span>
              <ShieldCheck size={12} /> Built on trust. Designed for clarity.
            </span>
            <span>
              Jev 1.0 <span>·</span> Simulated, entirely local
            </span>
          </footer>
        </main>
      </div>
      <Inspector />
      <Composer />
      <Guide />
      <AnimatePresence>
        {state.notice && (
          <motion.div
            role="status"
            className="toast"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
          >
            <CheckCheck size={17} />
            <span>{state.notice}</span>
            <button
              className="icon-button"
              onClick={() => state.notify(null)}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
