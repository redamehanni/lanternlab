// Jeu de données de démonstration (zone pilote Paris 1er–4e).
// Utilisé lorsque Supabase n'est pas configuré, afin que l'application reste
// entièrement navigable et déployable sans backend.

export interface DemoStore {
  id: string;
  name: string;
  storeType: string;
  address: string;
  lat: number;
  lng: number;
  deliveryMinutes: number;
}

export interface DemoProduct {
  id: string;
  name: string;
  category: string;
  image: string;
  sku: string;
}

export interface DemoInventory {
  storeId: string;
  productId: string;
  price: number;
  stock: number;
  available: boolean;
}

export const demoStores: DemoStore[] = [
  { id: "boutique-gaming", name: "Boutique Gaming", storeType: "Spécialiste", address: "12 rue de Rivoli, 75004 Paris", lat: 48.857, lng: 2.358, deliveryMinutes: 15 },
  { id: "fnac", name: "Fnac", storeType: "High-tech", address: "1 rue Pierre Lescot, 75001 Paris", lat: 48.8628, lng: 2.347, deliveryMinutes: 35 },
  { id: "carrefour", name: "Carrefour", storeType: "Grande surface", address: "11 rue Beaubourg, 75003 Paris", lat: 48.86, lng: 2.353, deliveryMinutes: 25 },
  { id: "apple-store", name: "Apple Store", storeType: "High-tech", address: "12 rue Halévy, 75009 Paris", lat: 48.871, lng: 2.332, deliveryMinutes: 18 },
  { id: "boulanger", name: "Boulanger", storeType: "Électroménager", address: "8 rue Saint-Paul, 75004 Paris", lat: 48.855, lng: 2.362, deliveryMinutes: 28 },
];

export const demoProducts: DemoProduct[] = [
  { id: "nintendo-switch", name: "Nintendo Switch", category: "Gaming", image: "https://images.unsplash.com/photo-1578303512597-81e6cc155167?w=600&h=600&fit=crop", sku: "NSW-001" },
  { id: "chargeur-iphone", name: "Chargeur iPhone USB-C", category: "Accessoires", image: "https://images.unsplash.com/photo-1591290619762-dc222acba72e?w=600&h=600&fit=crop", sku: "CHG-001" },
  { id: "casque-sony", name: "Casque Sony WH-1000XM5", category: "Audio", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop", sku: "AUD-001" },
  { id: "cable-hdmi", name: "Câble HDMI 2.1", category: "Accessoires", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop", sku: "HDM-001" },
  { id: "perceuse-bosch", name: "Perceuse Bosch 18V", category: "Bricolage", image: "https://images.unsplash.com/photo-1504141927866-0a4f4dcb5567?w=600&h=600&fit=crop", sku: "DRL-001" },
  { id: "petit-prince", name: "Le Petit Prince", category: "Livres", image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&h=600&fit=crop", sku: "BOK-001" },
];

export const demoInventory: DemoInventory[] = [
  { storeId: "boutique-gaming", productId: "nintendo-switch", price: 299, stock: 5, available: true },
  { storeId: "fnac", productId: "nintendo-switch", price: 299, stock: 2, available: true },
  { storeId: "carrefour", productId: "nintendo-switch", price: 299, stock: 3, available: true },
  { storeId: "apple-store", productId: "chargeur-iphone", price: 29, stock: 20, available: true },
  { storeId: "fnac", productId: "chargeur-iphone", price: 25, stock: 12, available: true },
  { storeId: "fnac", productId: "casque-sony", price: 349, stock: 4, available: true },
  { storeId: "apple-store", productId: "casque-sony", price: 349, stock: 2, available: true },
  { storeId: "boulanger", productId: "cable-hdmi", price: 19, stock: 30, available: true },
  { storeId: "carrefour", productId: "cable-hdmi", price: 19, stock: 15, available: true },
  { storeId: "boulanger", productId: "perceuse-bosch", price: 129, stock: 6, available: true },
  { storeId: "carrefour", productId: "petit-prince", price: 12, stock: 25, available: true },
];

export const SEARCH_SUGGESTIONS = [
  "Chargeur iPhone",
  "Nintendo Switch",
  "Casque audio",
  "Livre",
  "Perceuse",
  "Câble HDMI",
];
