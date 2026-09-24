import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge our custom utilities so it doesn't drop them as
// "conflicting" with Tailwind's own font-size / radius classes.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": ["txt-xsmall", "txt-small", "txt-medium", "txt-large", "txt-xlarge", "type-display", "type-h1", "type-h2", "type-h3", "type-h4", "eyebrow"],
    },
  },
});

// Same helper Medusa ships as `clx`.
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
