// Unit tests for HID-062 tax-form intake (OF-283)
// Covers: validation, jurisdiction+form_type matrix, last4 derivation, payout gate.

import { describe, it, expect } from "vitest";

// ── helpers extracted from tax.ts (inline for unit testing without importing Express) ──

type FormType = "w9" | "w8ben" | "w8ben_e" | "jp_mynumber" | "tw_national" | "sg_nric";

const ALLOWED_FORM_TYPES: Set<FormType> = new Set([
  "w9", "w8ben", "w8ben_e", "jp_mynumber", "tw_national", "sg_nric",
]);

const JURISDICTION_TO_FORM_TYPES: Record<string, FormType[]> = {
  US: ["w9", "w8ben", "w8ben_e"],
  JP: ["jp_mynumber", "w8ben"],
  TW: ["tw_national", "w8ben"],
  SG: ["sg_nric", "w8ben"],
};

function validatePayload(body: unknown): { data: Record<string, unknown> } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Request body must be a JSON object" };
  const b = body as Record<string, unknown>;
  const required = ["form_type", "jurisdiction", "full_name", "country", "address"] as const;
  for (const field of required) {
    if (typeof b[field] !== "string" || !(b[field] as string).trim()) {
      return { error: `Missing or empty required field: ${field}` };
    }
  }
  const formType = (b["form_type"] as string).toLowerCase() as FormType;
  if (!ALLOWED_FORM_TYPES.has(formType)) {
    return { error: `Invalid form_type. Allowed: ${[...ALLOWED_FORM_TYPES].join(", ")}` };
  }
  const jurisdiction = (b["jurisdiction"] as string).toUpperCase();
  const allowedForJurisdiction = JURISDICTION_TO_FORM_TYPES[jurisdiction];
  if (!allowedForJurisdiction) {
    return { error: `Unsupported jurisdiction. Allowed: ${Object.keys(JURISDICTION_TO_FORM_TYPES).join(", ")}` };
  }
  if (!allowedForJurisdiction.includes(formType)) {
    return { error: `form_type '${formType}' is not valid for jurisdiction '${jurisdiction}'. Allowed: ${allowedForJurisdiction.join(", ")}` };
  }
  if (b["tax_id"] !== undefined && typeof b["tax_id"] !== "string") {
    return { error: "tax_id must be a string" };
  }
  return { data: { ...b, form_type: formType, jurisdiction } };
}

function deriveLast4(taxId: string | undefined): string | null {
  if (!taxId || taxId.length < 4) return null;
  return taxId.slice(-4);
}

// ── tests ─────────────────────────────────────────────────────────────────────

const VALID_BASE = {
  form_type: "w9",
  jurisdiction: "US",
  full_name: "Jane Creator",
  country: "US",
  address: "123 Main St, Austin TX 78701",
};

describe("validatePayload", () => {
  it("accepts a valid W-9 payload", () => {
    const result = validatePayload(VALID_BASE);
    expect("data" in result).toBe(true);
  });

  it("normalises form_type to lowercase", () => {
    const result = validatePayload({ ...VALID_BASE, form_type: "W9" });
    expect("data" in result && (result as { data: Record<string, unknown> }).data.form_type).toBe("w9");
  });

  it("normalises jurisdiction to uppercase", () => {
    const result = validatePayload({ ...VALID_BASE, jurisdiction: "us" });
    expect("data" in result && (result as { data: Record<string, unknown> }).data.jurisdiction).toBe("US");
  });

  it("rejects missing required fields", () => {
    const { full_name: _, ...without } = VALID_BASE;
    const result = validatePayload(without);
    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toContain("full_name");
  });

  it("rejects invalid form_type", () => {
    const result = validatePayload({ ...VALID_BASE, form_type: "1099" });
    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toContain("form_type");
  });

  it("rejects unsupported jurisdiction", () => {
    const result = validatePayload({ ...VALID_BASE, jurisdiction: "DE" });
    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toContain("jurisdiction");
  });

  it("rejects w9 for JP jurisdiction", () => {
    const result = validatePayload({ ...VALID_BASE, form_type: "w9", jurisdiction: "JP" });
    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toContain("w9");
  });

  it("accepts jp_mynumber for JP jurisdiction", () => {
    const result = validatePayload({ ...VALID_BASE, form_type: "jp_mynumber", jurisdiction: "JP", country: "JP" });
    expect("data" in result).toBe(true);
  });

  it("accepts w8ben for all jurisdictions", () => {
    for (const jur of ["US", "JP", "TW", "SG"]) {
      const result = validatePayload({ ...VALID_BASE, form_type: "w8ben", jurisdiction: jur });
      expect("data" in result).toBe(true);
    }
  });

  it("accepts tw_national for TW jurisdiction", () => {
    const result = validatePayload({ ...VALID_BASE, form_type: "tw_national", jurisdiction: "TW", country: "TW" });
    expect("data" in result).toBe(true);
  });

  it("accepts sg_nric for SG jurisdiction", () => {
    const result = validatePayload({ ...VALID_BASE, form_type: "sg_nric", jurisdiction: "SG", country: "SG" });
    expect("data" in result).toBe(true);
  });

  it("rejects non-string tax_id", () => {
    const result = validatePayload({ ...VALID_BASE, tax_id: 12345678 });
    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toContain("tax_id");
  });

  it("accepts payload without tax_id", () => {
    const result = validatePayload(VALID_BASE);
    expect("data" in result).toBe(true);
  });
});

describe("deriveLast4", () => {
  it("returns last 4 chars of a US SSN", () => {
    expect(deriveLast4("123-45-6789")).toBe("6789");
  });

  it("returns last 4 chars of a JP My Number", () => {
    expect(deriveLast4("1234 5678 9012")).toBe("9012");
  });

  it("returns null for undefined", () => {
    expect(deriveLast4(undefined)).toBeNull();
  });

  it("returns null when string is shorter than 4 chars", () => {
    expect(deriveLast4("123")).toBeNull();
  });
});

describe("payout gate logic", () => {
  // Mirrors the SQL: eligible when status in ('submitted', 'approved')
  function isPayoutEligible(status: string | null): boolean {
    return status === "submitted" || status === "approved";
  }

  it("not_submitted → ineligible", () => {
    expect(isPayoutEligible(null)).toBe(false);
  });

  it("submitted → eligible", () => {
    expect(isPayoutEligible("submitted")).toBe(true);
  });

  it("approved → eligible", () => {
    expect(isPayoutEligible("approved")).toBe(true);
  });

  it("rejected → ineligible", () => {
    expect(isPayoutEligible("rejected")).toBe(false);
  });
});
