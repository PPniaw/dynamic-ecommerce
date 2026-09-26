// Chat with the store. What the shopper says becomes an update of their
// profile (shared/chat.ts); the store re-decides at once and the answer shows
// what changed plus the top of the new storefront. Prices and stock on those
// cards come from live data, never from the AI's reply.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { productPath } from "../../../shared/catalog";
import type { ChatChange, ChatResult, ChatTurn } from "../../../shared/chat";
import { Price } from "../ds/ui/Price";
import { ProductImage } from "../ds/ui/ProductImage";
import { cn } from "../ds/ui/cn";
import { api } from "./backend";
import { CHAT_COPY, CHAT_UI, changeLabel } from "./copy";
import { useStore } from "./StoreContext";

interface Msg { role: "user" | "assistant"; text: string; changes?: ChatChange[]; productIds?: string[]; by?: ChatResult["understoodBy"] }

export function ChatDock() {
  const { user, envelope } = useStore();
  const [open, setOpen] = useState(false);
  if (!user || !envelope) return null;
  const copy = CHAT_COPY[envelope.decision.archetype];
  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} aria-label={CHAT_UI.open}
          className="fixed bottom-[calc(72px+env(safe-area-inset-bottom,0px))] left-4 z-40 flex cursor-pointer items-center gap-2 rounded-full bg-accent px-4 py-2.5 txt-small font-semibold text-on-accent shadow-flyout transition-transform hover:-translate-y-0.5">
          <span aria-hidden>💬</span>{copy.title}
        </button>
      )}
      {/* Keyed by shopper: switching shopper starts a fresh conversation. */}
      {open && <ChatPanel key={user.id} userId={user.id} onClose={() => setOpen(false)} />}
    </>
  );
}

function ChatPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { envelope } = useStore();
  const copy = CHAT_COPY[envelope!.decision.archetype];
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);

  const send = async (text: string) => {
    text = text.trim();
    if (!text || busy) return;
    const history: ChatTurn[] = msgs.map(({ role, text }) => ({ role, text }));
    setMsgs((m) => [...m, { role: "user", text }]);
    setDraft("");
    setBusy(true);
    try {
      const r = await api.chat(userId, text, history);
      // No AI reply → answer in the voice of the store they're now in.
      const voice = CHAT_COPY[r.archetype ?? envelope!.decision.archetype];
      setMsgs((m) => [...m, { role: "assistant", text: r.reply ?? voice.reply(r.changes.length > 0), changes: r.changes, productIds: r.productIds, by: r.understoodBy }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: CHAT_UI.failed }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-label={copy.title}
      className="fixed bottom-[calc(16px+env(safe-area-inset-bottom,0px))] left-4 z-50 flex h-[min(560px,calc(100dvh-2rem))] w-[380px] max-w-[calc(100vw-2rem)] animate-rise-in flex-col overflow-hidden rounded-card bg-base shadow-flyout ring-1 ring-line">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="heading txt-medium">{copy.title}</p>
        <button type="button" onClick={onClose} aria-label={CHAT_UI.close} className="cursor-pointer rounded-control px-2 py-1 txt-small text-fg-muted hover:bg-component">✕</button>
      </div>

      <div className="flex grow flex-col gap-3 overflow-y-auto px-4 py-3">
        <Bubble role="assistant">{copy.greeting}</Bubble>
        {msgs.map((m, i) => <MsgView key={i} m={m} />)}
        {busy && <Bubble role="assistant"><span className="animate-pulse text-fg-muted">{CHAT_UI.thinking}</span></Bubble>}
        {!msgs.length && !busy && (
          <div className="flex flex-wrap gap-1.5">
            {copy.suggestions.map((s) => (
              <button key={s} type="button" onClick={() => void send(s)}
                className="cursor-pointer rounded-full px-3 py-1 txt-xsmall ring-1 ring-line-strong hover:bg-component">{s}</button>
            ))}
          </div>
        )}
        <div ref={end} />
      </div>

      <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={copy.placeholder} maxLength={500} disabled={busy}
          className="min-w-0 grow rounded-control bg-component px-3 py-2 txt-small outline-none focus:ring-2 focus:ring-accent" />
        <button type="submit" disabled={busy || !draft.trim()}
          className="cursor-pointer rounded-control bg-primary px-3 py-2 txt-small font-semibold text-on-primary disabled:opacity-45">{CHAT_UI.send}</button>
      </form>
    </div>
  );
}

function Bubble({ role, children }: { role: Msg["role"]; children: React.ReactNode }) {
  return (
    <div className={cn("max-w-[85%] rounded-card px-3 py-2 txt-small", role === "user" ? "self-end bg-primary text-on-primary" : "self-start bg-subtle")}>
      {children}
    </div>
  );
}

function MsgView({ m }: { m: Msg }) {
  const { products, add } = useStore();
  if (m.role === "user") return <Bubble role="user">{m.text}</Bubble>;
  const items = (m.productIds ?? []).map((id) => products.get(id)).filter((p) => !!p);
  return (
    <div className="flex flex-col gap-2">
      <Bubble role="assistant">{m.text}</Bubble>
      {!!m.changes?.length && (
        <div className="flex flex-wrap gap-1">
          {m.changes.map((c, i) => <span key={i} className="rounded-badge bg-component px-2 py-0.5 txt-xsmall">{changeLabel(c)}</span>)}
        </div>
      )}
      {items.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 rounded-control bg-subtle p-1.5">
              <ProductImage image={p.image} name={p.name} ratio="square" width={120} quietFallback className="h-12 w-12 shrink-0 overflow-hidden rounded-control" />
              <Link to={productPath(p)} className="min-w-0 grow truncate txt-small hover:underline">{p.name}</Link>
              <Price amount={p.price} compareAt={p.compareAt} size="sm" showDiscount={false} />
              <button type="button" disabled={p.stock === 0} onClick={() => void add(p.id)} aria-label={`加入購物車:${p.name}`}
                className="cursor-pointer rounded-control bg-primary px-2 py-1 txt-xsmall font-semibold text-on-primary disabled:opacity-45">＋</button>
            </li>
          ))}
        </ul>
      )}
      {m.by && <p className="txt-xsmall text-fg-muted">{CHAT_UI.aiNote[m.by]}</p>}
    </div>
  );
}
