import { useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { createCollection, useLiveQuery } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { ticketListSchema, ticketDetailSchema, ticketSchema, type IngestInput, type DemoScenario } from '@loura/contracts';
import { sampleTickets } from '@loura/contracts/samples';
import { queryClient } from '../../core/query';
import { request, post } from '../../core/api';
import { useStudio } from '../studio/studio.store';
export function useTickets() {
  const { category, priority, status, page } = useStudio();
  const options = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '8' });
    if (category) params.set('category', category);
    if (priority) params.set('priority', priority);
    if (status) params.set('status', status);
    return { queryKey: ['tickets', category, priority, status, page], queryFn: async () => ticketListSchema.parse(await request('/tickets?' + params)), refetchInterval: 1000 };
  }, [category, priority, status, page]);
  const collection = useMemo(() => createCollection(queryCollectionOptions({ ...options, queryClient, schema: ticketSchema, select: (data) => data.tickets, getKey: (ticket) => ticket.id })), [options]);
  const live = useLiveQuery((q) => q.from({ ticket: collection }).orderBy(({ ticket }) => ticket.createdAt, 'desc').orderBy(({ ticket }) => ticket.id, 'asc'));
  const query = useQuery(options);
  return { ...query, tickets: live.data ?? [] };
}
export function useTicket(id: string | null) {
  return useQuery({ queryKey: ['ticket', id], enabled: Boolean(id), queryFn: async () => ticketDetailSchema.parse(await request('/tickets/' + encodeURIComponent(id!))), refetchInterval: 650 });
}
export function refreshTickets() { void queryClient.invalidateQueries({ queryKey: ['tickets'] }); void queryClient.invalidateQueries({ queryKey: ['ticket'] }); }
export function useIngest() {
  return useMutation({ mutationFn: (input: IngestInput) => post('/tickets', input), onSuccess: refreshTickets });
}
export function useLoadSamples() {
  const notify = useStudio((state) => state.notify);
  return useMutation({ mutationFn: async () => {
    let added = 0;
    for (const ticket of sampleTickets) {
      const result = await post('/tickets', ticket);
      if (typeof result === 'object' && result && 'duplicate' in result && result.duplicate === false) added++;
      refreshTickets();
    }
    return added;
  }, onSuccess: (added) => { refreshTickets(); notify(added ? `${added} sample tickets added. Follow their classification live.` : 'All 10 sample tickets are already here. No duplicate jobs were created.'); }, onError: (error) => notify(error.message) });
}
export function useReclassify(id: string, version: number) {
  const notify = useStudio((state) => state.notify);
  return useMutation({ mutationFn: (scenario: DemoScenario) => post(`/tickets/${encodeURIComponent(id)}/reclassify`, { expectedVersion: version, scenario }), onSuccess: () => { refreshTickets(); notify('A new classification run is queued. Earlier runs stay in history.'); }, onError: (error) => { refreshTickets(); notify(error.message); } });
}
