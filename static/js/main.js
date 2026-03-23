/* ══════════════════════════════════════════════════════════════
   ITINERA – main.js
   ══════════════════════════════════════════════════════════════ */

// ── Restore preferences ────────────────────────────────────────
(function () {
  if (localStorage.getItem("itineraHighContrast") === "true")
    document.body.classList.add("high-contrast");
})();

function toggleHighContrast() {
  document.body.classList.toggle("high-contrast");
  localStorage.setItem("itineraHighContrast", document.body.classList.contains("high-contrast"));
}

let _fontLevel = 0;
function increaseFontSize() {
  _fontLevel = (_fontLevel + 1) % 3;
  document.body.style.fontSize = ["16px", "19px", "22px"][_fontLevel];
}

function announceToScreenReader(msg) {
  let el = document.getElementById("sr-live");
  if (!el) {
    el = document.createElement("div");
    el.id = "sr-live";
    el.setAttribute("aria-live", "polite");
    el.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;";
    document.body.appendChild(el);
  }
  el.textContent = "";
  setTimeout(() => { el.textContent = msg; }, 80);
}

// ── Navbar scroll ──────────────────────────────────────────────
window.addEventListener("scroll", () => {
  const nav = document.getElementById("navbar");
  if (!nav) return;
  if (window.scrollY > 40) {
    nav.classList.add("scrolled");
  } else {
    nav.classList.remove("scrolled");
  }
});

// ── Hamburger ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById("hamburger");
  const navUl = document.querySelector("nav ul");
  if (hamburger && navUl) {
    hamburger.addEventListener("click", () => {
      const open = navUl.classList.toggle("open");
      hamburger.setAttribute("aria-expanded", open);
    });
  }
});

// ── Contact ────────────────────────────────────────────────────
function handleContact(e) {
  e.preventDefault();
  alert("Thank you! We'll get back to you soon.");
  e.target.reset();
}

// ── Print ──────────────────────────────────────────────────────
function printItinerary() { window.print(); }

/* ════════════════════════════════════════════════════════════════
   VOICE SYSTEM
   ════════════════════════════════════════════════════════════════ */

let _rec        = null;
let _listening  = false;
let _isPlanPage = false;   // set true when called from plan page

// ── Open overlays ──────────────────────────────────────────────
function openVoice() {           // landing page 🎙️ button
  _isPlanPage = false;
  _openOverlay();
}
function openVoiceForm() {       // plan page 🎙️ button
  _isPlanPage = true;
  _openOverlay();
}

function _openOverlay() {
  const ov = document.getElementById("voiceOverlay");
  if (!ov) return;
  ov.style.display = "flex";
  _setStatus("Click the microphone button to start speaking.");
  const res = document.getElementById("voiceResult");
  if (res) res.textContent = "";
  const goBtn = document.getElementById("voiceGoBtn");
  if (goBtn) goBtn.style.display = "none";
  const micBtn = document.getElementById("micBtn");
  if (micBtn) { micBtn.textContent = "🎙️ Start Listening"; micBtn.disabled = false; }
  const wave = document.getElementById("voiceWave");
  if (wave) wave.classList.remove("active");
}

// ── Close overlays ─────────────────────────────────────────────
function closeVoice()     { _closeOverlay(); }
function closeVoiceForm() { _closeOverlay(); }

function _closeOverlay() {
  const ov = document.getElementById("voiceOverlay");
  if (ov) ov.style.display = "none";
  _stopRec();
}

// ── Start listening (called by micBtn onclick) ──────────────────
function startListening()   { _startRec(); }   // landing page micBtn
function startVoiceInput()  { _startRec(); }   // plan page micBtn

