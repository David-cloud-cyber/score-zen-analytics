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
  className = "size-12",
  imageClassName = "inset-1 size-10",
}: BookmakerLogoProps) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-xl text-sm font-black text-white",
        className,
      )}
      style={{ backgroundColor: accent }}
    >
      <span aria-hidden>{name.slice(0, 2).toUpperCase()}</span>
      {logoUrl && (
        <img
          src={logoUrl}
          alt={`Logo ${name}`}
          loading="lazy"
          decoding="async"
          className={cn("absolute rounded-lg object-contain", imageClassName)}
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
    </span>
  );
}
