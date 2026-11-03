import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ArrowUpRight, X, FlaskConical } from 'lucide-react';
import { ingestSchema, type DemoScenario } from '@loura/contracts';
import { useStudio } from '../studio/studio.store';
import { useIngest } from './tickets.queries';
import { Spinner } from '../../common/ui';
export const scenarios: { value: DemoScenario; label: string; description: string }[] = [
  { value: 'normal', label: 'Normal classification', description: 'A plausible, validated result on the first attempt.' },
  { value: 'malformed-once', label: 'Malformed response, then recovery', description: 'Bad JSON on attempt one. Automatic retry succeeds.' },
  { value: 'invalid-output', label: 'Invalid output, all attempts', description: 'Invalid category and priority are rejected three times.' },
  { value: 'timeout', label: 'Model timeout', description: 'Each request exceeds its deadline and exhausts retries.' },
];
export function Composer() {
  const { composerOpen, compose, select, notify, filter } = useStudio();
  const ingest = useIngest();
  const [id, setId] = useState(() => `t-${Date.now().toString().slice(-7)}`);
  const [subject, setSubject] = useState(''); const [body, setBody] = useState('');
  const [scenario, setScenario] = useState<DemoScenario>('normal'); const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    const parsed = ingestSchema.safeParse({ id, subject, body, scenario });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check the ticket fields.'); return; }
    try {
      const result = await ingest.mutateAsync(parsed.data);
      const duplicate = typeof result === 'object' && result && 'duplicate' in result && result.duplicate;
      notify(duplicate ? 'This ID already exists. The original ticket and classification were preserved.' : 'Ticket received. Classification is running in the background.');
      filter('status', ''); filter('category', ''); filter('priority', ''); select(id); compose(false);
      setId(`t-${Date.now().toString().slice(-7)}`); setSubject(''); setBody(''); setScenario('normal');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not submit ticket.'); }
  }
  return <Dialog.Root open={composerOpen} onOpenChange={compose}><Dialog.Portal><Dialog.Backdrop className="dialog-backdrop"/><Dialog.Popup className="dialog-popup composer">
    <div className="dialog-heading"><span className="eyebrow">START A CLASSIFICATION</span><Dialog.Close className="icon-button" aria-label="Close new ticket"><X size={18}/></Dialog.Close></div>
    <Dialog.Title>Give your inbox a new arrival.</Dialog.Title><Dialog.Description>Submit a ticket and follow every step from receipt to result.</Dialog.Description>
    <form onSubmit={(event) => void submit(event)}>
      <div className="form-row"><label>Ticket ID<input required value={id} maxLength={100} onChange={(event) => setId(event.target.value)} placeholder="t-1001"/><small>Reusing an ID returns the original ticket.</small></label></div>
      <label>Subject <span className="muted">(optional)</span><input value={subject} maxLength={300} onChange={(event) => setSubject(event.target.value)} placeholder="What can we help with?" autoFocus/></label>
      <label>Ticket body<textarea required value={body} maxLength={20000} onChange={(event) => setBody(event.target.value)} rows={5} placeholder="The customer's request, in their own words…"/></label>
      <div className="scenario-box"><label><span className="label-icon"><FlaskConical size={14}/> Model behavior</span><select value={scenario} onChange={(event) => setScenario(event.target.value as DemoScenario)}>{scenarios.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><p>{scenarios.find((item) => item.value === scenario)?.description}</p></div>
      {error && <p className="error-text" role="alert">{error}</p>}
      <button className="button primary submit" type="submit" disabled={ingest.isPending}>{ingest.isPending ? <Spinner/> : <>Submit & classify <ArrowUpRight size={16}/></>}</button>
    </form>
  </Dialog.Popup></Dialog.Portal></Dialog.Root>;
}
