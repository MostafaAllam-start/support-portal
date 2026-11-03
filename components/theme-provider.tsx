"use client";

import type { ComponentProps } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// next-themes renders an inline <script> that sets the theme class before the
// first paint. Only the copy in the server HTML has to run: a script React
// creates on the client never runs, and React logs "Encountered a script tag"
// when it does (switching locale remounts this provider). On the client the
// script is typed as a data block, which React doesn't warn about; the element
// has suppressHydrationWarning, so the type differing from the server's isn't a
// hydration mismatch.
const clientScriptProps =
  typeof window === "undefined" ? undefined : { type: "application/json" };

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider scriptProps={clientScriptProps} {...props}>
      {children}
    </NextThemesProvider>
  );
}
