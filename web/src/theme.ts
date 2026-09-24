import { createTheme, type MantineThemeOverride } from "@mantine/core";
import type { Decision } from "../../shared/decision";

const FONTS: Record<Decision["theme"]["font"], string> = {
  sans: "'Noto Sans TC', system-ui, sans-serif",
  serif: "'Noto Serif TC', Georgia, serif",
  rounded: "'M PLUS Rounded 1c', 'Noto Sans TC', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Noto Sans TC', monospace",
};

// density → how much air around things. Read by components via theme.other.
export const DENSITY = {
  compact: { gap: "xs", pad: "xs", cols: 5 },
  comfortable: { gap: "md", pad: "md", cols: 4 },
  spacious: { gap: "xl", pad: "lg", cols: 3 },
} as const;

export function decisionTheme(t: Decision["theme"] | undefined): MantineThemeOverride {
  const theme = t ?? { primaryColor: "blue", colorScheme: "light", radius: "md", density: "comfortable", font: "sans" };
  return createTheme({
    primaryColor: theme.primaryColor,
    defaultRadius: theme.radius,
    fontFamily: FONTS[theme.font],
    headings: { fontFamily: FONTS[theme.font], fontWeight: "800" },
    other: { density: theme.density },
  });
}
