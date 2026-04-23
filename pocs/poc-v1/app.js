/* Graphite Console - PageShot v1 POC
 * Vanilla state machine + dev controls.
 */
(function () {
  "use strict";

  // ---- DOM refs ----
  const frame = document.getElementById("frame");
  const panel = document.getElementById("panel");
  const btnCapture = document.getElementById("btn-capture");
  const btnCaptureLabel = document.getElementById("btn-capture-label");
  const btnCopy = document.getElementById("btn-copy");
  const btnCopyLabel = document.getElementById("btn-copy-label");
  const btnDownload = document.getElementById("btn-download");
  const btnRetry = document.getElementById("btn-retry");
  const elapsedEl = document.getElementById("elapsed");
  const frameDims = document.getElementById("frame-dims");
  const srStatus = document.getElementById("sr-status");
  const srAlert = document.getElementById("sr-alert");
  const devStateBtns = document.querySelectorAll(".devbtn[data-state]");
  const devWidthBtns = document.querySelectorAll(".devbtn[data-width]");

  // ---- State ----
  let state = "idle"; // idle | capturing | ready | error
  let captureStartedAt = 0;
  let captureTimer = null;
  let elapsedTimer = null;
  let copiedResetTimer = null;
  const CAPTURE_DURATION_MS = 2500;

  // ---- Helpers ----
  function setDevActive(selector, predicate) {
    document.querySelectorAll(selector).forEach((btn) => {
      btn.classList.toggle("is-active", predicate(btn));
    });
  }

  function announce(region, message) {
    const el = region === "alert" ? srAlert : srStatus;
    if (!el) return;
    // Force announce by briefly emptying
    el.textContent = "";
    // eslint-disable-next-line no-unused-expressions
    el.offsetHeight;
    el.textContent = message;
  }

  function clearTimers() {
    if (captureTimer) {
      clearTimeout(captureTimer);
      captureTimer = null;
    }
    if (elapsedTimer) {
      clearInterval(elapsedTimer);
      elapsedTimer = null;
    }
  }

  function formatElapsed(ms) {
    const sec = ms / 1000;
    if (sec < 5) {
      return sec.toFixed(1) + " s";
    }
    return "Still working\u2026 " + Math.floor(sec) + " s";
  }

  // ---- State transitions ----
  function setState(next, opts) {
    opts = opts || {};
    clearTimers();

    state = next;
    panel.setAttribute("data-state", state);

    // Sync dev buttons
    setDevActive(".devbtn[data-state]", (b) => b.dataset.state === state);

    // Reset copy button visuals
    btnCopy.classList.remove("btn--copied");
    btnCopyLabel.textContent = "Copy";
    if (copiedResetTimer) {
      clearTimeout(copiedResetTimer);
      copiedResetTimer = null;
    }

    switch (state) {
      case "idle":
        btnCapture.disabled = false;
        btnCapture.setAttribute("aria-disabled", "false");
        btnCaptureLabel.textContent = "Capture screenshot";
        btnCopy.disabled = true;
        btnCopy.setAttribute("aria-disabled", "true");
        btnDownload.disabled = true;
        btnDownload.setAttribute("aria-disabled", "true");
        btnRetry.hidden = true;
        elapsedEl.textContent = "0.0 s";
        if (!opts.silent) announce("status", "Ready to capture.");
        break;

      case "capturing":
        btnCapture.disabled = true;
        btnCapture.setAttribute("aria-disabled", "true");
        btnCaptureLabel.textContent = "Capturing\u2026";
        btnCopy.disabled = true;
        btnCopy.setAttribute("aria-disabled", "true");
        btnDownload.disabled = true;
        btnDownload.setAttribute("aria-disabled", "true");
        btnRetry.hidden = true;

        captureStartedAt = Date.now();
        elapsedEl.textContent = "0.2 s";

        elapsedTimer = setInterval(() => {
          const ms = Date.now() - captureStartedAt;
          elapsedEl.textContent = formatElapsed(ms);
        }, 200);

        // Only auto-advance when the state was entered as part of the real flow,
        // not when a user jumps to "capturing" via the dev bar.
        if (opts.autoAdvance !== false) {
          captureTimer = setTimeout(() => {
            setState("ready");
          }, CAPTURE_DURATION_MS);
        }

        if (!opts.silent) announce("status", "Capturing screenshot.");
        break;

      case "ready":
        btnCapture.disabled = false;
        btnCapture.setAttribute("aria-disabled", "false");
        btnCaptureLabel.textContent = "Capture screenshot";
        btnCopy.disabled = false;
        btnCopy.setAttribute("aria-disabled", "false");
        btnDownload.disabled = false;
        btnDownload.setAttribute("aria-disabled", "false");
        btnRetry.hidden = true;
        if (!opts.silent)
          announce(
            "status",
            "Screenshot ready. 1440 by 900 pixels. Copy and download now available."
          );
        break;

      case "error":
        btnCapture.disabled = false;
        btnCapture.setAttribute("aria-disabled", "false");
        btnCaptureLabel.textContent = "Capture screenshot";
        btnCopy.disabled = true;
        btnCopy.setAttribute("aria-disabled", "true");
        btnDownload.disabled = true;
        btnDownload.setAttribute("aria-disabled", "true");
        btnRetry.hidden = false;
        if (!opts.silent)
          announce(
            "alert",
            "The screenshot service is temporarily unavailable. Please retry in a moment."
          );
        break;
    }
  }

  // ---- Width control ----
  function setWidth(w) {
    const n = parseInt(w, 10);
    if (!n) return;
    frame.style.setProperty("--panel-w", n + "px");
    panel.style.setProperty("--panel-w", n + "px");
    if (frameDims) frameDims.textContent = n + " \u00d7 900";
    setDevActive(".devbtn[data-width]", (b) => parseInt(b.dataset.width, 10) === n);
  }

  // ---- Copy flow ----
  function runCopy() {
    if (state !== "ready") return;
    btnCopy.classList.add("btn--copied");
    btnCopyLabel.textContent = "\u2713 Copied";
    announce("status", "Image copied to clipboard.");
    copiedResetTimer = setTimeout(() => {
      btnCopy.classList.remove("btn--copied");
      btnCopyLabel.textContent = "Copy";
    }, 1600);
  }

  // ---- Download flow ----
  function runDownload() {
    if (state !== "ready") return;
    // Build a tiny data URI for the placeholder download so the browser actually saves a file.
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900">' +
      '<rect width="1440" height="900" fill="#0f1115"/>' +
      '<text x="720" y="450" text-anchor="middle" fill="#f59e0b" ' +
      'font-family="JetBrains Mono, monospace" font-size="36">hahn-solo / landing-spring-campaign</text>' +
      '<text x="720" y="500" text-anchor="middle" fill="#737373" ' +
      'font-family="JetBrains Mono, monospace" font-size="18">2026-04-22 09:42 &#183; 1440 &#215; 900</text>' +
      "</svg>";
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hahn-solo_landing-spring-campaign_20260422-0942.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ---- Event wiring ----

  btnCapture.addEventListener("click", () => {
    if (state === "capturing") return;
    setState("capturing");
  });

  btnCopy.addEventListener("click", runCopy);
  btnDownload.addEventListener("click", runDownload);

  btnRetry.addEventListener("click", () => {
    setState("capturing");
  });

  // Dev bar: state jumps (manual, no auto-advance)
  devStateBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      setState(btn.dataset.state, { autoAdvance: false });
    });
  });

  // Dev bar: width toggles
  devWidthBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      setWidth(btn.dataset.width);
    });
  });

  // Keyboard shortcuts (modifier-less letters per spec)
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const key = (e.key || "").toLowerCase();
    switch (key) {
      case "c":
        if (state === "idle" || state === "ready" || state === "error") {
          setState("capturing");
          e.preventDefault();
        }
        break;
      case "y":
        if (state === "ready") {
          runCopy();
          e.preventDefault();
        }
        break;
      case "d":
        if (state === "ready") {
          runDownload();
          e.preventDefault();
        }
        break;
      case "r":
        if (state === "error") {
          setState("capturing");
          e.preventDefault();
        }
        break;
    }
  });

  // ---- Initial state ----
  setWidth(360);
  setState("idle", { silent: true });
})();
