require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend static files (project root = one level up from backend/)
app.use(express.static(path.join(__dirname, '..')));

// Make "/" load the onboarding page (more reliable than a non-existent login.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'onboarding.html'));
});

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Test route to check DB connection
app.get('/api/ping', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ status: 'ok', db: rows[0] });
  } catch (err) {
    console.error('Ping error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Register new user
app.post('/api/register', async (req, res) => {
  const { email, password, fullName, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const safeRole = (role && String(role).trim()) || 'individual';
    const safeName = (fullName && String(fullName).trim()) || null;

    await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [String(email).trim().toLowerCase(), passwordHash, safeName, safeRole]
    );

    res.status(201).json({ message: 'User created' });
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Login existing user
app.post('/api/login', async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [String(email).trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];

    // If the client provided a role, enforce it (prevents logging into the wrong dashboard)
    if (role && String(role).trim() && user.role !== String(role).trim()) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.full_name || user.email,
      role: user.role || 'individual',
      createdAt: user.created_at
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save training data for a user
app.post('/api/training-data', async (req, res) => {
  const { userId, inputText, label } = req.body;

  if (!userId || !inputText) {
    return res.status(400).json({ error: 'userId and inputText required' });
  }

  try {
    await pool.query(
      'INSERT INTO training_data (user_id, input_text, label) VALUES (?, ?, ?)',
      [userId, inputText, label || null]
    );
    res.status(201).json({ message: 'Training data saved' });
  } catch (err) {
    console.error('Training data save error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get training data for a user
app.get('/api/training-data/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT * FROM training_data WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Training data fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server (LAST)
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
