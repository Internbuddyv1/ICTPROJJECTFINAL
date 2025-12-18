/* ============================================
   SESSION, ROLES, PROGRESS & NAVIGATION LOGIC
   ============================================ */

/*
  Users are now authenticated via the backend + database.
  We still keep a lightweight org directory (without passwords) for dashboards/teams.
*/
const ORG_USERS = [
  { id:"u_emp_001", email:"employee@demo.com", name:"John Doe",     role:"employee", teamId:"team_eng", managerId:"u_mgr_001" },
  { id:"u_emp_002", email:"lee@demo.com",      name:"Lee Wong",     role:"employee", teamId:"team_eng", managerId:"u_mgr_001" },
  { id:"u_emp_003", email:"maria@demo.com",    name:"Maria Silva",  role:"employee", teamId:"team_eng", managerId:"u_mgr_001" },
  { id:"u_mgr_001", email:"manager@demo.com",  name:"Alicia Patel", role:"manager",  teamId:"team_eng" },
  { id:"u_hr_001",  email:"hr@demo.com",       name:"Sara Ahmed",   role:"hr" },
  { id:"u_ind_001", email:"learner@demo.com",  name:"Alex Jordan",  role:"individual" }
];

const SCENARIOS = [
  { id:"recruitment",        title:"Recruitment Interview – Windrush Descendant Candidate", durationMins:15, perspectives:3 },
  { id:"first-day",          title:"First Day on the Trading Floor",                        durationMins:10, perspectives:2 },
  { id:"performance-review", title:"Performance Review Conversation",                       durationMins:12, perspectives:3 },
  { id:"cross-cultural",     title:"Cross-Cultural Client Meeting",                         durationMins:10, perspectives:2 }
];

const ROLE_ROUTES = {
  employee:   "index.html",
  manager:    "manager-dashboard.html",
  hr:         "hr-dashboard.html",
  individual: "dashboard-individual.html"
};

