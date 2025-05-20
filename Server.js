const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const cors = require("cors")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const { v4: uuidv4 } = require("uuid")
const path = require("path")
const cookieParser = require("cookie-parser")

// Importer les modules de base de données
const { initDatabase, testConnection } = require("./db-config")
const {
  userOperations,
  tokenOperations,
  statsOperations,
  achievementOperations,
  historyOperations,
} = require("./db-operations")

// Configuration
const PORT = process.env.PORT || 3000
// Utiliser une clé secrète fixe pour éviter les problèmes
const JWT_SECRET = "gameverse-secret-key-123456789"

// Initialisation de l'application
const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
})

// Middleware
app.use(
  cors({
    origin: true, // Permet toutes les origines
    credentials: true, // Important pour les cookies
  }),
)
app.use(express.json())
app.use(cookieParser()) // Utilisation de cookie-parser
app.use(express.static(path.join(__dirname, ".")))

// Structures de données en mémoire pour les éléments qui ne nécessitent pas de persistance
const rooms = new Map()
const matchmaking = {
  queue: [],
  inProgress: false,
}

// Middleware d'authentification simplifié
const authenticateToken = (req, res, next) => {
  try {
    console.log("Authentification en cours...")

    // Récupérer le token du cookie ou de l'en-tête
    let token = req.cookies?.auth_token

    if (!token) {
      const authHeader = req.headers["authorization"]
      token = authHeader && authHeader.split(" ")[1]
    }

    if (!token) {
      console.log("Aucun token trouvé")
      return res.status(401).json({ message: "Token manquant" })
    }

    // Vérifier uniquement la signature du token sans vérifier dans la base de données
    const user = jwt.verify(token, JWT_SECRET)
    console.log(`Utilisateur authentifié: ${user.username}`)

    req.user = user
    next()
  } catch (err) {
    console.error("Erreur d'authentification:", err.message)
    return res.status(401).json({ message: "Session expirée, veuillez vous reconnecter" })
  }
}

// Routes API
app.get("/api/health-check", (req, res) => {
  res.status(200).json({ status: "ok", message: "Serveur opérationnel" })
})

// Vérifier l'authentification
app.get("/api/auth/check", authenticateToken, (req, res) => {
  res.status(200).json({
    authenticated: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
    },
  })
})

// Inscription
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password, avatar } = req.body

    console.log("Tentative d'inscription:", { username, email })

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Tous les champs sont requis" })
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await userOperations.findUserByUsername(username)
    if (existingUser) {
      return res.status(400).json({ message: "Ce nom d'utilisateur est déjà pris" })
    }

    const existingEmail = await userOperations.findUserByEmail(email)
    if (existingEmail) {
      return res.status(400).json({ message: "Cet email est déjà utilisé" })
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Créer l'utilisateur
    console.log("Création de l'utilisateur avec les données:", { username, email })
    const userId = await userOperations.createUser(username, email, hashedPassword, avatar || "default")

    console.log(`Nouvel utilisateur créé: ${username} avec ID: ${userId}`)

    res.status(201).json({ message: "Inscription réussie" })
  } catch (error) {
    console.error("Erreur d'inscription détaillée:", error)
    res.status(500).json({ message: "Erreur serveur" })
  }
})

// Connexion
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body

    console.log("Tentative de connexion:", { username })

    if (!username || !password) {
      return res.status(400).json({ message: "Tous les champs sont requis" })
    }

    // Trouver l'utilisateur
    const user = await userOperations.findUserByUsername(username)

    if (!user) {
      return res.status(401).json({ message: "Nom d'utilisateur ou mot de passe incorrect" })
    }

    // Vérifier le mot de passe
    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      return res.status(401).json({ message: "Nom d'utilisateur ou mot de passe incorrect" })
    }

    // Créer le token avec une durée de validité très longue (1 an)
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: "1y" }, // 1 an
    )

    // Ajouter le token à la liste des tokens actifs
    try {
      await tokenOperations.addActiveToken(token, user.id)
    } catch (err) {
      console.error("Erreur lors de l'ajout du token à la base de données:", err)
      // Continuer même si l'ajout du token échoue
    }

    // Créer un objet utilisateur sans le mot de passe
    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
    }

    console.log(`Utilisateur connecté: ${username}`)

    // Définir un cookie simple avec des paramètres de base
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: false, // Mettre à false pour le développement
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 an
      sameSite: "lax",
      path: "/",
    })

    res.status(200).json({
      message: "Connexion réussie",
      token, // Toujours envoyer le token dans la réponse pour les clients qui l'utilisent
      user: userResponse,
    })
  } catch (error) {
    console.error("Erreur de connexion:", error)
    res.status(500).json({ message: "Erreur serveur" })
  }
})

