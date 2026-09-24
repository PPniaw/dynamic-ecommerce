// The "why is my store arranged like this" panel. Shows which engine decided,
// what triggered it, and the reason codes — plus the raw decision JSON, which
// is the entire output of the model.
import { Badge, Card, Code, Collapse, Group, Loader, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import { useState } from "react";
import type { ActivityItem, DecisionEnvelope, Product } from "../../../shared/decision";
import { SIGNAL_LABEL, TRIGGER_LABEL, activityText } from "../copy";

interface Props {
  envelope?: DecisionEnvelope;
  deciding?: string;
  claude: boolean;
  activity: ActivityItem[];
  products: Map<string, Product>;
}

export function DecisionPanel({ envelope, deciding, claude, activity, products }: Props) {
  const [raw, setRaw] = useState(false);
  return (
    <Stack gap="sm" pos="sticky" top={76}>
      <Card withBorder padding="sm">
        <Group justify="space-between" mb={6}>
          <Text fw={800} size="sm">決策引擎</Text>
          {envelope && (
            <Badge color={envelope.source === "claude" ? "grape" : "gray"} variant="light">
              {envelope.source === "claude" ? "Claude" : "規則引擎"}
            </Badge>
          )}
        </Group>
        {deciding ? (
          <Group gap={6}><Loader size="xs" /><Text size="xs">正在依「{TRIGGER_LABEL[deciding] ?? deciding}」重新安排…</Text></Group>
        ) : envelope ? (
          <Text size="xs" c="dimmed">
            因為「{TRIGGER_LABEL[envelope.trigger] ?? envelope.trigger}」· {envelope.latencyMs}ms · {new Date(envelope.at).toLocaleTimeString("zh-TW")}
          </Text>
        ) : null}
        {!claude && <Text size="xs" c="orange" mt={6}>尚未設定 ANTHROPIC_API_KEY,目前由規則引擎決策</Text>}
        {envelope && (
          <>
            <Group gap={4} mt="xs">
              {envelope.decision.signals.map((s) => <Badge key={s} size="xs" variant="outline">{SIGNAL_LABEL[s]}</Badge>)}
            </Group>
            <UnstyledButton mt="xs" onClick={() => setRaw((r) => !r)}>
              <Text size="xs" c="dimmed" td="underline">{raw ? "收起" : "看"}模型輸出(JSON)</Text>
            </UnstyledButton>
            <Collapse expanded={raw}>
              <ScrollArea h={260} mt={6}><Code block fz={10}>{JSON.stringify(envelope.decision, null, 2)}</Code></ScrollArea>
            </Collapse>
          </>
        )}
      </Card>

      <Card withBorder padding="sm">
        <Text fw={800} size="sm" mb={6}>即時動態</Text>
        <ScrollArea h={300}>
          <Stack gap={4}>
            {activity.length === 0 && <Text size="xs" c="dimmed">等待其他顧客的動作…</Text>}
            {activity.map((a) => (
              <Text key={`${a.at}-${a.productId}`} size="xs">
                <Text span c="dimmed" size="xs">{new Date(a.at).toLocaleTimeString("zh-TW")} </Text>
                {activityText(a, products.get(a.productId)?.name ?? a.productId)}
              </Text>
            ))}
          </Stack>
        </ScrollArea>
      </Card>
    </Stack>
  );
}
