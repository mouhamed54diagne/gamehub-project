const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Vérifier si package.json existe
if (!fs.existsSync(path.join(__dirname, 'package.json'))) {
  // Créer un package.json de base
  const packageJson = {
    "name": "gameverse",
    "version": "1.0.0",
    "description": "Plateforme de jeux multijoueur",
    "main": "Server.js",
    "scripts": {
      "start": "node Server.js",
      "init-db": "node db-config.js"
    },
    "dependencies": {
      "express": "^4.18.2",
      "socket.io": "^4.7.2",
      "cors": "^2.8.5",
      "jsonwebtoken": "^9.0.2",
      "bcryptjs": "^2.4.3",
      "uuid": "^9.0.1",
      "mysql2": "^3.6.1",
      "cookie-parser": "^1.4.6" // Ajout de cookie-parser
    }
  };

  fs.writeFileSync(
    path.join(__dirname, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  console.log('Fichier package.json créé.');
}

// Installer les dépendances
console.log('Installation des dépendances...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('Dépendances installées avec succès!');
} catch (error) {
  console.error('Erreur lors de l\'installation des dépendances:', error);
}

console.log('\nPour initialiser la base de données:');
console.log('1. Assurez-vous que XAMPP est démarré (MySQL)');
console.log('2. Exécutez: npm run init-db');
console.log('\nPour démarrer le serveur:');
console.log('npm start');