// Déconnexion
app.post("/api/auth/logout", authenticateToken, async (req, res) => {
  try {
    // Récupérer le token (soit du cookie, soit de l'en-tête)
    let token = req.cookies?.auth_token

    if (!token) {
      const authHeader = req.headers["authorization"]
      token = authHeader && authHeader.split(" ")[1]
    }

    if (token) {
      // Supprimer le token de la liste des tokens actifs
      try {
        await tokenOperations.removeActiveToken(token)
      } catch (err) {
        console.error("Erreur lors de la suppression du token:", err)
        // Continuer même si la suppression échoue
      }
    }

    // Supprimer le cookie
    res.clearCookie("auth_token", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    })

    res.status(200).json({ message: "Déconnexion réussie" })
  } catch (error) {
    console.error("Erreur de déconnexion:", error)
    res.status(500).json({ message: "Erreur serveur" })
  }
})

// Profil utilisateur
app.get("/api/user/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id

    // Trouver l'utilisateur
    const user = await userOperations.findUserById(userId)

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" })
    }

    // Créer un objet utilisateur sans le mot de passe
    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
    }

    // Récupérer les statistiques
    const stats = await statsOperations.getUserStats(userId)

    // Récupérer les succès
    const userAchievements = await achievementOperations.getUserAchievements(userId)

    // Récupérer l'historique
    const userHistory = await historyOperations.getUserGameHistory(userId)

    res.status(200).json({
      user: userResponse,
      stats,
      achievements: userAchievements,
      gameHistory: userHistory,
    })
  } catch (error) {
    console.error("Erreur de récupération du profil:", error)
    res.status(500).json({ message: "Erreur serveur" })
  }
})

// Mettre à jour les statistiques
app.post("/api/user/stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { wins, losses } = req.body

    // Mettre à jour les statistiques
    await statsOperations.updateUserStats(userId, wins, losses)

    // Vérifier les succès
    await checkAchievements(userId)

    res.status(200).json({ message: "Statistiques mises à jour" })
  } catch (error) {
    console.error("Erreur de mise à jour des statistiques:", error)
    res.status(500).json({ message: "Erreur serveur" })
  }
})

// Ajouter une partie à l'historique
async function addGameToHistory(userId, gameType, result, opponent) {
  if (!userId) return

  try {
    await historyOperations.addGameToHistory(userId, gameType, result, opponent)
  } catch (error) {
    console.error("Erreur lors de l'ajout à l'historique:", error)
  }
}

// Vérifier les succès
async function checkAchievements(userId) {
  try {
    const stats = await statsOperations.getUserStats(userId)

    // Première victoire
    if (stats.wins >= 1 && !(await achievementOperations.hasAchievement(userId, "first_win"))) {
      const achievement = {
        id: "first_win",
        name: "Première Victoire",
        description: "Gagnez votre première partie",
        icon: "🏆",
      }

      await achievementOperations.addAchievement(userId, achievement)

      // Notifier l'utilisateur
      const socket = findSocketByUserId(userId)
      if (socket) {
        socket.emit("achievementUnlocked", { achievement })
      }
    }

    // Maître du jeu (niveau 10)
    const totalGames = stats.wins + stats.losses
    const baseLevel = Math.floor(totalGames / 10) + 1
    const winBonus = Math.floor(stats.wins / 5)
    const level = Math.min(50, baseLevel + winBonus)

    if (level >= 10 && !(await achievementOperations.hasAchievement(userId, "master"))) {
      const achievement = {
        id: "master",
        name: "Maître du jeu",
        description: "Atteignez le niveau 10",
        icon: "🌟",
      }

      await achievementOperations.addAchievement(userId, achievement)

      // Notifier l'utilisateur
      const socket = findSocketByUserId(userId)
      if (socket) {
        socket.emit("achievementUnlocked", { achievement })
      }
    }
  } catch (error) {
    console.error("Erreur lors de la vérification des succès:", error)
  }
}

