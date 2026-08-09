import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Surface commune du design LiveFoot : compacte, lisible et sans ombre lourde. */
export function ScoreCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("score-card", className)} {...props} />;
}

export function ScoreSectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("score-section-label", className)}>{children}</p>;
}

export function ScoreEmptyState({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("score-empty-state", className)} {...props} />;
}
