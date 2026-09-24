// Cart drawer (Vercel Commerce's recipe: backdrop fade + panel slide, MIT),
// with live prices: lines say when the price moved since you added them, and
// the total shimmers while it's being recomputed.
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { productPath } from "../../../shared/catalog";
import { ThemeScope, useTheme } from "../ds/theme/ThemeScope";
import { Button } from "../ds/ui/Button";
import { Price, formatMoney } from "../ds/ui/Price";
import { ProductImage } from "../ds/ui/ProductImage";
import { FREE_SHIPPING } from "./copy";
import { useStore } from "./StoreContext";

export function CartDrawer() {
  const theme = useTheme();
  const { cart, products, cartOpen, setCartOpen, setQty, checkout } = useStore();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const total = cart.reduce((s, l) => s + (products.get(l.productId)?.price ?? 0) * l.qty, 0);
  const blocked = cart.filter((l) => (products.get(l.productId)?.stock ?? 0) < l.qty);
  const toFree = Math.max(0, FREE_SHIPPING - total);

  const change = async (pid: string, qty: number) => {
    setPending(true);
    try { await setQty(pid, qty); } finally { setPending(false); }
  };
  const pay = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const r = await checkout();
      setCartOpen(false);
      navigate(`/order/${r.orderId}`);
    } catch (e) {
      const body = (e as { body?: { error: string; productId?: string } }).body;
      setError(body?.error === "out_of_stock" ? `「${products.get(body.productId!)?.name}」剛剛被別人買走了,請調整數量。` : "結帳沒有成功,請再試一次。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={cartOpen} onClose={setCartOpen} className="relative z-50">
      {/* The dialog renders in a portal outside the theme root: re-apply the theme inside it. */}
      <ThemeScope theme={theme} className="contents">
        <DialogBackdrop transition className="fixed inset-0 bg-black/30 backdrop-blur-[1px] transition duration-300 data-closed:opacity-0" />
        <div className="fixed inset-y-0 right-0 flex w-full max-w-md">
          <DialogPanel transition className="flex w-full flex-col bg-base shadow-flyout transition duration-300 ease-(--ease-out-soft) data-closed:translate-x-full">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <DialogTitle className="heading txt-xlarge">購物車</DialogTitle>
              <button type="button" onClick={() => setCartOpen(false)} className="grid h-9 w-9 cursor-pointer place-items-center rounded-control hover:bg-component" aria-label="關閉">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m4 4 8 8M12 4l-8 8" /></svg>
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="flex grow flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="heading type-h3">購物車是空的</p>
                <p className="txt-small text-fg-muted">逛逛看,喜歡的就先放進來。</p>
              </div>
            ) : (
              <ul className="grow divide-y divide-line overflow-y-auto px-5">
                {cart.map((l) => {
                  const p = products.get(l.productId);
                  if (!p) return null;
                  const delta = p.price - l.priceAtAdd;
                  return (
                    <li key={l.productId} className="flex gap-4 py-4">
                      <Link to={productPath(p)} onClick={() => setCartOpen(false)} className="w-20 shrink-0 overflow-hidden rounded-media">
                        <ProductImage image={p.image} name="" ratio="square" width={200} quietFallback />
                      </Link>
                      <div className="flex min-w-0 grow flex-col gap-1">
                        <Link to={productPath(p)} onClick={() => setCartOpen(false)} className="truncate txt-medium hover:underline">{p.name}</Link>
                        <Price amount={p.price} compareAt={p.compareAt} size="sm" showDiscount={false} />
                        {delta < 0 && <p className="txt-xsmall text-success">加入後降了 {formatMoney(-delta)}</p>}
                        {delta > 0 && <p className="txt-xsmall text-warning">加入後漲了 {formatMoney(delta)}</p>}
                        {p.stock < l.qty && <p className="txt-xsmall text-danger">庫存只剩 {p.stock} 件</p>}
                        <div className="mt-1 flex items-center gap-3">
                          <div className="flex h-8 items-center rounded-control ring-1 ring-line-strong">
                            <button type="button" className="h-full w-8 cursor-pointer" onClick={() => change(p.id, l.qty - 1)} aria-label="減少">−</button>
                            <span className="w-6 text-center txt-small tabular-nums">{l.qty}</span>
                            <button type="button" className="h-full w-8 cursor-pointer disabled:opacity-40" disabled={l.qty >= p.stock} onClick={() => change(p.id, l.qty + 1)} aria-label="增加">+</button>
                          </div>
                          <button type="button" className="cursor-pointer txt-xsmall text-fg-muted underline hover:text-fg" onClick={() => change(p.id, 0)}>移除</button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex flex-col gap-3 border-t border-line p-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
              <div className="flex flex-col gap-1.5">
                <p className="txt-small">{toFree > 0 ? `再 ${formatMoney(toFree)} 就免運` : "已享免運"}</p>
                <div className="h-1.5 overflow-hidden rounded-full bg-component">
                  <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.min(100, (total / FREE_SHIPPING) * 100)}%` }} />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="txt-medium">總計 <span className="txt-xsmall text-fg-muted">(以當下價格計算)</span></span>
                <Price amount={total} size="lg" pending={pending} />
              </div>
              {error && <p className="txt-small text-danger" role="alert">{error}</p>}
              <Button size="lg" block disabled={cart.length === 0 || blocked.length > 0} loading={busy} onClick={pay}>結帳(模擬付款)</Button>
            </div>
          </DialogPanel>
        </div>
      </ThemeScope>
    </Dialog>
  );
}
