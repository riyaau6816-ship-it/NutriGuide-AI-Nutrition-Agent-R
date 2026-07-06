/* ============================================================
   NutriGuide — Main Application JS
   Handles: Chat, BMI/TDEE, Meal Plan, Family, Food Lookup,
            Dark Mode, Water Tracker, Tabs, Toasts
   ============================================================ */

"use strict";

/* ── Inline micro markdown renderer ────────────────────────── */
function renderMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Headings
  html = html.replace(/^#### (.+)$/gm, "<strong style='font-size:.88rem'>$1</strong>");
  html = html.replace(/^### (.+)$/gm,  "<strong style='font-size:.92rem;display:block;margin-top:.4rem'>$1</strong>");
  html = html.replace(/^## (.+)$/gm,   "<strong style='font-size:.97rem;display:block;margin-top:.5rem'>$1</strong>");
  html = html.replace(/^# (.+)$/gm,    "<strong style='font-size:1.05rem;display:block;margin-top:.5rem'>$1</strong>");

  // Bold / italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g,     "<em>$1</em>");
  html = html.replace(/__(.+?)__/g,     "<strong>$1</strong>");

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bullet lists (handles emoji bullets)
  html = html.replace(/^[ \t]*(?:[-•*]|[🌅☀️🌙💧💪🥗✅⚠️🍎🥣🥛🥚🍳🫘🥦🥕🍊]) (.+)$/gm,
    "<li>$1</li>");
  html = html.replace(/((?:<li>.+<\/li>[\n]?)+)/g, "<ul style='padding-left:1.1rem;margin:.2rem 0'>$1</ul>");

  // Ordered lists
  html = html.replace(/^\d+[.)]\s+(.+)$/gm, "<li>$1</li>");

  // Horizontal rule
  html = html.replace(/^---+$/gm, "<hr style='border-color:rgba(127,127,127,.2);margin:.4rem 0'>");

  // Paragraphs
  html = html.replace(/\n{2,}/g, "</p><p style='margin:.25rem 0'>");
  html = html.replace(/\n/g, "<br>");

  return `<p style='margin:0'>${html}</p>`;
}

/* ── DOM Refs ────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

const chatMessages   = $("chatMessages");
const chatInput      = $("chatInput");
const sendBtn        = $("sendBtn");
const clearChatBtn   = $("clearChat");
const themeToggle    = $("themeToggle");
const bmiForm        = $("bmiForm");
const mealPlanForm   = $("mealPlanForm");
const familyForm     = $("familyForm");
const nutritionForm  = $("nutritionForm");
const statusBanner   = $("statusBanner");
const statusText     = $("statusText");
const mpCalories     = $("mpCalories");
const mpCalDisplay   = $("mpCalDisplay");

/* ── State ───────────────────────────────────────────────────── */
let isSending   = false;
let waterCount  = 0;
const MAX_WATER = 8;

/* ════════════════════════════════════════════════════════════
   THEME MANAGEMENT
════════════════════════════════════════════════════════════ */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("ng_theme", theme);
  themeToggle.innerHTML = theme === "dark"
    ? '<i class="bi bi-sun-fill"></i>'
    : '<i class="bi bi-moon-stars-fill"></i>';
}

function initTheme() {
  const saved = localStorage.getItem("ng_theme") || "light";
  applyTheme(saved);
}

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

/* ════════════════════════════════════════════════════════════
   TAB NAVIGATION
════════════════════════════════════════════════════════════ */
function activateTab(tabName) {
  document.querySelectorAll(".tab-section").forEach(s => s.classList.add("d-none"));
  document.querySelectorAll(".nav-tab").forEach(l => l.classList.remove("active"));

  const section = $(`tab-${tabName}`);
  if (section) section.classList.remove("d-none");

  document.querySelectorAll(`.nav-tab[data-tab="${tabName}"]`).forEach(l => l.classList.add("active"));
}

document.querySelectorAll(".nav-tab").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    activateTab(link.dataset.tab);
    // Collapse mobile nav
    const nav = document.getElementById("mainNav");
    if (nav.classList.contains("show")) {
      const toggler = document.querySelector(".navbar-toggler");
      toggler && toggler.click();
    }
  });
});

