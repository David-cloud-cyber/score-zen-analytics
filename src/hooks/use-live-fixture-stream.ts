import { useCallback, useEffect, useRef, useState } from "react";
import type { FixturesPayload } from "@/lib/football-types";

type LoadSnapshot = () => Promise<FixturesPayload>;

type Options = {
  enabled: boolean;
  initialPayload?: FixturesPayload;
  loadSnapshot: LoadSnapshot;
};

type Result = {
  payload?: FixturesPayload;
  isRefreshing: boolean;
  retry: () => void;
};

const HTTP_FALLBACK_MS = 15_000;
const RECONNECT_MS = 5_000;

function websocketUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/live-stream`;
}

function isFixturesPayload(value: unknown): value is FixturesPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<FixturesPayload>;
  return Array.isArray(payload.matches) && typeof payload.state === "string";
}

/**
 * Opens one shared live stream per page. HTTP is used only when the socket is
 * unavailable; both paths terminate at the Worker coordinator, never at
 * API-Football from the browser.
 */
export function useLiveFixtureStream({ enabled, initialPayload, loadSnapshot }: Options): Result {
  const [payload, setPayload] = useState<FixturesPayload | undefined>(initialPayload);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [retrySignal, setRetrySignal] = useState(0);
  const loadRef = useRef(loadSnapshot);
  loadRef.current = loadSnapshot;

  const retry = useCallback(() => setRetrySignal((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    if (initialPayload) setPayload(initialPayload);

    let disposed = false;
    let socket: WebSocket | undefined;
    let fallbackTimer: number | undefined;
    let reconnectTimer: number | undefined;
    let connectTimer: number | undefined;
    let refreshInFlight = false;

    const clearTimers = () => {
      if (fallbackTimer !== undefined) window.clearInterval(fallbackTimer);
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      if (connectTimer !== undefined) window.clearTimeout(connectTimer);
      fallbackTimer = undefined;
      reconnectTimer = undefined;
      connectTimer = undefined;
    };

    const refreshOverHttp = async () => {
      if (disposed || refreshInFlight) return;
      refreshInFlight = true;
      setIsRefreshing(true);
      try {
        const response = await fetch("/api/fixtures/live", {
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        if (response.ok) {
          const next = (await response.json()) as unknown;
          if (isFixturesPayload(next)) {
            setPayload(next);
            return;
          }
        }
        const next = await loadRef.current();
        if (isFixturesPayload(next)) setPayload(next);
      } catch {
        try {
          const next = await loadRef.current();
          if (isFixturesPayload(next)) setPayload(next);
        } catch {
          // Keep the last real snapshot visible while the coordinator recovers.
        }
      } finally {
        refreshInFlight = false;
        setIsRefreshing(false);
      }
    };

    const startFallback = () => {
      if (disposed || fallbackTimer !== undefined) return;
      void refreshOverHttp();
      fallbackTimer = window.setInterval(() => void refreshOverHttp(), HTTP_FALLBACK_MS);
    };

    const connect = () => {
      if (disposed || typeof WebSocket === "undefined") {
        startFallback();
        return;
      }

      try {
        socket = new WebSocket(websocketUrl());
      } catch {
        startFallback();
        return;
      }

      connectTimer = window.setTimeout(() => {
        if (socket?.readyState === WebSocket.CONNECTING) {
          socket.close();
          startFallback();
        }
      }, 4_000);

      socket.onopen = () => {
        if (disposed) return;
        if (connectTimer !== undefined) window.clearTimeout(connectTimer);
        connectTimer = undefined;
        if (fallbackTimer !== undefined) window.clearInterval(fallbackTimer);
        fallbackTimer = undefined;
      };
      socket.onmessage = (event) => {
        try {
          const next = JSON.parse(String(event.data)) as unknown;
          if (isFixturesPayload(next)) setPayload(next);
        } catch {
          // Ignore a malformed heartbeat without losing the previous snapshot.
        }
      };
      socket.onerror = () => {
        if (!disposed) startFallback();
      };
      socket.onclose = () => {
        if (disposed) return;
        if (connectTimer !== undefined) window.clearTimeout(connectTimer);
        connectTimer = undefined;
        startFallback();
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = undefined;
          if (!disposed) connect();
        }, RECONNECT_MS);
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimers();
      socket?.close(1000, "Page changed");
    };
  }, [enabled, initialPayload, retrySignal]);

  return { payload, isRefreshing, retry };
}
