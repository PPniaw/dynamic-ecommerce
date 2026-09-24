import "../ds/tokens.css";
import "../ds/fonts.css";
import { useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { deriveVars } from "../ds/theme/derive";
import { DEFAULT_THEME, ThemeScope } from "../ds/theme/ThemeScope";
import { Skeleton } from "../ds/ui/Skeleton";
import { CartDrawer } from "./CartDrawer";
import { DecisionPeek } from "./DecisionPeek";
import { CategoryPage, NotFound } from "./pages/CategoryPage";
import { Home } from "./pages/Home";
import { OrderPage } from "./pages/OrderPage";
import { ProductPage } from "./pages/ProductPage";
import { PersonaDock } from "./PersonaPanel";
import { Footer, Header } from "./sections/Header";
import { StoreProvider, useStore } from "./StoreContext";

function Shell() {
  const { envelope, applyPending } = useStore();
  const location = useLocation();
  const theme = envelope?.decision.theme ?? DEFAULT_THEME;

  // A waiting re-decision applies when the shopper moves to another page —
  // never while they're reading this one (design-spec §6).
  useEffect(() => { applyPending(); window.scrollTo({ top: 0 }); }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Paint the page behind overscroll and the safe areas in the theme's colour.
  const bg = useMemo(() => deriveVars(theme.palette, theme.scheme, "page")["--bg-base"], [theme.palette, theme.scheme]);
  useEffect(() => { document.documentElement.style.background = bg; }, [bg]);

  if (!envelope) {
    // First load only: skeleton in the default theme.
    return (
      <ThemeScope theme={DEFAULT_THEME} className="min-h-screen">
        <div className="page flex flex-col gap-8 pt-10" aria-busy>
          <Skeleton className="mx-auto h-10 w-40" />
          <Skeleton className="h-80 w-full" />
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="aspect-[4/5]" />)}</div>
        </div>
      </ThemeScope>
    );
  }

  const d = envelope.decision;
  // overflow-x-clip: tilted collage stickers may poke past the edge; never scroll the page sideways.
  return (
    <ThemeScope theme={d.theme} className="flex min-h-screen flex-col overflow-x-clip">
      <div data-archetype={d.archetype} className="contents">
        <div style={{ viewTransitionName: "header" }}><Header header={d.header} /></div>
        <main className="grow pb-24">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/c/:category" element={<CategoryPage />} />
            <Route path="/p/:slug" element={<ProductPage />} />
            <Route path="/order/:id" element={<OrderPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer archetype={d.archetype} />
        <CartDrawer />
        <PersonaDock />
        <DecisionPeek />
      </div>
    </ThemeScope>
  );
}

createRoot(document.getElementById("root")!).render(
  <StoreProvider>
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  </StoreProvider>,
);
