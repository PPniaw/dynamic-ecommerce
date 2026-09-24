import { ActionIcon, Badge, Box, Button, Card, Group, Stack, Text } from "@mantine/core";
import { IconHeart, IconHeartFilled, IconShoppingCartPlus } from "@tabler/icons-react";
import type { Decision, Product } from "../../../shared/decision";
import { BADGE, money } from "../copy";

export interface CardActions {
  onOpen: (p: Product) => void;
  onAdd: (p: Product) => void;
  onFav: (p: Product) => void;
  isFav: (id: string) => boolean;
}

interface Props extends CardActions {
  product: Product;
  badge?: Decision["badges"][number]["badge"];
  size: "md" | "sm" | "row";
  flash: boolean;
  pad: string;
}

function Price({ p, size }: { p: Product; size: string }) {
  const down = p.price < p.basePrice;
  return (
    <Group gap={6} align="baseline" wrap="nowrap">
      <Text fw={800} size={size} c={down ? "green" : undefined}>{money(p.price)}</Text>
      {p.price !== p.basePrice && <Text size="xs" c="dimmed" td="line-through">{money(p.basePrice)}</Text>}
    </Group>
  );
}

function Stock({ p }: { p: Product }) {
  if (p.stock === 0) return <Text size="xs" c="red" fw={700}>已售完</Text>;
  if (p.stock <= 5) return <Text size="xs" c="orange" fw={700}>只剩 {p.stock} 件</Text>;
  return <Text size="xs" c="dimmed">庫存 {p.stock} · 已售 {p.sold}</Text>;
}

export function ProductCard({ product: p, badge, size, flash, pad, onOpen, onAdd, onFav, isFav }: Props) {
  const b = badge && BADGE[badge];
  const fav = isFav(p.id);
  const favBtn = (
    <ActionIcon variant="subtle" color="pink" onClick={(e) => { e.stopPropagation(); onFav(p); }} aria-label="收藏">
      {fav ? <IconHeartFilled size={18} /> : <IconHeart size={18} />}
    </ActionIcon>
  );

  if (size === "row") {
    return (
      <Card withBorder padding="xs" className={flash ? "flash" : undefined} onClick={() => onOpen(p)} style={{ cursor: "pointer" }}>
        <Group wrap="nowrap" gap="sm">
          <Box className="emoji-tile" w={52} style={{ borderRadius: "var(--mantine-radius-default)", fontSize: 28 }}>{p.emoji}</Box>
          <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
            <Group gap={6}><Text fw={600} truncate>{p.name}</Text>{b && <Badge size="xs" color={b.color}>{b.label}</Badge>}</Group>
            <Stock p={p} />
          </Stack>
          <Price p={p} size="sm" />
          {favBtn}
          <ActionIcon variant="filled" disabled={p.stock === 0} onClick={(e) => { e.stopPropagation(); onAdd(p); }} aria-label="加入購物車">
            <IconShoppingCartPlus size={18} />
          </ActionIcon>
        </Group>
      </Card>
    );
  }

  const small = size === "sm";
  return (
    <Card withBorder padding={small ? "xs" : pad} className={flash ? "flash" : undefined} onClick={() => onOpen(p)} style={{ cursor: "pointer" }}>
      <Card.Section pos="relative">
        <Box className="emoji-tile" style={{ fontSize: small ? 44 : 64 }}>{p.emoji}</Box>
        {b && <Badge pos="absolute" top={8} left={8} color={b.color}>{b.label}</Badge>}
        {p.stock === 0 && <Badge pos="absolute" top={8} right={8} color="gray">售完</Badge>}
      </Card.Section>
      <Stack gap={4} mt="xs">
        <Text fw={600} size={small ? "sm" : "md"} truncate>{p.name}</Text>
        <Price p={p} size={small ? "sm" : "md"} />
        <Stock p={p} />
        {!small && (
          <Group gap="xs" mt={4} wrap="nowrap">
            <Button size="xs" flex={1} leftSection={<IconShoppingCartPlus size={16} />} disabled={p.stock === 0}
              onClick={(e) => { e.stopPropagation(); onAdd(p); }}>
              加入購物車
            </Button>
            {favBtn}
          </Group>
        )}
      </Stack>
    </Card>
  );
}
