"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import {
  Ban,
  CircleCheck,
  Headset,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn, keepInputOnError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { UserRole } from "@/app/generated/prisma/enums";
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
  role: UserRole;
  // A team member who also works the branding-site requests.
  isSupport: boolean;
  image: string | null;
  isDisabled: boolean;
  companyId: number | null;
  // The scopes (CTC, ECM, …) a team member or client holds.
  scopeIds: number[];
  website: string | null;
  whatsapp: string | null;
  linkedin: string | null;
  isFeatured: boolean;
  hasContactInfoCard: boolean;
  // The team member's project roles.
  memberships: { projectId: number; roleId: number }[];
};

type CompanyOption = { id: number; name: string };
export type ProjectOption = {
  id: number;
  name: string;
  companyId: number;
  companyName: string;
};
export type RoleOption = { id: number; name: string };
export type ScopeOption = { id: number; name: string; companies: CompanyOption[] };

// The options the form needs, loaded once by the Users page.
export type UserFormOptions = {
  companies: CompanyOption[];
  projects: ProjectOption[];
  roles: RoleOption[];
  scopes: ScopeOption[];
};

// The account types in the order the picker shows them, each with its icon.
const TYPES: { value: UserRole; icon: LucideIcon }[] = [
  { value: UserRole.client, icon: UserRound },
  { value: UserRole.team_member, icon: UsersRound },
  { value: UserRole.admin, icon: ShieldCheck },
];

// The client company dropdown's "no choice" item (a Select item can't be "").
const AUTO_COMPANY = "auto";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

// A titled group of fields inside the dialog.
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="grid gap-3 rounded-lg border p-3 sm:p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {hint && <p className="-mt-1 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </fieldset>
  );
}

// One project-role row being edited. `key` keeps React's row identity stable
// while rows are added and removed.
type MembershipRow = { key: number; projectId: string; roleId: string };

let rowKey = 0;
function toRows(memberships: UserItem["memberships"]): MembershipRow[] {
  return memberships.map((membership) => ({
    key: ++rowKey,
    projectId: String(membership.projectId),
    roleId: String(membership.roleId),
  }));
}

