"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Ban,
  CircleCheck,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn, keepInputOnError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createUserAction,
  setUserDisabledAction,
  updateUserAction,
  type ActionState,
} from "../actions";

export type UserItem = {
  id: number;
  name: string;
  username: string;
  email: string;
  jobTitle: string | null;
  isAdmin: boolean;
  isSystemSupport: boolean;
  canAccessDashboard: boolean;
  image: string | null;
  isDisabled: boolean;
  companyId: number | null;
  website: string | null;
  whatsapp: string | null;
  linkedin: string | null;
  isTeamMember: boolean;
  hasContactInfoCard: boolean;
};

type CompanyOption = { id: number; name: string };

const selectClass =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function UserFormDialog({
  mode,
  user,
  companies = [],
  adminLocked = false,
  open,
  onOpenChange,
}: {
  mode: "add" | "edit";
  user?: UserItem;
  // Companies the user can be assigned to (only used in edit mode).
  companies?: CompanyOption[];
  // The default admin can't be demoted — render the checkbox checked + disabled.
  adminLocked?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Dashboard");
  const action = mode === "add" ? createUserAction : updateUserAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );

  // Admin implies dashboard access, so when "admin" is on we force the
  // dashboard-access checkbox checked + disabled. Tracking both as state keeps
  // the dashboard toggle in sync as the admin checkbox flips.
  const [isAdmin, setIsAdmin] = useState(adminLocked || Boolean(user?.isAdmin));
  const [canAccessDashboard, setCanAccessDashboard] = useState(
    Boolean(user?.canAccessDashboard),
  );
  const adminOn = adminLocked || isAdmin;
  const dashboardOn = adminOn || canAccessDashboard;

  useEffect(() => {
    if (state.ok) {
      toast.success(
        mode === "add" ? t("users.toast.created") : t("users.toast.updated"),
      );
      onOpenChange(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, mode, t, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Header and footer stay fixed; only the field area scrolls. The height
          is capped on tablet/desktop so the dialog never outgrows the viewport. */}
      <DialogContent className="flex flex-col gap-4 sm:max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>
            {mode === "add"
              ? t("users.form.addTitle")
              : t("users.form.editTitle")}
          </DialogTitle>
          <DialogDescription>{t("users.form.description")}</DialogDescription>
        </DialogHeader>

        <form
          action={formAction}
          onReset={keepInputOnError(state)}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          {mode === "edit" && user && (
            <input type="hidden" name="id" value={user.id} />
          )}

          {/* Scrollable field region (negative margin + padding so focus rings
              aren't clipped by the overflow container). */}
          <div className="-mx-1 grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-name">{t("users.form.name")}</Label>
              <Input
                id="user-name"
                name="name"
                defaultValue={user?.name}
                aria-invalid={Boolean(state.fieldErrors?.name)}
                required
              />
              <FieldError message={state.fieldErrors?.name} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-username">{t("users.form.username")}</Label>
              <Input
                id="user-username"
                name="username"
                defaultValue={user?.username}
                aria-invalid={Boolean(state.fieldErrors?.username)}
                required
              />
              <FieldError message={state.fieldErrors?.username} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-email">{t("users.form.email")}</Label>
            <Input
              id="user-email"
              name="email"
              type="email"
              defaultValue={user?.email}
              aria-invalid={Boolean(state.fieldErrors?.email)}
              required
            />
            <FieldError message={state.fieldErrors?.email} />
            {mode === "add" && (
              <p className="text-xs text-muted-foreground">
                {t("users.form.emailHint")}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Company is optional in both create and edit. Blank means no
                company (and on edit, clears any existing assignment). */}
            <div className="space-y-2">
              <Label htmlFor="user-company">{t("users.form.company")}</Label>
              <select
                id="user-company"
                name="companyId"
                defaultValue={user?.companyId ?? ""}
                className={cn(selectClass)}
              >
                <option value="">{t("users.form.companyNone")}</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-jobTitle">{t("users.form.jobTitle")}</Label>
              <Input
                id="user-jobTitle"
                name="jobTitle"
                defaultValue={user?.jobTitle ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-website">{t("users.form.website")}</Label>
              <Input
                id="user-website"
                name="website"
                defaultValue={user?.website ?? ""}
                placeholder="https://…"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-whatsapp">{t("users.form.whatsapp")}</Label>
              <Input
                id="user-whatsapp"
                name="whatsapp"
                defaultValue={user?.whatsapp ?? ""}
                placeholder="+962…"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-linkedin">{t("users.form.linkedin")}</Label>
            <Input
              id="user-linkedin"
              name="linkedin"
              defaultValue={user?.linkedin ?? ""}
              placeholder="https://www.linkedin.com/in/…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-isAdmin">{t("users.form.admin")}</Label>
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  id="user-isAdmin"
                  type="checkbox"
                  name="isAdmin"
                  value="true"
                  checked={adminOn}
                  onChange={(event) => setIsAdmin(event.target.checked)}
                  disabled={adminLocked}
                  className="size-4 rounded border-input"
                />
                <span className="text-muted-foreground">
                  {t("users.form.adminHint")}
                </span>
              </label>
              {/* A disabled checkbox submits nothing, so carry the locked flag. */}
              {adminLocked && <input type="hidden" name="isAdmin" value="true" />}
              {adminLocked && (
                <p className="text-xs text-muted-foreground">
                  {t("users.form.adminLocked")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-canAccessDashboard">
                {t("users.form.dashboard")}
              </Label>
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  id="user-canAccessDashboard"
                  type="checkbox"
                  name="canAccessDashboard"
                  value="true"
                  checked={dashboardOn}
                  onChange={(event) =>
                    setCanAccessDashboard(event.target.checked)
                  }
                  // Admins always have dashboard access — lock it on for them.
                  disabled={adminOn}
                  className="size-4 rounded border-input"
                />
                <span className="text-muted-foreground">
                  {t("users.form.dashboardHint")}
                </span>
              </label>
              {/* A disabled checkbox submits nothing, so carry the forced flag. */}
              {adminOn && (
                <input type="hidden" name="canAccessDashboard" value="true" />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-isSystemSupport">
              {t("users.form.systemSupport")}
            </Label>
            <label className="flex min-h-9 items-center gap-2 text-sm">
              <input
                id="user-isSystemSupport"
                type="checkbox"
                name="isSystemSupport"
                value="true"
                defaultChecked={user?.isSystemSupport}
                className="size-4 rounded border-input"
              />
              <span className="text-muted-foreground">
                {t("users.form.systemSupportHint")}
              </span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-isTeamMember">
                {t("users.form.teamMember")}
              </Label>
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  id="user-isTeamMember"
                  type="checkbox"
                  name="isTeamMember"
                  value="true"
                  defaultChecked={user?.isTeamMember}
                  className="size-4 rounded border-input"
                />
                <span className="text-muted-foreground">
                  {t("users.form.teamMemberHint")}
                </span>
              </label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-hasContactInfoCard">
                {t("users.form.contactCard")}
              </Label>
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  id="user-hasContactInfoCard"
                  type="checkbox"
                  name="hasContactInfoCard"
                  value="true"
                  defaultChecked={user?.hasContactInfoCard}
                  className="size-4 rounded border-input"
                />
                <span className="text-muted-foreground">
                  {t("users.form.contactCardHint")}
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-image">{t("users.form.image")}</Label>
            {mode === "edit" && user && (
              <input type="hidden" name="currentImage" value={user.image ?? ""} />
            )}
            <ImageDropzone
              id="user-image"
              name="imageFile"
              defaultPreview={user?.image ?? undefined}
              invalid={Boolean(state.fieldErrors?.image)}
              texts={{
                hint: t("users.form.imageHint"),
                types: t("users.form.imageTypes"),
                remove: t("users.form.imageRemove"),
              }}
            />
            <FieldError message={state.fieldErrors?.image} />
          </div>

          {/* Create generates a password and emails it to the user, so the field
              only appears when editing (blank = keep the current password). */}
          {mode === "edit" && (
            <div className="space-y-2">
              <Label htmlFor="user-password">{t("users.form.password")}</Label>
              <Input
                id="user-password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                aria-invalid={Boolean(state.fieldErrors?.password)}
              />
              <FieldError message={state.fieldErrors?.password} />
              <p className="text-xs text-muted-foreground">
                {t("users.form.passwordHint")}
              </p>
            </div>
          )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t("users.form.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {pending ? t("users.form.saving") : t("users.form.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleDisabledDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Dashboard");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    setUserDisabledAction,
    {},
  );
  // The dialog toggles to the opposite of the user's current state.
  const willDisable = !user.isDisabled;

  useEffect(() => {
    if (state.ok) {
      toast.success(
        willDisable ? t("users.toast.disabled") : t("users.toast.enabled"),
      );
      onOpenChange(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, willDisable, t, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} onReset={keepInputOnError(state)} className="grid gap-4">
          <input type="hidden" name="id" value={user.id} />
          <input type="hidden" name="disabled" value={String(willDisable)} />
          <DialogHeader>
            <DialogTitle>
              {willDisable
                ? t("users.disableConfirm.disableTitle")
                : t("users.disableConfirm.enableTitle")}
            </DialogTitle>
            <DialogDescription>
              {willDisable
                ? t("users.disableConfirm.disableDescription", {
                    name: user.name,
                  })
                : t("users.disableConfirm.enableDescription", {
                    name: user.name,
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t("users.disableConfirm.cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant={willDisable ? "destructive" : "default"}
              disabled={pending}
            >
              {pending && <Loader2 className="animate-spin" />}
              {willDisable
                ? t("users.disableConfirm.disable")
                : t("users.disableConfirm.enable")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddUserButton({ companies }: { companies: CompanyOption[] }) {
  const t = useTranslations("Dashboard");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        {t("users.add")}
      </Button>
      <UserFormDialog
        mode="add"
        companies={companies}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

export function UserRowActions({
  user,
  companies,
  isSelf,
  isDefaultAdmin = false,
}: {
  user: UserItem;
  companies: CompanyOption[];
  isSelf: boolean;
  isDefaultAdmin?: boolean;
}) {
  const t = useTranslations("Dashboard");
  const [editOpen, setEditOpen] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);

  return (
    // Stop double-clicks on the actions cell from opening the row details modal.
    <span onDoubleClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal />
            <span className="sr-only">{t("users.actions")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil />
            {t("users.edit")}
          </DropdownMenuItem>
          {user.isDisabled ? (
            <DropdownMenuItem onSelect={() => setToggleOpen(true)}>
              <CircleCheck />
              {t("users.enable")}
            </DropdownMenuItem>
          ) : (
            // An admin can't disable their own account; hide the action for self.
            <DropdownMenuItem
              variant="destructive"
              disabled={isSelf}
              onSelect={() => setToggleOpen(true)}
            >
              <Ban />
              {t("users.disable")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <UserFormDialog
        mode="edit"
        user={user}
        companies={companies}
        adminLocked={isDefaultAdmin}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <ToggleDisabledDialog
        user={user}
        open={toggleOpen}
        onOpenChange={setToggleOpen}
      />
    </span>
  );
}
