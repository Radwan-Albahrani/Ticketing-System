import { describe, expect, test } from 'bun:test';
import { inspectImport } from './lint-architecture';
describe('architecture boundaries', () => {
  test('rejects infrastructure → feature imports', () => expect(inspectImport('core/db.ts', 'api/tickets/tickets.service.ts')).toBeDefined());
  test('rejects transport in services', () => {
    expect(inspectImport('api/tickets/tickets.service.ts', 'express')).toBeDefined();
    expect(inspectImport('api/tickets/tickets.service.ts', 'api/tickets/tickets.controller.ts')).toBeDefined();
  });
  test('permits controllers calling their feature service', () => expect(inspectImport('api/tickets/tickets.controller.ts', 'api/tickets/tickets.service.ts')).toBeUndefined());
});
