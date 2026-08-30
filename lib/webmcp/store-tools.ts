import { z } from "zod";
import { storeServices } from "@/lib/store-domain/services";
import type { ToolgapToolDefinition } from "@/lib/webmcp/registry";

export const storeToolDefinitions: Omit<ToolgapToolDefinition, "handler">[] = [
  {
    name: "search_products",
    description:
      "Search the catalog by free text, category, brand, or maximum price. Returns matching products.",
    version: "1.0.0",
    inputSchema: z.object({
      q: z.string().optional(),
      category: z.string().optional(),
      brand: z.string().optional(),
      maxPrice: z.number().optional(),
    }),
    surface: "store",
    origin: "static",
    readOnly: true,
  },
  {
    name: "get_product",
    description: "Get a single product by id, including specs and description.",
    version: "1.0.0",
    inputSchema: z.object({
      productId: z.string(),
    }),
    surface: "store",
    origin: "static",
    readOnly: true,
  },
  {
    name: "get_availability",
    description: "Check stock availability for a single product id.",
    version: "1.0.0",
    inputSchema: z.object({
      productId: z.string(),
    }),
    surface: "store",
    origin: "static",
    readOnly: true,
  },
  {
    name: "add_to_cart",
    description: "Add a product to the shopping cart.",
    version: "1.0.0",
    inputSchema: z.object({
      productId: z.string(),
      qty: z.number().int().positive().optional(),
    }),
    surface: "store",
    origin: "static",
    readOnly: false,
  },
  {
    name: "get_cart",
    description: "Get the current shopping cart contents.",
    version: "1.0.0",
    inputSchema: z.object({}),
    surface: "store",
    origin: "static",
    readOnly: true,
  },
  {
    name: "complete_checkout",
    description:
      "Complete a simulated checkout for the current cart. Does not process real payments.",
    version: "1.0.0",
    inputSchema: z.object({}),
    surface: "store",
    origin: "static",
    readOnly: false,
  },
];

export function createStoreToolHandlers(): Record<string, ToolgapToolDefinition["handler"]> {
  return {
    search_products: async (params) =>
      storeServices.searchProducts({
        q: params.q as string | undefined,
        category: params.category as string | undefined,
        brand: params.brand as string | undefined,
        maxPrice: params.maxPrice as number | undefined,
      }),
    get_product: async (params) => {
      const product = await storeServices.getProduct(params.productId as string);
      if (!product) {
        throw Object.assign(new Error(`Product not found: ${params.productId}`), {
          category: "not_found" as const,
        });
      }
      return product;
    },
    get_availability: async (params) => {
      const availability = await storeServices.getAvailability(params.productId as string);
      if (!availability) {
        throw Object.assign(new Error(`Availability not found: ${params.productId}`), {
          category: "not_found" as const,
        });
      }
      return availability;
    },
    add_to_cart: async (params) =>
      storeServices.addToCart(
        params.productId as string,
        (params.qty as number | undefined) ?? 1,
      ),
    get_cart: async () => storeServices.getCart(),
    complete_checkout: async () => storeServices.completeCheckout(),
  };
}

export async function registerStaticStoreTools(
  register: (def: ToolgapToolDefinition) => Promise<void>,
): Promise<void> {
  const handlers = createStoreToolHandlers();
  for (const def of storeToolDefinitions) {
    await register({
      ...def,
      handler: handlers[def.name]!,
      entityExtractor: (input) => {
        if (typeof input.productId === "string") return [input.productId];
        return undefined;
      },
    });
  }
}
