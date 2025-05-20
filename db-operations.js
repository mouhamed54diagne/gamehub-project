const { createPool } = require('./db-config');
const { v4: uuidv4 } = require('uuid');

// Pool de connexions global
let pool;

// Initialiser le pool de connexions
async function initPool() {
  if (!pool) {
    pool = await createPool();
  }
  return pool;
}

// Opérations sur les utilisateurs
const userOperations = {
  // Créer un nouvel utilisateur
  async createUser(username, email, password, avatar = 'default') {
    try {
      const dbPool = await initPool();
      const userId = uuidv4();
      
      // Insérer l'utilisateur dans la table users
      await dbPool.query(
        'INSERT INTO users (id, username, email, password, avatar) VALUES (?, ?, ?, ?, ?)',
        [userId, username, email, password, avatar]
      );
      
      // Créer les statistiques initiales pour l'utilisateur
      await dbPool.query(
        'INSERT INTO user_stats (user_id, wins, losses) VALUES (?, 0, 0)',
        [userId]
      );
      
      return userId;
    } catch (error) {
      console.error('Erreur lors de la création de l\'utilisateur:', error);
      throw error;
    }
  },
  
  // Trouver un utilisateur par nom d'utilisateur
  async findUserByUsername(username) {
    try {
      const dbPool = await initPool();
      const [rows] = await dbPool.query(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Erreur lors de la recherche de l\'utilisateur par nom d\'utilisateur:', error);
      throw error;
    }
  },
  
  // Trouver un utilisateur par email
  async findUserByEmail(email) {
    try {
      const dbPool = await initPool();
      const [rows] = await dbPool.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Erreur lors de la recherche de l\'utilisateur par email:', error);
      throw error;
    }
  },
  
  // Trouver un utilisateur par ID
  async findUserById(userId) {
    try {
      const dbPool = await initPool();
      const [rows] = await dbPool.query(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Erreur lors de la recherche de l\'utilisateur par ID:', error);
      throw error;
    }
  }
};

// Opérations sur les tokens
const tokenOperations = {
  // Ajouter un token actif
  async addActiveToken(token, userId) {
    try {
      const dbPool = await initPool();
      
      // Supprimer d'abord les anciens tokens de cet utilisateur pour éviter les doublons
      await dbPool.query(
        'DELETE FROM active_tokens WHERE user_id = ?',
        [userId]
      );
      
      // Ajouter le nouveau token
      await dbPool.query(
        'INSERT INTO active_tokens (token, user_id, created_at) VALUES (?, ?, NOW())',
        [token, userId]
      );
      
      console.log(`Token ajouté pour l'utilisateur ${userId}`);
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'ajout du token actif:', error);
      throw error;
    }
  },
  
  // Supprimer un token actif
  async removeActiveToken(token) {
    try {
      const dbPool = await initPool();
      await dbPool.query(
        'DELETE FROM active_tokens WHERE token = ?',
        [token]
      );
      
      console.log('Token supprimé');
      return true;
    } catch (error) {
      console.error('Erreur lors de la suppression du token actif:', error);
      throw error;
    }
  },
  
  // Vérifier si un token est actif
  async isTokenActive(token) {
    try {
      const dbPool = await initPool();
      const [rows] = await dbPool.query(
        'SELECT * FROM active_tokens WHERE token = ?',
        [token]
      );
      
      const isActive = rows.length > 0;
      console.log(`Vérification du token: ${isActive ? 'actif' : 'inactif'}`);
      return isActive;
    } catch (error) {
      console.error('Erreur lors de la vérification du token actif:', error);
      return false; // En cas d'erreur, considérer le token comme inactif
    }
  }
};

