import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "brand" | "secondary";

function variantClass(variant: ButtonVariant) {
  return variant === "secondary" ? "ui-button-secondary" : "ui-button-brand";
}

export function Button({
  className = "",
  variant = "brand",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={`ui-button ${variantClass(variant)} ${className}`.trim()} {...props} />;
}
