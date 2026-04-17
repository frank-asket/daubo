"use client";

import { useEffect, useRef, useState } from "react";

type UseSseEventStreamOptions<T> = {
  enabled?: boolean;
  url: string;
  eventName: string;
  parseErrorMessage: string;
  pausedMessage: string;
  staleAfterMs?: number;
  debounceMs?: number;
  minReconnectMs?: number;
  maxReconnectMs?: number;
  jitterRatio?: number;
  initialEvent?: T | null;
};

export type SseConnectionState<T> = {
  event: T | null;
  streamError: string | null;
  isConnected: boolean;
  isStale: boolean;
  reconnectAttempt: number;
  lastEventAt: number | null;
};

function parseJsonPayload<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

function clampMs(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function reconnectDelayMs(
  attempt: number,
  minReconnectMs: number,
  maxReconnectMs: number,
  jitterRatio: number,
): number {
  const exp = minReconnectMs * Math.pow(2, Math.max(0, attempt - 1));
  const base = clampMs(exp, minReconnectMs, maxReconnectMs);
  const jitter = 1 + (Math.random() * 2 - 1) * jitterRatio;
  return clampMs(Math.round(base * jitter), minReconnectMs, maxReconnectMs);
}

export function useSseEventStream<T>({
  enabled = true,
  url,
  eventName,
  parseErrorMessage,
  pausedMessage,
  staleAfterMs = 25_000,
  debounceMs = 300,
  minReconnectMs = 1_000,
  maxReconnectMs = 30_000,
  jitterRatio = 0.2,
  initialEvent = null,
}: UseSseEventStreamOptions<T>): SseConnectionState<T> {
  const [event, setEvent] = useState<T | null>(initialEvent);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);

  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const staleTimerRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const connectedRef = useRef(false);
  const pendingEventRef = useRef<T | null>(null);
  const lastEventAtRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const disposedRef = useRef(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    disposedRef.current = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const clearDebounceTimer = (clearPending = true) => {
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (clearPending) pendingEventRef.current = null;
    };

    const closeSource = () => {
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
    };

    const touchHeartbeat = () => {
      const now = Date.now();
      lastEventAtRef.current = now;
      setLastEventAt(now);
      setIsStale(false);
      setStreamError(null);
    };

    const flushPendingEvent = () => {
      if (pendingEventRef.current == null) return;
      setEvent(pendingEventRef.current);
      pendingEventRef.current = null;
    };

    const queueEvent = (payload: T) => {
      pendingEventRef.current = payload;
      clearDebounceTimer(false);
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        flushPendingEvent();
      }, debounceMs);
    };

    const scheduleReconnect = () => {
      if (disposedRef.current) return;
      reconnectAttemptRef.current += 1;
      const attempt = reconnectAttemptRef.current;
      setReconnectAttempt(attempt);
      const delay = reconnectDelayMs(
        attempt,
        minReconnectMs,
        maxReconnectMs,
        jitterRatio,
      );
      clearReconnectTimer();
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (disposedRef.current) return;
      closeSource();

      const es = new EventSource(url);
      sourceRef.current = es;

      es.onopen = () => {
        reconnectAttemptRef.current = 0;
        setReconnectAttempt(0);
        setIsConnected(true);
        connectedRef.current = true;
        touchHeartbeat();
      };

      es.addEventListener(eventName, (evt) => {
        touchHeartbeat();
        try {
          const payload = parseJsonPayload<T>((evt as MessageEvent).data);
          queueEvent(payload);
        } catch {
          setStreamError(parseErrorMessage);
        }
      });

      es.addEventListener("ping", () => {
        touchHeartbeat();
      });

      es.onerror = () => {
        if (disposedRef.current) return;
        setIsConnected(false);
        connectedRef.current = false;
        setStreamError(pausedMessage);
        closeSource();
        scheduleReconnect();
      };
    };

    staleTimerRef.current = window.setInterval(() => {
      if (disposedRef.current) return;
      if (!connectedRef.current) return;
      const lastTs = lastEventAtRef.current;
      if (lastTs == null) return;
      if (Date.now() - lastTs > staleAfterMs) {
        setIsStale(true);
      }
    }, 2_000);

    connect();

    return () => {
      disposedRef.current = true;
      clearReconnectTimer();
      clearDebounceTimer();
      if (staleTimerRef.current != null) {
        window.clearInterval(staleTimerRef.current);
        staleTimerRef.current = null;
      }
      closeSource();
      connectedRef.current = false;
    };
  }, [
    debounceMs,
    enabled,
    eventName,
    jitterRatio,
    maxReconnectMs,
    minReconnectMs,
    parseErrorMessage,
    pausedMessage,
    staleAfterMs,
    url,
  ]);

  return { event, streamError, isConnected, isStale, reconnectAttempt, lastEventAt };
}
