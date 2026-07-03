import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  demoStores,
  demoProducts,
  demoInventory,
  type DemoStore,
} from "@/lib/demo-data";
import { USER_LOCATION, haversineKm, formatDistance } from "@/lib/geo";
import type {
  NearbyProduct,
  Listing,
  ProductDetail,
  Order,
  MerchantOrder,
  StockItem,
  DriverMission,
  FulfillmentType,
} from "@/lib/types";

// ── Persistance des commandes en mode démonstration ──────────────────────────
// Stockage en mémoire (survit au hot-reload). Suffisant pour la démo locale ;
// en production, c'est Supabase qui persiste les commandes.
const demoOrders: Map<string, Order> =
  (globalThis as { __mazoneOrders?: Map<string, Order> }).__mazoneOrders ??
  new Map();
(globalThis as { __mazoneOrders?: Map<string, Order> }).__mazoneOrders =
  demoOrders;

function storeDistance(store: DemoStore) {
  return haversineKm(USER_LOCATION.lat, USER_LOCATION.lng, store.lat, store.lng);
}

function listingFromDemo(productId: string): Listing[] {
  return demoInventory
    .filter((inv) => inv.productId === productId && inv.available)
    .map((inv) => {
      const store = demoStores.find((s) => s.id === inv.storeId)!;
      const km = storeDistance(store);
      return {
        id: `${inv.storeId}-${inv.productId}`,
        storeId: store.id,
        storeName: store.name,
        storeType: store.storeType,
        address: store.address,
        lat: store.lat,
        lng: store.lng,
        productId,
        price: inv.price,
        stock: inv.stock,
        deliveryMinutes: store.deliveryMinutes,
        distance: formatDistance(km),
        available: inv.available,
      };
    })
    .sort((a, b) => a.deliveryMinutes - b.deliveryMinutes);
}

// ── Lectures catalogue ───────────────────────────────────────────────────────

export async function getNearbyProducts(): Promise<NearbyProduct[]> {
  if (!isSupabaseConfigured) {
    return demoProducts.map((product) => {
      const best = listingFromDemo(product.id)[0];
      return {
        id: product.id,
        name: product.name,
        category: product.category,
        image: product.image,
        price: best?.price ?? 0,
        storeName: best?.storeName ?? "",
        deliveryMinutes: best?.deliveryMinutes ?? 0,
        distance: best?.distance ?? "",
      };
    });
  }

  const supabase = await createClient();
  const { data } = await supabase!
    .from("inventory")
    .select(
      "price, stock, product:products(id,name,category,image_url), store:stores(name,lat,lng)"
    )
    .eq("available", true);

  const byProduct = new Map<string, NearbyProduct>();
  for (const row of (data ?? []) as unknown as InventoryRow[]) {
    const km = haversineKm(
      USER_LOCATION.lat,
      USER_LOCATION.lng,
      row.store.lat,
      row.store.lng
    );
    const minutes = row.store.delivery_minutes ?? 25;
    const existing = byProduct.get(row.product.id);
    if (!existing || minutes < existing.deliveryMinutes) {
      byProduct.set(row.product.id, {
        id: row.product.id,
        name: row.product.name,
        category: row.product.category,
        image: row.product.image_url,
        price: row.price,
        storeName: row.store.name,
        deliveryMinutes: minutes,
        distance: formatDistance(km),
      });
    }
  }
  return [...byProduct.values()];
}

export async function searchListings(query: string): Promise<{
  product: { id: string; name: string; category: string; image: string } | null;
  listings: Listing[];
}> {
  const products = await getProductMatches(query);
  const product = products[0] ?? null;
  if (!product) return { product: null, listings: [] };
  const detail = await getProductDetail(product.id);
  return {
    product: detail
      ? { id: detail.id, name: detail.name, category: detail.category, image: detail.image }
      : null,
    listings: detail?.listings ?? [],
  };
}