// Opérations sur les statistiques
const statsOperations = {
  // Obtenir les statistiques d'un utilisateur
  async getUserStats(userId) {
    try {
      const dbPool = await initPool();
      const [rows] = await dbPool.query(
        'SELECT * FROM user_stats WHERE user_id = ?',
        [userId]
      );
      
      return rows.length > 0 ? rows[0] : { wins: 0, losses: 0 };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      throw error;
    }
  },
  
  // Mettre à jour les statistiques d'un utilisateur
  async updateUserStats(userId, wins = 0, losses = 0) {
    try {
      const dbPool = await initPool();
      await dbPool.query(
        'UPDATE user_stats SET wins = wins + ?, losses = losses + ? WHERE user_id = ?',
        [wins, losses, userId]
      );
    } catch (error) {
      console.error('Erreur lors de la mise à jour des statistiques:', error);
      throw error;
    }
  },
  
  // Incrémenter les victoires d'un utilisateur
  async incrementWins(userId) {
    try {
      const dbPool = await initPool();
      await dbPool.query(
        'UPDATE user_stats SET wins = wins + 1 WHERE user_id = ?',
        [userId]
      );
    } catch (error) {
      console.error('Erreur lors de l\'incrémentation des victoires:', error);
      throw error;
    }
  },
  
  // Incrémenter les défaites d'un utilisateur
  async incrementLosses(userId) {
    try {
      const dbPool = await initPool();
      await dbPool.query(
        'UPDATE user_stats SET losses = losses + 1 WHERE user_id = ?',
        [userId]
      );
    } catch (error) {
      console.error('Erreur lors de l\'incrémentation des défaites:', error);
      throw error;
    }
  }
};

// Opérations sur les succès
const achievementOperations = {
  // Obtenir les succès d'un utilisateur
  async getUserAchievements(userId) {
    try {
      const dbPool = await initPool();
      const [rows] = await dbPool.query(
        `SELECT a.id, a.name, a.description, a.icon, ua.unlocked_at 
         FROM achievements a 
         JOIN user_achievements ua ON a.id = ua.achievement_id 
         WHERE ua.user_id = ?`,
        [userId]
      );
      
      return rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des succès:', error);
      throw error;
    }
  },
  
  // Vérifier si un utilisateur a un succès
  async hasAchievement(userId, achievementId) {
    try {
      const dbPool = await initPool();
      const [rows] = await dbPool.query(
        `SELECT * FROM user_achievements ua 
         JOIN achievements a ON ua.achievement_id = a.id 
         WHERE ua.user_id = ? AND a.id = ?`,
        [userId, achievementId]
      );
      
      return rows.length > 0;
    } catch (error) {
      console.error('Erreur lors de la vérification du succès:', error);
      throw error;
    }
  },
  
  // Ajouter un succès à un utilisateur
  async addAchievement(userId, achievement) {
    try {
      const dbPool = await initPool();
      
      // Vérifier si le succès existe déjà
      const [existingAchievements] = await dbPool.query(
        'SELECT * FROM achievements WHERE id = ?',
        [achievement.id]
      );
      
      // Si le succès n'existe pas, l'ajouter
      if (existingAchievements.length === 0) {
        await dbPool.query(
          'INSERT INTO achievements (id, name, description, icon) VALUES (?, ?, ?, ?)',
          [achievement.id, achievement.name, achievement.description, achievement.icon]
        );
      }
      
      // Ajouter le succès à l'utilisateur
      await dbPool.query(
        'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
        [userId, achievement.id]
      );
    } catch (error) {
      console.error('Erreur lors de l\'ajout du succès:', error);
      throw error;
    }
  }
};

// Opérations sur l'historique des parties
const historyOperations = {
  // Obtenir l'historique des parties d'un utilisateur
  async getUserGameHistory(userId) {
    try {
      const dbPool = await initPool();
      const [rows] = await dbPool.query(
        'SELECT * FROM game_history WHERE user_id = ? ORDER BY played_at DESC LIMIT 10',
        [userId]
      );
      
      return rows;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique des parties:', error);
      throw error;
    }
  },
  
  // Ajouter une partie à l'historique
  async addGameToHistory(userId, gameType, result, opponent) {
    try {
      const dbPool = await initPool();
      await dbPool.query(
        'INSERT INTO game_history (user_id, game_type, result, opponent) VALUES (?, ?, ?, ?)',
        [userId, gameType, result, opponent]
      );
    } catch (error) {
      console.error('Erreur lors de l\'ajout à l\'historique des parties:', error);
      throw error;
    }
  }
};

module.exports = {
  userOperations,
  tokenOperations,
  statsOperations,
  achievementOperations,
  historyOperations
};