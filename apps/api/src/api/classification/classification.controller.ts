import type { Request, Response } from 'express';
import { MAX_ATTEMPTS, PROMPT_VERSION } from './classification.types';
export class ClassificationController {
  static metadata(_req: Request, res: Response) {
    res.json({
      provider: 'Jev',
      model: 'jev-classifier-1',
      fake: true,
      promptVersion: PROMPT_VERSION,
      maxAttempts: MAX_ATTEMPTS,
      toolsEnabled: false,
    });
  }
}
