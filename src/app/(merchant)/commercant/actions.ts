"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateStockItem(
  id: string,
  stock: number,
  available: boolean
) {
  const supabase = await createClient();
  // En mode démonstration, rien à persister : l'UI gère l'état optimiste.
  if (!supabase) return { ok: true };

  const { error } = await supabase
    .from("inventory")
    .update({ stock, available, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/commercant/stocks");
  return { ok: true };
}
