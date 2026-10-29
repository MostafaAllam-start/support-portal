import type { NotificationEntityType } from "@/services";

// Maps a notification's polymorphic target (entity_type + entity_id) to the
// dashboard detail page it should open. Returns null when the target can't be
// resolved (missing type or id) so the caller can fall back to a list view.
export function notificationHref(
  entityType: NotificationEntityType | null | undefined,
  entityId: number | null | undefined,
): string | null {
  if (entityType == null || entityId == null) return null;
  switch (entityType) {
    case "ticket":
      return `/dashboard/tickets/${entityId}`;
    case "suggestion":
      return `/dashboard/suggestions/${entityId}`;
    case "complaint":
      return `/dashboard/complaints/${entityId}`;
    case "site_request":
      // The requests list opens the matching request's details.
      return `/dashboard/requests?id=${entityId}`;
    default:
      return null;
  }
}

// The customer-facing page for the same target, for recipients without dashboard
// access (e.g. the reporter of a ticket). Complaints have no customer page.
export function customerNotificationHref(
  entityType: NotificationEntityType | null | undefined,
  entityId: number | null | undefined,
): string | null {
  if (entityType == null || entityId == null) return null;
  switch (entityType) {
    case "ticket":
      return `/tickets/${entityId}`;
    case "suggestion":
      return `/suggestions/${entityId}`;
    default:
      return null;
  }
}
