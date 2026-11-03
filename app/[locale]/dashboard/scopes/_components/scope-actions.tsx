"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { Input } from "@/components/ui/input";
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
import { keepInputOnError } from "@/lib/utils";
import {
  deleteScopeAction,
  updateScopeAction,
  type ScopeActionState,
} from "../actions";

export type ScopeItem = {
  id: number;
  name: string;
  logo: string;
  companyIds: number[];
  userCount: number;
};

type CompanyOption = { id: number; name: string };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

// Edits a scope's name and companies. Scopes come from the seed; there is no
// way to add one.
function ScopeFormDialog({
  scope,
  companies,
  open,
  onOpenChange,
}: {
  scope: ScopeItem;
  companies: CompanyOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Dashboard");
  const [state, formAction, pending] = useActionState<ScopeActionState, FormData>(
    updateScopeAction,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(t("scopes.toast.updated"));
      onOpenChange(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, t, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          action={formAction}
          onReset={keepInputOnError(state)}
          className="grid gap-4"
        >
          <input type="hidden" name="id" value={scope.id} />
          <DialogHeader>
            <DialogTitle>{t("scopes.form.editTitle")}</DialogTitle>
            <DialogDescription>{t("scopes.form.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="scope-name">{t("scopes.form.name")}</Label>
            <Input
              id="scope-name"
              name="name"
              defaultValue={scope.name}
              placeholder={t("scopes.form.namePlaceholder")}
              aria-invalid={Boolean(state.fieldErrors?.name)}
              required
            />
            <FieldError message={state.fieldErrors?.name} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scope-logo">{t("scopes.form.logo")}</Label>
            <input type="hidden" name="currentLogo" value={scope.logo} />
            <ImageDropzone
              id="scope-logo"
              name="logoFile"
              defaultPreview={scope.logo || undefined}
              invalid={Boolean(state.fieldErrors?.logo)}
              texts={{
                hint: t("scopes.form.logoHint"),
                types: t("scopes.form.logoTypes"),
                remove: t("scopes.form.logoRemove"),
              }}
            />
            <FieldError message={state.fieldErrors?.logo} />
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">
              {t("scopes.form.companies")}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {companies.map((company) => (
                <label
                  key={company.id}
                  className="flex items-center gap-2 rounded-md border p-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    name="companyIds"
                    value={company.id}
                    defaultChecked={scope.companyIds.includes(company.id)}
                    className="size-4 rounded border-input"
                  />
                  {company.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("scopes.form.companiesHint")}
            </p>
            <FieldError message={state.fieldErrors?.companyIds} />
          </fieldset>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t("scopes.form.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {pending ? t("scopes.form.saving") : t("scopes.form.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteScopeDialog({
  scope,
  open,
  onOpenChange,
}: {
  scope: ScopeItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Dashboard");
  const [state, formAction, pending] = useActionState<ScopeActionState, FormData>(
    deleteScopeAction,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(t("scopes.toast.deleted"));
      onOpenChange(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, t, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} onReset={keepInputOnError(state)} className="grid gap-4">
          <input type="hidden" name="id" value={scope.id} />
          <DialogHeader>
            <DialogTitle>{t("scopes.deleteConfirm.title")}</DialogTitle>
            <DialogDescription>
              {t("scopes.deleteConfirm.description", { name: scope.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t("scopes.deleteConfirm.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {pending
                ? t("scopes.deleteConfirm.deleting")
                : t("scopes.deleteConfirm.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ScopeRowActions({
  scope,
  companies,
}: {
  scope: ScopeItem;
  companies: CompanyOption[];
}) {
  const t = useTranslations("Dashboard");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // A scope still held by users can't be deleted (they would lose their access).
  const deletable = scope.userCount === 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal />
            <span className="sr-only">{t("scopes.actions")}</span>
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
            {t("scopes.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={!deletable}
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 />
            {t("scopes.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ScopeFormDialog
        key={formKey}
        scope={scope}
        companies={companies}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      {deletable && (
        <DeleteScopeDialog
          scope={scope}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}
    </>
  );
}
