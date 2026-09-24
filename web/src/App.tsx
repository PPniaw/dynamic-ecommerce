import "@mantine/notifications/styles.css";
import { AppShell, Badge, Box, Button, Center, Grid, Group, Indicator, Loader, Modal, Select, Stack, Text, Title } from "@mantine/core";
import { Notifications, notifications } from "@mantine/notifications";
import { MantineProvider } from "@mantine/core";
import { IconAdjustments, IconShoppingCart, IconUserPlus } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Product, User } from "../../shared/decision";
import { api } from "./api";
import { CartDrawer } from "./components/CartDrawer";
import { DecisionPanel } from "./components/DecisionPanel";
import { PrefsDrawer } from "./components/PrefsDrawer";
import { Storefront } from "./components/Storefront";
import { CATEGORY_LABEL, money } from "./copy";
import { decisionTheme } from "./theme";
import { useLive } from "./useLive";

const USER_KEY = "llm-shop:user";
const readUser = () => { try { return localStorage.getItem(USER_KEY) ?? undefined; } catch { return undefined; } };
const writeUser = (id: string) => { try { localStorage.setItem(USER_KEY, id); } catch { /* private mode */ } };

export function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState<string | undefined>(readUser);
  const [claude, setClaude] = useState(false);
  const live = useLive(userId);
  const [cartOpen, setCartOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [detail, setDetail] = useState<Product>();
  const [favs, setFavs] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.meta().then((m) => setClaude(m.claude));
    api.users().then((us) => {
      setUsers(us);
      setUserId((cur) => (cur && us.some((u) => u.id === cur) ? cur : us[0]?.id));
    });
  }, []);
  useEffect(() => { if (userId) writeUser(userId); setFavs(new Set()); }, [userId]);

  const user = live.user ?? users.find((u) => u.id === userId);
  const theme = useMemo(() => decisionTheme(live.envelope?.decision.theme), [live.envelope?.decision.theme]);
  const scheme = live.envelope?.decision.theme.colorScheme ?? "light";

  const onOpen = useCallback((p: Product) => { setDetail(p); if (userId) void api.event(userId, "view", p.id); }, [userId]);
  const onAdd = useCallback((p: Product) => {
    if (!userId) return;
    const qty = (live.cart.find((l) => l.productId === p.id)?.qty ?? 0) + 1;
    void api.setQty(userId, p.id, qty);
    notifications.show({ message: `已加入「${p.name}」`, autoClose: 1500 });
  }, [userId, live.cart]);
  const onFav = useCallback((p: Product) => {
    if (!userId) return;
    setFavs((s) => {
      const n = new Set(s);
      if (n.has(p.id)) n.delete(p.id);
      else { n.add(p.id); void api.event(userId, "favorite", p.id); }
      return n;
    });
  }, [userId]);
  const actions = { onOpen, onAdd, onFav, isFav: (id: string) => favs.has(id) };

  const newUser = async () => {
    const name = prompt("取個名字(新訪客會從零開始,AI 看你的行為學習)");
    if (name === null) return;
    const u = await api.createUser(name);
    setUsers((us) => [...us, u]);
    setUserId(u.id);
  };

  const cartCount = live.cart.reduce((s, l) => s + l.qty, 0);
  const detailLive = detail && (live.products.get(detail.id) ?? detail);

  return (
    <MantineProvider theme={theme} forceColorScheme={scheme}>
      <Notifications position="bottom-left" />
      <AppShell header={{ height: 60 }} padding="md">
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
              <Title order={3}>即時商店</Title>
              <Badge variant="dot" color={live.connected ? "green" : "red"}>{live.connected ? "即時連線" : "連線中"}</Badge>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <Select size="xs" w={140} allowDeselect={false} value={userId ?? null} onChange={(v) => v && setUserId(v)}
                data={users.map((u) => ({ value: u.id, label: u.name }))} aria-label="切換顧客" />
              <Button size="xs" variant="subtle" onClick={newUser} leftSection={<IconUserPlus size={16} />} visibleFrom="sm">新顧客</Button>
              <Button size="xs" variant="light" onClick={() => setPrefsOpen(true)} leftSection={<IconAdjustments size={16} />}>喜好</Button>
              <Indicator label={cartCount} size={16} disabled={cartCount === 0}>
                <Button size="xs" onClick={() => setCartOpen(true)} leftSection={<IconShoppingCart size={16} />}>購物車</Button>
              </Indicator>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Main>
          {!live.envelope ? (
            <Center h="60vh"><Loader /></Center>
          ) : (
            <Grid gap="lg">
              <Grid.Col span={{ base: 12, lg: 9 }}>
                <Storefront decision={live.envelope.decision} products={live.products} changed={live.changed} decidedAt={live.envelope.at} {...actions} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, lg: 3 }}>
                <DecisionPanel envelope={live.envelope} deciding={live.deciding} claude={claude} activity={live.activity} products={live.products} />
              </Grid.Col>
            </Grid>
          )}
        </AppShell.Main>
      </AppShell>

      {userId && (
        <CartDrawer opened={cartOpen} onClose={() => setCartOpen(false)} userId={userId} lines={live.cart} products={live.products}
          onOrdered={(id, total) => { setCartOpen(false); notifications.show({ color: "green", title: `訂單 #${id} 成立`, message: `共 ${money(total)}` }); }} />
      )}
      {user && (
        <PrefsDrawer opened={prefsOpen} onClose={() => setPrefsOpen(false)} user={user}
          onSaved={(u) => setUsers((us) => us.map((x) => (x.id === u.id ? u : x)))} />
      )}

      <Modal opened={!!detailLive} onClose={() => setDetail(undefined)} title={detailLive?.name} centered>
        {detailLive && (
          <Stack>
            <Box className="emoji-tile" style={{ fontSize: 120, borderRadius: "var(--mantine-radius-default)" }}>{detailLive.emoji}</Box>
            <Group justify="space-between">
              <Text fw={800} fz="xl">{money(detailLive.price)}</Text>
              <Text size="sm" c={detailLive.stock <= 5 ? "orange" : "dimmed"}>庫存 {detailLive.stock} · 已售 {detailLive.sold}</Text>
            </Group>
            <Group gap={4}>
              <Badge variant="light">{CATEGORY_LABEL[detailLive.category]}</Badge>
              {detailLive.tags.map((t) => <Badge key={t} variant="outline" size="sm">{t}</Badge>)}
            </Group>
            <Button disabled={detailLive.stock === 0} onClick={() => { onAdd(detailLive); setDetail(undefined); }}>加入購物車</Button>
          </Stack>
        )}
      </Modal>
    </MantineProvider>
  );
}
