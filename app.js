/* ============================================
   GLOBAL CONFIG (FIXES 405 PERMANENTLY)
   ============================================ */

// 🔴 HARD-CODED BACKEND URL (PUBLIC RAILWAY DOMAIN)
const API_BASE = "https://ictprojjectfinal-production.up.railway.app";

/* ============================================
   SESSION & NAVIGATION
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

const ROLE_ROUTES = {
  employee: "index.html",
  manager: "manager-dashboard.html",
  hr: "hr-dashboard.html",
  individual: "dashboard-individual.html",
};

/* ============================================
   API HELPERS
   ============================================ */

async function apiRequest(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }

  return data;
}

function apiRegister(payload) {
  return apiRequest("/api/register", { method: "POST", body: payload });
}

function apiLogin(payload) {
  return apiRequest("/api/login", { method: "POST", body: payload });
}

/* ============================================
   CREATE ACCOUNT – INDIVIDUAL
   ============================================ */

function initCreateAccountIndividualPage() {
  const form = document.getElementById("soloCreateForm");
  const msg = document.getElementById("soloCreateMessage");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    const fullName = document.getElementById("soloName").value.trim();
    const email = document.getElementById("soloCreateEmail").value.trim();
    const password = document.getElementById("soloCreatePassword").value;

    try {
      await apiRegister({
        email,
        password,
        fullName,
        role: "individual",
      });

      const account = await apiLogin({
        email,
        password,
        role: "individual",
      });

      setSession(account);
      msg.style.color = "green";
      msg.textContent = "Account created. Redirecting…";

      setTimeout(() => {
        window.location.href = ROLE_ROUTES.individual;
      }, 300);
    } catch (err) {
      msg.style.color = "red";
      msg.textContent = err.message;
    }
  });
}

/* ============================================
   CREATE ACCOUNT – COMPANY
   ============================================ */

function initCreateAccountCompanyPage() {
  const form = document.getElementById("companyCreateForm");
  const msg = document.getElementById("companyCreateMessage");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    const fullName = document.getElementById("companyFullName").value.trim();
    const email = document.getElementById("companyCreateEmail").value.trim();
    const password = document.getElementById("companyCreatePassword").value;
    const role = document.getElementById("companyRole").value;

    try {
      await apiRegister({
        email,
        password,
        fullName,
        role,
      });

      const account = await apiLogin({ email, password, role });
      setSession(account);

      msg.style.color = "green";
      msg.textContent = "Account created. Redirecting…";

      setTimeout(() => {
        window.location.href = ROLE_ROUTES[account.role];
      }, 300);
    } catch (err) {
      msg.style.color = "red";
      msg.textContent = err.message;
    }
  });
}

/* ============================================
   LOGIN – COMPANY
   ============================================ */

function initCompanyLoginPage() {
  const form = document.getElementById("companyLoginForm");
  const msg = document.getElementById("companyLoginMessage");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    const email = document.getElementById("companyEmail").value.trim();
    const password = document.getElementById("companyPassword").value;
    const role =
      document.querySelector(".role-card.active")?.dataset.role || "employee";

    try {
      const account = await apiLogin({ email, password, role });
      setSession(account);

      msg.style.color = "green";
      msg.textContent = "Login successful. Redirecting…";

      setTimeout(() => {
        window.location.href = ROLE_ROUTES[account.role];
      }, 300);
    } catch (err) {
      msg.style.color = "red";
      msg.textContent = err.message;
    }
  });
}

/* ============================================
   LOGIN – INDIVIDUAL
   ============================================ */

function initIndividualLoginPage() {
  const form = document.getElementById("individualLoginForm");
  const msg = document.getElementById("individualLoginMessage");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    const email = document.getElementById("individualEmail").value.trim();
    const password = document.getElementById("individualPassword").value;

    try {
      const account = await apiLogin({
        email,
        password,
        role: "individual",
      });

      setSession(account);
      msg.style.color = "green";
      msg.textContent = "Login successful. Redirecting…";

      setTimeout(() => {
        window.location.href = ROLE_ROUTES.individual;
      }, 300);
    } catch (err) {
      msg.style.color = "red";
      msg.textContent = err.message;
    }
  });
}

/* ============================================
   ROUTER
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  switch (page) {
    case "create-account-individual":
      initCreateAccountIndividualPage();
      break;

    case "create-account-company":
      initCreateAccountCompanyPage();
      break;

    case "login-company":
      initCompanyLoginPage();
      break;

    case "login-individual":
      initIndividualLoginPage();
      break;

    default:
      break;
  }
});