/* ════════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
════════════════════════════════════════════════════════════ */
function showToast(message, type = "info") {
  const icons = { success: "bi-check-circle-fill text-success",
                  danger:  "bi-x-circle-fill text-danger",
                  info:    "bi-info-circle-fill text-primary",
                  warning: "bi-exclamation-triangle-fill text-warning" };
  const icon = icons[type] || icons.info;
  const id   = "toast_" + Date.now();

  const html = `
    <div id="${id}" class="toast align-items-center" role="alert" aria-live="assertive">
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center gap-2">
          <i class="bi ${icon}"></i> ${message}
        </div>
        <button type="button" class="btn-close btn-close-sm me-2 m-auto"
                data-bs-dismiss="toast"></button>
      </div>
    </div>`;

  $("toastContainer").insertAdjacentHTML("beforeend", html);
  const toastEl = $(id);
  const bsToast = new bootstrap.Toast(toastEl, { delay: 3500 });
  bsToast.show();
  toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
}

/* ════════════════════════════════════════════════════════════
   STATUS CHECK
════════════════════════════════════════════════════════════ */
async function checkStatus() {
  try {
    const res  = await fetch("/api/status");
    const data = await res.json();
    if (data.mode === "demo") {
      statusBanner.classList.remove("d-none");
      const reason = data.error
        ? `<strong>Reason:</strong> ${data.error}`
        : `Set <code>IBM_API_KEY</code> &amp; <code>IBM_PROJECT_ID</code> in your <code>.env</code> file.`;
      statusText.innerHTML =
        `<strong>⚠️ Demo Mode</strong> &nbsp;|&nbsp; ${reason}`;
    } else {
      statusBanner.classList.add("d-none");
    }
  } catch {
    // silently ignore
  }
}

/* ════════════════════════════════════════════════════════════
   CHAT
════════════════════════════════════════════════════════════ */
function appendMessage(role, content, time) {
  const isUser = role === "user";
  const avatar = isUser ? "👤" : "🥗";
  const ts     = time || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const bubble = isUser
    ? `<div class="msg-bubble">${content.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>`
    : `<div class="msg-bubble">${renderMarkdown(content)}</div>`;

  const html = `
    <div class="chat-msg ${role}">
      <div class="msg-avatar">${avatar}</div>
      <div class="d-flex flex-column gap-1" style="max-width:100%">
        ${bubble}
        <span class="msg-time">${ts}</span>
      </div>
    </div>`;

  chatMessages.insertAdjacentHTML("beforeend", html);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
  const html = `
    <div id="typingIndicator" class="chat-msg assistant typing-indicator">
      <div class="msg-avatar">🥗</div>
      <div class="msg-bubble">
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>`;
  chatMessages.insertAdjacentHTML("beforeend", html);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
  const el = $("typingIndicator");
  if (el) el.remove();
}

async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message || isSending) return;

  isSending = true;
  sendBtn.disabled = true;
  chatInput.value  = "";

  appendMessage("user", message);
  showTypingIndicator();

  try {
    const res  = await fetch("/api/chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ message }),
    });
    const data = await res.json();
    removeTypingIndicator();

    if (data.error) {
      appendMessage("assistant", `❌ Error: ${data.error}`, data.timestamp);
    } else {
      appendMessage("assistant", data.response, data.timestamp);
    }
  } catch (err) {
    removeTypingIndicator();
    appendMessage("assistant", "❌ Network error. Please check your connection and try again.");
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

// Send button
sendBtn.addEventListener("click", sendMessage);

// Enter to send (Shift+Enter = new line)
chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Quick chips
document.querySelectorAll(".chip:not(.food-chip)").forEach(chip => {
  chip.addEventListener("click", () => {
    const msg = chip.dataset.msg;
    if (msg) {
      chatInput.value = msg;
      sendMessage();
    }
  });
});

// Clear chat
clearChatBtn.addEventListener("click", async () => {
  if (!confirm("Clear chat history?")) return;
  try {
    await fetch("/api/clear-chat", { method: "POST" });
    chatMessages.innerHTML = "";
    showWelcome();
    showToast("Chat cleared", "info");
  } catch {
    showToast("Failed to clear chat", "danger");
  }
});

function showWelcome() {
  const greeting = (typeof NG_CONFIG !== "undefined" && NG_CONFIG.greeting)
    ? NG_CONFIG.greeting
    : "Hello! I'm NutriGuide, your AI nutrition coach. How can I help you today?";
  appendMessage("assistant", greeting);
}

/* ════════════════════════════════════════════════════════════
   WATER TRACKER
════════════════════════════════════════════════════════════ */
function initWaterTracker() {
  const container = $("waterGlasses");
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < MAX_WATER; i++) {
    const g = document.createElement("span");
    g.className  = "glass";
    g.textContent = "💧";
    g.title      = `Glass ${i + 1}`;
    g.dataset.idx = i;
    g.addEventListener("click", () => toggleGlass(i));
    container.appendChild(g);
  }
  updateWaterDisplay();
}

