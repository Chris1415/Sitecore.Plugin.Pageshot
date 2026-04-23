import { vi, type Mock } from 'vitest';
import type { ClientSDK } from '@sitecore-marketplace-sdk/client';

/**
 * Typed Marketplace SDK stubs — per `client.md § 9a`.
 *
 * Naked `vi.fn()` fails `tsc --noEmit` against the SDK's overloaded signatures
 * (TS2348: "Value of type 'Mock<Procedure | Constructable>' is not callable").
 * Pass each verb's call signature as a generic to `vi.fn` so the stub exposes
 * a single callable shape to the compiler. The only cast allowed is the outer
 * `as unknown as ClientSDK` on the assembled stub — it covers the methods we
 * don't stub (`mutate`, `subscribe`, utility methods). Individual stubs are
 * typed with the verb's real signature and do not need casts.
 */
export type QueryFn = ClientSDK['query'];
export type MutateFn = ClientSDK['mutate'];
export type SubscribeFn = ClientSDK['subscribe'];
export type DestroyFn = ClientSDK['destroy'];

export interface SdkStubBundle {
  query: Mock<QueryFn>;
  mutate: Mock<MutateFn>;
  subscribe: Mock<SubscribeFn>;
  destroy: Mock<DestroyFn>;
  client: ClientSDK;
}

/**
 * Build a fresh typed stub bundle. Returns the individual mocks (for
 * call-shape assertions) and the assembled `ClientSDK`-shaped object (for
 * passing into code that consumes a client).
 */
export function createSdkStubs(): SdkStubBundle {
  const query: Mock<QueryFn> = vi.fn<QueryFn>();
  const mutate: Mock<MutateFn> = vi.fn<MutateFn>();
  const subscribe: Mock<SubscribeFn> = vi.fn<SubscribeFn>();
  const destroy: Mock<DestroyFn> = vi.fn<DestroyFn>();

  const client = { query, mutate, subscribe, destroy } as unknown as ClientSDK;

  return { query, mutate, subscribe, destroy, client };
}
