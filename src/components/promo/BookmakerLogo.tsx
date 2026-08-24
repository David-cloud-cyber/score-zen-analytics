import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type BookmakerLogoProps = {
  name: string;
  logoUrl?: string;
  accent: string;
  className?: string;
  imageClassName?: string;
};

/** Logo local avec fallback lisible si un asset est absent ou corrompu. */
export function BookmakerLogo({
  name,
  logoUrl,
  accent,
  className = "h-12 w-20",
  imageClassName = "inset-1 size-[calc(100%-0.5rem)]",
}: BookmakerLogoProps) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white text-sm font-black text-white shadow-sm dark:border-white/15",
        className,
      )}
      style={{ "--logo-fallback": accent } as CSSProperties}
    >
      <span
        aria-hidden
        className="absolute inset-0 grid place-items-center"
        style={{ backgroundColor: "var(--logo-fallback)" }}
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
      {logoUrl && (
        <img
          src={logoUrl}
          alt={`Logo ${name}`}
          loading="lazy"
          decoding="async"
          className={cn("absolute rounded-lg bg-white object-contain", imageClassName)}
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
    </span>
  );
}
