const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Configuration de la base de données
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '', // Mot de passe par défaut pour XAMPP
  database: 'gameverse',
  port: 3307,
  // Ajouter cette option pour résoudre le problème d'authentification
  authPlugins: {
    mysql_native_password: () => () => Buffer.from('', 'utf-8')
  }
};

// Fonction pour initialiser la base de données
async function initDatabase() {
  try {
    console.log('Initialisation de la base de données...');
    
    // Créer une connexion sans spécifier de base de données
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port,
      // Ajouter cette option pour résoudre le problème d'authentification
      authPlugins: {
        mysql_native_password: () => () => Buffer.from('', 'utf-8')
      }
    });
    
    // Créer la base de données si elle n'existe pas
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    
    // Utiliser la base de données
    await connection.query(`USE ${dbConfig.database}`);
    
    // Lire et exécuter le script SQL pour créer les tables
    const sqlScript = fs.readFileSync(path.join(__dirname, 'database.sql'), 'utf8');
    const statements = sqlScript.split(';').filter(statement => statement.trim() !== '');
    
    for (const statement of statements) {
      await connection.query(statement);
    }
    
    console.log('Base de données initialisée avec succès!');
    await connection.end();
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la base de données:', error);
    return false;
  }
}

// Fonction pour tester la connexion à la base de données
async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      ...dbConfig,
      // Ajouter cette option pour résoudre le problème d'authentification
      authPlugins: {
        mysql_native_password: () => () => Buffer.from('', 'utf-8')
      }
    });
    
    console.log('Connexion à la base de données MySQL réussie!');
    await connection.end();
    return true;
  } catch (error) {
    console.error('Erreur de connexion à la base de données:', error);
    return false;
  }
}

// Fonction pour créer un pool de connexions
async function createPool() {
  try {
    const pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    // Vérifier la connexion
    const connection = await pool.getConnection();
    connection.release();
    
    return pool;
  } catch (error) {
    console.error('Erreur de connexion à la base de données:', error);
    throw error;
  }
}

module.exports = {
  initDatabase,
  createPool,
  testConnection,
  dbConfig
};