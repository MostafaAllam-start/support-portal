"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { keepInputOnError } from "@/lib/utils";
import { updateProfileAction, type ProfileState } from "../actions";

export type ProfileValues = {
  name: string;
  username: string;
  email: string;
  jobTitle: string | null;
  image: string | null;
  website: string | null;
  whatsapp: string | null;
  linkedin: string | null;
};

export function ProfileForm({ user }: { user: ProfileValues }) {
  const t = useTranslations("Profile");
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    updateProfileAction,
    {},
  );

  useEffect(() => {
    if (state.ok) toast.success(t("success"));
    else if (state.error) toast.error(state.error);
  }, [state, t]);

  return (
    <form action={action} onReset={keepInputOnError(state)} className="grid gap-5 rounded-xl border p-6">
      <div className="space-y-2">
        <Label>{t("image")}</Label>
        {user.image && <input type="hidden" name="currentImage" value={user.image} />}
        <ImageDropzone
          id="profile-image"
          name="imageFile"
          defaultPreview={user.image ?? undefined}
          invalid={Boolean(state.fieldErrors?.image)}
          texts={{
            hint: t("imageHint"),
            types: t("imageTypes"),
            remove: t("imageRemove"),
          }}
        />
        <FieldError message={state.fieldErrors?.image} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-name">{t("name")}</Label>
          <Input
            id="profile-name"
            name="name"
            defaultValue={user.name}
            aria-invalid={Boolean(state.fieldErrors?.name)}
            required
          />
          <FieldError message={state.fieldErrors?.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-jobTitle">{t("jobTitle")}</Label>
          <Input
            id="profile-jobTitle"
            name="jobTitle"
            defaultValue={user.jobTitle ?? ""}
          />
        </div>
      </div>

      {/* The username is the sign-in handle and can only be changed by an admin. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-username">{t("username")}</Label>
          <Input id="profile-username" value={`@${user.username}`} disabled readOnly />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-email">{t("email")}</Label>
          <Input
            id="profile-email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={user.email}
            aria-invalid={Boolean(state.fieldErrors?.email)}
            required
          />
          <FieldError message={state.fieldErrors?.email} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-website">{t("website")}</Label>
          <Input
            id="profile-website"
            name="website"
            defaultValue={user.website ?? ""}
            placeholder="https://…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-whatsapp">{t("whatsapp")}</Label>
          <Input
            id="profile-whatsapp"
            name="whatsapp"
            defaultValue={user.whatsapp ?? ""}
            placeholder="+962…"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-linkedin">{t("linkedin")}</Label>
        <Input
          id="profile-linkedin"
          name="linkedin"
          defaultValue={user.linkedin ?? ""}
          placeholder="https://www.linkedin.com/in/…"
        />
      </div>

      <section className="grid gap-4 border-t pt-5" aria-labelledby="profile-security">
        <div className="space-y-1">
          <h2 id="profile-security" className="text-sm font-medium">
            {t("security")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("securityHint")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-newPassword">{t("password")}</Label>
            <Input
              id="profile-newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(state.fieldErrors?.newPassword)}
            />
            <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
            <FieldError message={state.fieldErrors?.newPassword} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-confirmPassword">{t("confirmPassword")}</Label>
            <Input
              id="profile-confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
            />
            <FieldError message={state.fieldErrors?.confirmPassword} />
          </div>
        </div>

        <div className="space-y-2 sm:max-w-[calc(50%-0.5rem)]">
          <Label htmlFor="profile-currentPassword">{t("currentPassword")}</Label>
          <Input
            id="profile-currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(state.fieldErrors?.currentPassword)}
          />
          <FieldError message={state.fieldErrors?.currentPassword} />
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}
