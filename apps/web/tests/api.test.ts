import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { request, ApiError } from '../src/core/api';
import { queryClient } from '../src/core/query';
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  queryClient.clear();
});
describe('browser HTTP boundary', () => {
  test('an expired session returns the app to the welcome state', async () => {
    queryClient.setQueryData(['session'], { user: { id: 'expired' } });
    spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json(
        { error: { code: 'UNAUTHORIZED', message: 'Sign in to continue.' } },
        { status: 401 },
      ),
    );
    await expect(request('/tickets')).rejects.toBeInstanceOf(ApiError);
    expect(queryClient.getQueryData(['session'])).toBeNull();
  });
  test('a server error retains the session and surfaces its safe message', async () => {
    const session = { user: { id: 'valid' } };
    queryClient.setQueryData(['session'], session);
    spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Please try again.' } },
        { status: 500 },
      ),
    );
    await expect(request('/tickets')).rejects.toThrow('Please try again.');
    expect(queryClient.getQueryData(['session'])).toEqual(session);
  });
});