function toggleGlass(idx) {
  waterCount = waterCount > idx ? idx : idx + 1;
  updateWaterDisplay();
}

function updateWaterDisplay() {
  const glasses = document.querySelectorAll(".glass");
  glasses.forEach((g, i) => g.classList.toggle("filled", i < waterCount));
  const countEl = $("waterCount");
  if (countEl) countEl.textContent = `${waterCount} / ${MAX_WATER} glasses`;
  if (waterCount === MAX_WATER) showToast("🎉 Daily water goal reached!", "success");
}

/* ════════════════════════════════════════════════════════════
   BMI & TDEE CALCULATOR
════════════════════════════════════════════════════════════ */
bmiForm.addEventListener("submit", async e => {
  e.preventDefault();

  const payload = {
    weight:   parseFloat($("bmiWeight").value),
    height:   parseFloat($("bmiHeight").value),
    age:      parseInt($("bmiAge").value, 10),
    gender:   $("bmiGender").value,
    activity: $("bmiActivity").value,
  };

  try {
    const res  = await fetch("/api/bmi", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.error) { showToast(data.error, "danger"); return; }
    renderBMIResults(data);
  } catch {
    showToast("Calculation failed. Please try again.", "danger");
  }
});

function renderBMIResults(data) {
  $("bmiPlaceholder").classList.add("d-none");
  $("bmiResults").classList.remove("d-none");

  // Gauge
  const bmi        = data.bmi;
  const gaugeValue = $("gaugeValue");
  const gaugeFill  = $("gaugeFill");
  const gaugeLabel = $("gaugeLabel");
  gaugeValue.textContent = bmi;

  // Dash offset: 0 = full arc (283), 283 = empty
  // BMI scale: 15–40 mapped to 0–283
  const pct    = Math.min(Math.max((bmi - 10) / 35, 0), 1);
  const offset = 283 - (pct * 283);
  gaugeFill.style.strokeDashoffset = offset;

  // Category colour
  const catMap = {
    "Underweight":   ["bmi-underweight", "#d97706"],
    "Normal Weight": ["bmi-normal",      "#16a34a"],
    "Overweight":    ["bmi-overweight",  "#ea580c"],
    "Obese":         ["bmi-obese",       "#dc2626"],
  };
  const [cssClass, colour] = catMap[data.category] || ["bmi-normal", "#16a34a"];
  gaugeFill.style.stroke  = colour;

  const catBadge = $("bmiCategory");
  catBadge.className = `bmi-category-badge ${cssClass}`;
  catBadge.textContent = `${data.category} — BMI ${bmi}`;
  $("bmiAdvice").textContent = data.advice;

  // Calorie targets
  $("calLoss").textContent     = data.weight_loss.toLocaleString();
  $("calMaintain").textContent = data.maintenance.toLocaleString();
  $("calGain").textContent     = data.weight_gain.toLocaleString();

  // Macro chart (50% carbs, 25% protein, 25% fat)
  renderMacroChart(data.maintenance);
}

