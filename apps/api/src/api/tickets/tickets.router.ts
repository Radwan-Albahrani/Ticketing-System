import { Router } from 'express';
import { TicketsController } from './tickets.controller';
export const ticketsRouter = Router();
ticketsRouter.post('/', TicketsController.create);
ticketsRouter.get('/', TicketsController.list);
ticketsRouter.get('/:id', TicketsController.get);
ticketsRouter.post('/:id/reclassify', TicketsController.reclassify);

ticketsRouter.post('/:id/activity', TicketsController.activity);
