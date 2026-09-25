import { z } from "zod";

const PHONE_REGEX = /^[0-9+()\s-]+$/;

export const orderSchema = z.object({
  customerName: z.string().trim().min(2, "Enter a customer name").max(140),
  customerPhone: z
    .string()
    .trim()
    .max(20)
    .regex(PHONE_REGEX, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  deliveryAddress: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  productId: z.string().uuid("Select a product"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  rider: z.enum(["BNP Fleet", "Own Rider", "Pickup"]),
  discountType: z.enum(["fixed", "percentage"]).optional(),
  discountValue: z.coerce.number().min(0).default(0),
  deliveryFee: z.coerce.number().min(0).default(0),
});

export type OrderInput = z.infer<typeof orderSchema>;

export const orderEditSchema = z.object({
  customerName: z.string().trim().min(2, "Enter a customer name").max(140),
  customerPhone: z
    .string()
    .trim()
    .max(20)
    .regex(PHONE_REGEX, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  customerEmail: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  deliveryAddress: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  rider: z.enum(["BNP Fleet", "Own Rider", "Pickup"]),
  status: z.enum(["Packaging", "Shipping", "Delivered", "Returned", "Damaged"]),
  discountType: z.enum(["fixed", "percentage"]).optional(),
  discountValue: z.coerce.number().min(0).default(0),
  deliveryFee: z.coerce.number().min(0).default(0),
});

export type OrderEditInput = z.infer<typeof orderEditSchema>;

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
