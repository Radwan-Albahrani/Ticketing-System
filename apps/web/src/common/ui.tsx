import { LoaderCircle, Check, CircleAlert, CircleDashed, ReceiptText, Wrench, UserRound, Shapes } from 'lucide-react';
import type { Ticket } from '@loura/contracts';
export function Spinner() { return <LoaderCircle size={16} className="spin" aria-hidden="true"/>; }
export function Status({ status }: { status: Ticket['status'] }) {
  const Icon = status === 'classified' ? Check : status === 'failed' ? CircleAlert : CircleDashed;
  return <span className={`status status-${status}`}><Icon size={12} className={status === 'pending' ? 'spin' : ''}/>{status === 'pending' ? 'Processing' : status === 'classified' ? 'Classified' : 'Needs review'}</span>;
}
export function Category({ value }: { value: string | undefined }) {
  const Icon = value === 'billing' ? ReceiptText : value === 'technical' ? Wrench : value === 'account' ? UserRound : Shapes;
  return value ? <span className={`category category-${value}`}><Icon size={12}/>{value}</span> : <span className="muted">—</span>;
}
export function Priority({ value }: { value: string | undefined }) {
  return value ? <span className={`priority priority-${value}`}><i/><span>{value}</span></span> : <span className="muted">—</span>;
}
export function Logo({ small = false }: { small?: boolean }) {
  return <span className={`brand ${small ? 'small' : ''}`}><span className="brand-mark"><span/><span/><span/></span>{!small && <span>loura<span className="brand-dot">.</span></span>}</span>;
}
