/* ══════════════════════════════════════════════════════════════
   ITINERA – plan.js
   ══════════════════════════════════════════════════════════════ */

// ── Prefill from landing page (quick form OR voice) ───────────
(function prefillFromLanding() {
  const map = {
    quickDest:   "destination",
    quickDepart: "start_date",
    quickReturn: "end_date",
    quickDays:   "num_days",
    quickBudget: "budget",
  };
  Object.entries(map).forEach(([key, id]) => {
    const val = sessionStorage.getItem(key);
    if (val) {
      const el = document.getElementById(id);
      if (el) el.value = val;
      sessionStorage.removeItem(key);
    }
  });
})();

// ── Set min date to today; auto-calc num_days ─────────────────
(function initDates() {
  const today    = new Date().toISOString().split("T")[0];
  const startEl  = document.getElementById("start_date");
  const endEl    = document.getElementById("end_date");
  const daysEl   = document.getElementById("num_days");
  if (startEl) startEl.min = today;
  if (endEl)   endEl.min   = today;

  function calcDays() {
    if (startEl.value && endEl.value) {
      const diff = (new Date(endEl.value) - new Date(startEl.value)) / 86400000;
      if (daysEl && diff > 0) daysEl.value = Math.ceil(diff);
    }
  }
  if (startEl) startEl.addEventListener("change", calcDays);
  if (endEl)   endEl.addEventListener("change", calcDays);
})();

// ── Wire up navbar voice button ───────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const voiceToggleBtn = document.getElementById("voiceToggle");
  if (voiceToggleBtn) voiceToggleBtn.addEventListener("click", openVoiceForm);
});

// ── Accessibility toggle ──────────────────────────────────────
function toggleAccessibility(val) {
  const box = document.getElementById("accessibilitySection");
  if (!box) return;
  box.style.display = val === "yes" ? "block" : "none";
}

// ── Form Validation ───────────────────────────────────────────
function validateForm() {
  const required = ["destination", "travel_style", "start_date", "end_date", "num_days", "budget"];
  let valid = true;

  required.forEach(id => {
    const el    = document.getElementById(id);
    const errEl = el?.parentElement?.querySelector(".field-error");
    if (!el) return;

    if (!el.value) {
      valid = false;
      el.style.borderColor = "#ff6b6b";
      if (errEl) errEl.textContent = "Required.";
    } else {
      el.style.borderColor = "";
      if (errEl) errEl.textContent = "";
    }
  });

  const budget = parseFloat(document.getElementById("budget")?.value || 0);
  if (budget < 50) {
    valid = false;
    const el = document.getElementById("budget");
    if (el) el.style.borderColor = "#ff6b6b";
    const errEl = el?.parentElement?.querySelector(".field-error");
    if (errEl) errEl.textContent = "Minimum $50.";
  }

  const s = document.getElementById("start_date")?.value;
  const e = document.getElementById("end_date")?.value;
  if (s && e && new Date(e) <= new Date(s)) {
    valid = false;
    const el = document.getElementById("end_date");
    if (el) el.style.borderColor = "#ff6b6b";
    const errEl = el?.parentElement?.querySelector(".field-error");
    if (errEl) errEl.textContent = "Must be after departure.";
  }

  return valid;
}

// ── Submit ────────────────────────────────────────────────────
async function submitPlan(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const submitBtn  = document.getElementById("submitBtn");
  const submitText = submitBtn?.querySelector(".submit-text");
  const submitLoad = submitBtn?.querySelector(".submit-loading");
  if (submitText) submitText.style.display = "none";
  if (submitLoad) submitLoad.style.display = "inline";
  if (submitBtn)  submitBtn.disabled = true;

  const activities   = [...document.querySelectorAll('input[name="activities"]:checked')].map(c => c.value);
  const accessNeeds  = [...document.querySelectorAll('input[name="accessibility_needs"]:checked')].map(c => c.value);

  const payload = {
    destination:         document.getElementById("destination")?.value,
    start_date:          document.getElementById("start_date")?.value,
    end_date:            document.getElementById("end_date")?.value,
    num_days:            parseInt(document.getElementById("num_days")?.value || 3),
    budget:              parseFloat(document.getElementById("budget")?.value || 1000),
    travel_style:        document.getElementById("travel_style")?.value,
    activities,
    specially_abled:     document.getElementById("specially_abled")?.value === "yes",
    disability_type:     document.getElementById("disability_type")?.value || "",
    accessibility_needs: accessNeeds,
  };

  try {
    const res  = await fetch("/api/generate", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.success) {
      sessionStorage.setItem("itinerary", JSON.stringify(data.itinerary));
      window.location.href = "/result";
    } else {
      throw new Error("Server error");
    }
  } catch (err) {
    alert("Something went wrong. Please check the server is running and try again.");
    if (submitText) submitText.style.display = "inline";
    if (submitLoad) submitLoad.style.display = "none";
    if (submitBtn)  submitBtn.disabled = false;
  }
}
