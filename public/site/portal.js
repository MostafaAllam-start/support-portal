// Portal glue for the branding site (copied to public/site by scripts/import-site.mjs).
// The demo form posts to the portal's /contact handler, which redirects back here with
// ?request=sent or ?request=invalid. Show that outcome as a toast that looks like the
// portal's own (sonner, components/ui/sonner.tsx), then drop the flag from the
// address bar so a reload doesn't show it again.
(function () {
  var params = new URLSearchParams(location.search);
  var outcome = params.get("request");
  if (outcome !== "sent" && outcome !== "invalid") return;

  params.delete("request");
  var query = params.toString();
  history.replaceState(null, "", location.pathname + (query ? "?" + query : "") + location.hash);

  var ar = document.documentElement.lang === "ar";
  var ok = outcome === "sent";
  var message = ok
    ? ar
      ? "شكراً لك، تم استلام طلبك وسيتواصل معك فريقنا قريباً."
      : "Thank you. Your request has been received, and our team will contact you shortly."
    : ar
      ? "تعذّر إرسال الطلب. يرجى التحقق من الحقول المطلوبة والمحاولة مرة أخرى."
      : "We couldn't send your request. Please check the required fields and try again.";

  // The portal's lucide icons: CircleCheck (success) and OctagonX (error).
  var ICONS = {
    sent: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    invalid:
      '<path d="M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  };

  // Styled by public/site/portal.css.
  var toaster = document.createElement("ol");
  toaster.className = "portal-toaster";
  toaster.setAttribute("aria-label", ar ? "الإشعارات" : "Notifications");

  var toast = document.createElement("li");
  toast.className = "portal-toast";
  toast.setAttribute("role", ok ? "status" : "alert");
  toast.setAttribute("dir", ar ? "rtl" : "ltr");
  toast.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    ICONS[outcome] +
    "</svg>";
  var text = document.createElement("span");
  text.textContent = message;
  toast.appendChild(text);
  toaster.appendChild(toast);
  document.body.appendChild(toaster);

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      toast.setAttribute("data-shown", "");
    });
  });

  // Dismiss after 4 s like sonner, pausing while the pointer is over the toast.
  var remaining = 4000;
  var started = Date.now();
  var timer = setTimeout(dismiss, remaining);
  toast.addEventListener("mouseenter", function () {
    clearTimeout(timer);
    remaining -= Date.now() - started;
  });
  toast.addEventListener("mouseleave", function () {
    started = Date.now();
    timer = setTimeout(dismiss, Math.max(remaining, 1000));
  });

  function dismiss() {
    toast.removeAttribute("data-shown");
    setTimeout(function () {
      toaster.remove();
    }, 400);
  }

  if (ok) {
    var form = document.getElementById("demo-form");
    if (form) form.reset();
  }
})();
