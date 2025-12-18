require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ DB POOL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// ✅ HEALTH CHECK
app.get("/api/ping", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

// ✅ REGISTER
app.post("/api/register", async (req, res) => {
  const { email, password, fullName, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)",
      [email.toLowerCase(), hash, fullName || null, role || "individual"]
    );
    res.status(201).json({ message: "User created" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Email exists" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ LOGIN
app.post("/api/login", async (req, res) => {
  const { email, password, role } = req.body;

  const [rows] = await pool.query(
    "SELECT * FROM users WHERE email = ?",
    [email.toLowerCase()]
  );

  if (!rows.length) return res.status(401).json({ error: "Invalid credentials" });

  const user = rows[0];
  if (role && user.role !== role) return res.status(401).json({ error: "Wrong role" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.full_name || user.email
  });
});

// ✅ START
app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("Backend running");
});
