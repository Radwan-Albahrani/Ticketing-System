import { describe, expect, test } from 'bun:test';
import { writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspectImport } from './lint-architecture';
describe('architecture boundaries', () => {
  test('rejects infrastructure → feature imports', () =>
    expect(inspectImport('core/db.ts', 'api/tickets/tickets.service.ts')).toBeDefined());
  test('rejects transport in services', () => {
    expect(inspectImport('api/tickets/tickets.service.ts', 'express')).toBeDefined();
    expect(
      inspectImport('api/tickets/tickets.service.ts', 'api/tickets/tickets.controller.ts'),
    ).toBeDefined();
  });
  test('permits controllers calling their feature service', () =>
    expect(
      inspectImport('api/tickets/tickets.controller.ts', 'api/tickets/tickets.service.ts'),
    ).toBeUndefined());
});

test('CLI parses type imports, re-exports and dynamic imports without matching comments', () => {
  const fixture = resolve(
    import.meta.dir,
    `../apps/api/src/core/architecture-fixture-${process.pid}.ts`,
  );
  try {
    writeFileSync(
      fixture,
      `
      import type { TicketsService } from '../api/tickets/tickets.service';
      export type { TicketsService as Exported } from '../api/tickets/tickets.service';
      export const load = () => import('../api/tickets/tickets.service');
      // import { ignored } from '../api/tickets/tickets.service';
    `,
    );
    const result = Bun.spawnSync([
      process.execPath,
      resolve(import.meta.dir, 'lint-architecture.ts'),
    ]);
    const diagnostics = result.stderr.toString();
    expect(result.exitCode).toBe(1);
    expect(diagnostics.match(/Infrastructure cannot depend on features/g)).toHaveLength(3);
  } finally {
    unlinkSync(fixture);
  }
});