// Trouver un socket par ID utilisateur
function findSocketByUserId(userId) {
  for (const [socketId, socket] of io.sockets.sockets.entries()) {
    if (socket.user && socket.user.id === userId) {
      return socket
    }
  }
  return null
}

// Vérifier s'il y a un gagnant
function checkWin(board) {
  const winPatterns = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8], // lignes
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8], // colonnes
    [0, 4, 8],
    [2, 4, 6], // diagonales
  ]

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return {
        winner: board[a],
        pattern,
      }
    }
  }

  return null
}

// Socket.IO - Middleware simplifié
io.use((socket, next) => {
  try {
    console.log("Authentification Socket.IO")

    // Vérifier d'abord le token dans l'authentification du socket
    let token = socket.handshake.auth.token

    // Si pas de token dans l'authentification, vérifier dans les cookies
    if (!token && socket.handshake.headers.cookie) {
      const cookies = socket.handshake.headers.cookie.split(";").map((c) => c.trim())
      const authCookie = cookies.find((c) => c.startsWith("auth_token="))
      if (authCookie) {
        token = authCookie.split("=")[1]
      }
    }

    if (!token) {
      console.log("Aucun token trouvé pour le socket, connexion anonyme")
      return next()
    }

    // Vérifier uniquement la signature du token sans vérifier dans la base de données
    const user = jwt.verify(token, JWT_SECRET)
    console.log("Socket authentifié pour l'utilisateur:", user.username)
    socket.user = user
    next()
  } catch (err) {
    console.error("Erreur d'authentification socket:", err)
    next()
  }
})

