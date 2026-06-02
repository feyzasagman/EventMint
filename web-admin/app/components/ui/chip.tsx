import type { HTMLAttributes } from "react";

type ChipVariant = "default" | "brand";

function variantClass(variant: ChipVariant) {
  return variant === "brand" ? "ui-chip-brand" : "";
}

export function Chip({
  className = "",
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: ChipVariant }) {
  return <span className={`ui-chip ${variantClass(variant)} ${className}`.trim()} {...props} />;
}