async function getProductMatches(query: string) {
  const q = query.trim().toLowerCase();
  if (!isSupabaseConfigured) {
    const matches = demoProducts.filter((p) =>
      p.name.toLowerCase().includes(q)
    );
    return (matches.length ? matches : demoProducts).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      image: p.image,
    }));
  }
  const supabase = await createClient();
  const { data } = await supabase!
    .from("products")
    .select("id,name,category,image_url")
    .ilike("name", `%${q}%`)
    .limit(5);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    image: p.image_url,
  }));
}

export async function getProductDetail(
  productId: string
): Promise<ProductDetail | null> {
  if (!isSupabaseConfigured) {
    const product = demoProducts.find((p) => p.id === productId);
    if (!product) return null;
    return {
      id: product.id,
      name: product.name,
      category: product.category,
      image: product.image,
      sku: product.sku,
      listings: listingFromDemo(productId),
    };
  }

  const supabase = await createClient();
  const { data: product } = await supabase!
    .from("products")
    .select("id,name,category,image_url,sku")
    .eq("id", productId)
    .single();
  if (!product) return null;

  const { data: inv } = await supabase!
    .from("inventory")
    .select("id,price,stock,available,store:stores(id,name,store_type,address,lat,lng)")
    .eq("product_id", productId)
    .eq("available", true);

  const listings: Listing[] = ((inv ?? []) as unknown as InventoryRow[])
    .map((row) => {
      const km = haversineKm(
        USER_LOCATION.lat,
        USER_LOCATION.lng,
        row.store.lat,
        row.store.lng
      );
      return {
        id: row.id,
        storeId: row.store.id,
        storeName: row.store.name,
        storeType: row.store.store_type ?? "",
        address: row.store.address,
        lat: row.store.lat,
        lng: row.store.lng,
        productId,
        price: row.price,
        stock: row.stock,
        deliveryMinutes: row.store.delivery_minutes ?? 25,
        distance: formatDistance(km),
        available: row.available,
      };
    })
    .sort((a, b) => a.deliveryMinutes - b.deliveryMinutes);

  return {
    id: product.id,
    name: product.name,
    category: product.category,
    image: product.image_url,
    sku: product.sku ?? "",
    listings,
  };
}

export interface MapStore {
  id: string;
  name: string;
  lat: number;
  lng: number;
  deliveryMinutes: number;
  products: number;
}

export async function getMapStores(): Promise<MapStore[]> {
  if (!isSupabaseConfigured) {
    return demoStores.map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      deliveryMinutes: s.deliveryMinutes,
      products: demoInventory.filter((i) => i.storeId === s.id).length,
    }));
  }
  const supabase = await createClient();
  const { data } = await supabase!.from("stores").select("id,name,lat,lng");
  return ((data ?? []) as { id: string; name: string; lat: number; lng: number }[]).map(
    (s) => {
      const km = haversineKm(USER_LOCATION.lat, USER_LOCATION.lng, s.lat, s.lng);
      return {
        id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        deliveryMinutes: Math.max(10, Math.round((8 + (km / 15) * 60) / 5) * 5),
        products: 0,
      };
    }
  );
}

// ── Commandes ─────────────────────────────────────────────────────────────────

export interface CreateOrderInput {
  productId: string;
  storeId: string;
  fulfillment: FulfillmentType;
  deliveryAddress?: string;
  customerName?: string;
}

