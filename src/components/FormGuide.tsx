import type { FormResult } from "@/data/matches";
import { cn } from "@/lib/utils";

export function FormGuide({ results, size = "md" }: { results: FormResult[]; size?: "sm" | "md" }) {
  const s = size === "sm" ? "size-5 text-[9px]" : "size-6 text-[10px]";
  return (
    <div className="flex gap-1">
      {results.map((r, i) => (
        <span
          key={i}
          className={cn(
            "grid place-items-center rounded-md font-black uppercase text-white",
            s,
            r === "V" && "bg-brand text-brand-foreground",
            r === "N" && "bg-muted text-muted-foreground",
            r === "D" && "bg-alert text-white",
          )}
        >
          {r}
        </span>
      ))}
    </div>
  );
}
