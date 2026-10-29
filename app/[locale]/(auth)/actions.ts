"use server";

import type { z } from "zod";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { userService, loginSchema } from "@/services";
import { canViewDashboard } from "@/lib/auth/guards";
import {
  getSelectedCompanyIdFromCookie,
  setSelectedCompanyCookie,
} from "@/lib/company-selection";

type AuthState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

// Reduces a ZodError to the first message per field — uses only `error.issues`,
// which is stable across zod versions.
function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && out[key] === undefined) {
      out[key] = issue.message;
    }
  }
  return out;
}

export async function loginAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await userService.login(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to sign in.",
    };
  }

  // Success: cookie is set inside userService.login(). redirect() must be called
  // outside the try/catch because it works by throwing. Privileged roles go to
  // the dashboard; a plain user lands on the (company-branded) landing page. The
  // locale-aware redirect keeps the active /en or /ar prefix.
  const me = await userService.currentUser();
  let href = "/";
  if (me && canViewDashboard(me)) {
    href = "/dashboard";
  } else if (me) {
    // Company selection happened before login. Keep account and cookie in sync:
    // adopt the cookie choice if the account has none, otherwise mirror the
    // account's company into the cookie so the brand is consistent.
    if (me.companyId == null) {
      const cookieId = await getSelectedCompanyIdFromCookie();
      if (cookieId != null) {
        await userService.update(me.id, { companyId: cookieId });
      } else {
        href = "/company-select";
      }
    } else {
      await setSelectedCompanyCookie(me.companyId);
    }
  }
  return redirect({ href, locale: await getLocale() });
}
