/* ============================================
   CONFIG
   ============================================ */

// ✅ Railway backend (PUBLIC API)
const API_BASE = "https://ictprojjectfinal-production.up.railway.app";

/* ============================================
   FORCE ONBOARDING (DEMO-SAFE)
   ============================================ */
(function () {
  const path = location.pathname;
  const isRoot = path === "/" || path.endsWith("index.html");
  const isOnboarding = path.endsWith("onboarding.html");

  // Always force clean start when landing
  if (isRoot || isOnboarding) {
    localStorage.removeItem("tp_user");
    if (!isOnboarding) {
      location.replace("onboarding.html");
    }
  }
})();

/* ============================================
   SESSION HELPERS
   ============================================ */
function setSession(user) {
  localStorage.setItem("tp_user", JSON.stringify(user));
}
function getSession() {
  try {
    return JSON.parse(localStorage.getItem("tp_user"));
  } catch {
    return null;
  }
}
function clearSession() {
  localStorage.removeItem("tp_user");
}

/* ============================================
   API HELPERS
   ============================================ */
async function apiRequest(path, { method = "GET", body = null } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

const apiRegister = (payload) =>
  apiRequest("/api/register", { method: "POST", body: payload });

const apiLogin = (payload) =>
  apiRequest("/api/login", { method: "POST", body: payload });

/* ============================================
   CREATE ACCOUNT — INDIVIDUAL
   ============================================ */
function initCreateAccountIndividual() {
  const form = document.getElementById("soloCreateForm");
  const msg = document.getElementById("soloCreateMessage");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    try {
      const fullName = document.getElementById("soloName").value.trim();
      const email = document.getElementById("soloCreateEmail").value.trim();
      const password = document.getElementById("soloCreatePassword").value;

      await apiRegister({ email, password, fullName, role: "individual" });
      const user = await apiLogin({ email, password, role: "individual" });

      setSession(user);
      msg.style.color = "green";
      msg.textContent = "Account created. Redirecting…";
      setTimeout(() => {
        location.href = "dashboard-individual.html";
      }, 300);
    } catch (err) {
      msg.style.color = "red";
      msg.textContent = err.message;
    }
  });
}

/* ============================================
   CREATE ACCOUNT — COMPANY
   ============================================ */
function initCreateAccountCompany() {
  const form = document.getElementById("companyCreateForm");
  const msg = document.getElementById("companyCreateMessage");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    try {
      const fullName = document.getElementById("companyFullName").value.trim();
      const email = document.getElementById("companyCreateEmail").value.trim();
      const password = document.getElementById("companyCreatePassword").value;
      const role = document.getElementById("companyRole").value;

      await apiRegister({ email, password, fullName, role });
      const user = await apiLogin({ email, password, role });

      setSession(user);
      msg.style.color = "green";
      msg.textContent = "Account created. Redirecting…";
      setTimeout(() => {
        location.href = "index.html";
      }, 300);
    } catch (err) {
      msg.style.color = "red";
      msg.textContent = err.message;
    }
  });
}

/* ============================================
   LOGIN — COMPANY
   ============================================ */
function initCompanyLogin() {
  const form = document.getElementById("companyLoginForm");
  const msg = document.getElementById("companyLoginMessage");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    try {
      const email = document.getElementById("companyEmail").value.trim();
      const password = document.getElementById("companyPassword").value;
      const role =
        document.querySelector(".role-card.active")?.dataset.role ||
        "employee";

      const user = await apiLogin({ email, password, role });
      setSession(user);

      msg.style.color = "green";
      msg.textContent = "Login successful. Redirecting…";
      setTimeout(() => {
        location.href = "index.html";
      }, 300);
    } catch (err) {
      msg.style.color = "red";
      msg.textContent = err.message;
    }
  });
}

/* ============================================
   LOGIN — INDIVIDUAL
   ============================================ */
function initIndividualLogin() {
  const form = document.getElementById("individualLoginForm");
  const msg = document.getElementById("individualLoginMessage");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    try {
      const email = document.getElementById("individualEmail").value.trim();
      const password = document.getElementById("individualPassword").value;

      const user = await apiLogin({ email, password, role: "individual" });
      setSession(user);

      msg.style.color = "green";
      msg.textContent = "Login successful. Redirecting…";
      setTimeout(() => {
        location.href = "dashboard-individual.html";
      }, 300);
    } catch (err) {
      msg.style.color = "red";
      msg.textContent = err.message;
    }
  });
}

/* ============================================
   PAGE ROUTER
   ============================================ */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if (page === "create-account-individual") initCreateAccountIndividual();
  if (page === "create-account-company") initCreateAccountCompany();
  if (page === "login-company") initCompanyLogin();
  if (page === "login-individual") initIndividualLogin();
});