function _startRec() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    _setStatus("⚠️ Speech recognition is only supported in Google Chrome. Please switch browsers.");
    return;
  }

  _stopRec(); // kill any previous session

  _rec = new SR();
  _rec.lang           = "en-US";
  _rec.continuous     = false;
  _rec.interimResults = false;
  _rec.maxAlternatives = 1;

  const micBtn = document.getElementById("micBtn");
  const wave   = document.getElementById("voiceWave");

  _rec.onstart = () => {
    _listening = true;
    _setStatus("🎤 Listening… Speak now!");
    if (micBtn) { micBtn.textContent = "🔴 Recording…"; micBtn.disabled = true; }
    if (wave)   wave.classList.add("active");
  };

  _rec.onresult = (e) => {
    const transcript = e.results[0][0].transcript.trim();
    console.log("[ITINERA voice] heard:", transcript);   // debug
    document.getElementById("voiceResult").textContent = "\u201c" + transcript + "\u201d";

    if (_isPlanPage) {
      _fillForm(transcript);
    } else {
      _saveLandingVoice(transcript);
    }
  };

  _rec.onerror = (e) => {
    console.error("[ITINERA voice] error:", e.error);
    const msgs = {
      "not-allowed":        "⚠️ Microphone blocked. Click the 🔒 icon in your browser address bar and allow microphone access.",
      "permission-denied":  "⚠️ Microphone blocked. Allow mic access in browser settings.",
      "no-speech":          "⚠️ No speech detected. Please try again.",
      "network":            "⚠️ Network error. Check your internet connection.",
      "audio-capture":      "⚠️ No microphone found. Please connect a microphone.",
    };
    _setStatus(msgs[e.error] || "⚠️ Error: " + e.error + ". Please try again.");
    if (micBtn) { micBtn.textContent = "🎙️ Try Again"; micBtn.disabled = false; }
    if (wave)   wave.classList.remove("active");
    _listening = false;
  };

  _rec.onend = () => {
    _listening = false;
    if (micBtn) { micBtn.textContent = "🎙️ Start Listening"; micBtn.disabled = false; }
    if (wave)   wave.classList.remove("active");
  };

  try {
    _rec.start();
  } catch (err) {
    _setStatus("⚠️ Could not access microphone: " + err.message);
  }
}

function _stopRec() {
  if (_rec) {
    try { _rec.stop(); } catch (e) {}
    _rec = null;
  }
  _listening = false;
}

function _setStatus(msg) {
  const el = document.getElementById("voiceStatus");
  if (el) el.textContent = msg;
}

/* ════════════════════════════════════════════════════════════════
   PARSE VOICE → FILL PLAN FORM  (plan page)
   ════════════════════════════════════════════════════════════════ */

