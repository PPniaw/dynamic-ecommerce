// Home = the decision, rendered. Order, surfaces, layouts and products all
// come from the engine; this file only knows how each kind looks.
import type { Product } from "../../../../shared/catalog";
import type { Decision, Section } from "../../../../shared/decision";
import { Surface } from "../../ds/theme/ThemeScope";
import { cn } from "../../ds/ui/cn";
import type { Highlight } from "../../ds/ui/ProductCard";
import { CATEGORY_COPY, INTENT_COPY } from "../copy";
import { Categories, Marquee, Promo, Story, Ticker } from "../sections/Blocks";
import { Hero } from "../sections/Hero";
import { Rail, SectionHead } from "../sections/Rail";
import { useStore } from "../StoreContext";

export function highlightMap(d: Decision) {
  return new Map<string, Highlight>(d.highlights.map((h) => [h.productId, h.badge]));
}

export function pick(products: Map<string, Product>, ids: string[]) {
  return ids.map((id) => products.get(id)).filter((p): p is Product => !!p);
}

// Stable identity per section (not index, not timestamp): a re-decision that
// keeps a section keeps its DOM, so it can morph instead of remounting.
function sectionKeys(sections: Section[]) {
  const seen = new Map<string, number>();
  return sections.map((s) => {
    const base = `${s.kind}-${s.intent}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  });
}

export function Home() {
  const { envelope, products } = useStore();
  if (!envelope) return null;
  const d = envelope.decision;
  const hl = highlightMap(d);
  const keys = sectionKeys(d.sections);

  return (
    <>
      <div style={{ viewTransitionName: "hero" }}>
        <Hero hero={d.hero} products={pick(products, d.hero.productIds)} />
      </div>
      {/* The flash hero is its own coloured band; the next section butts against it. */}
      <div className={cn("flex flex-col", d.hero.variant !== "flash" && "mt-(--section-gap)")}>
        {d.sections.map((s, i) => {
          const items = pick(products, s.productIds);
          const [title, sub] = INTENT_COPY[d.archetype][s.intent];
          const heading = s.intent === "category" && s.category !== "none" ? CATEGORY_COPY[s.category].label : title;
          const slim = s.kind === "marquee" || s.kind === "ticker";
          // Page-surface sections share the page's rhythm; coloured ones get their own padding.
          const pad = slim ? "py-5" : s.surface === "page" ? "py-[calc(var(--section-gap)/2)]" : "py-[calc(var(--section-gap)/1.6)]";
          return (
            <Surface key={keys[i]} surface={s.surface} className={cn(pad, "animate-rise-in")}>
              <div id={`s${i}`} className={cn(!slim && "page")} style={{ viewTransitionName: `sec-${keys[i]}` }}>
                {!slim && s.kind !== "promo" && <SectionHead archetype={d.archetype} title={heading} sub={sub} />}
                {s.kind === "rail" && <Rail layout={s.layout} products={items} card={d.card} highlights={hl} />}
                {s.kind === "story" && <Story products={items} />}
                {s.kind === "marquee" && <Marquee products={items} />}
                {s.kind === "categories" && <Categories archetype={d.archetype} layout={s.layout} />}
                {s.kind === "promo" && <Promo />}
                {s.kind === "ticker" && <Ticker />}
              </div>
            </Surface>
          );
        })}
      </div>
    </>
  );
}
