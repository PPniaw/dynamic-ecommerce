// Where the store's data comes from: the real server (REST + websocket), or —
// in the static preview build — the in-browser mirror in static/engine.ts.
import type { ServerMessage } from "../../../shared/decision";
import { api as netApi } from "./api";
import * as engine from "./static/engine";

export const STATIC = import.meta.env.VITE_STATIC === "1";
export const api = STATIC ? engine.api : netApi;

export function openChannel(userId: string, h: { onOpen: () => void; onClose: () => void; onMessage: (m: ServerMessage) => void }): () => void {
  if (STATIC) {
    h.onOpen();
    return engine.connect(userId, h.onMessage);
  }
  let ws: WebSocket;
  let closed = false;
  let timer: ReturnType<typeof setTimeout>;
  let retry = 0;
  const connect = () => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/ws?userId=${encodeURIComponent(userId)}`);
    ws.onopen = () => { retry = 0; h.onOpen(); };
    ws.onclose = () => { h.onClose(); if (!closed) timer = setTimeout(connect, Math.min(8000, 500 * 2 ** retry++)); };
    // A late message from a socket we already closed (shopper switched) must
    // not land in the new shopper's store.
    ws.onmessage = (ev) => { if (!closed) h.onMessage(JSON.parse(ev.data) as ServerMessage); };
  };
  connect();
  return () => { closed = true; clearTimeout(timer); ws?.close(); };
}
