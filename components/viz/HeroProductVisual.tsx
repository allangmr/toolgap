import Image from "next/image";

export const HERO_IMAGE_SRC = "/media/hero-product-trace.jpg";

export function HeroProductVisual() {
  return (
    <div className="relative aspect-video overflow-hidden rounded-lg border border-border shadow-[var(--shadow)]">
      <Image
        src={HERO_IMAGE_SRC}
        alt="Fieldkit Market storefront beside a ToolGap live trace of search, get_product, and get_availability calls"
        fill
        preload
        sizes="(min-width: 768px) 44vw, 100vw"
        className="object-cover object-top"
      />
    </div>
  );
}
