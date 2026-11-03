// "A navigation to this path is starting": a window event that lets the
// destination's skeleton show before the router has anything to render (see
// components/navigation-skeleton.tsx). Link clicks are picked up on their own;
// code that navigates with router.push announces it here.
export const NAVIGATION_START = "app:navigation-start";

export function announceNavigation(path: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(NAVIGATION_START, { detail: path }));
}
