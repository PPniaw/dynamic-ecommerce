// Bottom-right: which engine arranged this store, why, and — when a new
// decision is waiting — a button to apply it now instead of on the next page.
import { useState } from "react";
import { cn } from "../ds/ui/cn";
import { ARCHETYPE_LABEL, SIGNAL_LABEL, SOURCE_LABEL, SOURCE_SHORT, TRIGGER_LABEL } from "./copy";
import { STATIC } from "./backend";
import { useStore } from "./StoreContext";

export function DecisionPeek() {
  const { envelope, pending, deciding, claude, applyPending, connected } = useStore();
  const [open, setOpen] = useState(false);
  if (!envelope) return null;
  const d = envelope.decision;
  return (
    <div className="fixed right-4 bottom-[calc(16px+env(safe-area-inset-bottom,0px))] z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      {pending && (
        <button type="button" onClick={applyPending} title="不點的話,換頁時會自動套用"
          className="animate-rise-in cursor-pointer rounded-full bg-accent px-4 py-2 txt-small font-semibold text-on-accent shadow-flyout">
          已為你重新安排 · 現在套用
        </button>
      )}
      {open && (
        <div className="w-80 max-w-full animate-rise-in rounded-card bg-base p-4 shadow-flyout ring-1 ring-line">
          <p className="txt-xsmall text-fg-muted">這家店現在是</p>
          <p className="heading type-h3">「{ARCHETYPE_LABEL[d.archetype].name}」店</p>
          <p className="mt-1 txt-small text-fg-subtle">
            由{SOURCE_LABEL[envelope.source]}決定 · 因為「{TRIGGER_LABEL[envelope.trigger] ?? envelope.trigger}」· {envelope.latencyMs}ms
          </p>
          {!claude && <p className="mt-2 txt-xsmall text-warning">{STATIC ? "預覽版:由瀏覽器裡的規則引擎決策,商品照片無法載入。" : "尚未設定 TYPESAFE_API_KEY 或 ANTHROPIC_API_KEY,目前由規則引擎決策。"}</p>}
          <div className="mt-3 flex flex-wrap gap-1">
            {d.signals.map((s) => <span key={s} className="rounded-badge bg-component px-2 py-0.5 txt-xsmall">{SIGNAL_LABEL[s]}</span>)}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer txt-xsmall text-fg-muted underline">模型輸出(JSON)</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-control bg-component p-2 text-[10px] leading-4">{JSON.stringify(d, null, 2)}</pre>
          </details>
        </div>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex cursor-pointer items-center gap-2 rounded-full bg-base px-3.5 py-2 txt-small shadow-flyout ring-1 ring-line">
        <span className={cn("h-2 w-2 rounded-full", !connected ? "bg-danger" : deciding ? "animate-pulse bg-warning" : "bg-success")} />
        {deciding ? "AI 正在重新安排…" : `${ARCHETYPE_LABEL[d.archetype].name}店 · ${SOURCE_SHORT[envelope.source]}`}
      </button>
    </div>
  );
}
