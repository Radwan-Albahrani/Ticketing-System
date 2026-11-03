import { Dialog } from '@base-ui/react/dialog';
import { X, Inbox, Sparkles, ShieldCheck, Check, RefreshCw } from 'lucide-react';
import { useStudio } from './studio.store';
export function Guide() {
  const { guideOpen, guide } = useStudio();
  return <Dialog.Root open={guideOpen} onOpenChange={guide}><Dialog.Portal><Dialog.Backdrop className="dialog-backdrop"/><Dialog.Popup className="dialog-popup guide"><div className="dialog-heading"><span className="eyebrow">A LOOK UNDER THE HOOD</span><Dialog.Close className="icon-button" aria-label="Close workflow guide"><X size={18}/></Dialog.Close></div><Dialog.Title>A clear path, every time.</Dialog.Title><Dialog.Description>Each ticket has a durable job and an inspectable history. Nothing depends on keeping this page open.</Dialog.Description><div className="guide-steps">{[
    [Inbox, '01', 'Receive & queue', 'The ticket and its job are saved together. Reusing an ID returns the original, with no new work.'],
    [Sparkles, '02', 'Let Jev classify', 'Our local fake model suggests a category, priority, and summary. Three tickets can process at once.'],
    [ShieldCheck, '03', 'Validate the response', 'Strict schemas reject bad JSON and unsupported values. The model cannot call tools or approve actions.'],
    [Check, '04', 'Save a trusted shape', 'Only a validated result is saved. Failed attempts retry with backoff, up to three total attempts.'],
    [RefreshCw, '05', 'Review & reclassify', 'Choose a different model behavior to demonstrate recovery, or start a new version without erasing history.'],
  ].map(([Icon, number, title, text]) => { const StepIcon = Icon as typeof Inbox; return <div key={String(number)}><span><StepIcon size={18}/></span><section><small>{String(number)}</small><h3>{String(title)}</h3><p>{String(text)}</p></section></div>; })}</div><span className="guide-note">Jev is a deterministic simulation. No live provider, external network, or AI credentials are required.</span></Dialog.Popup></Dialog.Portal></Dialog.Root>;
}