/* ========== SESSION HELPERS ========== */
function setSession(user){ localStorage.setItem("tp_user", JSON.stringify(user)); }
function getSession(){
  try { const raw = localStorage.getItem("tp_user"); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function clearSession(){ localStorage.removeItem("tp_user"); }

/* ========== PROGRESS STORAGE ========== */
const PROGRESS_KEY = "tp_progress";

function _loadProgress(){
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}"); }
  catch { return {}; }
}
function _saveProgress(all){ localStorage.setItem(PROGRESS_KEY, JSON.stringify(all)); }

function _ensureUserProgress(email){
  const all = _loadProgress();
  if(!all[email]){
    const scenarios = {};
    SCENARIOS.forEach(s => {
      scenarios[s.id] = { status:"not_started", progressPct:0, lastUpdated:new Date().toISOString() };
    });
    all[email] = { scenarios };
    _saveProgress(all);
  }
  return all;
}
function getUserProgress(email){ return _ensureUserProgress(email)[email]; }

function setUserScenarioProgress(email, scenarioId, updates){
  const all = _ensureUserProgress(email);
  const entry = all[email].scenarios[scenarioId] || { status:"not_started", progressPct:0 };
  all[email].scenarios[scenarioId] = {
    ...entry,
    ...updates,
    lastUpdated: new Date().toISOString()
  };
  _saveProgress(all);
}

function markScenarioInProgress(email, scenarioId, pct=40){
  setUserScenarioProgress(email, scenarioId, {
    status: "in_progress",
    progressPct: Math.max(pct, 1)
  });
}

function markScenarioComplete(email, scenarioId){
  setUserScenarioProgress(email, scenarioId, {
    status: "complete",
    progressPct: 100
  });
}

function setSelectedChoice(email, scenarioId, choiceKey){
  setUserScenarioProgress(email, scenarioId, { selectedChoice: choiceKey });
}

/* ========== AGGREGATES (ORG) ========== */
function getCompletionStats(){
  const employees = ORG_USERS.filter(u => u.role === "employee");
  const all = _loadProgress();
  let enrolled = employees.length, completedAll = 0, inProgress = 0, notStarted = 0;

  employees.forEach(u => {
    const p = all[u.email] || null;
    if(!p){ notStarted++; return; }
    const statuses = Object.values(p.scenarios).map(s => s.status);
    if(statuses.every(s => s === "complete")) completedAll++;
    else if(statuses.some(s => s === "in_progress" || s === "complete")) inProgress++;
    else notStarted++;
  });

  return {
    enrolled,
    completedAll,
    inProgress,
    notStarted,
    completionPct: Math.round((completedAll / Math.max(enrolled, 1)) * 100)
  };
}

function getTeamStats(managerId){
  const team = ORG_USERS.filter(u => u.role === "employee" && u.managerId === managerId);
  const all = _loadProgress();
  return team.map(u => {
    const p = all[u.email] || null;
    const statuses = p ? Object.values(p.scenarios).map(s => s.status) : [];
    const completed = p ? Object.values(p.scenarios).filter(s => s.status === "complete").length : 0;
    const pct = Math.round((completed / SCENARIOS.length) * 100);
    let state = "Not started";
    if(statuses.length && statuses.some(s => s === "in_progress" || s === "complete")) state = "In progress";
    if(statuses.length && statuses.every(s => s === "complete")) state = "Completed";
    return { user:u, pct, state };
  });
}

/* ========== ACCESS CONTROL ========== */
function requireRole(allowedRoles){
  const user = getSession();
  if(!user){
    window.location.href = "login-company.html?reason=unauthenticated";
    return;
  }
  if(!allowedRoles.includes(user.role)){
    window.location.href = "login-company.html?reason=unauthorized";
    return;
  }
  if(user.role === "employee" || user.role === "individual"){
    _ensureUserProgress(user.email);
  }
}

/* ========== UI HELPERS ========== */
function populateUserName(){
  const user = getSession();
  document.querySelectorAll("[data-user-name]").forEach(el => {
    if(user) el.textContent = user.role === "individual"
      ? `${user.name}`
      : `${user.name} (${user.role.toUpperCase()})`;
  });
}

/* Make logo clickable: dashboard if logged in, onboarding if not */
function initLogoNavigation(){
  document.querySelectorAll(".logo").forEach(el => {
    el.style.cursor = "pointer";
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const user = getSession();
      if(user && ROLE_ROUTES[user.role]){
        window.location.href = ROLE_ROUTES[user.role];
      } else {
        window.location.href = "onboarding.html";
      }
    });
  });
}

