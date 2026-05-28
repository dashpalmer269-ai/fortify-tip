import { z } from "zod";

const dateOfBirth = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD")
  .refine((v) => !isNaN(Date.parse(v)), "Date of birth must be a valid date")
  .refine((v) => {
    const year = Number(v.slice(0, 4));
    const now = new Date().getFullYear();
    return year >= now - 120 && year <= now - 14;
  }, "Date of birth must be a plausible adult workforce member");

const nameField = z.string().trim().min(1).max(80);
const middleNameField = z.string().trim().max(80).optional();
const addressField = z.string().trim().max(200).optional();
const cityField = z.string().trim().max(80).optional();
const stateField = z.string().trim().max(40).optional();
const zipField = z.string().trim().max(12).optional();

export const PreliminaryScreeningSchema = z.object({
  subject_type: z.enum(["workforce_member", "vendor_contact"]),
  practice_id: z.string().uuid().nullable().optional(),
  vendor_id: z.string().uuid().nullable().optional(),
  first_name: nameField,
  last_name: nameField,
  date_of_birth: dateOfBirth,
});
export type PreliminaryScreeningBody = z.infer<typeof PreliminaryScreeningSchema>;

export const VerifyScreeningSchema = z
  .object({
    middle_name: middleNameField,
    address_line: addressField,
    city: cityField,
    state: stateField,
    zip: zipField,
  })
  .refine(
    (v) => Boolean(v.middle_name || v.address_line),
    "Provide a middle name or an address from your most recent tax return"
  );
export type VerifyScreeningBody = z.infer<typeof VerifyScreeningSchema>;

export const OverrideScreeningSchema = z.object({
  reason: z.string().trim().min(10).max(500),
});
export type OverrideScreeningBody = z.infer<typeof OverrideScreeningSchema>;

export const VendorScreeningSchema = z.object({
  vendor_id: z.string().uuid(),
  first_name: nameField,
  last_name: nameField,
  date_of_birth: dateOfBirth,
});
export type VendorScreeningBody = z.infer<typeof VendorScreeningSchema>;
