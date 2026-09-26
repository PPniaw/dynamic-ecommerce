// First visit: tell the visitor what this demo is — the store becomes what
// *they* are — and offer the two ways in: talk (guided chat) or pick traits.
// Shown to this browser's visitor ("你") until they've told us anything, once per
// browser (dismissal remembered in localStorage, read in an effect so render
// never touches it).
import { useEffect, useState } from "react";
import { isVisitor, nothingStated } from "../../../shared/personas";
import { GUIDE_COPY } from "./copy";
import { useStore } from "./StoreContext";

const KEY = "llm-shop:welcomed";

export function Welcome() {
  const { user, envelope, chatOpen, personaOpen, setChatOpen, setPersonaOpen } = useStore();
  const [seen, setSeen] = useState(true);
  useEffect(() => { try { setSeen(localStorage.getItem(KEY) === "1"); } catch { setSeen(false); } }, []);
  if (seen || !envelope || !user || !isVisitor(user.id) || !nothingStated(user.prefs.persona) || chatOpen || personaOpen) return null;

  const close = () => { setSeen(true); try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ } };
  const c = GUIDE_COPY.welcome;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 backdrop-blur-[1px] sm:items-center" onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="welcome-title" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-rise-in rounded-card bg-base p-6 shadow-flyout ring-1 ring-line">
        <p className="eyebrow text-fg-muted">{c.eyebrow}</p>
        <h2 id="welcome-title" className="heading mt-2 type-h2">{c.title}</h2>
        <p className="mt-3 txt-medium text-fg-subtle">{c.body}</p>
        <div className="mt-6 flex flex-col gap-2">
          <button type="button" autoFocus onClick={() => { close(); setChatOpen(true); }}
            className="h-11 cursor-pointer rounded-control bg-accent px-4 txt-medium font-semibold text-on-accent hover:bg-accent-hover">{c.chat}</button>
          <button type="button" onClick={() => { close(); setPersonaOpen(true); }}
            className="h-11 cursor-pointer rounded-control px-4 txt-medium font-medium ring-1 ring-line-strong hover:bg-component">{c.pick}</button>
          <button type="button" onClick={close} className="mt-1 cursor-pointer txt-small text-fg-muted underline">{c.browse}</button>
        </div>
      </div>
    </div>
  );
}
