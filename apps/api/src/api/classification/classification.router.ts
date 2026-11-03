import { Router } from 'express';
import { ClassificationController } from './classification.controller';
export const classificationRouter = Router();
classificationRouter.get('/', ClassificationController.metadata);
