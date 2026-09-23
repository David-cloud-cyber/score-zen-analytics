import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

const PRODUCT_HUNT_URL =
  "https://www.producthunt.com/products/livefoot-ia?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-livefoot-ia";
const PRODUCT_HUNT_IMAGE =
  "https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1242134&theme=light&t=1788676974866";

export function ProductHuntBadge() {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    track("product_hunt_badge_view", { placement: "public_footer" });
  }, []);

  return (
    <aside className="mx-auto mt-8 flex justify-center px-4 pb-6" aria-label="LiveFoot sur Product Hunt">
      <a
        href={PRODUCT_HUNT_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("product_hunt_badge_click", { placement: "public_footer" })}
        className="inline-flex rounded-xl transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Découvrir LiveFoot IA sur Product Hunt"
      >
        <img
          src={PRODUCT_HUNT_IMAGE}
          alt="LiveFoot IA sur Product Hunt"
          width={250}
          height={54}
          loading="lazy"
          decoding="async"
          className="h-[54px] w-[250px] max-w-full"
        />
      </a>
    </aside>
  );
}
