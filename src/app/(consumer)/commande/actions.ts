"use server";

import { redirect } from "next/navigation";
import { createOrder } from "@/lib/data";
import type { FulfillmentType } from "@/lib/types";

export async function placeOrder(formData: FormData) {
  const productId = String(formData.get("product"));
  const storeId = String(formData.get("store"));
  const fulfillment = String(formData.get("fulfillment")) as FulfillmentType;
  const deliveryAddress = formData.get("address")
    ? String(formData.get("address"))
    : undefined;

  const orderId = await createOrder({
    productId,
    storeId,
    fulfillment,
    deliveryAddress,
    customerName: "Client Ma Zone",
  });

  redirect(`/commande/confirmee?order=${orderId}`);
}
