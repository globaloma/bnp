import { z } from "zod";

export const applicationSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name").max(120),
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().email("Enter a valid email address").max(160),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20)
    .regex(/^[0-9+()\s-]+$/, "Enter a valid phone number"),
  category: z.string().trim().max(80).optional(),
  location: z.string().trim().min(1, "Select a preferred location").max(80),
  volume: z.string().trim().max(80).optional(),
  note: z.string().trim().max(2000).optional(),
  // honeypot, must stay empty
  website: z.string().max(0).optional(),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

export type ApplicationResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
