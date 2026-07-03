export type Role = "consumer" | "merchant" | "driver";

export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "assigned"
  | "picked_up"
  | "delivering"
  | "delivered"
  | "cancelled";

export type FulfillmentType = "delivery" | "pickup";

export interface ProductSummary {
  id: string;
  name: string;
  category: string;
  image: string;
}

/** Produit affiché dans la section « près de vous » avec sa meilleure offre. */
export interface NearbyProduct extends ProductSummary {
  price: number;
  storeName: string;
  deliveryMinutes: number;
  distance: string;
}

/** Une offre d'un produit dans un commerce donné. */
export interface Listing {
  id: string;
  storeId: string;
  storeName: string;
  storeType: string;
  address: string;
  lat: number;
  lng: number;
  productId: string;
  price: number;
  stock: number;
  deliveryMinutes: number;
  distance: string;
  available: boolean;
}

export interface ProductDetail extends ProductSummary {
  sku: string;
  listings: Listing[];
}

export interface Order {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  storeId: string;
  storeName: string;
  storeAddress: string;
  storeLat: number;
  storeLng: number;
  price: number;
  status: OrderStatus;
  fulfillment: FulfillmentType;
  deliveryAddress: string | null;
  etaMinutes: number;
  customerName: string;
  driverName?: string;
  createdAt: string;
}

export interface MerchantOrder {
  id: string;
  productName: string;
  customerName: string;
  time: string;
  status: OrderStatus;
  fulfillment: FulfillmentType;
}

export interface StockItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  available: boolean;
  lastSync: string;
}

export interface DriverMission {
  id: string;
  storeName: string;
  storeAddress: string;
  storeLat: number;
  storeLng: number;
  productName: string;
  productImage: string;
  customerName: string;
  customerAddress: string;
  earnings: number;
  deliveryMinutes: number;
  distance: string;
}