function _fillForm(text) {
  const t = text.toLowerCase();
  const filled = [];

  /* ── 1. City ───────────────────────────────────────────────── */
  const cities = [
    ["rio de janeiro", "Rio de Janeiro"],
    ["los angeles",    "Los Angeles"],
    ["new york",       "New York"],
    ["cape town",      "Cape Town"],
    ["new delhi",      "New Delhi"],
    ["london",         "London"],
    ["paris",          "Paris"],
    ["tokyo",          "Tokyo"],
    ["dubai",          "Dubai"],
    ["singapore",      "Singapore"],
    ["bangkok",        "Bangkok"],
    ["bali",           "Bali"],
    ["barcelona",      "Barcelona"],
    ["amsterdam",      "Amsterdam"],
    ["venice",         "Venice"],
    ["vienna",         "Vienna"],
    ["sydney",         "Sydney"],
    ["nairobi",        "Nairobi"],
    ["istanbul",       "Istanbul"],
  ];
  for (const [lower, proper] of cities) {
    if (t.includes(lower)) {
      const el = document.getElementById("destination");
      if (el) {
        el.value = proper;
        filled.push("📍 " + proper);
      }
      break;
    }
  }

  /* ── 2. Dates + Days ───────────────────────────────────────── */
  const fmt  = d => d.toISOString().split("T")[0];
  const now  = new Date();
  const MONTHS = {
    january:0, jan:0, february:1, feb:1, march:2, mar:2,
    april:3, apr:3, may:4, june:5, jun:5, july:6, jul:6,
    august:7, aug:7, september:8, sep:8, sept:8, october:9, oct:9,
    november:10, nov:10, december:11, dec:11
  };

  // Helper: parse "25th july", "july 25", "25 july", "25/7", "25-7", "7/25"
  function parseDate(str) {
    str = str.trim().toLowerCase().replace(/(\d+)(st|nd|rd|th)/g, "$1");

    // "25 july" or "july 25"
    const wordMatch = str.match(/(\d{1,2})\s+([a-z]+)|([a-z]+)\s+(\d{1,2})/);
    if (wordMatch) {
      const day   = parseInt(wordMatch[1] || wordMatch[4]);
      const mName = (wordMatch[2] || wordMatch[3]).toLowerCase();
      if (MONTHS[mName] !== undefined) {
        let year = now.getFullYear();
        const d  = new Date(year, MONTHS[mName], day);
        if (d < now) d.setFullYear(year + 1); // if past, assume next year
        if (!isNaN(d)) return d;
      }
    }

    // "25/7" or "25-7" or "7/25"
    const numMatch = str.match(/(\d{1,2})[\/\-](\d{1,2})/);
    if (numMatch) {
      let day = parseInt(numMatch[1]), month = parseInt(numMatch[2]) - 1;
      if (day > 12) { /* day first */ }
      else if (month > 11) { [day, month] = [month + 1, day - 1]; }
      const d = new Date(now.getFullYear(), month, day);
      if (d < now) d.setFullYear(now.getFullYear() + 1);
      if (!isNaN(d)) return d;
    }

    return null;
  }

  // Patterns: "from X to Y", "X to Y", "between X and Y", "X till Y", "X until Y"
  const rangePat = [
    /(?:from\s+)(.+?)\s+(?:to|till|until|through)\s+(.+?)(?:\s+(?:with|for|budget|dollar|\d+\s*day)|$)/i,
    /(?:between\s+)(.+?)\s+(?:and|to)\s+(.+?)(?:\s+(?:with|for|budget|dollar|\d+\s*day)|$)/i,
    /(.+?)\s+(?:to|till|until)\s+(.+?)(?:\s+(?:with|for|budget|dollar|\d+\s*day)|$)/i,
  ];

  let startDate = null, endDate = null;

  for (const pat of rangePat) {
    const m = t.match(pat);
    if (m) {
      const s = parseDate(m[1]);
      const e = parseDate(m[2]);
      if (s && e && e > s) { startDate = s; endDate = e; break; }
    }
  }

  // Single date keywords: "starting 20th june", "departure 20 june", "leaving june 20"
  if (!startDate) {
    const singleStart = t.match(/(?:starting|departure|depart|leaving|from|start)\s+(?:on\s+)?(.+?)(?:\s+(?:to|till|until|for|\d+\s*day|with|budget)|$)/i);
    if (singleStart) startDate = parseDate(singleStart[1]);
  }
  if (!endDate) {
    const singleEnd = t.match(/(?:returning|return|back|ending|end|arrival|to|till|until)\s+(?:on\s+)?(.+?)(?:\s+(?:with|for|budget|dollar|\d+\s*day)|$)/i);
    if (singleEnd) endDate = parseDate(singleEnd[1]);
  }

  // Fill date fields
  if (startDate) {
    const el = document.getElementById("start_date");
    if (el) el.value = fmt(startDate);
  }
  if (endDate) {
    const el = document.getElementById("end_date");
    if (el) el.value = fmt(endDate);
  }

  // Auto-calculate num_days from dates, or from spoken days
  const daysMatch = t.match(/(\d+)\s*(?:day|night)/);
  if (startDate && endDate) {
    const diff = Math.round((endDate - startDate) / 86400000);
    const el = document.getElementById("num_days");
    if (el && diff > 0) el.value = diff;
    filled.push("📅 " + fmt(startDate) + " → " + fmt(endDate) + " (" + diff + " days)");
  } else if (daysMatch) {
    // fallback: no explicit dates spoken — use today + N days
    const numDays = parseInt(daysMatch[1]);
    const s = new Date();
    const e = new Date(); e.setDate(s.getDate() + numDays);
    const startEl = document.getElementById("start_date");
    const endEl   = document.getElementById("end_date");
    const daysEl  = document.getElementById("num_days");
    if (startEl && !startEl.value) startEl.value = fmt(s);
    if (endEl   && !endEl.value)   endEl.value   = fmt(e);
    if (daysEl)                    daysEl.value   = numDays;
    filled.push("🌙 " + numDays + " days (" + fmt(s) + " → " + fmt(e) + ")");
  } else if (startDate) {
    filled.push("📅 Departure: " + fmt(startDate));
  } else if (endDate) {
    filled.push("📅 Return: " + fmt(endDate));
  }

  /* ── 3. Budget ─────────────────────────────────────────────── */
  // matches: "$2000", "2000 dollars", "2000 usd", "2 thousand"
  let budgetAmt = null;
  const budgetPatterns = [
    /\$\s*(\d[\d,]*)/,                              // $2000
    /(\d[\d,]*)\s*(?:dollar|dollars|usd)/i,         // 2000 dollars
    /(\d+)\s*thousand/i,                            // 2 thousand
  ];
  for (const pat of budgetPatterns) {
    const m = t.match(pat);
    if (m) {
      budgetAmt = m[1].replace(/,/g, "");
      if (pat.toString().includes("thousand")) budgetAmt = String(parseInt(budgetAmt) * 1000);
      break;
    }
  }
  // fallback: any standalone 3-5 digit number that wasn't the days number
  if (!budgetAmt) {
    const nums = [...t.matchAll(/\b(\d{3,5})\b/g)];
    for (const m of nums) {
      if (!daysMatch || m[1] !== daysMatch[1]) {
        budgetAmt = m[1];
        break;
      }
    }
  }
  if (budgetAmt && parseInt(budgetAmt) >= 50) {
    const el = document.getElementById("budget");
    if (el) { el.value = budgetAmt; filled.push("💰 $" + budgetAmt); }
  }

  /* ── 4. Travel style ───────────────────────────────────────── */
  const styleMap = {
    luxury: ["luxury","luxurious","5 star","five star","premium","high end"],
    budget: ["budget","cheap","affordable","backpacker","low cost"],
    adventure: ["adventure","adventurous","trekking","hiking","extreme"],
    cultural: ["cultural","culture","heritage","history","historical"],
    family: ["family","kids","children","family friendly"],
  };
  for (const [style, keywords] of Object.entries(styleMap)) {
    if (keywords.some(k => t.includes(k))) {
      const el = document.getElementById("travel_style");
      if (el) { el.value = style; filled.push("🎨 " + style); }
      break;
    }
  }

  /* ── 5. Accessibility ──────────────────────────────────────── */
  const accessWords = ["wheelchair","accessible","disability","handicap","blind","deaf","ramp","elevator"];
  if (accessWords.some(w => t.includes(w))) {
    const spEl = document.getElementById("specially_abled");
    if (spEl) {
      spEl.value = "yes";
      // show the section
      const section = document.getElementById("accessibilitySection");
      if (section) section.style.display = "block";
      // auto-tick matching checkboxes
      if (t.includes("wheelchair") || t.includes("handicap")) {
        const cb = document.querySelector('input[value="wheelchair accessible"]');
        if (cb) cb.checked = true;
        const cb2 = document.querySelector('input[value="ramp access"]');
        if (cb2) cb2.checked = true;
      }
      if (t.includes("elevator") || t.includes("lift")) {
        const cb = document.querySelector('input[value="elevator"]');
        if (cb) cb.checked = true;
      }
      if (t.includes("blind") || t.includes("visual")) {
        const cb = document.querySelector('input[value="audio guide"]');
        if (cb) cb.checked = true;
        const dt = document.getElementById("disability_type");
        if (dt) dt.value = "blind";
      }
      if (t.includes("deaf") || t.includes("hearing")) {
        const dt = document.getElementById("disability_type");
        if (dt) dt.value = "deaf";
      }
      filled.push("♿ Accessibility");
    }
  }

  /* ── 6. Activities ─────────────────────────────────────────── */
  const actMap = {
    sightseeing: ["sightseeing","sight","tourist","landmark"],
    history:     ["history","historical","museum","heritage","monument"],
    food:        ["food","eat","cuisine","restaurant","dining"],
    nature:      ["nature","park","garden","wildlife","outdoor"],
    adventure:   ["adventure","trek","hike","surf","dive","sport"],
    shopping:    ["shopping","shop","market","bazaar","mall"],
  };
  for (const [act, keywords] of Object.entries(actMap)) {
    if (keywords.some(k => t.includes(k))) {
      const cb = document.querySelector(`input[name="activities"][value="${act}"]`);
      if (cb) cb.checked = true;
    }
  }

  /* ── Result ────────────────────────────────────────────────── */
  if (filled.length > 0) {
    _setStatus("✅ Filled: " + filled.join(", ") + "\nReview the form and submit!");
    announceToScreenReader("Form filled with: " + filled.join(", "));
  } else {
    _setStatus('🤔 Could not detect details. Try: "3 days in Tokyo, 2000 dollar budget"');
  }
}

