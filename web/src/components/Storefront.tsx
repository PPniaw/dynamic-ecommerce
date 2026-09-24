// Renders a Decision. Nothing here chooses *what* to show — only *how* each
// enum looks. Order, layout, hero and badges all come from the engine.
import { Badge, Box, Button, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconShoppingCartPlus } from "@tabler/icons-react";
import type { Decision, Product } from "../../../shared/decision";
import { CATEGORY_LABEL, HERO_EYEBROW, SECTION_TITLE, money } from "../copy";
import { DENSITY } from "../theme";
import { ProductCard, type CardActions } from "./ProductCard";

interface Props extends CardActions {
  decision: Decision;
  products: Map<string, Product>;
  changed: Map<string, number>;
  decidedAt: number;
}

const FLASH_MS = 1500;

export function Storefront({ decision, products, changed, decidedAt, ...actions }: Props) {
  const d = DENSITY[decision.theme.density];
  const badges = new Map(decision.badges.map((b) => [b.productId, b.badge]));
  const now = Date.now();
  const flash = (id: string) => now - (changed.get(id) ?? 0) < FLASH_MS;
  const hero = products.get(decision.hero.productId);

  return (
    <Stack gap={d.gap === "xl" ? 48 : d.gap === "md" ? 32 : 20}>
      {hero && <Hero p={hero} variant={decision.hero.variant} onAdd={actions.onAdd} onOpen={actions.onOpen} flash={flash(hero.id)} />}
      {decision.sections.map((s, i) => {
        const items = s.productIds.map((id) => products.get(id)).filter((p): p is Product => !!p);
        const title = s.kind === "category" && s.category !== "none" ? CATEGORY_LABEL[s.category] : SECTION_TITLE[s.kind];
        const card = (p: Product, size: "md" | "sm" | "row") => (
          <ProductCard key={p.id} product={p} badge={badges.get(p.id)} size={size} flash={flash(p.id)} pad={d.pad} {...actions} />
        );
        return (
          // key includes decidedAt so a re-decision replays the entrance animation.
          <Box key={`${decidedAt}-${i}-${s.kind}`} className="section-in" style={{ animationDelay: `${i * 60}ms` }}>
            <Group justify="space-between" mb="sm">
              <Title order={3}>{title}</Title>
              <Text size="xs" c="dimmed">{s.layout}</Text>
            </Group>
            {s.layout === "carousel" && <Box className="h-scroll" style={{ gap: `var(--mantine-spacing-${d.gap})` }}>{items.map((p) => card(p, "md"))}</Box>}
            {s.layout === "list" && <Stack gap="xs">{items.map((p) => card(p, "row"))}</Stack>}
            {s.layout === "grid" && <SimpleGrid cols={{ base: 2, sm: 3, md: d.cols }} spacing={d.gap}>{items.map((p) => card(p, "md"))}</SimpleGrid>}
            {s.layout === "compact_grid" && <SimpleGrid cols={{ base: 3, sm: 4, md: d.cols + 2 }} spacing="xs">{items.map((p) => card(p, "sm"))}</SimpleGrid>}
          </Box>
        );
      })}
    </Stack>
  );
}

function Hero({ p, variant, onAdd, onOpen, flash }: {
  p: Product; variant: Decision["hero"]["variant"]; flash: boolean;
  onAdd: (p: Product) => void; onOpen: (p: Product) => void;
}) {
  const off = p.price < p.basePrice ? Math.round((1 - p.price / p.basePrice) * 100) : 0;
  return (
    <Card withBorder padding="xl" className={`section-in ${flash ? "flash" : ""}`} bg="var(--mantine-primary-color-light)">
      <Group wrap="nowrap" gap="xl" align="center">
        <Box style={{ fontSize: "clamp(72px, 14vw, 140px)", lineHeight: 1, cursor: "pointer" }} onClick={() => onOpen(p)}>{p.emoji}</Box>
        <Stack gap="xs" style={{ flex: 1 }}>
          <Group gap="xs">
            <Badge size="lg" variant="filled">{HERO_EYEBROW[variant]}</Badge>
            {off > 0 && <Badge size="lg" color="green">省 {off}%</Badge>}
            {p.stock > 0 && p.stock <= 5 && <Badge size="lg" color="orange">只剩 {p.stock} 件</Badge>}
          </Group>
          <Title order={1} style={{ fontSize: "clamp(28px, 4vw, 44px)" }}>{p.name}</Title>
          <Group gap="sm" align="baseline">
            <Text fw={800} fz={28}>{money(p.price)}</Text>
            {off > 0 && <Text c="dimmed" td="line-through">{money(p.basePrice)}</Text>}
          </Group>
          <Group>
            <Button size="md" leftSection={<IconShoppingCartPlus size={18} />} disabled={p.stock === 0} onClick={() => onAdd(p)}>加入購物車</Button>
            <Text size="sm" c="dimmed">{CATEGORY_LABEL[p.category]} · 已售 {p.sold}</Text>
          </Group>
        </Stack>
      </Group>
    </Card>
  );
}
