"use server";

import { createClient } from "@/lib/supabase/server";

export async function acceptMission(orderId: string) {
  const supabase = await createClient();
  if (!supabase) return { ok: true };

  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("orders")
    .update({ driver_id: auth.user?.id, status: "assigned" })
    .eq("id", orderId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setDriverOnline(isOnline: boolean) {
  const supabase = await createClient();
  if (!supabase) return { ok: true };

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };

  await supabase.from("driver_sessions").upsert({
    driver_id: auth.user.id,
    is_online: isOnline,
    updated_at: new Date().toISOString(),
  });
  return { ok: true };
}
