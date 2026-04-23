"use client";

import {
  type ApplicationContext,
  ClientSDK,
} from "@sitecore-marketplace-sdk/client";
import { XMC } from "@sitecore-marketplace-sdk/xmc";
import type React from "react";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface ClientSDKProviderProps {
  children: ReactNode;
}

/**
 * T007b — PageShot MarketplaceProvider.
 *
 * Extends the scaffold's Provider to subscribe to `pages.context` via
 * **PATH A** (`client.query('pages.context', { subscribe: true, onSuccess })`),
 * per `client.md § 6a` and § 4c-6. The verb-based `client.subscribe(...)` is
 * never used for this key — `pages.context` lives in `QueryMap`, not
 * `SubscribeMap`, and PATH B would fail typecheck (§ 4c-1).
 *
 * On unmount: the `unsubscribe` handle returned by `client.query` is invoked,
 * and `client.destroy()` tears down the PostMessage bridge.
 *
 * The hook `usePagesContext()` returns `{ pageId, siteName, pageName } | null`
 * — `null` until the first `onSuccess` event fires, then the extracted fields
 * from `pageInfo.id`, `siteInfo.name`, `pageInfo.name`.
 */

export interface PageshotPagesContext {
  pageId: string | undefined;
  siteName: string | undefined;
  pageName: string | undefined;
}

/**
 * Subset of the SDK's `PagesContext` shape (`client.md § 6a`) that this
 * Provider depends on. Declared locally so the Provider does not need to
 * import a runtime type from the SDK that may not yet be exported at
 * top-level — we only care about `pageInfo.id`, `siteInfo.name`,
 * `pageInfo.name`, all `string | undefined` per the SDK contract.
 */
interface PagesContextEvent {
  siteInfo?: { name?: string };
  pageInfo?: { id?: string; name?: string };
}

const ClientSDKContext = createContext<ClientSDK | null>(null);
const AppContextContext = createContext<ApplicationContext | null>(null);
const PagesContextContext = createContext<PageshotPagesContext | null>(null);

export const MarketplaceProvider: React.FC<ClientSDKProviderProps> = ({
  children,
}) => {
  const [client, setClient] = useState<ClientSDK | null>(null);
  const [appContext, setAppContext] = useState<ApplicationContext | null>(null);
  const [pagesCtx, setPagesCtx] = useState<PageshotPagesContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  // Guard against StrictMode double-mount producing two ClientSDK.init calls
  // (T007a-TEST-1 idempotency assertion).
  const initStartedRef = useRef<boolean>(false);
  // Hold the unsubscribe handle returned by `client.query('pages.context', { subscribe: true })`
  // so the cleanup effect can invoke it exactly once on unmount.
  const pagesUnsubscribeRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (initStartedRef.current) {
      return;
    }
    initStartedRef.current = true;
    const init = async () => {
      const config = {
        target: window.parent,
        modules: [XMC],
      };
      try {
        setLoading(true);
        const created = await ClientSDK.init(config);
        setClient(created);
      } catch (err) {
        console.error("Error initializing client SDK", err);
        setError("Error initializing client SDK");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (!client) {
      return;
    }
    client.query("application.context").then((res) => {
      if (res?.data) {
        setAppContext(res.data);
      }
    });
  }, [client]);

  useEffect(() => {
    if (!client) {
      return;
    }

    let cancelled = false;

    // PATH A subscription — `client.md § 6a`.
    client
      .query("pages.context", {
        subscribe: true,
        onSuccess: (data) => {
          // Fires on initial resolve AND on every subsequent update.
          const event = data as PagesContextEvent | undefined;
          setPagesCtx({
            pageId: event?.pageInfo?.id,
            siteName: event?.siteInfo?.name,
            pageName: event?.pageInfo?.name,
          });
        },
        onError: (err) => {
          console.error("[pageshot][pages.context] error", err);
        },
      })
      .then((res) => {
        if (cancelled) {
          // Component unmounted between query invocation and resolution —
          // tear down the subscription we just wired.
          res?.unsubscribe?.();
          return;
        }
        pagesUnsubscribeRef.current = res?.unsubscribe;
      });

    return () => {
      cancelled = true;
      pagesUnsubscribeRef.current?.();
      pagesUnsubscribeRef.current = undefined;
      client.destroy();
    };
  }, [client]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-dvh items-center justify-center bg-background p-6 text-sm text-muted-foreground"
      >
        Connecting to Sitecore Marketplace&hellip;
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-6 text-center"
      >
        <h1 className="text-lg font-semibold text-danger-fg">
          Error initializing Marketplace SDK
        </h1>
        <p className="max-w-prose text-sm text-foreground">{error}</p>
        <p className="max-w-prose text-xs text-muted-foreground">
          Please check that the SDK is loaded inside a Sitecore Marketplace
          parent window and that the app&apos;s extension points are properly
          configured.
        </p>
      </div>
    );
  }

  if (!client) {
    return null;
  }

  if (!appContext) {
    return null;
  }

  return (
    <ClientSDKContext.Provider value={client}>
      <AppContextContext.Provider value={appContext}>
        <PagesContextContext.Provider value={pagesCtx}>
          {children}
        </PagesContextContext.Provider>
      </AppContextContext.Provider>
    </ClientSDKContext.Provider>
  );
};

export const useMarketplaceClient = () => {
  const context = useContext(ClientSDKContext);
  if (!context) {
    throw new Error(
      "useMarketplaceClient must be used within a ClientSDKProvider",
    );
  }
  return context;
};

export const useAppContext = () => {
  const context = useContext(AppContextContext);
  if (!context) {
    throw new Error("useAppContext must be used within a ClientSDKProvider");
  }
  return context;
};

/**
 * Read the live `pages.context` values exposed by `<MarketplaceProvider>`.
 * Returns `null` until the SDK delivers the first `onSuccess` event.
 * Calling this hook outside the Provider also returns `null` (consumers
 * that need a hard guard should check for `null` and render their own
 * loading state — see T008's "Loading page context…" fallback).
 */
export const usePagesContext = (): PageshotPagesContext | null => {
  return useContext(PagesContextContext);
};
