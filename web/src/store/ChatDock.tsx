// Chat with the store. A visitor we know nothing about is first guided through
// who they are (MBTI, zodiac, traits, store type, vibe, light/dark — the page
// reshapes after each answer), then what they're looking for.
// What the shopper says becomes an update of their
// profile (shared/chat.ts); the store re-decides at once and the answer shows
// what changed plus the top of the new storefront. Prices and stock on those
// cards come from live data, never from the AI's reply.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { productPath } from "../../../shared/catalog";
import type { ChatChange, ChatResult, ChatTurn } from "../../../shared/chat";
import { ARCHETYPES, VIBES, type UserPrefs } from "../../../shared/decision";
import { isVisitor, MBTI_TYPES, nothingStated, TRAITS, ZODIACS, type Persona, type Trait } from "../../../shared/personas";
import { Price } from "../ds/ui/Price";
import { ProductImage } from "../ds/ui/ProductImage";
import { cn } from "../ds/ui/cn";
import { api } from "./backend";
import { ARCHETYPE_LABEL, CHAT_COPY, CHAT_UI, changeLabel, GUIDE_COPY, VIBE_LABEL } from "./copy";
import { useStore } from "./StoreContext";

interface Msg { role: "user" | "assistant"; text: string; changes?: ChatChange[]; productIds?: string[]; by?: ChatResult["understoodBy"] }

// ---- guided first conversation --------------------------------------------------
// Style first, products second: each answer is written straight into the
// persona (no AI needed, so it's instant and exact) and the store re-decides
// and morphs — the visitor watches their answer reshape the page. After the
// last step the chat is free text, read by the AI as before.

type Step = "mbti" | "zodiac" | "traits" | "style" | "vibe" | "scheme";
const STEPS: Step[] = ["mbti", "zodiac", "traits", "style", "vibe", "scheme"];
const askOf = (s: Step) => GUIDE_COPY[s].ask;

// A visitor who hasn't told us anything yet gets the guided start (guesses from
// browsing don't count; the demo shoppers are already described).
const guided = (id: string, p: UserPrefs) => isVisitor(id) && nothingStated(p.persona);

interface ChatState { msgs: Msg[]; step: number | null }

export function ChatDock() {
  const { user, envelope, chatOpen: open, setChatOpen: setOpen } = useStore();
  // Kept here, not in the panel, so closing and reopening the chat keeps the
  // conversation and the guide's progress. Reset when the shopper changes.
  const [state, setState] = useState<{ userId?: string } & ChatState>({ msgs: [], step: null });
  if (!user || !envelope) return null;
  const copy = CHAT_COPY[envelope.decision.archetype];
  const cur: ChatState = state.userId === user.id ? state
    : guided(user.id, user.prefs) ? { msgs: [{ role: "assistant", text: askOf("mbti") }], step: 0 } : { msgs: [], step: null };
  const setChat = (next: ChatState) => setState({ ...next, userId: user.id });
  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} aria-label={CHAT_UI.open}
          className="fixed bottom-[calc(16px+env(safe-area-inset-bottom,0px))] left-[68px] z-40 flex h-11 cursor-pointer items-center gap-2 rounded-full bg-accent px-3 txt-small font-semibold text-on-accent shadow-flyout transition-transform hover:-translate-y-0.5 sm:bottom-[calc(72px+env(safe-area-inset-bottom,0px))] sm:left-4 sm:px-4">
          {/* Phones: icon only, beside the shopper avatar, so the docks don't cover the page. */}
          <span aria-hidden>💬</span><span className="hidden sm:inline">{cur.step !== null ? GUIDE_COPY.welcome.chat.replace("💬 ", "") : copy.title}</span>
        </button>
      )}
      {open && <ChatPanel userId={user.id} chat={cur} setChat={setChat} onClose={() => setOpen(false)} />}
    </>
  );
}