function renderMacroChart(tdee) {
  const macros = [
    { name: "Carbohydrates", pct: 50, g: Math.round((tdee * 0.50) / 4), cls: "bar-carbs"  },
    { name: "Protein",       pct: 25, g: Math.round((tdee * 0.25) / 4), cls: "bar-protein"},
    { name: "Fat",           pct: 25, g: Math.round((tdee * 0.25) / 9), cls: "bar-fat"    },
  ];
  const container = $("macroChart");
  container.innerHTML = macros.map(m => `
    <div class="macro-bar-row">
      <span>${m.name}</span>
      <div class="macro-bar-bg">
        <div class="macro-bar-fill ${m.cls}" style="width:0%" data-target="${m.pct}"></div>
      </div>
      <span class="text-muted">${m.g}g (${m.pct}%)</span>
    </div>`).join("");

  // Animate bars after render
  requestAnimationFrame(() => {
    container.querySelectorAll(".macro-bar-fill").forEach(bar => {
      bar.style.width = bar.dataset.target + "%";
    });
  });
}

/* ════════════════════════════════════════════════════════════
   MEAL PLAN GENERATOR
════════════════════════════════════════════════════════════ */
mpCalories.addEventListener("input", () => {
  mpCalDisplay.textContent = mpCalories.value;
});

mealPlanForm.addEventListener("submit", async e => {
  e.preventDefault();

  const payload = {
    days:               parseInt($("mpDays").value, 10),
    dietary_preference: $("mpDiet").value,
    cuisine:            $("mpCuisine").value,
    calorie_target:     parseInt(mpCalories.value, 10),
    health_goal:        $("mpGoal").value,
    allergies:          $("mpAllergies").value || "none",
  };

  $("mealPlanResult").classList.add("d-none");
  $("mealPlanLoader").classList.remove("d-none");
  $("copyMealPlan").classList.add("d-none");

  try {
    const res  = await fetch("/api/meal-plan", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    $("mealPlanLoader").classList.add("d-none");
    $("mealPlanResult").classList.remove("d-none");

    const output = $("mealPlanResult");
    output.innerHTML = renderMarkdown(data.meal_plan || "No plan generated.");
    $("copyMealPlan").classList.remove("d-none");
    showToast("Meal plan generated!", "success");
  } catch {
    $("mealPlanLoader").classList.add("d-none");
    $("mealPlanResult").classList.remove("d-none");
    $("mealPlanResult").textContent = "Error generating meal plan. Please try again.";
    showToast("Meal plan generation failed", "danger");
  }
});

// Copy meal plan
$("copyMealPlan").addEventListener("click", () => {
  const text = $("mealPlanResult").innerText;
  navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard!", "success"));
});

/* ════════════════════════════════════════════════════════════
   FAMILY PROFILES
════════════════════════════════════════════════════════════ */
async function loadFamilyMembers() {
  try {
    const res  = await fetch("/api/family");
    const data = await res.json();
    renderFamilyMembers(data.members || []);
  } catch {
    showToast("Failed to load family profiles", "danger");
  }
}

function renderFamilyMembers(members) {
  const list = $("familyMembersList");
  const planBtn = $("familyMealPlanBtn");

  if (!members.length) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-people fs-1 text-muted"></i>
        <p class="mt-3 text-muted">Add family members using the form to get personalised family nutrition plans.</p>
      </div>`;
    planBtn.classList.add("d-none");
    return;
  }

  planBtn.classList.remove("d-none");
  list.innerHTML = `<div class="d-flex flex-column gap-3">` +
    members.map(m => `
      <div class="family-card">
        <div class="family-avatar">${m.gender === "female" ? "👩" : "👨"}</div>
        <div class="family-info">
          <div class="family-name">${escHtml(m.name)}</div>
          <div class="family-meta">Age: ${m.age} · ${m.gender} · ${escHtml(m.diet_type)}</div>
          <div class="family-tags">
            ${m.goal       ? `<span class="family-tag">🎯 ${escHtml(m.goal)}</span>` : ""}
            ${m.conditions ? `<span class="family-tag">🏥 ${escHtml(m.conditions)}</span>` : ""}
            ${m.allergies  ? `<span class="family-tag">⚠️ ${escHtml(m.allergies)}</span>` : ""}
          </div>
        </div>
        <div class="d-flex flex-column gap-1">
          <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="editMember('${m.id}')">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger rounded-pill" onclick="deleteMember('${m.id}')">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </div>`).join("") + `</div>`;
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

familyForm.addEventListener("submit", async e => {
  e.preventDefault();

  const payload = {
    id:         $("memberId").value || String(Date.now()),
    name:       $("memberName").value,
    age:        parseInt($("memberAge").value, 10),
    gender:     $("memberGender").value,
    weight:     parseFloat($("memberWeight").value) || 0,
    height:     parseFloat($("memberHeight").value) || 0,
    diet_type:  $("memberDiet").value,
    conditions: $("memberConditions").value,
    allergies:  $("memberAllergies").value,
    goal:       $("memberGoal").value,
  };

  try {
    const res  = await fetch("/api/family", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      showToast(`${payload.name} saved!`, "success");
      familyForm.reset();
      $("memberId").value = "";
      loadFamilyMembers();
    }
  } catch {
    showToast("Failed to save member", "danger");
  }
});

window.deleteMember = async (id) => {
  if (!confirm("Remove this family member?")) return;
  try {
    await fetch("/api/family", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id }),
    });
    showToast("Member removed", "info");
    loadFamilyMembers();
  } catch {
    showToast("Delete failed", "danger");
  }
};

