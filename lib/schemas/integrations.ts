import { z } from "zod";

export const OktaConnectSchema = z.object({
  org_url: z
    .string()
    .trim()
    .url()
    .refine((u) => /\.okta(preview|-emea)?\.com$/.test(new URL(u).hostname) || /\.oktapreview\.com$/.test(new URL(u).hostname) || new URL(u).hostname.endsWith(".okta.com"), {
      message: "Must be an Okta org URL (e.g. https://acme.okta.com)",
    }),
  api_token: z.string().trim().min(20).max(200),
});
export type OktaConnectBody = z.infer<typeof OktaConnectSchema>;
