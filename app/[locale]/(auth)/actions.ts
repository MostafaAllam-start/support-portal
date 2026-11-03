"use server";

import type { z } from "zod";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { userService, loginSchema } from "@/services";
import { brandScope, hasDashboardAccess } from "@/lib/auth/guards";
import { chooseScope } from "@/lib/choose-scope";

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
  if (me && hasDashboardAccess(me)) {
    href = "/dashboard";
  } else if (me) {
    // Scope selection happened before login. Keep account and cookie in sync: the
    // choice stands if the scope is theirs, otherwise the scope of their company.
    const scope = await brandScope();
    if (scope) {
      await chooseScope(scope.id);
    } else {
      href = "/company-select";
    }
  }
  return redirect({ href, locale: await getLocale() });
}