/* ════════════════════════════════════════════════════════════════
   PARSE VOICE → LANDING PAGE (store + redirect)
   ════════════════════════════════════════════════════════════════ */

function _saveLandingVoice(text) {
  const t = text.toLowerCase();

  const cities = [
    ["rio de janeiro","Rio de Janeiro"],["los angeles","Los Angeles"],
    ["new york","New York"],["cape town","Cape Town"],["new delhi","New Delhi"],
    ["london","London"],["paris","Paris"],["tokyo","Tokyo"],["dubai","Dubai"],
    ["singapore","Singapore"],["bangkok","Bangkok"],["bali","Bali"],
    ["barcelona","Barcelona"],["amsterdam","Amsterdam"],["venice","Venice"],
    ["vienna","Vienna"],["sydney","Sydney"],["nairobi","Nairobi"],["istanbul","Istanbul"],
  ];
  for (const [lower, proper] of cities) {
    if (t.includes(lower)) { sessionStorage.setItem("quickDest", proper); break; }
  }

  const daysMatch = t.match(/(\d+)\s*(?:day|night)/);
  if (daysMatch) sessionStorage.setItem("quickDays", daysMatch[1]);

  let budgetAmt = null;
  const patterns = [/\$\s*(\d[\d,]*)/, /(\d[\d,]*)\s*(?:dollar|dollars|usd)/i, /(\d+)\s*thousand/i];
  for (const p of patterns) {
    const m = t.match(p);
    if (m) { budgetAmt = p.toString().includes("thousand") ? String(parseInt(m[1])*1000) : m[1].replace(/,/g,""); break; }
  }
  if (!budgetAmt) {
    const nums = [...t.matchAll(/\b(\d{3,5})\b/g)];
    if (nums.length) budgetAmt = nums[0][1];
  }
  if (budgetAmt && parseInt(budgetAmt) >= 50) sessionStorage.setItem("quickBudget", budgetAmt);

  _setStatus("✅ Got it! Click below to open the full planning form.");
  const goBtn = document.getElementById("voiceGoBtn");
  if (goBtn) { goBtn.style.display = "inline-flex"; goBtn.style.width = "100%"; goBtn.style.justifyContent = "center"; }
}

/* ════════════════════════════════════════════════════════════════
   TEXT-TO-SPEECH  (result page)
   ════════════════════════════════════════════════════════════════ */

function speakItinerary() {
  if (!("speechSynthesis" in window)) { alert("Text-to-speech not supported in this browser."); return; }
  window.speechSynthesis.cancel();

  let speech = "Your ITINERA travel itinerary is ready. ";
  const titleEl = document.getElementById("resultTitle");
  if (titleEl) speech += "Destination: " + titleEl.textContent + ". ";
  const hotelName = document.querySelector(".hotel-name");
  if (hotelName) speech += "Your hotel is " + hotelName.textContent + ". ";
  const transType = document.querySelector(".transport-type");
  if (transType) speech += "Getting around by " + transType.textContent + ". ";
  document.querySelectorAll(".day-block").forEach((block, i) => {
    speech += "Day " + (i + 1) + ": ";
    block.querySelectorAll(".activity-name").forEach(a => { speech += a.textContent + ". "; });
  });

  const utt   = new SpeechSynthesisUtterance(speech);
  utt.lang    = "en-US";
  utt.rate    = 0.88;
  utt.pitch   = 1;
  window.speechSynthesis.speak(utt);
}

function stopSpeaking() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
