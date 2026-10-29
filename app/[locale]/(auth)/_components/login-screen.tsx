"use client";

import { useActionState, useState, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import {
  AtSign,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { keepInputOnError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import type { BrandKey } from "@/lib/companies";
import { loginAction } from "../actions";

// Sign-in is the only public auth surface: accounts are created by an admin from
// the dashboard, and the credentials are emailed to the new user.
export function LoginScreen({ brand = "ctc" }: { brand?: BrandKey }) {
  const t = useTranslations("Auth");
  const tBrand = useTranslations("Brand");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div className="pointer-events-none absolute -top-24 -start-24 size-72 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 end-0 size-80 translate-y-1/3 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 text-primary-foreground opacity-[0.15] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:36px_36px]" />

        <Logo
          className="relative self-center"
          imageClassName="h-16"
          brand={brand}
        />

        <div className="relative space-y-6">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance">
            {tBrand(`${brand}.headline`)}
          </h1>
          <p className="max-w-sm text-primary-foreground/80">
            {tBrand(`${brand}.tagline`)}
          </p>
          <ul className="space-y-3 text-sm text-primary-foreground/90">
            <li className="flex items-center gap-3">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary-foreground/10">
                <Zap className="size-4" />
              </span>
              {tBrand(`${brand}.feature1`)}
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary-foreground/10">
                <ShieldCheck className="size-4" />
              </span>
              {tBrand(`${brand}.feature2`)}
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary-foreground/10">
                <Sparkles className="size-4" />
              </span>
              {tBrand(`${brand}.feature3`)}
            </li>
          </ul>
        </div>

        <p className="relative text-sm text-primary-foreground/60">
          {tBrand(`${brand}.rights`)}
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between gap-3">
            <Logo className="lg:hidden" brand={brand} />
            <div className="flex items-center gap-2 ms-auto">
              <ThemeToggle />
              <LocaleSwitcher />
            </div>
          </div>

          <div className="mb-6 space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">
              {t("welcomeBack")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("welcomeBackDesc")}
            </p>
          </div>

          <LoginForm />

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("noAccount")}
          </p>
        </div>
      </main>
    </div>
  );
}

function LoginForm() {
  const t = useTranslations("Auth");
  const [state, formAction, pending] = useActionState(loginAction, {});

  return (
    <form action={formAction} onReset={keepInputOnError(state)} className="space-y-4">
      <FormError message={state.error} />

      <div className="space-y-2">
        <Label htmlFor="login-identifier">{t("usernameOrEmail")}</Label>
        <div className="relative">
          <AtSign className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="login-identifier"
            name="identifier"
            placeholder={t("emailPlaceholder")}
            autoComplete="username"
            className="ps-9"
            aria-invalid={Boolean(state.fieldErrors?.identifier)}
          />
        </div>
        <FieldError message={state.fieldErrors?.identifier} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">{t("password")}</Label>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t("forgotPassword")}
          </button>
        </div>
        <PasswordInput
          id="login-password"
          name="password"
          placeholder="••••••••"
          autoComplete="current-password"
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
        <FieldError message={state.fieldErrors?.password} />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {t("submitSignIn")}
      </Button>
    </form>
  );
}

function PasswordInput(props: ComponentProps<typeof Input>) {
  const t = useTranslations("Auth");
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input type={show ? "text" : "password"} className="px-9" {...props} />
      <button
        type="button"
        onClick={() => setShow((value) => !value)}
        className="absolute top-1/2 end-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={show ? t("hidePassword") : t("showPassword")}
        tabIndex={-1}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  );
}