window.editMember = async (id) => {
  try {
    const res  = await fetch("/api/family");
    const data = await res.json();
    const m    = (data.members || []).find(x => x.id === id);
    if (!m) return;
    $("memberId").value        = m.id;
    $("memberName").value      = m.name;
    $("memberAge").value       = m.age;
    $("memberGender").value    = m.gender;
    $("memberWeight").value    = m.weight;
    $("memberHeight").value    = m.height;
    $("memberDiet").value      = m.diet_type;
    $("memberConditions").value = m.conditions;
    $("memberAllergies").value = m.allergies;
    $("memberGoal").value      = m.goal;
    $("memberName").focus();
    showToast("Edit member details and save", "info");
  } catch {
    showToast("Could not load member data", "danger");
  }
};

// Family meal plan button — switches to meal plan tab pre-configured
$("familyMealPlanBtn").addEventListener("click", () => {
  activateTab("meal-plan");
  showToast("Family profiles loaded — generate your plan!", "info");
});

/* ════════════════════════════════════════════════════════════
   FOOD NUTRITION LOOKUP
════════════════════════════════════════════════════════════ */
async function lookupFood(foodItem) {
  $("nutritionResult").classList.add("d-none");
  $("nutritionLoader").classList.remove("d-none");

  try {
    const res  = await fetch("/api/nutrition-info", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ food: foodItem }),
    });
    const data = await res.json();
    $("nutritionLoader").classList.add("d-none");
    $("nutritionResult").classList.remove("d-none");

    if (data.error) {
      $("nutritionResult").textContent = data.error;
    } else {
      $("nutritionResult").innerHTML =
        `<div class="nutrition-result-text">${renderMarkdown(data.info)}</div>`;
    }
  } catch {
    $("nutritionLoader").classList.add("d-none");
    $("nutritionResult").classList.remove("d-none");
    $("nutritionResult").textContent = "Error fetching nutrition info. Please try again.";
    showToast("Nutrition lookup failed", "danger");
  }
}

nutritionForm.addEventListener("submit", e => {
  e.preventDefault();
  lookupFood($("foodInput").value.trim());
});

// Food quick chips
document.querySelectorAll(".food-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const food = chip.dataset.food;
    $("foodInput").value = food;
    lookupFood(food);
  });
});

/* ════════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initWaterTracker();
  showWelcome();
  checkStatus();
  loadFamilyMembers();

  // Auto-focus chat input on load
  if (chatInput) chatInput.focus();

  // Mobile: collapse navbar on outside click
  document.addEventListener("click", e => {
    const nav     = document.getElementById("mainNav");
    const toggler = document.querySelector(".navbar-toggler");
    if (nav && nav.classList.contains("show") &&
        !nav.contains(e.target) && !toggler.contains(e.target)) {
      toggler.click();
    }
  });
});
