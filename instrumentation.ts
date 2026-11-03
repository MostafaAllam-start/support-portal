/**
 * Next.js instrumentation hook – runs once when the server starts.
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only register event listeners on the Node.js server runtime (not edge).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeEventListeners } = await import("@/events/init");
    initializeEventListeners();

    // Check the SMTP settings once at startup so a wrong host or password shows
    // in the logs right away, and close the pooled connections on shutdown.
    if (process.env.SMTP_HOST) {
      const { emailService } = await import("@/services/email-service");
      void emailService.verifyConnection();
      process.once("SIGTERM", () => emailService.close());
    }
  }
}
