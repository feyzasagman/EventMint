import Image from "next/image";

export type EventMintLogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export function EventMintLogo({
  size = 72,
  className = "",
  priority = false,
}: EventMintLogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="EventMint"
      width={size}
      height={size}
      priority={priority}
      className={`object-contain ${className}`.trim()}
    />
  );
}
