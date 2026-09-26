// "你是誰?" — pick one of the demo shoppers, or describe yourself (MBTI,
// zodiac, traits, interests, budget, need) and watch the store change. The
// archetype scores update live as you edit, so the reason is visible.
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { pickArchetype, scoreArchetypes } from "../../../shared/archetypes";
import { SHOP_CATEGORIES } from "../../../shared/catalog";
import { ARCHETYPES, type Archetype, type User, type UserPrefs } from "../../../shared/decision";
import { INTERESTS, TRAITS, ZODIACS, type MBTI } from "../../../shared/personas";
import { ThemeScope, useTheme } from "../ds/theme/ThemeScope";
import { Button } from "../ds/ui/Button";
import { cn } from "../ds/ui/cn";
import { ARCHETYPE_LABEL, CATEGORY_COPY, INFER_COPY } from "./copy";
import { useStore } from "./StoreContext";

export function personaLine(u: User) {
  const p = u.prefs.persona;
  return [p.mbti, p.zodiac && `${p.zodiac}座`].filter(Boolean).join(" · ") || "還沒填個性";
}

export function PersonaDock() {
  const { user } = useStore();
  const [open, setOpen] = useState(false);
  const guessed = useGuessToast(user);
  if (!user) return null;
  return (
    <>
      {guessed && (
        <button type="button" onClick={() => setOpen(true)} role="status"
          className="fixed bottom-[calc(72px+env(safe-area-inset-bottom,0px))] left-4 sm:bottom-[calc(124px+env(safe-area-inset-bottom,0px))] z-40 max-w-[calc(100vw-2rem)] animate-rise-in cursor-pointer rounded-card bg-base px-3.5 py-2 text-left txt-small shadow-flyout ring-1 ring-line">
          {INFER_COPY.toast(guessed)}
          <span className="block txt-xsmall text-fg-muted">{INFER_COPY.toastHint}</span>
        </button>
      )}
      <button type="button" onClick={() => setOpen(true)}
        aria-label={`${user.name} · ${personaLine(user)}`}
        className="fixed bottom-[calc(16px+env(safe-area-inset-bottom,0px))] left-4 z-40 flex h-11 cursor-pointer items-center gap-2.5 rounded-full bg-primary p-1.5 text-on-primary shadow-flyout transition-transform hover:-translate-y-0.5 sm:pr-4">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-accent txt-small font-bold text-on-accent">{user.name.slice(0, 1)}</span>
        {/* Phones: avatar only. */}
        <span className="hidden text-left leading-tight sm:block">
          <span className="block txt-small font-semibold">{user.name}</span>
          <span className="block text-[11px] opacity-75">{personaLine(user)}</span>
        </span>
      </button>
      <PersonaDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// A new guess from behaviour (shared/infer.ts) → a short note above the dock.
// Only for the same shopper: switching shopper isn't a guess.
function useGuessToast(user: User | undefined): string[] | null {
  const [shown, setShown] = useState<string[] | null>(null);
  const prev = useRef<{ id: string; inferred: string[] } | null>(null);
  const inferred = user?.prefs.persona.inferred ?? [];
  const key = inferred.join();
  useEffect(() => {
    if (!user) return;
    const before = prev.current;
    prev.current = { id: user.id, inferred };
    if (!before || before.id !== user.id) return;
    const added = inferred.filter((t) => !before.inferred.includes(t));
    if (!added.length) return;
    setShown(added);
    const t = setTimeout(() => setShown(null), 6000);
    return () => clearTimeout(t);
  }, [user?.id, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return shown;
}

const AXES: [string, string, string, string][] = [["I", "內向", "E", "外向"], ["N", "直覺", "S", "實感"], ["F", "情感", "T", "思考"], ["P", "隨性", "J", "計畫"]];

function PersonaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const { user, users, switchUser, savePrefs } = useStore();
  const [draft, setDraft] = useState<UserPrefs | undefined>(user?.prefs);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setDraft(user?.prefs); }, [open, user]);

  const scores = useMemo(() => draft ? scoreArchetypes(draft.persona, 0, draft.budget !== null) : null, [draft]);
  if (!user || !draft || !scores) return null;
  const winner = draft.archetype !== "auto" ? draft.archetype : pickArchetype(scores);
  const max = Math.max(1, ...Object.values(scores));
  const persona = draft.persona;
  const setPersona = (patch: Partial<typeof persona>) => setDraft({ ...draft, persona: { ...persona, ...patch } });
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const mbti = persona.mbti ?? "INFP";
  const setAxis = (i: number, letter: string) => setPersona({ mbti: (mbti.slice(0, i) + letter + mbti.slice(i + 1)) as MBTI });

  const save = async () => {
    setSaving(true);
    try { await savePrefs(draft); onClose(); } finally { setSaving(false); }
  };

  const chip = (on: boolean) => cn("h-8 cursor-pointer rounded-control px-3 txt-small transition-colors", on ? "bg-primary text-on-primary" : "bg-component text-fg-subtle hover:text-fg");

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <ThemeScope theme={theme} className="contents">
        <DialogBackdrop transition className="fixed inset-0 bg-black/30 transition duration-300 data-closed:opacity-0" />
        <div className="fixed inset-y-0 left-0 flex w-full max-w-lg">
          <DialogPanel transition className="flex w-full flex-col overflow-y-auto bg-base shadow-flyout transition duration-300 ease-(--ease-out-soft) data-closed:-translate-x-full">
            <div className="flex flex-col gap-8 p-6">
              <div>
                <DialogTitle className="heading type-h2">你是誰?</DialogTitle>
                <p className="mt-1 txt-small text-fg-muted">不同個性的人,會走進不同的店。換一位顧客,或描述你自己。</p>
              </div>

              <section className="flex flex-col gap-2">
                <p className="eyebrow text-fg-muted">示範顧客</p>
                <div className="grid grid-cols-2 gap-2">
                  {users.map((u) => {
                    const a = u.prefs.archetype !== "auto" ? u.prefs.archetype : pickArchetype(scoreArchetypes(u.prefs.persona, 0, u.prefs.budget !== null));
                    const active = u.id === user.id;
                    return (
                      <button key={u.id} type="button" onClick={() => { switchUser(u.id); onClose(); }} aria-pressed={active}
                        className={cn("flex cursor-pointer flex-col items-start gap-0.5 rounded-card p-3 text-left ring-1 transition-colors", active ? "bg-subtle ring-fg" : "ring-line hover:bg-subtle")}>
                        <span className="txt-medium font-semibold">{u.name}</span>
                        <span className="txt-xsmall text-fg-muted">{personaLine(u)}</span>
                        <span className="mt-1 txt-xsmall">走進「{ARCHETYPE_LABEL[a].name}」店</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="flex flex-col gap-5">
                <p className="eyebrow text-fg-muted">描述 {user.name}</p>
                <Field label="MBTI">
                  <div className="grid grid-cols-4 gap-2">
                    {AXES.map(([a, al, b, bl], i) => (
                      <div key={i} className="flex flex-col gap-1">
                        {[[a, al], [b, bl]].map(([letter, label]) => (
                          <button key={letter} type="button" className={chip(persona.mbti !== null && mbti[i] === letter)} onClick={() => setAxis(i, letter)}>
                            {letter} <span className="txt-xsmall opacity-70">{label}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                  {persona.mbti && <button type="button" className="mt-1 cursor-pointer self-start txt-xsmall text-fg-muted underline" onClick={() => setPersona({ mbti: null })}>清除 MBTI</button>}
                </Field>
                <Field label="星座">
                  <div className="flex flex-wrap gap-1.5">
                    {ZODIACS.map((z) => <button key={z} type="button" className={chip(persona.zodiac === z)} onClick={() => setPersona({ zodiac: persona.zodiac === z ? null : z })}>{z}</button>)}
                  </div>
                </Field>
                <Field label="個性">
                  <div className="flex flex-wrap gap-1.5">
                    {TRAITS.map((t) => {
                      const guess = persona.inferred?.includes(t) && persona.traits.includes(t);
                      return (
                        <button key={t} type="button" title={guess ? INFER_COPY.chipTitle : undefined}
                          className={cn(chip(persona.traits.includes(t)), guess && "bg-transparent text-fg outline-1 -outline-offset-1 outline-dashed outline-fg")}
                          onClick={() => setPersona({ traits: toggle(persona.traits, t) })}>
                          {t}{guess && <span className="ml-1 txt-xsmall opacity-70">{INFER_COPY.chip}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {!!persona.inferred?.some((t) => persona.traits.includes(t)) && <p className="mt-1 txt-xsmall text-fg-muted">{INFER_COPY.panelHint}</p>}
                </Field>
                <Field label="興趣">
                  <div className="flex flex-wrap gap-1.5">
                    {INTERESTS.map((t) => <button key={t} type="button" className={chip(persona.interests.includes(t))} onClick={() => setPersona({ interests: toggle(persona.interests, t) })}>{t}</button>)}
                  </div>
                </Field>
                <Field label="常逛的分類">
                  <div className="flex flex-wrap gap-1.5">
                    {SHOP_CATEGORIES.map((c) => <button key={c} type="button" className={chip(draft.categories.includes(c))} onClick={() => setDraft({ ...draft, categories: toggle(draft.categories, c) })}>{CATEGORY_COPY[c].label}</button>)}
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="單品預算上限">
                    <input id="budget" type="number" min={0} step={100} placeholder="不限" value={draft.budget ?? ""}
                      onChange={(e) => setDraft({ ...draft, budget: e.target.value ? Math.max(0, Number(e.target.value)) || null : null })}
                      className="h-10 rounded-control bg-component px-3 txt-medium tabular-nums" />
                  </Field>
                  <Field label="明暗">
                    <div className="flex gap-1.5">
                      {(["auto", "light", "dark"] as const).map((s) => <button key={s} type="button" className={chip(draft.scheme === s)} onClick={() => setDraft({ ...draft, scheme: s })}>{{ auto: "自動", light: "亮", dark: "暗" }[s]}</button>)}
                    </div>
                  </Field>
                </div>
                <Field label="現在的需求(會交給 AI 讀)">
                  <textarea id="need" rows={2} value={draft.need} placeholder="例如:要送同事的生日禮物,預算一千內"
                    onChange={(e) => setDraft({ ...draft, need: e.target.value.slice(0, 200) })}
                    className="rounded-control bg-component px-3 py-2 txt-medium" />
                </Field>
              </section>

              <section className="flex flex-col gap-3 rounded-card bg-subtle p-4">
                <p className="txt-small">依這些資料,{user.name} 會走進 <strong className="heading">「{ARCHETYPE_LABEL[winner].name}」</strong> 店 —— 給{ARCHETYPE_LABEL[winner].who}。</p>
                <div className="flex flex-col gap-1.5">
                  {ARCHETYPES.map((a) => (
                    <div key={a} className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-2 txt-xsmall">
                      <span>{ARCHETYPE_LABEL[a].name}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-component">
                        <span className={cn("block h-full rounded-full transition-[width] duration-300", a === winner ? "bg-accent" : "bg-line-strong")} style={{ width: `${(scores[a] / max) * 100}%` }} />
                      </span>
                      <span className="text-right tabular-nums text-fg-muted">{scores[a].toFixed(1)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="txt-xsmall text-fg-muted">直接指定:</span>
                  {(["auto", ...ARCHETYPES] as ("auto" | Archetype)[]).map((a) => (
                    <button key={a} type="button" className={chip(draft.archetype === a)} onClick={() => setDraft({ ...draft, archetype: a })}>{a === "auto" ? "交給 AI" : ARCHETYPE_LABEL[a].name}</button>
                  ))}
                </div>
                <p className="txt-xsmall text-fg-muted">這是規則引擎的分數;有 API key 時由 Claude 綜合判斷,結果可能不同。</p>
              </section>
            </div>
            <div className="sticky bottom-0 flex gap-2 border-t border-line bg-base p-4">
              <Button variant="secondary" onClick={onClose}>取消</Button>
              <Button block loading={saving} onClick={save}>儲存,重新安排這家店</Button>
            </div>
          </DialogPanel>
        </div>
      </ThemeScope>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="txt-small font-medium">{label}</span>
      {children}
    </div>
  );
}