function ChatPanel({ userId, chat, setChat, onClose }: { userId: string; chat: ChatState; setChat: (c: ChatState) => void; onClose: () => void }) {
  const { envelope, user, savePrefs } = useStore();
  const copy = CHAT_COPY[envelope!.decision.archetype];
  const { msgs, step } = chat;
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Trait[]>([]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, busy, step]);

  // Latest messages for async updates (the AI call resolves after re-renders).
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;
  const push = (add: Msg[], nextStep: number | null = step) => setChat({ msgs: [...msgsRef.current, ...add], step: nextStep });

  // Answer the current guide step: write it into the persona (instant re-decide
  // + morph), acknowledge, ask the next one.
  const answer = async (label: string | null, patch: ((p: UserPrefs) => UserPrefs) | null, ack: string) => {
    if (step === null || !user) return;
    const next = step + 1 < STEPS.length ? step + 1 : null;
    const reply = next === null ? `${ack}\n\n${GUIDE_COPY.done}` : `${ack}\n\n${askOf(STEPS[next])}`;
    push([...(label ? [{ role: "user" as const, text: label }] : []), { role: "assistant", text: reply }], next);
    setPicked([]);
    if (patch) await savePrefs(patch(user.prefs)).catch(() => {});
  };
  const persona = (f: (p: Persona) => Partial<Persona>) => (p: UserPrefs): UserPrefs => ({ ...p, persona: { ...p.persona, ...f(p.persona) } });

  const send = async (text: string) => {
    text = text.trim();
    if (!text || busy) return;
    const history: ChatTurn[] = msgs.map(({ role, text }) => ({ role, text }));
    push([{ role: "user", text }]);
    setDraft("");
    setBusy(true);
    try {
      const r = await api.chat(userId, text, history);
      // No AI reply → answer in the voice of the store they're now in.
      const voice = CHAT_COPY[r.archetype ?? envelope!.decision.archetype];
      push([{ role: "assistant", text: r.reply ?? voice.reply(r.changes.length > 0), changes: r.changes, productIds: r.productIds, by: r.understoodBy }]);
    } catch {
      push([{ role: "assistant", text: CHAT_UI.failed }]);
    } finally {
      setBusy(false);
    }
  };

  const guiding = step !== null;
  const chip = "cursor-pointer rounded-full px-3 py-1 txt-xsmall ring-1 ring-line-strong hover:bg-component";
  const on = "bg-primary text-on-primary ring-primary";

  // Phones: a half-height sheet, so the store above stays visible and the
  // visitor sees each answer reshape it.
  return (
    <div role="dialog" aria-label={copy.title}
      className="fixed bottom-[calc(16px+env(safe-area-inset-bottom,0px))] left-4 z-50 flex h-[52dvh] w-[400px] sm:h-[min(600px,calc(100dvh-2rem))] max-w-[calc(100vw-2rem)] animate-rise-in flex-col overflow-hidden rounded-card bg-base shadow-flyout ring-1 ring-line">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="heading txt-medium">{copy.title}</p>
        <div className="flex items-center gap-2">
          {guiding && <span className="txt-xsmall text-fg-muted">{GUIDE_COPY.step(step + 1, STEPS.length)}</span>}
          <button type="button" onClick={onClose} aria-label={CHAT_UI.close} className="cursor-pointer rounded-control px-2 py-1 txt-small text-fg-muted hover:bg-component">✕</button>
        </div>
      </div>

      <div className="flex grow flex-col gap-3 overflow-y-auto px-4 py-3">
        {!guiding && !msgs.length && <Bubble role="assistant">{copy.greeting}</Bubble>}
        {msgs.map((m, i) => <MsgView key={i} m={m} />)}
        {busy && <Bubble role="assistant"><span className="animate-pulse text-fg-muted">{CHAT_UI.thinking}</span></Bubble>}

        {/* Quick answers for the current guide step. */}
        {guiding && !busy && (
          <div className="flex flex-wrap gap-1.5">
            {STEPS[step] === "mbti" && <>
              <div className="grid w-full grid-cols-4 gap-1.5">
                {MBTI_TYPES.map((t) => <button key={t} type="button" className={chip} onClick={() => void answer(t, persona(() => ({ mbti: t })), GUIDE_COPY.mbti.ack(t))}>{t}</button>)}
              </div>
              <button type="button" className={chip} onClick={() => void answer(GUIDE_COPY.mbti.skip, null, GUIDE_COPY.skipped)}>{GUIDE_COPY.mbti.skip}</button>
            </>}
            {STEPS[step] === "zodiac" && <>
              {ZODIACS.map((z) => <button key={z} type="button" className={chip} onClick={() => void answer(`${z}座`, persona(() => ({ zodiac: z })), GUIDE_COPY.zodiac.ack(z))}>{z}</button>)}
              <button type="button" className={chip} onClick={() => void answer(GUIDE_COPY.zodiac.skip, null, GUIDE_COPY.skipped)}>{GUIDE_COPY.zodiac.skip}</button>
            </>}
            {STEPS[step] === "traits" && <>
              {TRAITS.map((t) => (
                <button key={t} type="button" aria-pressed={picked.includes(t)} className={cn(chip, picked.includes(t) && on)}
                  onClick={() => setPicked((xs) => (xs.includes(t) ? xs.filter((x) => x !== t) : [...xs, t]))}>{t}</button>
              ))}
              <div className="flex w-full gap-1.5 pt-1">
                <button type="button" disabled={!picked.length} className={cn(chip, on, "disabled:opacity-45")}
                  onClick={() => void answer(picked.join("、"), persona((p) => ({ traits: [...new Set([...p.traits, ...picked])] })), GUIDE_COPY.traits.ack(picked))}>{GUIDE_COPY.traits.done}</button>
                <button type="button" className={chip} onClick={() => void answer(GUIDE_COPY.traits.skip, null, GUIDE_COPY.skipped)}>{GUIDE_COPY.traits.skip}</button>
              </div>
            </>}
            {STEPS[step] === "style" && <>
              {ARCHETYPES.map((a) => (
                <button key={a} type="button" className={cn(chip, "w-full rounded-control py-2 text-left")}
                  onClick={() => void answer(`${ARCHETYPE_LABEL[a].name}店`, (p) => ({ ...p, archetype: a }), GUIDE_COPY.style.ack(`${ARCHETYPE_LABEL[a].name}店`))}>
                  <span className="font-semibold">{ARCHETYPE_LABEL[a].name}店</span> <span className="text-fg-muted">— 給{ARCHETYPE_LABEL[a].who}</span>
                </button>
              ))}
              <button type="button" className={chip} onClick={() => void answer(GUIDE_COPY.style.auto, (p) => ({ ...p, archetype: "auto" }), GUIDE_COPY.style.autoAck)}>{GUIDE_COPY.style.auto}</button>
            </>}
            {STEPS[step] === "vibe" && <>
              {VIBES.map((v) => (
                <button key={v} type="button" className={cn(chip, "w-full rounded-control py-2 text-left")}
                  onClick={() => void answer(VIBE_LABEL[v].name, (p) => ({ ...p, vibe: v }), GUIDE_COPY.vibe.ack(VIBE_LABEL[v].name))}>
                  <span className="font-semibold">{VIBE_LABEL[v].name}</span> <span className="text-fg-muted">— {VIBE_LABEL[v].hint}</span>
                </button>
              ))}
              <button type="button" className={chip} onClick={() => void answer(GUIDE_COPY.vibe.auto, (p) => ({ ...p, vibe: "auto" }), GUIDE_COPY.vibe.autoAck)}>{GUIDE_COPY.vibe.auto}</button>
            </>}
            {STEPS[step] === "scheme" && (["light", "dark", "auto"] as const).map((v) => (
              <button key={v} type="button" className={chip} onClick={() => void answer(GUIDE_COPY.scheme[v], (p) => ({ ...p, scheme: v }), GUIDE_COPY.scheme.ack(GUIDE_COPY.scheme[v]))}>{GUIDE_COPY.scheme[v]}</button>
            ))}
            <button type="button" className="w-full cursor-pointer pt-1 text-left txt-xsmall text-fg-muted underline"
              onClick={() => push([{ role: "assistant", text: GUIDE_COPY.done }], null)}>{GUIDE_COPY.skipAll}</button>
          </div>
        )}

        {/* After the guide (or for someone we already know): product prompts. */}
        {!guiding && !busy && !msgs.some((m) => m.role === "user" && !isGuideAnswer(m)) && (
          <div className="flex flex-wrap gap-1.5">
            {(msgs.length ? GUIDE_COPY.productSuggestions : copy.suggestions).map((s) => (
              <button key={s} type="button" onClick={() => void send(s)} className={chip}>{s}</button>
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

// Guide answers are user bubbles too; product prompts show until the first real message.
const GUIDE_ANSWERS = new Set<string>([...MBTI_TYPES, ...ZODIACS.map((z) => `${z}座`), GUIDE_COPY.mbti.skip, GUIDE_COPY.zodiac.skip, GUIDE_COPY.traits.skip,
  ...ARCHETYPES.map((a) => `${ARCHETYPE_LABEL[a].name}店`), GUIDE_COPY.style.auto, ...VIBES.map((v) => VIBE_LABEL[v].name), GUIDE_COPY.scheme.light, GUIDE_COPY.scheme.dark, GUIDE_COPY.scheme.auto]);
const isGuideAnswer = (m: Msg) => GUIDE_ANSWERS.has(m.text) || m.text.split("、").every((t) => (TRAITS as readonly string[]).includes(t));

function Bubble({ role, children }: { role: Msg["role"]; children: React.ReactNode }) {
  return (
    <div className={cn("max-w-[85%] whitespace-pre-line rounded-card px-3 py-2 txt-small", role === "user" ? "self-end bg-primary text-on-primary" : "self-start bg-subtle")}>
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
