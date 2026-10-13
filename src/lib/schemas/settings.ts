import { z } from "zod";

export const profileSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name").max(120),
  contactName: z.string().trim().min(2, "Enter your full name").max(120),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20)
    .regex(/^[0-9+()\s-]+$/, "Enter a valid phone number"),
  category: z.string().trim().max(80).optional(),
  logoUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
});

export const storefrontSchema = z.object({
  description: z.string().trim().max(500, "Keep it under 500 characters").optional(),
  whatsapp: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9+()\s-]*$/, "Enter a valid phone number")
    .refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, "Enter a valid phone number")
    .optional(),
  // Accepts "@glowco", "glowco" or a pasted profile link, stores "glowco".
  instagram: z
    .string()
    .trim()
    .transform((v) =>
      v
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
        .replace(/^@/, "")
        .replace(/[/?].*$/, ""),
    )
    .refine(
      (v) => v === "" || /^[A-Za-z0-9._]{1,30}$/.test(v),
      "Enter your Instagram username, e.g. @glowco",
    )
    .optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72, "Use fewer than 72 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type SettingsResult =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
