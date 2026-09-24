import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { productPath } from "../../../../shared/catalog";
import { formatMoney } from "../../ds/ui/Price";
import { ProductImage } from "../../ds/ui/ProductImage";
import { api, type Order } from "../api";
import { useStore } from "../StoreContext";

export function OrderPage() {
  const { id } = useParams();
  const { user, products } = useStore();
  const [order, setOrder] = useState<Order | null>();
  useEffect(() => {
    if (!user) return;
    api.orders(user.id).then((os) => setOrder(os.find((o) => String(o.id) === id) ?? null)).catch(() => setOrder(null));
  }, [user, id]);

  return (
    <div className="page max-w-2xl py-16">
      <p className="eyebrow text-accent">訂單 #{id}</p>
      <h1 className="heading mt-3 type-h1">謝謝你,東西在路上了</h1>
      <p className="mt-3 txt-large text-fg-subtle">這是一個 demo,不會真的扣款或出貨。庫存已經扣掉,其他人的畫面也同步更新了。</p>
      {order && (
        <div className="mt-10 border-t border-line">
          {order.items.map((it) => {
            const p = products.get(it.productId);
            return (
              <div key={it.productId} className="flex items-center gap-4 border-b border-line py-4">
                {p && <span className="w-14 shrink-0 overflow-hidden rounded-media"><ProductImage image={p.image} name="" ratio="square" width={160} quietFallback /></span>}
                <span className="grow txt-medium">{p ? <Link to={productPath(p)} className="hover:underline">{p.name}</Link> : it.productId} × {it.qty}</span>
                <span className="txt-medium tabular-nums">{formatMoney(it.price * it.qty)}</span>
              </div>
            );
          })}
          <div className="flex justify-between py-4 txt-large font-semibold"><span>總計</span><span className="tabular-nums">{formatMoney(order.total)}</span></div>
        </div>
      )}
      {order === null && <p className="mt-10 txt-medium text-fg-muted">找不到這筆訂單(可能是另一位顧客的)。</p>}
      <Link to="/" className="mt-10 inline-block txt-medium underline underline-offset-4">繼續逛</Link>
    </div>
  );
}
