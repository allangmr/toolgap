import Image from "next/image";
import Link from "next/link";

export const BRAND_MARK_SRC = "/brand/toolgap-mark.png";

const SIZE_PX = {
  sm: 24,
  md: 32,
  lg: 40,
} as const;

type MarkSize = keyof typeof SIZE_PX | number;

function markPixels(size: MarkSize) {
  return typeof size === "number" ? size : SIZE_PX[size];
}

export function BrandMark({
  size = "md",
  alt = "ToolGap",
  className = "",
  preload = false,
}: {
  size?: MarkSize;
  alt?: string;
  className?: string;
  preload?: boolean;
}) {
  const px = markPixels(size);
  return (
    <Image
      src={BRAND_MARK_SRC}
      alt={alt}
      width={px}
      height={px}
      unoptimized
      preload={preload}
      className={`shrink-0 ${className}`.trim()}
    />
  );
}

export function BrandLogo({
  href = "/",
  size = "md",
  subtitle,
  preload = false,
  wordmarkClassName = "font-display text-lg font-semibold tracking-tight text-foreground",
  className = "",
}: {
  href?: string;
  size?: keyof typeof SIZE_PX;
  subtitle?: string;
  preload?: boolean;
  wordmarkClassName?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2.5 ${className}`.trim()}
      aria-label={subtitle ? `ToolGap, ${subtitle}` : undefined}
    >
      <BrandMark size={size} alt="" preload={preload} />
      <span className="flex min-w-0 flex-col justify-center">
        <span className={wordmarkClassName}>ToolGap</span>
        {subtitle ? (
          <span className="hidden text-[11px] leading-tight text-muted lg:block">
            {subtitle}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
