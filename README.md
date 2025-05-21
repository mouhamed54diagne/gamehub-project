

## 🎮 About GameVerse

GameVerse is a modern, interactive multiplayer gaming platform that brings classic games to your browser. Play solo against AI opponents, challenge friends locally on the same device, or compete with players from around the world in real-time multiplayer matches.

## ✨ Features

### Games
- **Tic-Tac-Toe**: The classic game of X's and O's
- **Connect Four**: Strategically drop tokens to connect four in a row
- **Memory Game**: Test your memory by matching pairs of cards

### Game Modes
- **Solo Mode**: Play against AI with adjustable difficulty levels
- **Local Mode**: Challenge a friend on the same device
- **Online Mode**: Compete against other players in real-time

### Multiplayer Features
- **Real-time Matchmaking**: Find opponents quickly
- **Game Rooms**: Create or join rooms with unique IDs
- **Live Chat**: Communicate with your opponent during games
- **Spectator Mode**: Watch ongoing matches

### User Experience
- **User Profiles**: Track your gaming stats and progress
- **Achievements**: Unlock achievements as you play
- **Game History**: Review your past matches
- **Customization**: Choose between light and dark themes
- **Sound Effects**: Toggle game sounds and background music

## 🛠️ Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript
- **Realtime Communication**: Socket.io
- **Authentication**: JWT (JSON Web Tokens)
- **Backend**: Node.js, Express.js
- **Database**: Any SQL database (MySQL/MariaDB recommended)

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Web browser (Chrome, Firefox, Safari, or Edge recommended)
- MySQL/MariaDB (for user data persistence)

## 🚀 Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/JSHMD/gameverse.git
   cd gameverse
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database:
   - Create a MySQL database
   - Import the schema from `db-schema.sql`
   - Configure database connection in `.env` file


  

4. Start the server:
   ```bash
   npm start
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## 🎯 How to Play

### Creating an Account
1. Click "Commencer à jouer" on the welcome screen
2. Select "S'inscrire" to create a new account
3. Fill in your details and select an avatar
4. Click "S'inscrire" to complete registration

### Starting a Game
1. Choose a game from the game selection menu
2. Select your preferred mode (Solo, Local, or Online)
3. For Online mode, create a room or join an existing one
4. Start playing!

### Game Controls
- **Tic-Tac-Toe**: Click on any empty cell to place your mark
- **Connect Four**: Click on a column to drop your token
- **Memory**: Click on cards to flip them and find matching pairs

## 💻 Development

### Project Structure
```
gameverse/
├── index.html        # Main HTML file
├── styles.css        # Main CSS styles
├── script.js         # Client-side JavaScript
├── server.js         # Express server and Socket.io setup
├── db-config.js      # Database configuration
├── db-operations.js  # Database operations
└── sounds/           # Game sound effects
```

### Key Components
- **Authentication System**: User registration, login, and session management
- **Game Logic**: Implementation of game rules and AI opponents
- **Socket Communication**: Real-time game updates and chat functionality
- **User Interface**: Responsive design with theme options



## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Socket.io for the real-time communication framework
- Various open-source libraries and tools that made this project possible
- The gaming community for inspiration

---

Developed with ❤️ by [joshua and diagne mouhamed]
