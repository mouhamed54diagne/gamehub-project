-- Création de la table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  avatar VARCHAR(50) DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des statistiques
CREATE TABLE IF NOT EXISTS user_stats (
  user_id VARCHAR(36) PRIMARY KEY,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Création de la table des succès
CREATE TABLE IF NOT EXISTS achievements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50)
);

-- Création de la table des succès débloqués par les utilisateurs
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id VARCHAR(36),
  achievement_id INT,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, achievement_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
);

-- Création de la table de l'historique des parties
CREATE TABLE IF NOT EXISTS game_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36),
  game_type VARCHAR(50) NOT NULL,
  result ENUM('win', 'lose', 'draw') NOT NULL,
  opponent VARCHAR(50),
  played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Création de la table des tokens actifs
CREATE TABLE IF NOT EXISTS active_tokens (
  token VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insertion des succès par défaut
INSERT IGNORE INTO achievements (id, name, description, icon) VALUES
(1, 'Première Victoire', 'Gagnez votre première partie', '🏆'),
(2, 'Sur une lancée', 'Gagnez 3 parties d\'affilée', '🔥'),
(3, 'Maître du jeu', 'Atteignez le niveau 10', '🌟');