/* ========== AUTH (BACKEND) HELPERS ========== */
async function apiRequest(path, { method="GET", body=null } = {}){
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try { data = await res.json(); } catch { data = null; }

  if(!res.ok){
    const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function apiLogin({ email, password, role }){
  return apiRequest("/api/login", { method: "POST", body: { email, password, role } });
}

async function apiRegister({ email, password, fullName, role }){
  return apiRequest("/api/register", { method: "POST", body: { email, password, fullName, role } });
}

/* ---- Company login (employee / manager / hr) ---- */
function initCompanyLoginPage(){
  const roleCards = document.querySelectorAll(".role-card");
  const formTitle = document.getElementById("companyLoginTitle");
  const loginForm = document.getElementById("companyLoginForm");
  const acceptTerms = document.getElementById("companyAcceptTerms");
  const loginMessage = document.getElementById("companyLoginMessage");

  // If already logged in, go straight to dashboard
  const existing = getSession();
  if(existing && existing.role !== "individual"){
    window.location.href = ROLE_ROUTES[existing.role] || "index.html";
    return;
  }

  let selectedRole = "employee";
  const titles = {
    employee: "Employee login",
    manager:  "Manager login",
    hr:       "HR login"
  };

  roleCards.forEach(card => {
    card.addEventListener("click", () => {
      roleCards.forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      selectedRole = card.getAttribute("data-role");
      formTitle.textContent = titles[selectedRole] || "Login";
      loginMessage.textContent = "";
      card.setAttribute("aria-pressed","true");
      roleCards.forEach(c => { if(c !== card) c.setAttribute("aria-pressed","false"); });
    });
    card.addEventListener("keydown", (e) => {
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        card.click();
      }
    });
  });

  const params = new URLSearchParams(location.search);
  const reason = params.get("reason");
  if(reason === "unauthenticated"){
    loginMessage.textContent = "Please log in to continue.";
    loginMessage.style.color = "red";
  } else if(reason === "unauthorized"){
    loginMessage.textContent = "You do not have access to that area with this role.";
    loginMessage.style.color = "red";
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    loginMessage.textContent = "";
    loginMessage.style.color = "red";

    if(!acceptTerms.checked){
      loginMessage.textContent = "Please agree to the Terms & Conditions before logging in.";
      return;
    }

    const email = document.getElementById("companyEmail").value.trim();
    const password = document.getElementById("companyPassword").value;

    (async () => {
      try {
        const account = await apiLogin({ email, password, role: selectedRole });
        setSession(account);
        if(account.role === "employee") _ensureUserProgress(account.email);
        loginMessage.style.color = "green";
        loginMessage.textContent = "Login successful. Redirecting…";
        setTimeout(() => {
          window.location.href = ROLE_ROUTES[account.role] || "index.html";
        }, 250);
      } catch(err){
        loginMessage.textContent = err?.message || "Invalid credentials.";
      }
    })();
  });
}

/* ---- Individual login ---- */
function initIndividualLoginPage(){
  const loginForm = document.getElementById("individualLoginForm");
  const loginMessage = document.getElementById("individualLoginMessage");
  const acceptTerms = document.getElementById("individualAcceptTerms");

  const existing = getSession();
  if(existing && existing.role === "individual"){
    window.location.href = ROLE_ROUTES.individual;
    return;
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    loginMessage.textContent = "";
    loginMessage.style.color = "red";

    if(!acceptTerms.checked){
      loginMessage.textContent = "Please agree to the Terms & Conditions before logging in.";
      return;
    }

    const email = document.getElementById("individualEmail").value.trim();
    const password = document.getElementById("individualPassword").value;

    (async () => {
      try {
        const account = await apiLogin({ email, password, role: "individual" });
        setSession(account);
        _ensureUserProgress(account.email);
        loginMessage.style.color = "green";
        loginMessage.textContent = "Login successful. Redirecting…";
        setTimeout(() => {
          window.location.href = ROLE_ROUTES.individual;
        }, 250);
      } catch(err){
        loginMessage.textContent = err?.message || "Invalid credentials.";
      }
    })();
  });
}

/* ---- Individual create account ---- */
function initCreateAccountIndividualPage(){
  const form = document.getElementById("soloCreateForm");
  const msg = document.getElementById("soloCreateMessage");
  if(!form) return;

  // If already logged in as an individual, go to dashboard
  const existing = getSession();
  if(existing && existing.role === "individual"){
    window.location.href = ROLE_ROUTES.individual;
    return;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if(msg){ msg.textContent = ""; msg.style.color = "red"; }

    const fullName = document.getElementById("soloName")?.value?.trim();
    const email = document.getElementById("soloCreateEmail")?.value?.trim();
    const password = document.getElementById("soloCreatePassword")?.value;

    (async () => {
      try {
        await apiRegister({ email, password, fullName, role: "individual" });
        const account = await apiLogin({ email, password, role: "individual" });
        setSession(account);
        _ensureUserProgress(account.email);
        if(msg){ msg.style.color = "green"; msg.textContent = "Account created. Redirecting…"; }
        setTimeout(() => {
          window.location.href = ROLE_ROUTES.individual;
        }, 250);
      } catch(err){
        if(msg) msg.textContent = err?.message || "Could not create account.";
      }
    })();
  });
}

