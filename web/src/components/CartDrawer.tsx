import { ActionIcon, Alert, Button, Divider, Drawer, Group, NumberInput, Stack, Text } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import type { CartLine, Product } from "../../../shared/decision";
import { api } from "../api";
import { money } from "../copy";

interface Props {
  opened: boolean;
  onClose: () => void;
  userId: string;
  lines: CartLine[];
  products: Map<string, Product>;
  onOrdered: (orderId: number, total: number) => void;
}

export function CartDrawer({ opened, onClose, userId, lines, products, onOrdered }: Props) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const total = lines.reduce((s, l) => s + (products.get(l.productId)?.price ?? 0) * l.qty, 0);
  const problems = lines.filter((l) => (products.get(l.productId)?.stock ?? 0) < l.qty);

  const pay = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const r = await api.checkout(userId);
      onOrdered(r.orderId, r.total);
    } catch (e) {
      const body = (e as { body?: { error: string; productId?: string } }).body;
      setError(body?.error === "out_of_stock"
        ? `「${products.get(body.productId!)?.name}」庫存不足,剛剛被別人買走了`
        : "結帳失敗,請再試一次");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer opened={opened} onClose={onClose} position="right" title={<Text fw={800}>購物車</Text>} size="md">
      <Stack>
        {lines.length === 0 && <Text c="dimmed">購物車是空的</Text>}
        {lines.map((l) => {
          const p = products.get(l.productId);
          if (!p) return null;
          const delta = p.price - l.priceAtAdd;
          return (
            <Group key={l.productId} wrap="nowrap" align="flex-start">
              <Text fz={32}>{p.emoji}</Text>
              <Stack gap={2} style={{ flex: 1 }}>
                <Text fw={600}>{p.name}</Text>
                <Text size="sm">{money(p.price)}</Text>
                {/* The price is live: tell them if it moved since they added it. */}
                {delta < 0 && <Text size="xs" c="green">加入後降了 {money(-delta)}</Text>}
                {delta > 0 && <Text size="xs" c="orange">加入後漲了 {money(delta)}</Text>}
                {p.stock < l.qty && <Text size="xs" c="red">庫存只剩 {p.stock} 件</Text>}
              </Stack>
              <NumberInput w={72} min={0} max={99} value={l.qty} onChange={(v) => api.setQty(userId, p.id, Number(v) || 0)} />
              <ActionIcon variant="subtle" color="red" onClick={() => api.setQty(userId, p.id, 0)} aria-label="移除"><IconTrash size={18} /></ActionIcon>
            </Group>
          );
        })}
        <Divider />
        <Group justify="space-between">
          <Text fw={700}>總計(以當下價格計算)</Text>
          <Text fw={800} fz="xl">{money(total)}</Text>
        </Group>
        {error && <Alert color="red">{error}</Alert>}
        <Button size="md" disabled={lines.length === 0 || problems.length > 0} loading={busy} onClick={pay}>
          結帳(模擬付款)
        </Button>
      </Stack>
    </Drawer>
  );
}
