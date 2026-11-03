// The two seeded companies. ECM+ keeps the original (project-less) behavior; CTC
// is project-scoped, so CTC reporters must pick a project when filing a ticket
// and permissions are evaluated per project.
export const ECM_COMPANY_NAME = "ECM+";
export const CTC_COMPANY_NAME = "CTC";

// Whether tickets for the given company are scoped to a project (CTC only).
export function companyRequiresProject(companyName: string | null | undefined): boolean {
  return companyName === CTC_COMPANY_NAME;
}

// The two companies created by the seed (ECM+, CTC). They underpin the app's
// branding and project-scoping rules, so admins can't delete or rename them —
// only their logo and website are editable.
export function isSeededCompany(companyName: string | null | undefined): boolean {
  return companyName === ECM_COMPANY_NAME || companyName === CTC_COMPANY_NAME;
}

// The brand a surface is shown under. Drives the logo and the landing-page copy.
// Defaults to CTC (the primary brand) for anyone without an ECM+ company.
export type BrandKey = "ecm" | "ctc";

export function brandKeyForCompany(
  companyName: string | null | undefined,
): BrandKey {
  return companyName === ECM_COMPANY_NAME ? "ecm" : "ctc";
}
