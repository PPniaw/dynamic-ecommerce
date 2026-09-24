import { Button, Chip, Divider, Drawer, Group, NumberInput, Progress, SegmentedControl, Stack, Text, Textarea } from "@mantine/core";
import { useEffect, useState } from "react";
import { CATEGORIES, type Category, type Profile, type User, type UserPrefs } from "../../../shared/decision";
import { api } from "../api";
import { CATEGORY_LABEL, money } from "../copy";

interface Props {
  opened: boolean;
  onClose: () => void;
  user: User;
  onSaved: (u: User) => void;
}

// Two halves: what the shopper *says* (prefs, editable) and what their
// behaviour *shows* (profile, computed from events). The engine gets both.
export function PrefsDrawer({ opened, onClose, user, onSaved }: Props) {
  const [prefs, setPrefs] = useState<UserPrefs>(user.prefs);
  const [profile, setProfile] = useState<Profile>();
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof api.orders>>>([]);

  useEffect(() => {
    if (!opened) return;
    setPrefs(user.prefs);
    api.profile(user.id).then(setProfile);
    api.orders(user.id).then(setOrders);
  }, [opened, user]);

  const save = async () => { onSaved(await api.setPrefs(user.id, prefs)); onClose(); };

  return (
    <Drawer opened={opened} onClose={onClose} title={<Text fw={800}>{user.name} 的喜好與需求</Text>} size="md">
      <Stack>
        <Text fw={700}>風格</Text>
        <SegmentedControl fullWidth value={prefs.style} onChange={(v) => setPrefs({ ...prefs, style: v as UserPrefs["style"] })}
          data={[{ value: "auto", label: "交給 AI" }, { value: "minimal", label: "極簡" }, { value: "vivid", label: "繽紛" }, { value: "dark", label: "暗色" }]} />
        <Text fw={700}>有興趣的分類</Text>
        <Chip.Group multiple value={prefs.categories} onChange={(v) => setPrefs({ ...prefs, categories: v as Category[] })}>
          <Group gap="xs">{CATEGORIES.map((c) => <Chip key={c} value={c} size="sm">{CATEGORY_LABEL[c]}</Chip>)}</Group>
        </Chip.Group>
        <NumberInput label="單品預算上限" placeholder="不限" prefix="NT$" thousandSeparator min={0} step={500}
          value={prefs.budget ?? ""} onChange={(v) => setPrefs({ ...prefs, budget: typeof v === "number" && v > 0 ? v : null })} />
        <Textarea label="現在的需求(AI 會讀這段)" placeholder="例如:下週要去露營,想找輕便的裝備" autosize minRows={2}
          value={prefs.need} onChange={(e) => setPrefs({ ...prefs, need: e.currentTarget.value })} />
        <Button onClick={save}>儲存並重新安排商店</Button>

        <Divider label="從你的行為推算出來的" />
        {profile && (
          <Stack gap={6}>
            {CATEGORIES.map((c) => (
              <Group key={c} gap="xs" wrap="nowrap">
                <Text size="sm" w={80}>{CATEGORY_LABEL[c]}</Text>
                <Progress value={profile.affinity[c] * 100} style={{ flex: 1 }} />
              </Group>
            ))}
            <Text size="sm" c="dimmed">
              行為紀錄 {profile.eventCount} 筆 · 平均瀏覽價位 {profile.avgViewedPrice ? money(profile.avgViewedPrice) : "—"} · 常見標籤 {profile.topTags.join("、") || "—"}
            </Text>
          </Stack>
        )}

        <Divider label="訂單" />
        {orders.length === 0 && <Text size="sm" c="dimmed">還沒有訂單</Text>}
        {orders.map((o) => (
          <Group key={o.id} justify="space-between">
            <Text size="sm">#{o.id} · {new Date(o.ts).toLocaleTimeString("zh-TW")} · {o.items.reduce((s, i) => s + i.qty, 0)} 件</Text>
            <Text size="sm" fw={700}>{money(o.total)}</Text>
          </Group>
        ))}
      </Stack>
    </Drawer>
  );
}
