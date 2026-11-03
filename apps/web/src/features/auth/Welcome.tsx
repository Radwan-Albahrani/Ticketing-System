import { useMutation } from '@tanstack/react-query';
import { ArrowUpRight, ShieldCheck, Sparkles, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { post } from '../../core/api';
import { queryClient } from '../../core/query';
import { Logo, Spinner } from '../../common/ui';
export function Welcome() {
  const login = useMutation({
    mutationFn: () =>
      post('/auth/sign-in/email', { email: 'demo@loura.local', password: 'loura-demo-local-2026' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['session'] }),
  });
  return (
    <main className="welcome">
      <div className="welcome-nav">
        <Logo />
        <span className="eyebrow">THE SUPPORT WORKSPACE, REIMAGINED</span>
      </div>
      <div className="welcome-grid">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <span className="pill">
            <span className="live-dot" /> Meet your calmer inbox
          </span>
          <h1>
            Every ticket.
            <br />A clear next step.
          </h1>
          <p className="welcome-copy">
            A little intelligence. A lot less sorting.
            <br />
            Watch Loura turn an incoming ticket into an actionable answer, one transparent step at a
            time.
          </p>
          <button
            className="button primary large"
            onClick={() => login.mutate()}
            disabled={login.isPending}
          >
            {login.isPending ? (
              <Spinner />
            ) : (
              <>
                Enter the demo studio <ArrowUpRight size={18} />
              </>
            )}
          </button>
          {login.error && (
            <p role="alert" className="error-text">
              {login.error.message}
            </p>
          )}
          <p className="demo-note">Local demo · No API key needed · Nothing leaves your machine</p>
        </motion.section>
        <motion.div
          className="welcome-art"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.15 }}
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orb">
            <Sparkles size={50} strokeWidth={1} />
          </div>
          <div className="floating-ticket">
            <span className="mini-label">
              <span className="live-dot" /> INCOMING TICKET
            </span>
            <strong>Charged twice this month</strong>
            <p>Can you help with a duplicate charge?</p>
            <div className="floating-result">
              <span>
                <Check size={13} /> Billing
              </span>
              <span>Medium priority</span>
            </div>
          </div>
          <div className="floating-note">
            <ShieldCheck size={18} />
            <span>Validated. Then saved.</span>
          </div>
        </motion.div>
      </div>
      <footer className="welcome-footer">
        <span>Built for a thoughtful support experience.</span>
        <span>
          Powered by Jev <span className="tiny-tag">SIMULATED MODEL</span>
        </span>
      </footer>
    </main>
  );
}
