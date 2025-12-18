-- Trading Places (ICT Project) database schema
--
-- This creates the minimal user table requested:
--   - email (username)
--   - password_hash (hashed password)
--   - created_at (date of creation)
--
-- It also includes a couple of extra fields (full_name, role) so the existing
-- front-end dashboards can keep working without changing any UI.

CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  full_name VARCHAR(255) NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'individual',
  PRIMARY KEY (id),
  UNIQUE KEY uniq_users_email (email)
);

-- Existing endpoints also use training_data; keep this if you want that feature.
CREATE TABLE IF NOT EXISTS training_data (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  input_text TEXT NOT NULL,
  label VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_training_user (user_id),
  CONSTRAINT fk_training_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);
