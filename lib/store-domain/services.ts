import {
  cartRepo,
  inventoryRepo,
  orderRepo,
  productRepo,
} from "@/lib/db/repositories";
import { createId, nowMs } from "@/lib/shared";
import type { Cart, Inventory, Order, Product } from "@/lib/shared/types";
import { SEED_INVENTORY, SEED_PRODUCTS } from "./catalog";

const DEFAULT_CART_ID = "default-cart";

export async function ensureCatalogSeeded(): Promise<void> {
  const existing = await productRepo.all();
  if (existing.length > 0) return;
  await productRepo.putMany(SEED_PRODUCTS);
  await inventoryRepo.putMany(SEED_INVENTORY);
}

export async function searchProducts(query: {
  q?: string;
  category?: string;
  brand?: string;
  maxPrice?: number;
}): Promise<Product[]> {
  await ensureCatalogSeeded();
  return productRepo.search(query);
}

export async function getProduct(productId: string): Promise<Product | null> {
  await ensureCatalogSeeded();
  return (await productRepo.get(productId)) ?? null;
}

export async function getProducts(productIds: string[]): Promise<Product[]> {
  await ensureCatalogSeeded();
  const products = await Promise.all(productIds.map((id) => productRepo.get(id)));
  return products.filter((p): p is Product => p != null);
}

export async function getAvailability(productId: string): Promise<Inventory | null> {
  await ensureCatalogSeeded();
  return (await inventoryRepo.get(productId)) ?? null;
}

export async function getAvailabilityBatch(
  productIds: string[],
): Promise<Inventory[]> {
  await ensureCatalogSeeded();
  return inventoryRepo.getMany(productIds);
}

export async function getOrCreateCart(cartId = DEFAULT_CART_ID): Promise<Cart> {
  const existing = await cartRepo.get(cartId);
  if (existing) return existing;
  const cart: Cart = { id: cartId, items: [], updatedAt: nowMs() };
  await cartRepo.put(cart);
  return cart;
}

export async function addToCart(
  productId: string,
  qty = 1,
  cartId = DEFAULT_CART_ID,
): Promise<Cart> {
  const product = await getProduct(productId);
  if (!product) {
    throw Object.assign(new Error(`Product not found: ${productId}`), {
      category: "not_found" as const,
    });
  }
  const cart = await getOrCreateCart(cartId);
  const existing = cart.items.find((i) => i.productId === productId);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.items.push({ productId, qty });
  }
  cart.updatedAt = nowMs();
  await cartRepo.put(cart);
  return cart;
}

export async function getCart(cartId = DEFAULT_CART_ID): Promise<Cart> {
  return getOrCreateCart(cartId);
}

export async function completeCheckout(
  cartId = DEFAULT_CART_ID,
): Promise<Order> {
  const cart = await getOrCreateCart(cartId);
  if (cart.items.length === 0) {
    throw Object.assign(new Error("Cart is empty"), {
      category: "validation" as const,
    });
  }

  const products = await getProducts(cart.items.map((i) => i.productId));
  const priceById = new Map(products.map((p) => [p.id, p.price]));
  const total = cart.items.reduce(
    (sum, item) => sum + (priceById.get(item.productId) ?? 0) * item.qty,
    0,
  );

  const order: Order = {
    id: createId(),
    items: [...cart.items],
    total,
    createdAt: nowMs(),
    status: "simulated",
  };
  await orderRepo.put(order);
  await cartRepo.put({ id: cartId, items: [], updatedAt: nowMs() });
  return order;
}

export async function compareProducts(
  productIds: string[],
  fields?: string[],
): Promise<{
  products: Array<Record<string, unknown>>;
  fields: string[];
}> {
  const products = await getProducts(productIds);
  const defaultFields = ["id", "name", "brand", "price", "category"];
  const selected = fields && fields.length > 0 ? fields : defaultFields;

  const projected = products.map((p) => {
    const row: Record<string, unknown> = {};
    for (const field of selected) {
      if (field.startsWith("specs.")) {
        const key = field.slice("specs.".length);
        row[field] = p.specs[key] ?? null;
      } else if (field in p) {
        row[field] = (p as unknown as Record<string, unknown>)[field];
      }
    }
    return row;
  });

  return { products: projected, fields: selected };
}

export type StoreDomainServices = {
  searchProducts: typeof searchProducts;
  getProduct: typeof getProduct;
  getProducts: typeof getProducts;
  getAvailability: typeof getAvailability;
  getAvailabilityBatch: typeof getAvailabilityBatch;
  addToCart: typeof addToCart;
  getCart: typeof getCart;
  completeCheckout: typeof completeCheckout;
  compareProducts: typeof compareProducts;
};

export const storeServices: StoreDomainServices = {
  searchProducts,
  getProduct,
  getProducts,
  getAvailability,
  getAvailabilityBatch,
  addToCart,
  getCart,
  completeCheckout,
  compareProducts,
};
