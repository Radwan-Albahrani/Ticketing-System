import { lazy, Suspense, useState } from 'react';
import { Tabs } from '@base-ui/react/tabs';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  History,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
  CircleAlert,
  LoaderCircle,
} from 'lucide-react';
import type { DemoScenario, TicketEvent } from '@loura/contracts';
import { useStudio } from '../studio/studio.store';
import { useTicket, useReclassify } from './tickets.queries';
import { Category, Priority, Spinner, Status } from '../../common/ui';
import { scenarios } from './Composer';
const RunFeed = lazy(() => import('./RunFeed').then(({ RunFeed }) => ({ default: RunFeed })));
const labels: Record<string, string> = {
  received: 'Ticket received',
  reclassified: 'New run requested',
  model_started: 'Jev classification',
  guardrail: 'Untrusted content boundary',
  validated: 'Output validated',
  classified: 'Classification saved',
  retry_scheduled: 'Output rejected · retry queued',
  failed: 'Run needs attention',
};
function eventMessage(event: TicketEvent) {
  if (event.type !== 'classified') return event.message;
  try {
    const result: unknown = JSON.parse(event.message);
    if (
      typeof result === 'object' &&
      result &&
      'summary' in result &&
      typeof result.summary === 'string'
    )
      return result.summary;
  } catch {
    /* Older records can still be displayed as text. */
  }
  return event.message;
}
function Timeline({ events }: { events: TicketEvent[] }) {
  return (
    <ol className="timeline">
      {events.map((event, index) => {
        const previous = events[index - 1];
        const changed = !previous || previous.version !== event.version;
        const warning = ['failed', 'retry_scheduled'].includes(event.type);
        const Icon = warning
          ? CircleAlert
          : event.type === 'guardrail'
            ? ShieldCheck
            : event.type === 'model_started'
              ? Sparkles
              : Check;
        return (
          <motion.li
            key={event.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {changed && (
              <div className="run-divider">
                <span>RUN {String(event.version).padStart(2, '0')}</span>
                <span>
                  {new Date(event.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
            <div className={`timeline-event ${warning ? 'warning' : ''}`}>
              <span className="timeline-icon">
                <Icon size={12} />
              </span>
              <div>
                <div className="event-title">
                  <strong>{labels[event.type] ?? event.type}</strong>
                  {event.attempt && <span>Try {event.attempt}</span>}
                </div>
                <p>{eventMessage(event)}</p>
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
export function Inspector() {
  const { selectedId, select } = useStudio();
  const query = useTicket(selectedId);
  const [tab, setTab] = useState('overview');
  const [scenario, setScenario] = useState<DemoScenario>('normal');
  const ticket = query.data?.ticket;
  const retry = useReclassify(ticket?.id ?? '', ticket?.version ?? 1);
  return (
    <AnimatePresence mode="wait">
      {selectedId && (
        <motion.aside
          className="inspector"
          key={selectedId}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          aria-label="Ticket details"
        >
          <div className="inspector-top">
            <button
              className="icon-button mobile-back"
              onClick={() => select(null)}
              aria-label="Back to inbox"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="eyebrow">
              TICKET DETAILS <ChevronRight size={11} /> {selectedId}
            </span>
            <button
              className="icon-button"
              aria-label="Close ticket details"
              onClick={() => select(null)}
            >
              <X size={17} />
            </button>
          </div>
          {query.isLoading && (
            <div className="panel-loading">
              <Spinner /> Opening ticket…
            </div>
          )}
          {query.error && (
            <div className="panel-loading error-text" role="alert">
              {query.error.message}
              <button className="button" onClick={() => void query.refetch()}>
                Try again
              </button>
            </div>
          )}
          {ticket && (
            <>
              <div className="inspector-title">
                <Status status={ticket.status} />
                <h2>{ticket.subject || 'Untitled ticket'}</h2>
                <span className="muted">
                  {ticket.id} <span className="separator">·</span> Run {ticket.version}{' '}
                  <span className="separator">·</span>{' '}
                  {new Date(ticket.createdAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <Tabs.Root
                value={tab}
                onValueChange={(value) => setTab(String(value))}
                className="detail-tabs"
              >
                <Tabs.List className="tabs-list">
                  <Tabs.Tab value="overview">Overview</Tabs.Tab>
                  <Tabs.Tab value="history">
                    <History size={13} /> Run history{' '}
                    <span className="count-chip">{query.data?.events.length}</span>
                  </Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="overview" className="detail-content">
                  <div className="section-label">
                    <span>CUSTOMER MESSAGE</span>
                    <span className="tiny-tag">UNTRUSTED INPUT</span>
                  </div>
                  <p className="ticket-body">{ticket.body}</p>
                  <div className={`classification-card ${ticket.status}`}>
                    <div className="section-label">
                      <span>
                        <Sparkles size={13} /> JEV CLASSIFICATION
                      </span>
                      {ticket.classification && <Check size={15} />}
                    </div>
                    <AnimatePresence mode="wait">
                      {ticket.classification ? (
                        <motion.div
                          key={`result-${ticket.version}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <p className="result-summary">{ticket.classification.summary}</p>
                          <div className="result-tags">
                            <Category value={ticket.classification.category} />
                            <Priority value={ticket.classification.priority} />
                          </div>
                          <div className="validated-note">
                            <ShieldCheck size={12} /> Schema validated · {ticket.promptVersion}
                          </div>
                        </motion.div>
                      ) : ticket.status === 'failed' ? (
                        <motion.div key="failed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <h3>No invalid output was saved.</h3>
                          <p>{ticket.lastError}</p>
                          <small>All {ticket.attempts} attempts used. Start a new run below.</small>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="pending"
                          className="processing-result"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <div className="processing-orb">
                            <Sparkles size={24} />
                          </div>
                          <h3>
                            {ticket.attempts
                              ? 'Finding a clear next step…'
                              : 'Your ticket is in the queue.'}
                          </h3>
                          <p>
                            Receive <ChevronRight size={11} /> Classify <ChevronRight size={11} />{' '}
                            Validate <ChevronRight size={11} /> Save
                          </p>
                          <div className="progress-track">
                            <span />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {ticket.status === 'pending' && (
                    <Suspense
                      fallback={
                        <div className="live-feed">
                          <Spinner /> Connecting to the live run…
                        </div>
                      }
                    >
                      <RunFeed key={`${ticket.id}-${ticket.version}`} id={ticket.id} />
                    </Suspense>
                  )}
                  <div className="mini-lifecycle">
                    <div className="section-label">
                      <span>THIS RUN</span>
                      <span>{ticket.attempts}/3 attempts</span>
                    </div>
                    {['received', 'model_started', 'validated', 'classified'].map((step, i) => {
                      const done = query.data?.events.some(
                        (event) =>
                          event.version === ticket.version &&
                          (event.type === step ||
                            (step === 'received' && event.type === 'reclassified')),
                      );
                      const active = !done && ticket.status === 'pending' && (i === 1 || i === 0);
                      return (
                        <div className={`mini-step ${done ? 'done' : ''}`} key={step}>
                          <span>
                            {done ? (
                              <Check size={11} />
                            ) : active ? (
                              <LoaderCircle size={11} className="spin" />
                            ) : (
                              i + 1
                            )}
                          </span>
                          <p>
                            {
                              [
                                'Received & queued',
                                'Model request started',
                                'Validated against schema',
                                'Saved for your team',
                              ][i]
                            }
                          </p>
                          {done && <span className="step-done">Done</span>}
                        </div>
                      );
                    })}
                  </div>
                  <button className="text-button view-history" onClick={() => setTab('history')}>
                    See the complete run history <ArrowUpRight size={14} />
                  </button>
                </Tabs.Panel>
                <Tabs.Panel value="history" className="detail-content">
                  <p className="history-intro">
                    Every attempt, guardrail, and result. Earlier runs stay here when you
                    reclassify.
                  </p>
                  <Timeline events={query.data?.events ?? []} />
                </Tabs.Panel>
              </Tabs.Root>
              <div className="inspector-footer">
                <div className="reclassify-heading">
                  <RefreshCw size={15} />
                  <strong>Run it again</strong>
                  <span>
                    v{ticket.version} → v{ticket.version + 1}
                  </span>
                </div>
                <label className="sr-only" htmlFor="retry-scenario">
                  Reclassification behavior
                </label>
                <select
                  id="retry-scenario"
                  value={scenario}
                  onChange={(event) => setScenario(event.target.value as DemoScenario)}
                  disabled={ticket.status === 'pending' || retry.isPending}
                >
                  {scenarios.map((item) => (
                    <option value={item.value} key={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <button
                  className="button retry-button"
                  disabled={ticket.status === 'pending' || retry.isPending}
                  onClick={() => retry.mutate(scenario)}
                >
                  {retry.isPending ? <Spinner /> : <RefreshCw size={14} />}{' '}
                  {ticket.status === 'pending' ? 'Classification in progress' : 'Reclassify ticket'}
                </button>
                <p>
                  <Clock3 size={11} /> Earlier results are kept in run history.
                </p>
              </div>
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
