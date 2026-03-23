/* ══════════════════════════════════════════════════════════════
   ITINERA – result.js  |  Render itinerary
   ══════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  const raw = sessionStorage.getItem("itinerary");
  const loading  = document.getElementById("loadingState");
  const content  = document.getElementById("itineraryContent");

  if (!raw) {
    if (loading) loading.innerHTML = '<p>No itinerary found. <a href="/plan" style="color:var(--maroon)">Plan a trip →</a></p>';
    return;
  }

  const itin = JSON.parse(raw);

  setTimeout(() => {
    if (loading)  loading.style.display = "none";
    if (content)  content.style.display = "block";
    renderAll(itin);
  }, 1200); // slight delay for nice UX
});

// ── Master render ─────────────────────────────────────────────
function renderAll(itin) {
  renderHero(itin);
  renderWeather(itin.weather);
  renderBudget(itin.budget);
  renderHotel(itin.hotel);
  renderTransport(itin.transport);
  renderDailyPlan(itin.daily_plan, itin.weather);
  renderAccessibility(itin.accessibility);
  checkTTS(itin.accessibility);
  announceToScreenReader("Your itinerary for " + itin.destination + " is ready.");
}

// ── Hero ──────────────────────────────────────────────────────
function renderHero(itin) {
  const title = document.getElementById("resultTitle");
  const meta  = document.getElementById("resultMeta");
  const eyebrow = document.getElementById("resultEyebrow");

  if (title) title.textContent = itin.destination;
  if (eyebrow) eyebrow.textContent = "Your AI-Crafted Itinerary";

  if (meta) {
    meta.innerHTML = `
      <span>📅 ${itin.start_date} → ${itin.end_date}</span>
      <span>🌙 ${itin.num_days} days</span>
      <span>💰 $${Number(itin.budget?.total).toLocaleString("en-US")}</span>
      ${itin.accessibility?.specially_abled ? '<span>♿ Accessibility Enabled</span>' : ''}
    `;
  }
}

// ── Weather ───────────────────────────────────────────────────
function renderWeather(weather) {
  const strip = document.getElementById("weatherStrip");
  if (!strip || !weather?.length) return;

  strip.innerHTML = weather.map(w => `
    <div class="weather-day" role="listitem" aria-label="Day ${w.day}: ${w.condition}, ${w.temp_high}°C">
      <div class="w-icon" aria-hidden="true">${w.icon}</div>
      <div class="w-label">Day ${w.day}</div>
      <div class="w-temp">${w.temp_high}° / ${w.temp_low}°C</div>
      <div class="w-cond">${w.condition}</div>
    </div>
  `).join("");
}

// ── Budget ────────────────────────────────────────────────────
function renderBudget(budget) {
  const bars  = document.getElementById("budgetBars");
  const total = document.getElementById("budgetTotal");
  if (!bars || !budget) return;

  const items = [
    { label: "🏨 Hotel",     val: budget.hotel,      cls: "bar-hotel",      pct: 40 },
    { label: "🚌 Transport", val: budget.transport,   cls: "bar-transport",  pct: 30 },
    { label: "🍛 Food",      val: budget.food,        cls: "bar-food",       pct: 20 },
    { label: "🎯 Activities",val: budget.activities,  cls: "bar-activities", pct: 10 }
  ];

  bars.innerHTML = items.map(it => `
    <div class="budget-item">
      <div class="budget-label">${it.label}</div>
      <div class="budget-bar-wrap" role="progressbar" aria-valuenow="${it.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${it.label}: ${it.pct}%">
        <div class="budget-bar-fill ${it.cls}" style="width:0%" data-pct="${it.pct}"></div>
      </div>
      <div class="budget-val">$${Number(it.val).toLocaleString("en-US")}</div>
    </div>
  `).join("");

  if (total) {
    total.innerHTML = `
      <span>Total Budget: $${Number(budget.total).toLocaleString("en-US")}</span>
      <span class="remaining">Remaining: $${Math.max(0, Number(budget.remaining)).toLocaleString("en-US")}</span>
    `;
  }

  // Animate bars
  setTimeout(() => {
    document.querySelectorAll(".budget-bar-fill").forEach(el => {
      el.style.width = el.dataset.pct + "%";
    });
  }, 300);
}

// ── Hotel ─────────────────────────────────────────────────────
function renderHotel(hotel) {
  const card = document.getElementById("hotelCard");
  if (!card) return;

  if (!hotel) {
    card.innerHTML = "<p>Hotel recommendations not available.</p>";
    return;
  }

  const stars = "⭐".repeat(Math.round(hotel.rating || 4));
  const accessBadges = [
    hotel.wheelchair_accessible === "true" || hotel.wheelchair_accessible === true ? "♿ Wheelchair" : null,
    hotel.elevator === "true"             || hotel.elevator === true              ? "🛗 Elevator"   : null,
    hotel.ramp_access === "true"          || hotel.ramp_access === true           ? "🔼 Ramp"       : null
  ].filter(Boolean);

  card.innerHTML = `
    <div class="hotel-icon" aria-hidden="true">🏨</div>
    <div>
      <div class="hotel-name">${hotel.name || "—"}</div>
      <div class="hotel-city">${hotel.city || ""}</div>
      <div class="hotel-desc">${hotel.description || ""}</div>
      <div class="hotel-price">$${Number(hotel.price_per_night).toLocaleString("en-US")} / night</div>
      <div class="hotel-rating" aria-label="Rating ${hotel.rating}">${stars} ${hotel.rating}</div>
      ${accessBadges.length ? `
        <div class="hotel-badges" style="margin-top:10px;">
          ${accessBadges.map(b => `<span class="hotel-badge accessible">${b}</span>`).join("")}
        </div>` : ""}
    </div>
  `;
}

// ── Transport ─────────────────────────────────────────────────
function renderTransport(transport) {
  const card = document.getElementById("transportCard");
  if (!card || !transport) return;

  const icon = {
    "Metro": "🚇",
    "MRT": "🚇",
    "U-Bahn": "🚇",
    "London Underground": "🚇",
    "BTS Skytrain": "🚈",
    "Train & Metro": "🚆",
    "Train & Ferry": "🚆",
    "Delhi Metro": "🚇",
    "Metro Rail": "🚇",
    "Accessible Cab": "🚖",
    "Accessible Taxi": "🚖",
    "Accessible Van": "🚖",
    "Access Services": "🚐",
    "Black Cab": "🚕",
    "Yellow Cab": "🚕",
    "Taxi/Cab": "🚕",
    "Taxi": "🚕",
    "Taxi/Uber": "🚕",
    "Grab": "🚗",
    "Uber": "🚗",
    "OLA/Uber": "🚗",
    "Lyft/Uber": "🚗",
    "Private Driver": "🚗",
    "Auto Rickshaw": "🛺",
    "Tuk Tuk": "🛺",
    "Matatu": "🚌",
    "MyCiti Bus": "🚌",
    "Bus": "🚌",
    "Vaporetto": "⛵",
    "Water Taxi": "⛵",
    "Bosphorus Ferry": "⛴️",
    "Boat": "⛵",
    "Jeep Safari": "🚙",
    "Scooter": "🛵",
    "Vélib Bike": "🚲"
  }[transport.type] || "🚌";

  card.innerHTML = `
    <div class="transport-icon" aria-hidden="true">${icon}</div>
    <div>
      <div class="transport-type">${transport.type}</div>
      <div class="transport-desc">${transport.description || ""}</div>
      <div class="transport-price">$${Number(transport.price_per_day_usd || transport.price_per_day).toLocaleString("en-US")} / day</div>
      ${transport.accessible === "true" || transport.accessible === true
        ? '<div style="color:var(--maroon);font-size:.82rem;margin-top:4px;font-weight:600">♿ Accessible</div>' : ""}
    </div>
  `;
}

// ── Daily Plan ────────────────────────────────────────────────
function renderDailyPlan(dailyPlan, weather) {
  const timeline = document.getElementById("timeline");
  if (!timeline || !dailyPlan?.length) return;

  const times = ["9:00 AM", "12:30 PM", "3:30 PM", "6:00 PM"];
  const catIcons = {
    sightseeing: "🏛️", history: "📜", food: "🍛", nature: "🌿",
    adventure: "🧗", shopping: "🛍️"
  };

  timeline.innerHTML = dailyPlan.map((dayActivities, idx) => {
    const dayWeather = weather?.[idx];
    const activitiesHtml = dayActivities.map((act, ai) => `
      <div class="activity-card" aria-label="${act.name}">
        <div class="activity-name">${catIcons[act.category] || "📍"} ${act.name}</div>
        <div class="activity-meta">
          <span>🕐 ${times[ai] || "Flexible"}</span>
          <span>⏱️ ${act.duration_hours}h</span>
          ${(act.entry_fee_usd || act.entry_fee) > 0 ? `<span>🎫 $${act.entry_fee_usd || act.entry_fee}</span>` : '<span>🎫 Free</span>'}
          <span class="act-cat">${act.category}</span>
        </div>
        <div class="activity-desc">${act.description || ""}</div>
        ${act.wheelchair_accessible === "true" || act.wheelchair_accessible === true
          ? '<div class="activity-accessible">♿ Wheelchair Accessible</div>' : ""}
      </div>
    `).join("") || "<p style='color:var(--text-muted);font-size:.9rem'>Relaxation day — explore at your own pace.</p>";

    return `
      <div class="day-block" role="article" aria-label="Day ${idx + 1}">
        <div class="day-header">
          <div class="day-num" aria-hidden="true">D${idx + 1}</div>
          <div>
            <div class="day-title">Day ${idx + 1}</div>
            ${dayWeather ? `<div class="day-weather">${dayWeather.icon} ${dayWeather.condition} · ${dayWeather.temp_high}°C</div>` : ""}
          </div>
        </div>
        <div class="day-activities" role="list">
          ${activitiesHtml}
        </div>
      </div>
    `;
  }).join("");
}

// ── Accessibility Info ────────────────────────────────────────
function renderAccessibility(accessibility) {
  const section = document.getElementById("accessInfoSection");
  const card    = document.getElementById("accessInfoCard");
  if (!section || !card || !accessibility?.specially_abled) return;

  section.style.display = "block";
  const needs = accessibility.needs || [];

  card.innerHTML = `
    <ul>
      <li>🦽 Disability type: <strong>${accessibility.disability_type || "Not specified"}</strong></li>
      ${needs.map(n => `<li>✅ ${n.charAt(0).toUpperCase() + n.slice(1)}</li>`).join("")}
    </ul>
    <p style="margin-top:14px;font-size:.88rem;color:var(--text-muted)">
      All recommendations above have been filtered for your accessibility needs.
    </p>
  `;
}

// ── TTS auto-trigger for blind users ─────────────────────────
function checkTTS(accessibility) {
  const banner = document.getElementById("ttsBanner");
  if (!banner) return;
  if (accessibility?.disability_type === "blind" || accessibility?.disability_type === "visually_impaired") {
    banner.style.display = "flex";
    // Auto-start TTS after a short delay
    setTimeout(() => {
      speakItinerary();
    }, 2000);
  }
}
