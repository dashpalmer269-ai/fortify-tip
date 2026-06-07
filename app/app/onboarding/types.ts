export type StepKey = "information" | "fortification" | "safeguards" | "payment";

export interface OnboardingLocation {
  label?: string;
  street_1: string;
  street_2?: string;
  city: string;
  region: string;
  postal_code: string;
}

export interface InformationData {
  practice_name: string;
  description: string;
  employee_range: "1-20" | "21-50" | "51+" | "";
  location_count_range: "1-2" | "3-5" | "5+" | "";
  locations: OnboardingLocation[];
}

export interface FortificationData {
  current_status: "starting_brand_new" | "maintenance_needed" | "transfer_from_other" | "";
  upcoming_audit_window:
    | "within_30_days"
    | "within_60_days"
    | "within_90_days"
    | "beyond_90_days"
    | "";
}

export type SafeguardMode = "manual" | "schedule" | "";

export interface SafeguardsData {
  mode: SafeguardMode;
  integrations: string[];               // integration_type list when manual
  assistance_date?: string;             // YYYY-MM-DD
  assistance_window?: "morning" | "afternoon" | "evening" | "flexible" | "";
  assistance_phone?: string;
  assistance_notes?: string;
}

export interface PaymentData {
  selected_plan: "software" | "full_service" | "";
}

export interface OnboardingState {
  information: InformationData;
  fortification: FortificationData;
  safeguards: SafeguardsData;
  payment: PaymentData;
}

export const EMPTY_LOCATION: OnboardingLocation = {
  label: "",
  street_1: "",
  street_2: "",
  city: "",
  region: "",
  postal_code: "",
};

export function defaultState(): OnboardingState {
  return {
    information: {
      practice_name: "",
      description: "",
      employee_range: "",
      location_count_range: "",
      locations: [{ ...EMPTY_LOCATION }],
    },
    fortification: {
      current_status: "",
      upcoming_audit_window: "",
    },
    safeguards: {
      mode: "",
      integrations: [],
      assistance_window: "",
    },
    payment: {
      selected_plan: "",
    },
  };
}
