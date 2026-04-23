import { describe, expect, it } from 'vitest';
import nextConfig from './next.config.mjs';

/**
 * T003-TEST-1 — Chrome Local Network Access headers present.
 *
 * Guards the Section 4c-1 rule that HTTP localhost must be portal-iframe reachable
 * (Chrome PNA) and the task breakdown T003 "do NOT combine Allow-Origin: * with
 * Allow-Credentials: true" constraint.
 */
describe('next.config.mjs — PNA headers (T003-TEST-1)', () => {
  it('exposes a headers() function that covers every path', async () => {
    expect(typeof (nextConfig as { headers?: () => unknown }).headers).toBe('function');
    const rules = await (
      nextConfig as { headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>> }
    ).headers();
    expect(rules).toHaveLength(1);
    expect(rules[0]!.source).toBe('/:path*');
  });

  it('sets the four Chrome Local Network Access headers', async () => {
    const rules = await (
      nextConfig as { headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>> }
    ).headers();
    const headers = rules[0]!.headers;
    const byKey = new Map(headers.map((h) => [h.key, h.value]));

    expect(byKey.get('Access-Control-Allow-Private-Network')).toBe('true');
    expect(byKey.get('Access-Control-Allow-Origin')).toBe('*');
    expect(byKey.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
    expect(byKey.get('Access-Control-Allow-Headers')).toBe(
      'Content-Type, Authorization, Access-Control-Request-Private-Network',
    );
  });

  it('does NOT set Access-Control-Allow-Credentials to true (spec-forbidden with * origin)', async () => {
    const rules = await (
      nextConfig as { headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>> }
    ).headers();
    const credsHeader = rules[0]!.headers.find((h) => h.key === 'Access-Control-Allow-Credentials');
    expect(credsHeader?.value).not.toBe('true');
  });
});
