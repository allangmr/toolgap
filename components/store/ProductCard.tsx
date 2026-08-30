import Link from "next/link";
import type { Product } from "@/lib/shared/types";

const tones: Record<string, string> = {
  headphones: "from-[#44403c] to-[#1c1917]",
  laptops: "from-[#57534e] to-[#292524]",
  chairs: "from-[#78716c] to-[#44403c]",
  cameras: "from-[#a8a29e] to-[#57534e]",
};

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="overflow-hidden rounded-xl border border-[#e4ddd3] bg-white">
      <div
        className={`h-36 bg-gradient-to-br ${tones[product.category] ?? tones.headphones}`}
        aria-hidden="true"
      />
      <div className="space-y-2 p-4">
        <p className="text-xs uppercase tracking-wide text-[#78716c]">
          {product.brand} · {product.category}
        </p>
        <h2 className="text-lg font-semibold text-[#1c1917]">
          <Link href={`/store/products/${product.id}`} className="hover:underline">
            {product.name}
          </Link>
        </h2>
        <p className="line-clamp-2 text-sm text-[#57534e]">{product.description}</p>
        <p className="text-base font-semibold tabular-nums">${product.price}</p>
      </div>
    </article>
  );
}
