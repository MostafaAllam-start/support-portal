/* Portico — progressive enhancement for the ECM+ homepage template.
   The page reads completely without this file: the Support menu falls back to a
   plain link, the mobile panel is shown in flow, and nothing is hidden for
   animation. Shared by the English and Arabic pages. */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  // Reveal styles only hide content once this script is actually running.
  // "reveal-ready" is added at the very end; if anything below throws first,
  // a CSS fail-safe shows every hidden item after 2.5 s.
  root.classList.add("reveal");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var desktop = window.matchMedia("(min-width: 1100px)");

  function motionOK() {
    return !reduceMotion.matches;
  }

  function toArray(list) {
    return Array.prototype.slice.call(list);
  }

  // Older Safari only has the deprecated addListener on MediaQueryList.
  function onMediaChange(mq, handler) {
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq.addListener) mq.addListener(handler);
  }

  /* ------------------------------------------------------------------
     Theme: light by default, whatever the system prefers. Choosing dark
     sets data-theme="dark" and is stored under the key shared by every
     ECM+ template and the gallery. The inline <head> script applies a
     stored choice before first paint.
     ------------------------------------------------------------------ */
  var THEME_KEY = "ecmplus-theme";
  var THEME_COLORS = { light: "#F4F2EE", dark: "#10141B" };
  var themeToggles = toArray(doc.querySelectorAll(".theme-toggle"));
  var themeMeta = doc.querySelector('meta[name="theme-color"]');
  // Set when the visitor uses the toggle on this page (kept in memory in case storage is blocked).
  var explicitTheme = false;

  function currentTheme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  // The toggle keeps one fixed name ("Dark mode"); aria-pressed carries the state.
  function syncTheme() {
    var theme = currentTheme();
    themeToggles.forEach(function (button) {
      button.setAttribute("aria-pressed", String(theme === "dark"));
    });
    if (themeMeta) themeMeta.setAttribute("content", THEME_COLORS[theme]);
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    syncTheme();
  }

  themeToggles.forEach(function (button) {
    button.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      explicitTheme = true;
      applyTheme(next);
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        // Storage blocked: the choice lasts for this page view.
      }
    });
  });

  // A choice made in another tab or template follows here, unless this page made its own.
  window.addEventListener("storage", function (event) {
    if (event.key !== THEME_KEY || explicitTheme) return;
    applyTheme(event.newValue === "dark" ? "dark" : "light");
  });

  syncTheme();

  /* ------------------------------------------------------------------
     Header: mobile disclosure + the click-toggled Support menu
     ------------------------------------------------------------------ */
  var header = doc.querySelector(".site-header");
  var navToggle = doc.querySelector(".nav-toggle");
  var navPanel = navToggle ? doc.getElementById(navToggle.getAttribute("aria-controls")) : null;
  var navOpen = false;
  var openItem = null;

  function triggerOf(item) {
    return item.querySelector(".nav__trigger");
  }

  function closeMenu(item, returnFocus) {
    if (!item) return;
    var button = triggerOf(item);
    item.classList.remove("is-open");
    if (button) {
      button.setAttribute("aria-expanded", "false");
      if (returnFocus) button.focus();
    }
    if (openItem === item) openItem = null;
  }

  function openMenu(item) {
    if (openItem && openItem !== item) closeMenu(openItem, false);
    item.classList.add("is-open");
    triggerOf(item).setAttribute("aria-expanded", "true");
    openItem = item;
  }

  function setNav(open, returnFocus) {
    if (!navToggle || !navPanel) return;
    navOpen = open;
    navToggle.setAttribute("aria-expanded", String(open));
    navPanel.classList.toggle("is-open", open);
    if (!open) {
      if (openItem) closeMenu(openItem, false);
      if (returnFocus) navToggle.focus();
    }
  }

  toArray(doc.querySelectorAll("[data-menu]")).forEach(function (item) {
    var button = triggerOf(item);
    var panel = button ? doc.getElementById(button.getAttribute("aria-controls")) : null;
    if (!button || !panel) return;

    button.addEventListener("click", function () {
      if (item.classList.contains("is-open")) closeMenu(item, false);
      else openMenu(item);
    });

    // On desktop, tabbing out of an open menu closes it.
    item.addEventListener("focusout", function (event) {
      if (!desktop.matches) return;
      var next = event.relatedTarget;
      if (next && !item.contains(next)) closeMenu(item, false);
    });

    // Following a link inside the menu closes it (and the mobile panel).
    panel.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        closeMenu(item, false);
        setNav(false, false);
      }
    });
  });

  if (navToggle && navPanel) {
    navToggle.addEventListener("click", function () {
      setNav(!navOpen, false);
    });
    navPanel.addEventListener("click", function (event) {
      var link = event.target.closest("a");
      if (link && !link.closest(".menu-panel")) setNav(false, false);
    });
  }

  doc.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (openItem) {
      closeMenu(openItem, true);
      event.preventDefault();
    } else if (navOpen) {
      setNav(false, true);
      event.preventDefault();
    }
  });

  doc.addEventListener("click", function (event) {
    if (openItem && !openItem.contains(event.target)) closeMenu(openItem, false);
    if (navOpen && header && !header.contains(event.target)) setNav(false, false);
  });

  onMediaChange(desktop, function () {
    setNav(false, false);
    if (openItem) closeMenu(openItem, false);
  });

  /* ------------------------------------------------------------------
     Reveal on scroll: plates fade up 300ms with a 40ms stagger between
     siblings. Items inside a [data-reveal-group] (the sector scroller,
     whose plates may sit off-screen sideways) reveal together when the
     group comes into view.
     ------------------------------------------------------------------ */
  var revealEls = toArray(doc.querySelectorAll("[data-reveal]"));
  var hasIO = "IntersectionObserver" in window;

  if (hasIO && motionOK()) {
    var counts = new Map();
    revealEls.forEach(function (el) {
      var parent = el.parentElement;
      var n = counts.get(parent) || 0;
      el.style.setProperty("--i", String(n));
      counts.set(parent, n + 1);
    });
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var target = entry.target;
        if (target.hasAttribute("data-reveal-group")) {
          toArray(target.querySelectorAll("[data-reveal]")).forEach(function (el) {
            el.classList.add("in");
          });
        } else {
          target.classList.add("in");
        }
        revealIO.unobserve(target);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.12 });
    revealEls.forEach(function (el) {
      if (!el.closest("[data-reveal-group]")) revealIO.observe(el);
    });
    toArray(doc.querySelectorAll("[data-reveal-group]")).forEach(function (group) {
      revealIO.observe(group);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("in");
    });
  }

  /* ------------------------------------------------------------------
     Photo reveal: where scroll-driven animation is supported, photos that
     start below the fold settle in as they enter (CSS does the work).
     Photos already on screen are left alone.
     ------------------------------------------------------------------ */
  var scrollTimeline = !!(window.CSS && CSS.supports && CSS.supports("animation-timeline: view()"));
  if (scrollTimeline && motionOK()) {
    var viewport = window.innerHeight || root.clientHeight;
    toArray(doc.querySelectorAll(".ph--reveal")).forEach(function (photo) {
      if (photo.getBoundingClientRect().top >= viewport) photo.classList.add("is-pending");
    });
  }

  /* ------------------------------------------------------------------
     Governance: draw the trace from the trace code to the access record
     ------------------------------------------------------------------ */
  var evidence = doc.querySelector("[data-evidence]");
  if (evidence) {
    var stage = evidence.querySelector(".evidence__stage");
    var from = evidence.querySelector("[data-trace-from]");
    var to = evidence.querySelector("[data-trace-to]");
    var svg = evidence.querySelector(".trace");
    var path = svg.querySelector(".trace__path");
    var dotA = svg.querySelector(".trace__dot--a");
    var dotB = svg.querySelector(".trace__dot--b");

    var f = function (n) {
      return Math.round(n * 10) / 10;
    };

    // Horizontal-first elbow with rounded corners.
    var elbowH = function (x1, y1, x2, y2) {
      var mx = x1 + (x2 - x1) / 2;
      var dy = y2 - y1;
      var r = Math.min(12, Math.abs(dy) / 2, (x2 - x1) / 4);
      if (Math.abs(dy) < 2 || r < 1) return "M" + f(x1) + " " + f(y1) + " H" + f(x2);
      var sy = dy > 0 ? 1 : -1;
      return "M" + f(x1) + " " + f(y1) +
        " H" + f(mx - r) +
        " Q" + f(mx) + " " + f(y1) + " " + f(mx) + " " + f(y1 + sy * r) +
        " V" + f(y2 - sy * r) +
        " Q" + f(mx) + " " + f(y2) + " " + f(mx + r) + " " + f(y2) +
        " H" + f(x2);
    };

    var draw = function () {
      var s = stage.getBoundingClientRect();
      var a = from.getBoundingClientRect();
      var b = to.getBoundingClientRect();
      if (!s.width || !s.height) return;
      svg.setAttribute("viewBox", "0 0 " + f(s.width) + " " + f(s.height));
      var x1;
      var y1;
      var x2;
      var y2;
      var d;
      if (b.left >= a.right + 8) {
        // Record sits beside the page: leave the code to the right.
        x1 = a.right - s.left;
        y1 = a.top + a.height / 2 - s.top;
        x2 = b.left - s.left;
        y2 = b.top - s.top + Math.min(64, b.height / 3);
        d = elbowH(x1, y1, x2, y2);
      } else {
        // Record sits below the page: drop straight down from the code.
        x1 = a.left + a.width / 2 - s.left;
        y1 = a.bottom - s.top;
        x2 = x1;
        y2 = b.top - s.top;
        d = "M" + f(x1) + " " + f(y1) + " V" + f(y2);
      }
      path.setAttribute("d", d);
      svg.classList.add("is-drawn");
      dotA.setAttribute("cx", f(x1));
      dotA.setAttribute("cy", f(y1));
      dotB.setAttribute("cx", f(x2));
      dotB.setAttribute("cy", f(y2));
    };

    draw();
    if ("ResizeObserver" in window) {
      var traceRO = new ResizeObserver(draw);
      traceRO.observe(stage);
      traceRO.observe(from.closest(".paper") || from);
      traceRO.observe(to);
    } else {
      window.addEventListener("resize", draw);
    }
    // Web fonts arrive after first paint (display=swap); redraw when they land.
    if (doc.fonts) {
      if (doc.fonts.ready) doc.fonts.ready.then(draw);
      doc.fonts.addEventListener("loadingdone", draw);
    }

    if (hasIO && motionOK()) {
      // Watch the record and the code at a low threshold: on stacked phone layouts
      // the whole stage can be taller than the viewport.
      var traceIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || evidence.classList.contains("in")) return;
          draw();
          evidence.classList.add("in");
          traceIO.disconnect();
        });
      }, { threshold: 0.15 });
      traceIO.observe(to);
      traceIO.observe(from);
    } else {
      evidence.classList.add("in");
    }
  }

  /* ------------------------------------------------------------------
     Sector scroller: a keyboard stop only while it actually scrolls.
     ------------------------------------------------------------------ */
  var scroller = doc.querySelector(".sectors__scroller");
  if (scroller) {
    var syncScroller = function () {
      if (scroller.scrollWidth > scroller.clientWidth + 1) scroller.setAttribute("tabindex", "0");
      else scroller.removeAttribute("tabindex");
    };
    syncScroller();
    if ("ResizeObserver" in window) new ResizeObserver(syncScroller).observe(scroller);
    else window.addEventListener("resize", syncScroller);
  }

  /* ------------------------------------------------------------------
     Contact helpers: some links pre-fill an empty message so the request
     lands with context.
     ------------------------------------------------------------------ */
  var message = doc.getElementById("demo-message");
  doc.addEventListener("click", function (event) {
    var prefill = event.target.closest("[data-prefill]");
    if (prefill && message && !message.value.trim()) {
      message.value = prefill.getAttribute("data-prefill");
    }
  });

  /* ------------------------------------------------------------------
     Demo request: sent in the background so the page stays where it is,
     with the outcome shown as a toast. The handler at the form's action
     answers { "ok": true } (or { "ok": false } for invalid input) when the
     request asks for JSON. Without this script the form posts normally; a
     handler that then redirects back with ?request=sent|invalid still gets
     its toast here.
     ------------------------------------------------------------------ */
  var arabic = root.lang === "ar";
  // The portal's icons: a check in a circle, and an X in an octagon.
  var ICON_OK = '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>';
  var ICON_ERROR =
    '<path d="M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>';
  var TOASTS = {
    sent: {
      icon: ICON_OK,
      text: arabic
        ? "شكراً لك، تم استلام طلبك وسيتواصل معك فريقنا قريباً."
        : "Thank you. Your request has been received, and our team will contact you shortly.",
    },
    invalid: {
      icon: ICON_ERROR,
      text: arabic
        ? "تعذّر إرسال الطلب. يرجى التحقق من الحقول المطلوبة والمحاولة مرة أخرى."
        : "We couldn't send your request. Please check the required fields and try again.",
    },
    failed: {
      icon: ICON_ERROR,
      text: arabic
        ? "تعذّر إرسال الطلب حالياً. يرجى المحاولة لاحقاً."
        : "We couldn't send your request right now. Please try again later.",
    },
  };
  var toaster = null;

  // Shows one toast for 4 s (paused while the pointer is over it).
  function showToast(outcome) {
    var spec = TOASTS[outcome];
    if (!toaster) {
      toaster = doc.createElement("ol");
      toaster.className = "toaster";
      toaster.setAttribute("aria-label", arabic ? "الإشعارات" : "Notifications");
      doc.body.appendChild(toaster);
    }
    var toast = doc.createElement("li");
    toast.className = "toast";
    toast.setAttribute("role", outcome === "sent" ? "status" : "alert");
    toast.innerHTML =
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + spec.icon + "</svg>";
    var text = doc.createElement("span");
    text.textContent = spec.text;
    toast.appendChild(text);
    toaster.appendChild(toast);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.classList.add("is-shown");
      });
    });

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
      toast.classList.remove("is-shown");
      setTimeout(function () {
        toast.remove();
      }, motionOK() ? 400 : 0);
    }
  }

  // Back from a redirect-style handler: show its outcome once, then drop the flag
  // so a reload doesn't repeat it.
  var params = new URLSearchParams(window.location.search);
  var redirected = params.get("request");
  if (redirected === "sent" || redirected === "invalid") {
    params.delete("request");
    var query = params.toString();
    history.replaceState(null, "", window.location.pathname + (query ? "?" + query : "") + window.location.hash);
    showToast(redirected);
  }

  var demoForm = doc.getElementById("demo-form");
  if (demoForm && window.fetch && window.FormData) {
    demoForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var submit = demoForm.querySelector('[type="submit"]');
      if (submit) submit.disabled = true;
      demoForm.setAttribute("aria-busy", "true");

      fetch(demoForm.action, {
        method: "POST",
        body: new FormData(demoForm),
        headers: { Accept: "application/json" },
      })
        .then(function (response) {
          return response.json().then(
            function (data) { return { data: data, url: response.url }; },
            function () { return { data: null, url: response.url }; }
          );
        })
        .then(function (result) {
          // A handler that redirects instead of answering JSON still reports
          // its outcome in the final URL.
          var flag = /[?&]request=(sent|invalid)\b/.exec(result.url || "");
          var outcome = result.data
            ? (result.data.ok ? "sent" : "invalid")
            : (flag ? flag[1] : "failed");
          if (outcome === "sent") demoForm.reset();
          showToast(outcome);
        })
        .catch(function () {
          showToast("failed");
        })
        .then(function () {
          if (submit) submit.disabled = false;
          demoForm.removeAttribute("aria-busy");
        });
    });
  }

  // Everything is wired up: the CSS fail-safe is no longer needed.
  root.classList.add("reveal-ready");
})();
