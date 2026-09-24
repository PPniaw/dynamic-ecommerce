// Product photo with a typographic fallback: a tinted tile with the product
// name set large (Horizon's no-image placeholder). A broken image never shows
// the browser's broken-image icon.
import { useState } from "react";
import { imageUrl, type ImageRatio } from "../../../../shared/catalog";
import { cn } from "./cn";

const ASPECT: Record<ImageRatio, string> = { portrait: "aspect-[4/5]", square: "aspect-square", landscape: "aspect-video" };

export type ImageStatus = "loading" | "ok" | "error";

export function ProductImage({ image, name, ratio, secondary, width = 640, eager, className, onStatus, quietFallback, detail }: {
  image: string;
  name: string;
  ratio: ImageRatio;
  // Show a detail crop on hover (Horizon's "second image on hover").
  secondary?: boolean;
  width?: number;
  eager?: boolean;
  className?: string;
  onStatus?: (s: ImageStatus) => void;
  // The card already prints the name over the photo (overlay info): keep the
  // fallback tile plain instead of showing the name twice.
  quietFallback?: boolean;
  // A tighter crop of the same photo (gallery close-ups).
  detail?: boolean;
}) {
  const [status, setStatus] = useState<ImageStatus>("loading");
  const set = (s: ImageStatus) => { setStatus(s); onStatus?.(s); };

  return (
    <div className={cn("relative overflow-hidden bg-component", ASPECT[ratio], className)}>
      {status === "error" ? (
        <div className="absolute inset-0 flex items-end bg-subtle p-4">
          {!quietFallback && <span className="heading type-h3 text-fg-subtle">{name}</span>}
        </div>
      ) : (
        <>
          <img
            src={imageUrl(image, width, ratio, detail)}
            srcSet={`${imageUrl(image, Math.round(width / 2), ratio, detail)} ${Math.round(width / 2)}w, ${imageUrl(image, width, ratio, detail)} ${width}w`}
            sizes="(min-width: 1024px) 25vw, 50vw"
            alt={name}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => set("ok")}
            onError={() => set("error")}
            className={cn(
              "card-img absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
              status === "loading" ? "opacity-0" : "opacity-100",
              secondary && "group-hover/card:opacity-0",
            )}
          />
          {secondary && status === "ok" && (
            // Loaded lazily with the card, so the swap on hover never flashes.
            <img
              src={imageUrl(image, width, ratio, true)}
              alt=""
              aria-hidden
              loading="lazy"
              className="card-img absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
            />
          )}
          {status === "loading" && <div className="absolute inset-0 animate-pulse bg-component" />}
        </>
      )}
    </div>
  );
}
