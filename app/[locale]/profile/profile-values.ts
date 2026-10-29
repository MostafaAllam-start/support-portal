import type { AuthUser } from "@/services";
import type { ProfileValues } from "./_components/profile-form";

// The fields the account settings form edits, shared by /profile (customers) and
// /dashboard/settings (everyone with dashboard access).
export function toProfileValues(user: AuthUser): ProfileValues {
  return {
    name: user.name,
    username: user.username,
    email: user.email,
    jobTitle: user.jobTitle,
    image: user.image,
    website: user.website,
    whatsapp: user.whatsapp,
    linkedin: user.linkedin,
  };
}
