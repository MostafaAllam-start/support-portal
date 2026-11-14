"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn, keepInputOnError } from "@/lib/utils";
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
import {
  createPartnerAction,
  deletePartnerAction,
  updatePartnerAction,
  type ActionState,
} from "../actions";
import { Checkbox } from "@/components/ui/checkbox";

export type ScopeOption = { id: number; name: string };
export type PartnerItem = {
  id: number;
  name: string;
  logo: string;
  details: string;
  scopeIds: number[];
};

const textareaClass =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export function PartnerFormDialog({
  mode,
  partner,
  scopes,
  fixedScope,
  onCreated,
  open,
  onOpenChange,
}: {
  mode: "add" | "edit";
  partner?: PartnerItem;
  scopes: ScopeOption[];
  // Adding from another form: the partner goes to this scope only (no scope picker).
  fixedScope?: ScopeOption;
  onCreated?: (partner: { id: number; name: string }) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Dashboard");
  const action = mode === "add" ? createPartnerAction : updatePartnerAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(
        mode === "add"
          ? t("partners.toast.created")
          : t("partners.toast.updated"),
      );
      if (state.id != null && onCreated) onCreated({ id: state.id, name: state.name ?? "" });
      onOpenChange(false);
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} onReset={keepInputOnError(state)} className="grid gap-4">
          {mode === "edit" && partner && (
            <input type="hidden" name="id" value={partner.id} />
          )}
          <DialogHeader>
            <DialogTitle>
              {mode === "add"
                ? t("partners.form.addTitle")
                : t("partners.form.editTitle")}
            </DialogTitle>
            <DialogDescription>{t("partners.form.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="partner-name">{t("partners.form.name")}</Label>
            <Input
              id="partner-name"
              name="name"
              defaultValue={partner?.name}
              aria-invalid={Boolean(state.fieldErrors?.name)}
              required
            />
            <FieldError message={state.fieldErrors?.name} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner-logo">{t("partners.form.logo")}</Label>
            <input type="hidden" name="currentLogo" value={partner?.logo ?? ""} />
            <ImageDropzone
              id="partner-logo"
              name="logoFile"
              defaultPreview={partner?.logo || undefined}
              invalid={Boolean(state.fieldErrors?.logo)}
              texts={{
                hint: t("partners.form.logoHint"),
                types: t("partners.form.logoTypes"),
                remove: t("partners.form.logoRemove"),
              }}
            />
            <FieldError message={state.fieldErrors?.logo} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner-details">{t("partners.form.details")}</Label>
            <textarea
              id="partner-details"
              name="details"
              rows={4}
              defaultValue={partner?.details}
              aria-invalid={Boolean(state.fieldErrors?.details)}
              required
              className={cn(textareaClass)}
            />
            <FieldError message={state.fieldErrors?.details} />
          </div>

          {fixedScope ? (
            <div className="space-y-2">
              <Label>{t("partners.form.scopes")}</Label>
              <input type="hidden" name="scopeIds" value={fixedScope.id} />
              <p className="text-sm">{fixedScope.name}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t("partners.form.scopes")}</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {scopes.map((scope) => (
                  <label
                    key={scope.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      name="scopeIds"
                      value={String(scope.id)}
                      defaultChecked={partner?.scopeIds.includes(scope.id)}
                    />
                    {scope.name}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("partners.form.scopesHint")}
              </p>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t("partners.form.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {pending ? t("partners.form.saving") : t("partners.form.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeletePartnerDialog({
  partner,
  open,
  onOpenChange,
}: {
  partner: PartnerItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Dashboard");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deletePartnerAction,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(t("partners.toast.deleted"));
      onOpenChange(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, t, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} onReset={keepInputOnError(state)} className="grid gap-4">
          <input type="hidden" name="id" value={partner.id} />
          <DialogHeader>
            <DialogTitle>{t("partners.deleteConfirm.title")}</DialogTitle>
            <DialogDescription>
              {t("partners.deleteConfirm.description", { name: partner.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t("partners.deleteConfirm.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {pending
                ? t("partners.deleteConfirm.deleting")
                : t("partners.deleteConfirm.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddPartnerButton({
  scopes,
}: {
  scopes: ScopeOption[];
}) {
  const t = useTranslations("Dashboard");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        {t("partners.add")}
      </Button>
      <PartnerFormDialog
        mode="add"
        scopes={scopes}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

export function PartnerRowActions({
  partner,
  scopes,
}: {
  partner: PartnerItem;
  scopes: ScopeOption[];
}) {
  const t = useTranslations("Dashboard");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal />
            <span className="sr-only">{t("partners.actions")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil />
            {t("partners.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 />
            {t("partners.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PartnerFormDialog
        mode="edit"
        partner={partner}
        scopes={scopes}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeletePartnerDialog
        partner={partner}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