io.on("connection", (socket) => {
  console.log(`Nouvelle connexion socket: ${socket.id}`)

  // Authentification
  if (socket.user) {
    socket.emit("authenticated", { message: "Authentifié avec succès" })
    console.log(`Utilisateur authentifié: ${socket.user.username}`)
  }

  // Créer une salle
  socket.on("createRoom", ({ gameType, mode }) => {
    try {
      const roomId = uuidv4()
      const playerSymbol = "X"

      // Créer l'état initial du jeu
      const gameState = {
        board: Array(9).fill(""),
        currentPlayer: "X",
        gameOver: false,
        winner: null,
        isDraw: false,
        winningPattern: null,
      }

      // Créer la salle
      rooms.set(roomId, {
        id: roomId,
        gameType,
        mode,
        players: [
          {
            socketId: socket.id,
            userId: socket.user ? socket.user.id : null,
            username: socket.user ? socket.user.username : "Invité",
            symbol: playerSymbol,
          },
        ],
        spectators: [],
        gameState,
        createdAt: new Date().toISOString(),
      })

      // Rejoindre la salle
      socket.join(roomId)

      console.log(`Salle créée: ${roomId}, Jeu: ${gameType}, Mode: ${mode}`)

      // Envoyer les informations de la salle
      socket.emit("roomCreated", {
        roomId,
        gameState,
        mode,
        playerSymbol,
        roomName: `Partie de ${socket.user ? socket.user.username : "Invité"}`,
      })
    } catch (error) {
      console.error("Erreur lors de la création de la salle:", error)
      socket.emit("error", { message: "Erreur lors de la création de la salle" })
    }
  })

  // Rejoindre une salle
  socket.on("joinRoom", ({ roomId }) => {
    try {
      // Vérifier si la salle existe
      if (!rooms.has(roomId)) {
        return socket.emit("joinError", { message: "Salle introuvable" })
      }

      const room = rooms.get(roomId)

      // Vérifier si la partie est déjà pleine
      if (room.players.length >= 2) {
        // Rejoindre en tant que spectateur
        room.spectators.push({
          socketId: socket.id,
          userId: socket.user ? socket.user.id : null,
          username: socket.user ? socket.user.username : "Spectateur",
        })

        socket.join(roomId)

        // Informer les joueurs qu'un spectateur a rejoint
        io.to(roomId).emit("spectatorJoined", {
          username: socket.user ? socket.user.username : "Spectateur",
          count: room.spectators.length,
        })

        // Envoyer l'état actuel du jeu au spectateur
        socket.emit("gameStart", {
          roomId,
          gameState: room.gameState,
          playerSymbol: null,
          isSpectator: true,
          players: room.players.map((p) => ({ username: p.username, symbol: p.symbol })),
        })

        console.log(`Spectateur a rejoint la salle: ${roomId}`)
        return
      }

      // Rejoindre en tant que joueur
      const playerSymbol = "O" // Le second joueur est toujours O

      room.players.push({
        socketId: socket.id,
        userId: socket.user ? socket.user.id : null,
        username: socket.user ? socket.user.username : "Invité",
        symbol: playerSymbol,
      })

      socket.join(roomId)

      console.log(`Joueur a rejoint la salle: ${roomId}`)

      // Informer les deux joueurs que la partie commence
      io.to(roomId).emit("gameStart", {
        roomId,
        gameState: room.gameState,
        opponent: socket.user ? socket.user.username : "Invité",
      })

      // Envoyer le symbole au joueur qui vient de rejoindre
      socket.emit("gameStart", {
        roomId,
        gameState: room.gameState,
        playerSymbol,
        opponent: room.players[0].username,
      })

      // Envoyer le symbole au premier joueur
      io.to(room.players[0].socketId).emit("gameStart", {
        roomId,
        gameState: room.gameState,
        playerSymbol: room.players[0].symbol,
        opponent: socket.user ? socket.user.username : "Invité",
      })
    } catch (error) {
      console.error("Erreur lors de la connexion à la salle:", error)
      socket.emit("joinError", { message: "Erreur lors de la connexion à la salle" })
    }
  })

  // Faire un mouvement
  socket.on("gameMove", ({ roomId, move, playerSymbol }) => {
    try {
      // Vérifier si la salle existe
      if (!rooms.has(roomId)) {
        return socket.emit("error", { message: "Salle introuvable" })
      }

      const room = rooms.get(roomId)

      // Vérifier si c'est le tour du joueur
      if (room.gameState.currentPlayer !== playerSymbol) {
        return socket.emit("error", { message: "Ce n'est pas votre tour" })
      }

      // Vérifier si la case est vide
      if (room.gameState.board[move] !== "") {
        return socket.emit("error", { message: "Cette case est déjà occupée" })
      }

      // Vérifier si la partie est terminée
      if (room.gameState.gameOver) {
        return socket.emit("error", { message: "La partie est terminée" })
      }

      // Faire le mouvement
      const newBoard = [...room.gameState.board]
      newBoard[move] = playerSymbol

      // Vérifier s'il y a un gagnant
      const winResult = checkWin(newBoard)
      const isDraw = !winResult && !newBoard.includes("")

      // Mettre à jour l'état du jeu
      room.gameState = {
        ...room.gameState,
        board: newBoard,
        currentPlayer: playerSymbol === "X" ? "O" : "X",
        gameOver: !!winResult || isDraw,
        winner: winResult ? winResult.winner : null,
        isDraw,
        winningPattern: winResult ? winResult.pattern : null,
      }

      // Informer tous les joueurs du mouvement
      io.to(roomId).emit("gameUpdate", {
        gameState: room.gameState,
        move,
        playerId: socket.id,
        winner: winResult ? winResult.winner : null,
        pattern: winResult ? winResult.pattern : null,
        isDraw,
      })

      // Si la partie est terminée, mettre à jour les statistiques
      if (room.gameState.gameOver && winResult) {
        const winner = room.players.find((p) => p.symbol === winResult.winner)
        const loser = room.players.find((p) => p.symbol !== winResult.winner)

        if (winner && winner.userId && loser && loser.userId) {
          // Mettre à jour les statistiques du gagnant
          statsOperations.incrementWins(winner.userId)

          // Mettre à jour les statistiques du perdant
          statsOperations.incrementLosses(loser.userId)

          // Vérifier les succès
          checkAchievements(winner.userId)
          checkAchievements(loser.userId)

          // Ajouter à l'historique
          addGameToHistory(winner.userId, room.gameType, "win", loser.username)
          addGameToHistory(loser.userId, room.gameType, "lose", winner.username)
        }
      } else if (room.gameState.gameOver && isDraw) {
        // Match nul
        room.players.forEach((player) => {
          if (player.userId) {
            addGameToHistory(
              player.userId,
              room.gameType,
              "draw",
              room.players.find((p) => p.userId !== player.userId)?.username || "Adversaire",
            )
          }
        })
      }
    } catch (error) {
      console.error("Erreur lors du mouvement:", error)
      socket.emit("error", { message: "Erreur lors du mouvement" })
    }
  })

  // Réinitialiser la partie
  socket.on("resetGame", ({ roomId }) => {
    try {
      // Vérifier si la salle existe
      if (!rooms.has(roomId)) {
        return socket.emit("error", { message: "Salle introuvable" })
      }

      const room = rooms.get(roomId)

      // Vérifier si le joueur est dans la salle
      const player = room.players.find((p) => p.socketId === socket.id)
      if (!player) {
        return socket.emit("error", { message: "Vous n'êtes pas dans cette salle" })
      }

      // Réinitialiser l'état du jeu
      room.gameState = {
        board: Array(9).fill(""),
        currentPlayer: "X",
        gameOver: false,
        winner: null,
        isDraw: false,
        winningPattern: null,
      }

      // Informer tous les joueurs de la réinitialisation
      io.to(roomId).emit("gameReset", {
        gameState: room.gameState,
      })
    } catch (error) {
      console.error("Erreur lors de la réinitialisation:", error)
      socket.emit("error", { message: "Erreur lors de la réinitialisation" })
    }
  })

  // Message de chat
  socket.on("chatMessage", ({ roomId, message }) => {
    try {
      // Vérifier si la salle existe
      if (!rooms.has(roomId)) {
        return socket.emit("error", { message: "Salle introuvable" })
      }

      // Vérifier si le message est valide
      if (!message || message.trim() === "") {
        return
      }

      // Envoyer le message à tous les joueurs de la salle
      io.to(roomId).emit("chatMessage", {
        username: socket.user ? socket.user.username : "Invité",
        message: message.trim(),
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error)
      socket.emit("error", { message: "Erreur lors de l'envoi du message" })
    }
  })

  // Indication de frappe
  socket.on("typing", ({ roomId }) => {
    try {
      // Vérifier si la salle existe
      if (!rooms.has(roomId)) {
        return
      }

      // Informer les autres joueurs que l'utilisateur est en train d'écrire
      socket.to(roomId).emit("typing", {
        username: socket.user ? socket.user.username : "Invité",
      })
    } catch (error) {
      console.error("Erreur lors de l'indication de frappe:", error)
    }
  })

  // Demande de revanche
  socket.on("requestRematch", ({ roomId }) => {
    try {
      // Vérifier si la salle existe
      if (!rooms.has(roomId)) {
        return socket.emit("error", { message: "Salle introuvable" })
      }

      const room = rooms.get(roomId)

      // Vérifier si le joueur est dans la salle
      const player = room.players.find((p) => p.socketId === socket.id)
      if (!player) {
        return socket.emit("error", { message: "Vous n'êtes pas dans cette salle" })
      }

      // Informer l'autre joueur de la demande de revanche
      const otherPlayer = room.players.find((p) => p.socketId !== socket.id)
      if (otherPlayer) {
        io.to(otherPlayer.socketId).emit("rematchRequested", {
          from: player.username,
        })
      }
    } catch (error) {
      console.error("Erreur lors de la demande de revanche:", error)
      socket.emit("error", { message: "Erreur lors de la demande de revanche" })
    }
  })

  // Accepter la revanche
  socket.on("acceptRematch", ({ roomId }) => {
    try {
      // Vérifier si la salle existe
      if (!rooms.has(roomId)) {
        return socket.emit("error", { message: "Salle introuvable" })
      }

      const room = rooms.get(roomId)

      // Vérifier si le joueur est dans la salle
      const player = room.players.find((p) => p.socketId === socket.id)
      if (!player) {
        return socket.emit("error", { message: "Vous n'êtes pas dans cette salle" })
      }

      // Informer tous les joueurs que la revanche a été acceptée
      io.to(roomId).emit("rematchAccepted")

      // Réinitialiser l'état du jeu
      room.gameState = {
        board: Array(9).fill(""),
        currentPlayer: "X",
        gameOver: false,
        winner: null,
        isDraw: false,
        winningPattern: null,
      }

      // Informer tous les joueurs de la réinitialisation
      io.to(roomId).emit("gameReset", {
        gameState: room.gameState,
      })
    } catch (error) {
      console.error("Erreur lors de l'acceptation de la revanche:", error)
      socket.emit("error", { message: "Erreur lors de l'acceptation de la revanche" })
    }
  })

  // Recherche de partie rapide
  socket.on("findQuickMatch", ({ gameType }) => {
    try {
      // Vérifier si l'utilisateur est déjà dans la file d'attente
      if (matchmaking.queue.some((p) => p.socketId === socket.id)) {
        return socket.emit("error", { message: "Vous êtes déjà dans la file d'attente" })
      }

      // Ajouter l'utilisateur à la file d'attente
      matchmaking.queue.push({
        socketId: socket.id,
        userId: socket.user ? socket.user.id : null,
        username: socket.user ? socket.user.username : "Invité",
        gameType,
      })

      socket.emit("matchmakingStarted", {
        message: "Recherche d'une partie en cours...",
      })

      console.log(`Joueur ajouté à la file d'attente: ${socket.id}`)

      // Lancer le processus de matchmaking s'il n'est pas déjà en cours
      if (!matchmaking.inProgress) {
        processMatchmaking()
      }
    } catch (error) {
      console.error("Erreur lors de la recherche de partie rapide:", error)
      socket.emit("error", { message: "Erreur lors de la recherche de partie rapide" })
    }
  })

  // Annuler la recherche de partie
  socket.on("cancelMatchmaking", () => {
    try {
      // Retirer l'utilisateur de la file d'attente
      matchmaking.queue = matchmaking.queue.filter((p) => p.socketId !== socket.id)

      socket.emit("matchmakingCancelled", {
        message: "Recherche de partie annulée",
      })

      console.log(`Joueur retiré de la file d'attente: ${socket.id}`)
    } catch (error) {
      console.error("Erreur lors de l'annulation de la recherche de partie:", error)
      socket.emit("error", { message: "Erreur lors de l'annulation de la recherche de partie" })
    }
  })

  // Déconnexion
  socket.on("disconnect", () => {
    console.log(`Déconnexion socket: ${socket.id}`)

    // Retirer l'utilisateur de la file d'attente
    matchmaking.queue = matchmaking.queue.filter((p) => p.socketId !== socket.id)

    // Vérifier si l'utilisateur est dans une salle
    for (const [roomId, room] of rooms.entries()) {
      // Vérifier si l'utilisateur est un joueur
      const playerIndex = room.players.findIndex((p) => p.socketId === socket.id)
      if (playerIndex !== -1) {
        // Informer les autres joueurs que le joueur a quitté
        socket.to(roomId).emit("playerLeft", {
          message: `${room.players[playerIndex].username} a quitté la partie`,
        })

        // Supprimer le joueur de la salle
        room.players.splice(playerIndex, 1)

        // Si la salle est vide, la supprimer
        if (room.players.length === 0 && room.spectators.length === 0) {
          rooms.delete(roomId)
          console.log(`Salle supprimée: ${roomId}`)
        }

        break
      }

      // Vérifier si l'utilisateur est un spectateur
      const spectatorIndex = room.spectators.findIndex((s) => s.socketId === socket.id)
      if (spectatorIndex !== -1) {
        // Informer les joueurs qu'un spectateur a quitté
        io.to(roomId).emit("spectatorLeft", {
          username: room.spectators[spectatorIndex].username,
          count: room.spectators.length - 1,
        })

        // Supprimer le spectateur de la salle
        room.spectators.splice(spectatorIndex, 1)

        // Si la salle est vide, la supprimer
        if (room.players.length === 0 && room.spectators.length === 0) {
          rooms.delete(roomId)
          console.log(`Salle supprimée: ${roomId}`)
        }

        break
      }
    }
  })
})

// Processus de matchmaking
function processMatchmaking() {
  matchmaking.inProgress = true

  try {
    // Regrouper les joueurs par type de jeu
    const gameTypeGroups = {}

    for (const player of matchmaking.queue) {
      if (!gameTypeGroups[player.gameType]) {
        gameTypeGroups[player.gameType] = []
      }

      gameTypeGroups[player.gameType].push(player)
    }

    // Pour chaque type de jeu, créer des paires de joueurs
    for (const [gameType, players] of Object.entries(gameTypeGroups)) {
      while (players.length >= 2) {
        const player1 = players.shift()
        const player2 = players.shift()

        // Créer une salle
        const roomId = uuidv4()

        // Créer l'état initial du jeu
        const gameState = {
          board: Array(9).fill(""),
          currentPlayer: "X",
          gameOver: false,
          winner: null,
          isDraw: false,
          winningPattern: null,
        }

        // Créer la salle
        rooms.set(roomId, {
          id: roomId,
          gameType,
          mode: "online",
          players: [
            {
              socketId: player1.socketId,
              userId: player1.userId,
              username: player1.username,
              symbol: "X",
            },
            {
              socketId: player2.socketId,
              userId: player2.userId,
              username: player2.username,
              symbol: "O",
            },
          ],
          spectators: [],
          gameState,
          createdAt: new Date().toISOString(),
        })

        // Faire rejoindre les joueurs à la salle
        const socket1 = io.sockets.sockets.get(player1.socketId)
        const socket2 = io.sockets.sockets.get(player2.socketId)

        if (socket1) socket1.join(roomId)
        if (socket2) socket2.join(roomId)

        console.log(`Partie rapide créée: ${roomId}, Jeu: ${gameType}`)

        // Informer les joueurs que la partie commence
        if (socket1) {
          socket1.emit("gameStart", {
            roomId,
            gameState,
            playerSymbol: "X",
            opponent: player2.username,
          })
        }

        if (socket2) {
          socket2.emit("gameStart", {
            roomId,
            gameState,
            playerSymbol: "O",
            opponent: player1.username,
          })
        }
      }
    }

    // Mettre à jour la file d'attente
    matchmaking.queue = matchmaking.queue.filter((player) => {
      const socket = io.sockets.sockets.get(player.socketId)
      return socket && socket.connected
    })

    // Si la file d'attente n'est pas vide, relancer le processus dans 5 secondes
    if (matchmaking.queue.length > 0) {
      setTimeout(processMatchmaking, 5000)
    } else {
      matchmaking.inProgress = false
    }
  } catch (error) {
    console.error("Erreur lors du processus de matchmaking:", error)
    matchmaking.inProgress = false
  }
}

// Initialiser la base de données et démarrer le serveur
async function startServer() {
  try {
    // Initialiser la base de données
    console.log("Initialisation de la base de données...")
    await initDatabase()

    // Tester la connexion à la base de données
    const dbConnected = await testConnection()
    if (!dbConnected) {
      console.error("Impossible de se connecter à la base de données. Vérifiez que MySQL est démarré dans XAMPP.")
      process.exit(1)
    }

    // Démarrer le serveur
    server.listen(PORT, () => {
      console.log(`Serveur démarré sur le port ${PORT}`)
      console.log(`URL: http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error("Erreur lors du démarrage du serveur:", error)
    process.exit(1)
  }
}

// Démarrer le serveur
startServer()
