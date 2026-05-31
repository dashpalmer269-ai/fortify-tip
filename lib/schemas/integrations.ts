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

export const AwsConnectSchema = z.object({
  access_key_id: z.string().trim().regex(/^AKIA[0-9A-Z]{16}$/, {
    message: "Must be a valid AWS access key id (starts with AKIA)",
  }),
  secret_access_key: z.string().trim().min(40).max(60),
  region: z
    .string()
    .trim()
    .regex(/^[a-z]{2}-[a-z]+-\d$/, {
      message: "Must be a valid AWS region (e.g. us-east-1, eu-west-2)",
    }),
});
export type AwsConnectBody = z.infer<typeof AwsConnectSchema>;
