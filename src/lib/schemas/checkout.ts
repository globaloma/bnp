import { z } from "zod";

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, "Enter your name").max(140),
  customerPhone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20)
    .regex(/^[0-9+()\s-]+$/, "Enter a valid phone number"),
  customerEmail: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),
  fulfillment: z.enum(["delivery", "pickup"]).default("delivery"),
  deliveryZoneId: z.string().uuid().optional().or(z.literal("")),
  deliveryAddress: z.string().trim().max(500).optional().default(""),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1),
      }),
    )
    .min(1, "Your cart is empty"),
})
  // Pickup customers don't need to give an address; delivery customers do.
  .refine((d) => d.fulfillment === "pickup" || d.deliveryAddress.length >= 5, {
    path: ["deliveryAddress"],
    message: "Enter a delivery address",
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export type ActionResult =
  | { ok: true; authorizationUrl: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
