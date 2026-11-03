import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ProjectRole, UserRole } from "@/lib/auth/roles";
import { canAccessSuggestion } from "@/lib/suggestions";
import { attachmentService, replyService, suggestionService } from "@/services";
import { SuggestionReplies } from "../_components/suggestion-replies";
import { LiveReplies } from "@/components/live-replies";
import { liveRoom } from "@/realtime/liveReplies";

export default async function SuggestionDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await requireRole(UserRole.admin, ProjectRole.Manager);

  const suggestionId = Number(id);
  if (!Number.isInteger(suggestionId)) notFound();

  const suggestion = await suggestionService.getDetail(suggestionId);
  if (!suggestion) notFound();

  if (!canAccessSuggestion(user, suggestion)) notFound();

  const t = await getTranslations("Dashboard");
  const created = suggestion.createdAt.toISOString().slice(0, 10);
  const [images, replies] = await Promise.all([
    attachmentService.forEntity("suggestion", suggestion.id),
    replyService.forEntity("suggestion", suggestion.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <LiveReplies room={liveRoom("suggestion", suggestion.id)} />
      <Link
        href="/dashboard/suggestions"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" />
        {t("suggestions.detail.back")}
      </Link>

      <article className="rounded-xl border p-6">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">#{suggestion.id}</p>
          <h1 className="text-xl font-semibold tracking-tight">
            {suggestion.title}
          </h1>
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">
              {t("suggestions.detail.author")}
            </dt>
            <dd>{suggestion.createdBy.name}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">
              {t("suggestions.detail.created")}
            </dt>
            <dd className="tabular-nums">{created}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">
              {t("suggestions.detail.company")}
            </dt>
            <dd>{suggestion.company.name}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">
              {t("suggestions.detail.project")}
            </dt>
            <dd>
              {suggestion.project ? (
                suggestion.project.name
              ) : (
                <span className="text-muted-foreground">
                  {t("suggestions.detail.noProject")}
                </span>
              )}
            </dd>
          </div>
        </dl>

        {suggestion.details && (
          <div className="mt-5 border-t pt-5">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              {t("suggestions.detail.details")}
            </h2>
            <p className="text-sm whitespace-pre-wrap">{suggestion.details}</p>
          </div>
        )}

        {images.length > 0 && (
          <div className="mt-5 border-t pt-5">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              {t("suggestions.detail.attachments")} ({images.length})
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((image) => (
                <li key={image.id}>
                  <a
                    href={image.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-video overflow-hidden rounded-lg border transition-opacity hover:opacity-90"
                  >
                    <Image
                      src={image.url}
                      alt=""
                      width={320}
                      height={180}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>

      <SuggestionReplies
        suggestionId={suggestion.id}
        currentUserId={user.id}
        canModerate={user.effectiveRole === "admin"}
        replies={replies}
      />
    </div>
  );
}
