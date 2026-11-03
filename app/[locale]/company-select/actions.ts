"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { chooseScope } from "@/lib/choose-scope";

export type ScopeSelectState = {
  error?: string;
};

// Records the scope an (anonymous or signed-in) visitor picked.
export async function selectScopeAction(
  _prevState: ScopeSelectState,
  formData: FormData,
): Promise<ScopeSelectState> {
  if (!(await chooseScope(Number(formData.get("scopeId"))))) {
    return { error: "Please choose a scope." };
  }

  // Land on the landing page, now branded for the scope.
  return redirect({ href: "/", locale: await getLocale() });
}
