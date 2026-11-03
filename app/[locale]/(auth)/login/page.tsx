import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { companyService } from "@/services";
import { brandCompanyId, brandScope, requireScopeSelection } from "@/lib/auth/guards";
import { brandKeyForCompany } from "@/lib/companies";
import { LoginScreen } from "../_components/login-screen";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Scope selection comes first — even before the login page.
  await requireScopeSelection();
  const [scope, companyId] = await Promise.all([brandScope(), brandCompanyId()]);
  const company = companyId ? await companyService.findById(companyId) : null;
  return (
    <LoginScreen
      brand={brandKeyForCompany(company?.name)}
      logo={scope?.logo}
      logoAlt={scope?.name}
    />
  );
}
