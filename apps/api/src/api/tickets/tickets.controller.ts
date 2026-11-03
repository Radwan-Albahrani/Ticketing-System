import { createUIMessageStream, pipeUIMessageStreamToResponse } from 'ai';
import type { Request, Response } from 'express';
import { ingestSchema, listQuerySchema, reclassifySchema, ticketDetailSchema, ticketListSchema, ticketInputSchema } from '@loura/contracts';
import { TicketsService } from './tickets.service';
export class TicketsController {
  static async create(req: Request, res: Response) {
    const input = ingestSchema.parse(req.body);
    const result = await TicketsService.ingest(req.ownerId, input);
    req.log?.set({ action: 'ticket.ingest', ticketId: input.id, duplicate: result.duplicate });
    res.status(result.duplicate ? 200 : 202).json(result);
  }
  static async list(req: Request, res: Response) { res.json(ticketListSchema.parse(await TicketsService.list(req.ownerId, listQuerySchema.parse(req.query)))); }
  static async get(req: Request, res: Response) {
    const id = ticketInputSchema.shape.id.parse(req.params.id);
    res.json(ticketDetailSchema.parse(await TicketsService.get(req.ownerId, id)));
  }
  static async activity(req: Request, res: Response) {
    const id = ticketInputSchema.shape.id.parse(req.params.id);
    const initial = await TicketsService.get(req.ownerId, id);
    let closed = false;
    res.on('close', () => { closed = true; });
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const seen = new Set<string>();
        const textId = crypto.randomUUID();
        writer.write({ type: 'text-start', id: textId });
        let snapshot = initial;
        const deadline = Date.now() + 60000;
        while (!closed && Date.now() < deadline) {
          for (const event of snapshot.events.filter((event) => event.version === initial.ticket.version && !seen.has(event.id))) {
            seen.add(event.id);
            writer.write({ type: 'text-delta', id: textId, delta: event.message + '\n' });
          }
          if (snapshot.ticket.status !== 'pending' || snapshot.ticket.version !== initial.ticket.version) break;
          await new Promise((resolve) => setTimeout(resolve, 400));
          if (!closed) snapshot = await TicketsService.get(req.ownerId, id);
        }
        if (!closed) writer.write({ type: 'text-end', id: textId });
      },
      onError: () => 'Live feed interrupted; the saved run history is still available.',
    });
    pipeUIMessageStreamToResponse({ response: res, stream });
  }
  static async reclassify(req: Request, res: Response) {
    const id = ticketInputSchema.shape.id.parse(req.params.id);
    const input = reclassifySchema.parse(req.body);
    res.status(202).json({ ticket: await TicketsService.reclassify(req.ownerId, id, input.expectedVersion, input.scenario) });
  }
}