export async function createOrder(input: CreateOrderInput): Promise<string> {
  const detail = await getProductDetail(input.productId);
  const listing = detail?.listings.find((l) => l.storeId === input.storeId);

  if (!isSupabaseConfigured) {
    const id = `CMD-${Math.floor(1000 + Math.random() * 9000)}`;
    demoOrders.set(id, {
      id,
      productId: input.productId,
      productName: detail?.name ?? "Produit",
      productImage: detail?.image ?? "",
      storeId: input.storeId,
      storeName: listing?.storeName ?? "Commerce",
      storeAddress: listing?.address ?? "",
      storeLat: listing?.lat ?? USER_LOCATION.lat,
      storeLng: listing?.lng ?? USER_LOCATION.lng,
      price: listing?.price ?? 0,
      status: "pending",
      fulfillment: input.fulfillment,
      deliveryAddress: input.deliveryAddress ?? null,
      etaMinutes: listing?.deliveryMinutes ?? 27,
      customerName: input.customerName ?? "Client",
      createdAt: new Date().toISOString(),
    });
    return id;
  }

  const supabase = await createClient();
  const { data: auth } = await supabase!.auth.getUser();
  const { data, error } = await supabase!
    .from("orders")
    .insert({
      consumer_id: auth.user?.id ?? null,
      product_id: input.productId,
      store_id: input.storeId,
      fulfillment: input.fulfillment,
      price: listing?.price ?? 0,
      delivery_address: input.deliveryAddress ?? null,
      eta_minutes: listing?.deliveryMinutes ?? 27,
      customer_name: input.customerName ?? null,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function getOrder(id: string): Promise<Order | null> {
  if (!isSupabaseConfigured) {
    return demoOrders.get(id) ?? fallbackOrder(id);
  }
  const supabase = await createClient();
  const { data } = await supabase!
    .from("orders")
    .select(
      "id,status,fulfillment,price,delivery_address,eta_minutes,customer_name,created_at,product:products(id,name,image_url),store:stores(name,address,lat,lng),driver:profiles!orders_driver_id_fkey(full_name)"
    )
    .eq("id", id)
    .single();
  if (!data) return null;
  const row = data as unknown as OrderRow;
  return {
    id: row.id,
    productId: row.product.id,
    productName: row.product.name,
    productImage: row.product.image_url,
    storeId: "",
    storeName: row.store.name,
    storeAddress: row.store.address,
    storeLat: row.store.lat ?? USER_LOCATION.lat,
    storeLng: row.store.lng ?? USER_LOCATION.lng,
    price: row.price,
    status: row.status,
    fulfillment: row.fulfillment,
    deliveryAddress: row.delivery_address,
    etaMinutes: row.eta_minutes ?? 27,
    customerName: row.customer_name ?? "Client",
    driverName: row.driver?.full_name ?? undefined,
    createdAt: row.created_at,
  };
}

/** Commande de secours pour garder le suivi navigable même sans persistance. */
function fallbackOrder(id: string): Order {
  const listing = listingFromDemo("nintendo-switch")[0];
  return {
    id,
    productId: "nintendo-switch",
    productName: "Nintendo Switch",
    productImage: "/products/nintendo-switch.svg",
    storeId: listing.storeId,
    storeName: listing.storeName,
    storeAddress: listing.address,
    storeLat: listing.lat,
    storeLng: listing.lng,
    price: listing.price,
    status: "delivering",
    fulfillment: "delivery",
    deliveryAddress: "8 avenue de l'Opéra, 75001 Paris",
    etaMinutes: 27,
    customerName: "Client",
    driverName: "Karim D.",
    createdAt: new Date().toISOString(),
  };
}

// ── Commerçant ─────────────────────────────────────────────────────────────────

export async function getMerchantOrders(): Promise<MerchantOrder[]> {
  if (!isSupabaseConfigured) {
    return [
      { id: "CMD-2847", productName: "Nintendo Switch", customerName: "Marie L.", time: "14:32", status: "preparing", fulfillment: "delivery" },
      { id: "CMD-2846", productName: "Casque Sony WH-1000XM5", customerName: "Thomas D.", time: "14:18", status: "ready", fulfillment: "pickup" },
      { id: "CMD-2845", productName: "Chargeur iPhone USB-C", customerName: "Sophie M.", time: "13:55", status: "delivered", fulfillment: "delivery" },
      { id: "CMD-2844", productName: "Câble HDMI 2.1", customerName: "Lucas B.", time: "13:40", status: "pending", fulfillment: "delivery" },
    ];
  }
  const supabase = await createClient();
  const { data } = await supabase!
    .from("orders")
    .select("id,status,fulfillment,created_at,customer_name,product:products(name)")
    .order("created_at", { ascending: false })
    .limit(20);
  return ((data ?? []) as unknown as OrderRow[]).map((row) => ({
    id: row.id.slice(0, 8).toUpperCase(),
    productName: row.product.name,
    customerName: row.customer_name ?? "Client",
    time: new Date(row.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    status: row.status,
    fulfillment: row.fulfillment,
  }));
}

export async function getStockItems(): Promise<StockItem[]> {
  if (!isSupabaseConfigured) {
    return demoInventory
      .filter((inv) => inv.storeId === "boutique-gaming")
      .map((inv) => {
        const product = demoProducts.find((p) => p.id === inv.productId)!;
        return {
          id: `${inv.storeId}-${inv.productId}`,
          name: product.name,
          sku: product.sku,
          price: inv.price,
          stock: inv.stock,
          available: inv.available,
          lastSync: "Il y a 2 min",
        };
      });
  }
  const supabase = await createClient();
  const { data: auth } = await supabase!.auth.getUser();
  const { data } = await supabase!
    .from("inventory")
    .select("id,price,stock,available,updated_at,product:products(name,sku),store:stores!inner(merchant_id)")
    .eq("store.merchant_id", auth.user?.id ?? "");
  return ((data ?? []) as unknown as StockRow[]).map((row) => ({
    id: row.id,
    name: row.product.name,
    sku: row.product.sku ?? "",
    price: row.price,
    stock: row.stock,
    available: row.available,
    lastSync: "Synchronisé",
  }));
}

// ── Livreur ─────────────────────────────────────────────────────────────────

export async function getDriverMissions(): Promise<DriverMission[]> {
  if (!isSupabaseConfigured) {
    const store = demoStores.find((s) => s.id === "boutique-gaming")!;
    const km = storeDistance(store);
    return [
      {
        id: "MIS-4821",
        storeName: store.name,
        storeAddress: store.address,
        storeLat: store.lat,
        storeLng: store.lng,
        productName: "Nintendo Switch",
        productImage: "/products/nintendo-switch.svg",
        customerName: "Marie L.",
        customerAddress: "8 avenue de l'Opéra, 75001 Paris",
        earnings: 8.5,
        deliveryMinutes: store.deliveryMinutes,
        distance: formatDistance(km),
      },
    ];
  }
  const supabase = await createClient();
  const { data } = await supabase!
    .from("orders")
    .select("id,eta_minutes,customer_name,delivery_address,product:products(name,image_url),store:stores(name,address,lat,lng)")
    .eq("status", "ready")
    .is("driver_id", null)
    .limit(10);
  return ((data ?? []) as unknown as OrderRow[]).map((row) => ({
    id: row.id.slice(0, 8).toUpperCase(),
    storeName: row.store.name,
    storeAddress: row.store.address,
    storeLat: row.store.lat ?? USER_LOCATION.lat,
    storeLng: row.store.lng ?? USER_LOCATION.lng,
    productName: row.product.name,
    productImage: row.product.image_url,
    customerName: row.customer_name ?? "Client",
    customerAddress: row.delivery_address ?? "Paris",
    earnings: 8.5,
    deliveryMinutes: row.eta_minutes ?? 25,
    distance: "1,2 km",
  }));
}

// ── Types des lignes Supabase (jointures) ────────────────────────────────────

interface InventoryRow {
  id: string;
  price: number;
  stock: number;
  available: boolean;
  product: { id: string; name: string; category: string; image_url: string };
  store: { id: string; name: string; store_type?: string; address: string; lat: number; lng: number; delivery_minutes?: number };
}

interface OrderRow {
  id: string;
  status: Order["status"];
  fulfillment: FulfillmentType;
  price: number;
  delivery_address: string | null;
  eta_minutes: number | null;
  customer_name: string | null;
  created_at: string;
  product: { id: string; name: string; image_url: string };
  store: { name: string; address: string; lat?: number; lng?: number };
  driver?: { full_name: string | null } | null;
}

interface StockRow {
  id: string;
  price: number;
  stock: number;
  available: boolean;
  product: { name: string; sku?: string };
}