/* ========== MANAGER EMAIL HELPERS (unchanged) ========== */
function getTeamEmailSummary(manager){
  const rows = getTeamStats(manager.id);
  const lines = rows.map(r => `${r.user.name}: ${r.pct}% (${r.state})`);
  const pending = rows
    .filter(r => r.state !== "Completed")
    .map(r => r.user.name)
    .join(", ") || "None – all complete 🎉";
  return { lines, pending };
}

function composeTeamReminderMailto(manager){
  const { lines, pending } = getTeamEmailSummary(manager);
  const subject = encodeURIComponent(`Training reminder – ${manager.name}'s team`);
  const body = encodeURIComponent(`Hi team,

This is a reminder to complete the DEI scenarios.

Team status:
${lines.join("\n")}

Not yet complete: ${pending}

Thanks,
${manager.name}`);
  const to = "Kleviszaimi73@gmail.com";
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

/* ========== GENERIC BUTTON ACTIONS ========== */
async function copyProfessionalEmailToClipboard(manager){
  const { lines, pending } = getTeamEmailSummary(manager);
  const logoURL = "https://dummyimage.com/180x36/1f4f9c/ffffff&text=TRADING+PLACES";
  const now = new Date().toLocaleString();

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:2px solid #0f172a;border-radius:12px;box-shadow:0 4px 14px rgba(15,23,42,0.08);">
<tr><td style="padding:16px 24px;border-bottom:2px solid #0f172a;">
<img src="${logoURL}" alt="Trading Places" width="180" height="36" style="display:block"/>
<div style="font-size:18px;font-weight:bold;margin-top:8px;">Team Training Reminder</div>
<div style="font-size:12px;color:#64748b;">${now}</div>
</td></tr>
<tr><td style="padding:20px 24px;">
<p style="margin:0 0 12px 0;">Hi team,</p>
<p style="margin:0 0 12px 0;">This is a friendly reminder to complete the mandatory DEI scenarios in <strong>Trading Places</strong>.</p>
<p style="margin:0 0 8px 0;font-weight:bold;">Current team status</p>
<ul style="margin:0 0 12px 20px;padding:0;">${lines.map(l => `<li style="margin:4px 0;">${l}</li>`).join("")}</ul>
<p style="margin:0 0 12px 0;"><strong>Not yet complete:</strong> ${pending}</p>
<p style="margin:0 0 16px 0;">If you have any issues accessing a scenario, please reply to this email.</p>
<p style="margin:0;">Thanks,<br/>${manager.name}</p>
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #cbd5e1;font-size:12px;color:#64748b;">Trading Places • Culture Pulse Prototype • For demo use only</td></tr>
</table>
</td></tr></table></body></html>`;

  try{
    const item = new ClipboardItem({
      "text/html": new Blob([html], {type:"text/html"}),
      "text/plain": new Blob([html.replace(/<[^>]+>/g,"")], {type:"text/plain"})
    });
    await navigator.clipboard.write([item]);
    alert("Professional HTML email copied. Your email client will open next — paste into the body.");
  }catch(e){
    console.warn("Clipboard API failed; fallback prompt.", e);
    prompt("Copy the HTML below into your email client:", html);
  }
}

function initPrototypeButtons(){
  document.querySelectorAll("[data-action]").forEach(el => {
    el.addEventListener("click", async (e) => {
      const action = el.getAttribute("data-action");
      if(!action) return;
      if(el.tagName === "A" && el.getAttribute("href") === "#") e.preventDefault();

      switch(action){
        case "logout":
          clearSession();
          window.location.href = "onboarding.html";
          break;

        case "send-team-reminder": {
          const user = getSession();
          if(!user || user.role !== "manager"){
            alert("Only managers can send team reminders.");
            return;
          }
          window.location.href = composeTeamReminderMailto(user);
          break;
        }

        case "copy-professional-email": {
          const user = getSession();
          if(!user || user.role !== "manager"){
            alert("Only managers can use this action.");
            return;
          }
          await copyProfessionalEmailToClipboard(user);
          window.location.href = composeTeamReminderMailto(user);
          break;
        }

        case "print-report":
          window.print();
          break;

        case "complete-current-scenario": {
          const user = getSession(); if(!user) return;
          const sid = el.getAttribute("data-scenario-id") ||
                      new URLSearchParams(location.search).get("sid") ||
                      "recruitment";
          markScenarioComplete(user.email, sid);
          window.location.href = `scenario-results.html?sid=${encodeURIComponent(sid)}`;
          break;
        }

        case "forgot-password":
          alert("This is a prototype. In a live system, this would start the password reset process.");
          break;

        case "create-account":
          // Keep UI the same, but make the existing button functional.
          window.location.href = "create-account-individual.html";
          break;

        case "start-individual-scenario": {
          const user = getSession();
          if(!user || user.role !== "individual"){
            alert("Please log in as an individual learner first.");
            window.location.href = "login-individual.html";
            return;
          }
          const sid = el.getAttribute("data-sid") || "recruitment";
          markScenarioInProgress(user.email, sid, 40);
          window.location.href = `scenario-training.html?sid=${encodeURIComponent(sid)}`;
          break;
        }

        case "save-individual-notes": {
          const user = getSession();
          const textarea = document.getElementById("individualExtraTraining");
          if(user && textarea){
            localStorage.setItem(`tp_individual_notes_${user.email}`, textarea.value || "");
            alert("Notes saved locally.");
          }
          break;
        }

        default:
          break;
      }
    });
  });
}

/* ========== SCENARIO CHOICE INTERACTIONS ========== */
function initScenarioChoiceInteractions(sid){
  const user = getSession(); if(!user) return;
  const group = document.getElementById("choiceGroup");
  if(!group) return;

  const radios = [...group.querySelectorAll('[role="radio"]')];
  const status = document.getElementById("sc-status");
  const confirm = document.getElementById("confirmChoiceBtn");

  function announce(msg){ if(status) status.textContent = msg; }

  function selectRadio(el){
    radios.forEach(r => {
      r.setAttribute("aria-checked","false");
      r.classList.remove("is-selected");
      r.tabIndex = -1;
    });
    el.setAttribute("aria-checked","true");
    el.classList.add("is-selected");
    el.tabIndex = 0;
    el.focus({preventScroll:true});
    const choiceKey = el.getAttribute("data-choice-key");
    setSelectedChoice(user.email, sid, choiceKey);
    if(confirm){
      confirm.disabled = false;
      confirm.setAttribute("aria-disabled","false");
    }
    announce(`Selected option ${choiceKey}.`);
  }

  radios.forEach(r => {
    r.addEventListener("click", () => selectRadio(r));
    r.addEventListener("keydown", (e) => {
      const idx = radios.indexOf(r);
      if(e.key === " " || e.key === "Enter"){
        e.preventDefault();
        selectRadio(r);
      } else if(e.key === "ArrowDown" || e.key === "ArrowRight"){
        e.preventDefault();
        const next = radios[Math.min(idx+1, radios.length-1)];
        next && next.focus();
      } else if(e.key === "ArrowUp" || e.key === "ArrowLeft"){
        e.preventDefault();
        const prev = radios[Math.max(idx-1, 0)];
        prev && prev.focus();
      }
    });
  });

  if(radios[0]) radios[0].tabIndex = 0;

  const prog = getUserProgress(user.email).scenarios[sid];
  if(prog && prog.selectedChoice){
    const pre = radios.find(r => r.getAttribute("data-choice-key") === prog.selectedChoice);
    if(pre) selectRadio(pre);
  } else if(confirm){
    confirm.disabled = true;
    confirm.setAttribute("aria-disabled","true");
  }
}

/* ========== PAGE HYDRATION ========== */
function hydrateEmployeeDashboard(){
  const user = getSession(); if(!user) return;
  const prog = getUserProgress(user.email);
  const completed = Object.values(prog.scenarios).filter(s => s.status === "complete").length;
  const total = SCENARIOS.length;
  const pct = Math.round((completed / total) * 100);

  const subtitle = document.getElementById("emp-subtitle");
  const pctLabel = document.getElementById("emp-pct-label");
  const pctBar   = document.getElementById("emp-pct-bar");
  const compSpan = document.getElementById("emp-completed");
  if(subtitle) subtitle.innerHTML = `You have completed <strong>${completed} of ${total}</strong> scenarios`;
  if(pctLabel) pctLabel.textContent = `${pct}% complete`;
  if(pctBar)   pctBar.style.width = `${pct}%`;
  if(compSpan) compSpan.textContent = String(completed);

  SCENARIOS.forEach(s => {
    const badge = document.querySelector(`[data-scenario-badge="${s.id}"]`);
    if(!badge) return;
    const sProg = prog.scenarios[s.id];
    badge.textContent =
      sProg.status === "complete"   ? "Completed" :
      sProg.status === "in_progress" ? "In Progress" :
      "Not Started";
  });
}

function hydrateManagerDashboard(){
  const user = getSession(); if(!user) return;
  const rows = getTeamStats(user.id);
  const tbody = document.getElementById("mgr-team-body"); if(!tbody) return;
  tbody.innerHTML = "";
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.user.name}</td>
      <td>${r.pct}%</td>
      <td>${r.state}</td>
      <td>
        <button type="button" class="btn-small btn-secondary" data-action="send-team-reminder">Email team</button>
        <button type="button" class="btn-small btn-ghost" data-action="copy-professional-email">Copy pro email</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function hydrateHRDashboard(){
  const stats = getCompletionStats();
  const q = (s) => document.querySelector(s);
  q("[data-stat='enrolled']")        && (q("[data-stat='enrolled']").textContent        = String(stats.enrolled));
  q("[data-stat='completedAll']")    && (q("[data-stat='completedAll']").textContent    = String(stats.completedAll));
  q("[data-stat='inProgress']")      && (q("[data-stat='inProgress']").textContent      = String(stats.inProgress));
  q("[data-stat='notStarted']")      && (q("[data-stat='notStarted']").textContent      = String(stats.notStarted));
  q("[data-stat='completionPctLabel']") && (q("[data-stat='completionPctLabel']").textContent = `${stats.completionPct}%`);
  q("[data-stat='completionPctBar']")   && (q("[data-stat='completionPctBar']").style.width   = `${stats.completionPct}%`);
}

function hydrateScenarioTraining(){
  const u = getSession(); if(!u) return;
  const sid = new URLSearchParams(location.search).get("sid") || "recruitment";
  markScenarioInProgress(u.email, sid, 40);
  const s = SCENARIOS.find(x => x.id === sid) || SCENARIOS[0];

  const titleEl   = document.getElementById("sc-title");
  const durEl     = document.getElementById("sc-duration");
  const perEl     = document.getElementById("sc-perspectives");
  const headerBar = document.getElementById("sc-header-progress");

  if(titleEl)   titleEl.textContent = s.title;
  if(durEl)     durEl.textContent   = `${s.durationMins} mins`;
  if(perEl)     perEl.textContent   = `${s.perspectives}`;
  if(headerBar) headerBar.style.width = "40%";

  const confirmBtn = document.getElementById("confirmChoiceBtn");
  if(confirmBtn) confirmBtn.setAttribute("data-scenario-id", s.id);

  initScenarioChoiceInteractions(s.id);
}

function hydrateScenarioResults(){
  const u = getSession(); if(!u) return;
  const sid = new URLSearchParams(location.search).get("sid") || "recruitment";
  const s = SCENARIOS.find(x => x.id === sid) || SCENARIOS[0];
  const prog = getUserProgress(u.email).scenarios[s.id];

  const titleEl = document.getElementById("res-title");
  const statusEl = document.getElementById("res-status");
  const durEl = document.getElementById("res-duration");
  const perEl = document.getElementById("res-perspectives");
  const pctEl = document.getElementById("res-pct");

  if(titleEl)  titleEl.textContent = s.title;
  if(durEl)    durEl.textContent   = `${s.durationMins} mins`;
  if(perEl)    perEl.textContent   = `${s.perspectives}`;
  if(pctEl)    pctEl.textContent   = `${prog.progressPct}%`;
  if(statusEl) statusEl.textContent = prog.status === "complete" ? "Completed" : "In Progress";
}

/* Individual dashboard hydration */
function hydrateIndividualDashboard(){
  const user = getSession(); if(!user) return;
  const prog = getUserProgress(user.email);
  const scenariosToTrack = ["recruitment","first-day","cross-cultural"];
  const relevant = scenariosToTrack.map(id => prog.scenarios[id] || {status:"not_started",progressPct:0});
  const completed = relevant.filter(s => s.status === "complete").length;
  const total = relevant.length;
  const pct = Math.round((completed / Math.max(total,1)) * 100);

  const completedEl = document.getElementById("ind-completed");
  const pctLabel1   = document.getElementById("ind-pct-label");
  const pctLabel2   = document.getElementById("ind-pct-label2");
  const pctBar      = document.getElementById("ind-pct-bar");

  if(completedEl) completedEl.textContent = String(completed);
  if(pctLabel1)   pctLabel1.textContent   = `${pct}%`;
  if(pctLabel2)   pctLabel2.textContent   = `${pct}%`;
  if(pctBar)      pctBar.style.width      = `${pct}%`;

  const textarea = document.getElementById("individualExtraTraining");
  if(textarea){
    const saved = localStorage.getItem(`tp_individual_notes_${user.email}`);
    if(saved) textarea.value = saved;
  }
}

/* Onboarding logic */
function initOnboardingPage(){
  const form = document.getElementById("onboardingForm");
  if(!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const prefs = {
      highContrast: !!document.getElementById("prefHighContrast")?.checked,
      dyslexia:     !!document.getElementById("prefDyslexia")?.checked,
      keyboard:     !!document.getElementById("prefKeyboard")?.checked
    };
    localStorage.setItem("tp_accessibility_prefs", JSON.stringify(prefs));

    const modeInput = form.elements["accountMode"];
    let selected = "company";
    if(modeInput){
      if(modeInput.length){
        for(const r of modeInput){
          if(r.checked) { selected = r.value; break; }
        }
      } else {
        if(modeInput.checked) selected = modeInput.value;
      }
    }
    if(selected === "individual"){
      window.location.href = "login-individual.html";
    } else {
      window.location.href = "login-company.html";
    }
  });
}

/* ========== ROUTER ========== */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  const skip = document.getElementById("skip-to-content");
  if(skip){
    skip.addEventListener("click", () => {
      const main = document.querySelector("main");
      if(main){
        main.setAttribute("tabindex","-1");
        main.focus();
      }
    });
  }

  initLogoNavigation();
  initPrototypeButtons();
  populateUserName();

  switch(page){
    case "onboarding":
      initOnboardingPage();
      break;

    case "login-company":
      initCompanyLoginPage();
      break;

    case "login-individual":
      initIndividualLoginPage();
      break;

    case "create-account-individual":
      initCreateAccountIndividualPage();
      break;

    case "employee-dashboard":
      requireRole(["employee"]);
      hydrateEmployeeDashboard();
      break;

    case "manager-dashboard":
      requireRole(["manager"]);
      hydrateManagerDashboard();
      break;

    case "hr-dashboard":
      requireRole(["hr"]);
      hydrateHRDashboard();
      break;

    case "scenario-training":
      requireRole(["employee","individual"]);
      hydrateScenarioTraining();
      break;

    case "scenario-results":
      requireRole(["employee","individual"]);
      hydrateScenarioResults();
      break;

    case "settings-privacy":
      requireRole(["employee","manager","hr","individual"]);
      break;

    case "culture-report":
      requireRole(["manager","hr"]);
      break;

    case "individual-dashboard":
      requireRole(["individual"]);
      hydrateIndividualDashboard();
      break;

    default:
      break;
  }
});