function UserFormDialog({
  mode,
  user,
  options,
  typeLocked = false,
  typeLockedReason,
  open,
  onOpenChange,
}: {
  mode: "add" | "edit";
  user?: UserItem;
  options: UserFormOptions;
  // The default admin and the signed-in admin themself can't change the type.
  typeLocked?: boolean;
  typeLockedReason?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Dashboard");
  const action = mode === "add" ? createUserAction : updateUserAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );

  // The account type drives which fields show.
  // A new user starts as the first type in the picker, a client.
  const [role, setRole] = useState<UserRole>(user?.role ?? UserRole.client);
  const [rows, setRows] = useState<MembershipRow[]>(() =>
    toRows(user?.memberships ?? []),
  );
  const isTeamMember = role === UserRole.team_member;
  const isClient = role === UserRole.client;
  // Team members and clients get one or more scopes (CTC, ECM, …); admins have
  // none. A team member also picks a main company among the scopes' companies.
  // A client is defined by the scopes alone: their company is the one they're
  // viewing, switched in the header.
  const scoped = role !== UserRole.admin;
  const [scopeIds, setScopeIds] = useState<string[]>(() =>
    (user?.scopeIds ?? []).map(String),
  );
  const [companyId, setCompanyId] = useState(
    user?.companyId ? String(user.companyId) : "",
  );
  // The distinct companies of the given scopes, in scope order.
  function companiesOf(ids: string[]): CompanyOption[] {
    const byId = new Map<number, CompanyOption>();
    for (const s of options.scopes) {
      if (!ids.includes(String(s.id))) continue;
      for (const company of s.companies) byId.set(company.id, company);
    }
    return [...byId.values()];
  }
  const scopeCompanies = companiesOf(scopeIds);
  // With one company in the scopes it is the main company; no need to ask.
  const mainCompanyId =
    scopeCompanies.length === 1 ? String(scopeCompanies[0].id) : companyId;
  const inScope = (id: number) => scopeCompanies.some((c) => c.id === id);
  // A team member with several companies picks their main one; a client may
  // pick the company they start in (optional: otherwise the first of them).
  const asksMainCompany = isTeamMember && scopeCompanies.length > 1;
  const asksClientCompany = isClient && scopeCompanies.length > 0;
  // A team member's projects come from the companies in their scopes.
  const scopeProjects = options.projects.filter((p) => inScope(p.companyId));

  function toggleScope(id: string) {
    const next = scopeIds.includes(id)
      ? scopeIds.filter((scopeId) => scopeId !== id)
      : [...scopeIds, id];
    setScopeIds(next);
    const nextCompanies = companiesOf(next);
    // Keep the company only if it is still in the scopes. A team member falls
    // back to the first one; a client's is optional, so it goes back to none.
    if (!nextCompanies.some((c) => String(c.id) === companyId)) {
      setCompanyId(
        !isClient && nextCompanies.length > 0 ? String(nextCompanies[0].id) : "",
      );
    }
    // Drop project roles on projects outside the new scopes.
    setRows((current) =>
      current.map((row) => {
        const project = options.projects.find((p) => String(p.id) === row.projectId);
        return project && nextCompanies.some((c) => c.id === project.companyId)
          ? row
          : { ...row, projectId: "" };
      }),
    );
  }
  // Contact details only appear on the landing team and the public contact card,
  // so they are asked for only when one of those is switched on.
  const [featured, setFeatured] = useState(Boolean(user?.isFeatured));
  const [contactCard, setContactCard] = useState(Boolean(user?.hasContactInfoCard));
  // Only team members are featured on the landing team or get a public contact
  // card, so only they are asked (and for the contact details behind them).
  const showsContact = isTeamMember && (featured || contactCard);

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

  const usedProjects = new Set(rows.map((row) => row.projectId));
  const companies = [...new Set(scopeProjects.map((p) => p.companyName))];

  function updateRow(key: number, patch: Partial<MembershipRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Header and footer stay fixed; only the field area scrolls. The height
          is capped on tablet/desktop so the dialog never outgrows the viewport. */}
      <DialogContent className="flex flex-col gap-4 sm:max-h-[90vh] sm:max-w-2xl">
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
          <div className="-mx-1 grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-1 pb-1">
            <Section title={t("users.form.sections.type")}>
              <div
                role="radiogroup"
                aria-label={t("users.form.sections.type")}
                aria-invalid={Boolean(state.fieldErrors?.role)}
                className="grid gap-2 sm:grid-cols-3"
              >
                {TYPES.map(({ value, icon: Icon }) => {
                  const checked = role === value;
                  return (
                    <label
                      key={value}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-start transition-colors hover:bg-accent/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                        checked && "border-primary bg-primary/5",
                        typeLocked && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={value}
                        checked={checked}
                        disabled={typeLocked}
                        onChange={() => setRole(value)}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
                          checked && "bg-primary text-primary-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="grid gap-0.5">
                        <span className="text-sm font-medium">
                          {t(`users.types.${value}.label`)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t(`users.types.${value}.description`)}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {/* A disabled radio submits nothing, so carry the locked type. */}
              {typeLocked && <input type="hidden" name="role" value={role} />}
              {typeLocked && typeLockedReason && (
                <p className="text-xs text-muted-foreground">{typeLockedReason}</p>
              )}
              <FieldError message={state.fieldErrors?.role} />
            </Section>

            <Section title={t("users.form.sections.account")}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="user-name">{t("users.form.name")}</Label>
                  <Input
                    id="user-name"
                    name="name"
                    defaultValue={user?.name}
                    autoComplete="off"
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
                    autoComplete="off"
                    minLength={3}
                    pattern="[A-Za-z0-9._\-]+"
                    title={t("users.form.errors.usernameFormat")}
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
                  dir="ltr"
                  defaultValue={user?.email}
                  autoComplete="off"
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

              {/* Create generates a password and emails it to the user, so the
                  field only appears when editing (blank = keep the current one). */}
              {mode === "edit" && (
                <div className="space-y-2">
                  <Label htmlFor="user-password">{t("users.form.password")}</Label>
                  <Input
                    id="user-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    minLength={8}
                    aria-invalid={Boolean(state.fieldErrors?.password)}
                  />
                  <FieldError message={state.fieldErrors?.password} />
                  <p className="text-xs text-muted-foreground">
                    {t("users.form.passwordHint")}
                  </p>
                </div>
              )}
            </Section>

            {scoped && (
              <Section
                title={t("users.form.sections.access")}
                hint={t(`users.types.${role}.accessHint`)}
              >
                <div
                  className={cn(
                    "grid gap-3",
                    (asksMainCompany || asksClientCompany) && "sm:grid-cols-2",
                  )}
                >
                    <fieldset className="space-y-2" aria-describedby="user-scope-hint">
                      <legend className="text-sm font-medium">
                        {t("users.form.scope")}
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {options.scopes.map((s) => {
                          const companyNames = s.companies.map((c) => c.name).join(", ");
                          return (
                            <label
                              key={s.id}
                              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                            >
                              <Checkbox
                                name="scopeIds"
                                value={String(s.id)}
                                checked={scopeIds.includes(String(s.id))}
                                onCheckedChange={() => toggleScope(String(s.id))}
                                aria-invalid={Boolean(state.fieldErrors?.scopeIds)}
                              />
                              <span className="font-medium">{s.name}</span>
                              {companyNames !== s.name && (
                                <span className="text-xs text-muted-foreground">
                                  ({companyNames})
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                      <p id="user-scope-hint" className="text-xs text-muted-foreground">
                        {t(`users.form.scopeHint.${role}`)}
                      </p>
                      <FieldError message={state.fieldErrors?.scopeIds} />
                    </fieldset>

                    {asksMainCompany ? (
                      <div className="space-y-2">
                        <Label htmlFor="user-company">
                          {t("users.form.mainCompany")}
                        </Label>
                        <input type="hidden" name="companyId" value={companyId} />
                        <Select value={companyId} onValueChange={setCompanyId}>
                          <SelectTrigger
                            id="user-company"
                            aria-invalid={Boolean(state.fieldErrors?.companyId)}
                            aria-describedby="user-company-hint"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {scopeCompanies.map((company) => (
                              <SelectItem key={company.id} value={String(company.id)}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p id="user-company-hint" className="text-xs text-muted-foreground">
                          {t("users.form.mainCompanyHint")}
                        </p>
                        <FieldError message={state.fieldErrors?.companyId} />
                      </div>
                    ) : asksClientCompany ? (
                      <div className="space-y-2">
                        <Label htmlFor="user-company">
                          {t("users.form.clientCompany")}
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            {t("users.form.optional")}
                          </span>
                        </Label>
                        <input type="hidden" name="companyId" value={companyId} />
                        <Select
                          value={companyId || AUTO_COMPANY}
                          onValueChange={(next) =>
                            setCompanyId(next === AUTO_COMPANY ? "" : next)
                          }
                        >
                          <SelectTrigger
                            id="user-company"
                            aria-invalid={Boolean(state.fieldErrors?.companyId)}
                            aria-describedby="user-company-hint"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={AUTO_COMPANY}>
                              {t("users.form.clientCompanyAuto")}
                            </SelectItem>
                            {scopeCompanies.map((company) => (
                              <SelectItem key={company.id} value={String(company.id)}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p id="user-company-hint" className="text-xs text-muted-foreground">
                          {t("users.form.clientCompanyHint")}
                        </p>
                        <FieldError message={state.fieldErrors?.companyId} />
                      </div>
                    ) : (
                      <input type="hidden" name="companyId" value={mainCompanyId} />
                    )}
                  </div>

                {isTeamMember && (
                  <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                    <Checkbox
                      name="isSupport"
                      value="true"
                      defaultChecked={user?.isSupport}
                      className="mt-0.5"
                    />
                    <Headset className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="grid gap-0.5">
                      <span className="font-medium">{t("users.form.support")}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("users.form.supportHint")}
                      </span>
                    </span>
                  </label>
                )}

                {isTeamMember && (
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {t("users.form.memberships.title")}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          scopeIds.length === 0 ||
                          usedProjects.size >= scopeProjects.length
                        }
                        onClick={() =>
                          setRows((current) => [
                            ...current,
                            { key: ++rowKey, projectId: "", roleId: "" },
                          ])
                        }
                      >
                        <Plus />
                        {t("users.form.memberships.add")}
                      </Button>
                    </div>

                    {rows.length === 0 ? (
                      <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        {scopeIds.length > 0
                          ? t("users.form.memberships.empty")
                          : t("users.form.memberships.needsScope")}
                      </p>
                    ) : (
                      <ul className="grid gap-2">
                        {rows.map((row) => (
                          <li
                            key={row.key}
                            className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[3fr_2fr_auto]"
                          >
                            <input
                              type="hidden"
                              name="membershipProjectId"
                              value={row.projectId}
                            />
                            <Select
                              value={row.projectId}
                              onValueChange={(projectId) => updateRow(row.key, { projectId })}
                            >
                              <SelectTrigger
                                aria-label={t("users.form.memberships.project")}
                                className="col-span-2 sm:col-span-1"
                              >
                                <SelectValue
                                  placeholder={t("users.form.memberships.projectPlaceholder")}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {companies.map((companyName) => (
                                  <SelectGroup key={companyName}>
                                    <SelectLabel>{companyName}</SelectLabel>
                                    {scopeProjects
                                      .filter((p) => p.companyName === companyName)
                                      .map((project) => (
                                        <SelectItem
                                          key={project.id}
                                          value={String(project.id)}
                                          disabled={
                                            usedProjects.has(String(project.id)) &&
                                            row.projectId !== String(project.id)
                                          }
                                        >
                                          {project.name}
                                        </SelectItem>
                                      ))}
                                  </SelectGroup>
                                ))}
                              </SelectContent>
                            </Select>
                            <input type="hidden" name="membershipRoleId" value={row.roleId} />
                            <Select
                              value={row.roleId}
                              onValueChange={(roleId) => updateRow(row.key, { roleId })}
                            >
                              <SelectTrigger aria-label={t("users.form.memberships.role")}>
                                <SelectValue
                                  placeholder={t("users.form.memberships.rolePlaceholder")}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {options.roles.map((r) => (
                                  <SelectItem key={r.id} value={String(r.id)}>
                                    {t.has(`users.projectRoles.${r.name}`)
                                      ? t(`users.projectRoles.${r.name}`)
                                      : r.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() =>
                                setRows((current) =>
                                  current.filter((r) => r.key !== row.key),
                                )
                              }
                            >
                              <Trash2 />
                              <span className="sr-only">
                                {t("users.form.memberships.remove")}
                              </span>
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <FieldError message={state.fieldErrors?.memberships} />
                  </div>
                )}
              </Section>
            )}

            {/* Optional details, collapsed until needed. Collapsed fields still
                submit, so nothing is lost by leaving them closed. */}
            <details
              className="group rounded-lg border p-3 sm:p-4"
              open={
                mode === "edit" &&
                Boolean(user?.jobTitle || user?.image || showsContact)
              }
            >
              <summary className="cursor-pointer text-sm font-semibold marker:text-muted-foreground">
                {/* Only a team member has a public page (landing team, contact card). */}
                {t(
                  isTeamMember
                    ? "users.form.sections.profile"
                    : "users.form.sections.profileOnly",
                )}
                <span className="ms-2 font-normal text-muted-foreground">
                  {t("users.form.optional")}
                </span>
              </summary>

              <div className="mt-3 grid gap-3">
                <div className="space-y-2">
                  <Label htmlFor="user-jobTitle">{t("users.form.jobTitle")}</Label>
                  <Input
                    id="user-jobTitle"
                    name="jobTitle"
                    defaultValue={user?.jobTitle ?? ""}
                  />
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

                {isTeamMember && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
                      <Checkbox
                        name="isFeatured"
                        value="true"
                        checked={featured}
                        onCheckedChange={(checked) => setFeatured(checked === true)}
                        className="mt-0.5"
                      />
                      <span className="grid gap-0.5">
                        <span className="font-medium">{t("users.form.featured")}</span>
                        <span className="text-xs text-muted-foreground">
                          {t("users.form.featuredHint")}
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
                      <Checkbox
                        name="hasContactInfoCard"
                        value="true"
                        checked={contactCard}
                        onCheckedChange={(checked) => setContactCard(checked === true)}
                        className="mt-0.5"
                      />
                      <span className="grid gap-0.5">
                        <span className="font-medium">{t("users.form.contactCard")}</span>
                        <span className="text-xs text-muted-foreground">
                          {t("users.form.contactCardHint")}
                        </span>
                      </span>
                    </label>
                  </div>
                )}

                {showsContact ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="user-website">{t("users.form.website")}</Label>
                      <Input
                        id="user-website"
                        name="website"
                        type="url"
                        dir="ltr"
                        defaultValue={user?.website ?? ""}
                        placeholder="https://…"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-whatsapp">{t("users.form.whatsapp")}</Label>
                      <Input
                        id="user-whatsapp"
                        name="whatsapp"
                        type="tel"
                        dir="ltr"
                        defaultValue={user?.whatsapp ?? ""}
                        placeholder="+962…"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-linkedin">{t("users.form.linkedin")}</Label>
                      <Input
                        id="user-linkedin"
                        name="linkedin"
                        type="url"
                        dir="ltr"
                        defaultValue={user?.linkedin ?? ""}
                        placeholder="https://www.linkedin.com/in/…"
                      />
                    </div>
                  </div>
                ) : (
                  // Hidden, but kept: the user may still use them on their own
                  // profile, so an edit here must not clear them.
                  <>
                    <input type="hidden" name="website" value={user?.website ?? ""} />
                    <input type="hidden" name="whatsapp" value={user?.whatsapp ?? ""} />
                    <input type="hidden" name="linkedin" value={user?.linkedin ?? ""} />
                  </>
                )}
              </div>
            </details>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t("users.form.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {pending
                ? t("users.form.saving")
                : mode === "add"
                  ? t("users.form.create")
                  : t("users.form.save")}
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

export function AddUserButton({ options }: { options: UserFormOptions }) {
  const t = useTranslations("Dashboard");
  const [open, setOpen] = useState(false);
  // A fresh form (type, project rows, errors) every time the dialog opens.
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <Button
        onClick={() => {
          setFormKey((key) => key + 1);
          setOpen(true);
        }}
      >
        <Plus />
        {t("users.add")}
      </Button>
      <UserFormDialog
        key={formKey}
        mode="add"
        options={options}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

export function UserRowActions({
  user,
  options,
  isSelf,
  isDefaultAdmin = false,
}: {
  user: UserItem;
  options: UserFormOptions;
  isSelf: boolean;
  isDefaultAdmin?: boolean;
}) {
  const t = useTranslations("Dashboard");
  const [editOpen, setEditOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
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
          <DropdownMenuItem
            onSelect={() => {
              setFormKey((key) => key + 1);
              setEditOpen(true);
            }}
          >
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
        key={formKey}
        mode="edit"
        user={user}
        options={options}
        typeLocked={isDefaultAdmin || isSelf}
        typeLockedReason={
          isDefaultAdmin
            ? t("users.form.typeLocked")
            : isSelf
              ? t("users.form.typeSelf")
              : undefined
        }
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
