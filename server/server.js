const WebSocket = require('ws')
const PORT = 8080
const wss = new WebSocket.Server({ port: PORT })

let rooms = {} // Store rooms and their game states
let nextClientId = 0 // Counter for unique client IDs
let clients = {} // Store connected clients

wss.on('connection', function connection(ws) {
	let clientId = nextClientId++
	ws.clientId = clientId
	let currentRoomId = null // Each client will be part of a specific room

	// Save client information
	clients[clientId] = { ws, roomId: null, playerIndex: null }

	ws.on('message', function incoming(message) {
		const data = JSON.parse(message)
		console.log(data)

		if (data.action === 'createRoom') {
			// Room creation flow
			currentRoomId = generateRoomId()
			setupGame(data.config, ws, currentRoomId) // Create the new room

			// Assign the clientId to the first player (index 0) in the new room
			clients[clientId].roomId = currentRoomId
			clients[clientId].playerIndex = 0 // Creator is always playerIndex 0

			// Set the first player (creator) as the active client for this room
			const room = rooms[currentRoomId]
			room.players[0].clientId = clientId
		}

		// Handle 'joinRoom' action separately
		else if (data.action === 'joinRoom') {
			console.log(data.action)
			currentRoomId = data.roomId

			// Check if the room exists
			if (!rooms[currentRoomId]) {
				ws.send(
					JSON.stringify({
						action: 'error',
						message: 'Room does not exist!',
					})
				)
				return
			}

			const room = rooms[currentRoomId]

			// Find an existing player slot that does not have a WebSocket connection yet
			let playerIndex = null
			for (let i = 0; i < room.players.length; i++) {
				if (room.players[i].clientId === null) {
					playerIndex = i // Assign the player to this slot
					break
				}
			}

			// If no available player slot is found, the room is full
			if (playerIndex === null) {
				ws.send(
					JSON.stringify({
						action: 'error',
						message: 'Room is full!',
					})
				)
				return
			}

			// Assign the client ID to the existing player slot
			room.players[playerIndex].clientId = clientId

			// Update client connection data
			clients[clientId].roomId = currentRoomId
			clients[clientId].playerIndex = playerIndex

			// Send the current game state to the newly joined player
			const playerGameState = {
				...room,
				playerIndex, // Send the player's index so they know which one they are
			}
			console.log(playerGameState)
			ws.send(JSON.stringify(playerGameState))

			// Broadcast to other players that a new player has joined
			broadcastGameState(currentRoomId, {
				action: 'playerJoined',
				playerName: room.players[playerIndex].name, // Use the existing player name
			})
		}

		// Handle any game actions after room join
		else if (currentRoomId) {
			updateGameState(currentRoomId, data)
		}
	})

	// Handle player disconnection
	ws.on('close', function () {
		console.log(`Client disconnected: ${clientId}`)
		if (clients[clientId]) {
			const roomId = clients[clientId].roomId
			const room = rooms[roomId]

			if (room) {
				// Remove the player's clientId
				const playerIndex = clients[clientId].playerIndex
				if (playerIndex !== null) {
					room.players[playerIndex].clientId = null
				}

				// Delete the room if no players are left with WebSocket connections
				const activePlayers = room.players.filter(
					(player) => player.clientId !== null
				)
				if (activePlayers.length === 0) {
					delete rooms[roomId]
				}
			}

			// Remove the client connection
			delete clients[clientId]
		}
	})
})

function setupGame(config, ws, roomId) {
	const { numPlayers, numRounds, numCards, playerNames } = config
	console.log(playerNames)
	console.log(roomId)

	// Create the room game state
	rooms[roomId] = {
		players: playerNames.map((name) => ({
			name,
			hand: [],
			points: 0,
			fp: 0,
			target: null,
			rank: null,
			clientId: null, // Store only clientId instead of the WebSocket
		})),
		masterCardplayer: numPlayers - 1,
		board: [],
		round: 1,
		firstCard: null,
		currentPlayerIndex: 0,
		masterSuit: null,
		totalRounds: numRounds,
		numCards: numCards,
		totalPlayers: numPlayers,
		roomId: roomId,
	}

	const playerGameState = { ...rooms[roomId], playerIndex: 0 }
	console.log(playerGameState)
	ws.send(JSON.stringify(playerGameState))

	const action = { action: 'setTargets' }
	broadcastGameState(roomId, action)
}

function updateGameState(roomId, data) {
	const gameState = rooms[roomId]

	if (data.action === 'dealCards') {
		dealCards(roomId)
	}
	if (data.action === 'setTarget') {
		setPlayerTarget(roomId, data.playerIndex, data.target)
	}
	if (data.action === 'playCard') {
		playCard(roomId, data.currentPlayerIndex, data.cardIndex, data.card)
	}
	if (data.action === 'decideMasterSuit') {
		decideMasterSuit(roomId, data.masterSuit)
	}
	if (data.action === 'calculatePointsAndResetBoard') {
		calculatePointsAndResetBoard(
			roomId,
			data.currentPlayerIndex,
			data.players,
			data.masterCardplayer,
			data.round,
			data.numCards
		)
	}
	if (data.action === 'updatePlayerName') {
		const gameState = rooms[roomId]
		const playerIndex = data.playerIndex
		const newName = data.newName

		if (gameState.players[playerIndex]) {
			gameState.players[playerIndex].name = newName
		}

		broadcastGameState(roomId)
	}
}

function setPlayerTarget(roomId, playerIndex, target) {
	const gameState = rooms[roomId]

	if (gameState.players[playerIndex]) {
		gameState.players[playerIndex].target = target
	}

	const allTargetsSet = gameState.players.every(
		(player) => player.target !== null
	)
	gameState.currentPlayerIndex =
		(gameState.currentPlayerIndex + 1) % gameState.players.length

	if (allTargetsSet) {
		gameState.currentPlayerIndex =
			(gameState.currentPlayerIndex + 1) % gameState.players.length
		broadcastGameState(roomId, { action: 'gameSetupComplete' })
	} else {
		broadcastGameState(roomId, { action: 'waitingForTargets' })
	}
}

function dealCards(roomId) {
	const gameState = rooms[roomId]
	console.log('deal cards')
	const suits = ['♥', '♦', '♠', '♣']
	const values = [
		'2',
		'3',
		'4',
		'5',
		'6',
		'7',
		'8',
		'9',
		'10',
		'J',
		'Q',
		'K',
		'A',
	]
	const deck = suits.flatMap((suit) =>
		values.map((value) => ({ id: `${suit}-${value}`, suit, value }))
	)

	for (let i = deck.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[deck[i], deck[j]] = [deck[j], deck[i]]
	}

	gameState.players.forEach((player, index) => {
		gameState.players[index].hand = deck.slice(
			index * gameState.numCards,
			(index + 1) * gameState.numCards
		)
	})
	console.log(gameState.players)

	const action = { action: 'chooseMasterSuit' }
	broadcastGameState(roomId, action)
}

function playCard(roomId, currentPlayerIndex, cardIndex, card) {
	const gameState = rooms[roomId]
	const currentPlayer = gameState.players[currentPlayerIndex]

	if (gameState.firstCard === null) {
		gameState.firstCard = card
	}

	gameState.players = gameState.players.map((player, index) => {
		if (index === gameState.currentPlayerIndex) {
			return {
				...player,
				hand: player.hand.filter((_, idx) => idx !== cardIndex),
			}
		}
		return player
	})

	gameState.board.push({ currentPlayerIndex, cardIndex, card })

	if (gameState.board.length < gameState.players.length) {
		gameState.currentPlayerIndex =
			(gameState.currentPlayerIndex + 1) % gameState.players.length
	}

	if (gameState.players.every((player) => player.hand.length === 0)) {
		gameState.round++
	}

	broadcastGameState(roomId)
}

function decideMasterSuit(roomId, suit) {
	rooms[roomId].masterSuit = suit
	broadcastGameState(roomId)
}

function calculatePointsAndResetBoard(
	roomId,
	currentPlayerIndex,
	players,
	masterCardplayer,
	round,
	numCards
) {
	const gameState = rooms[roomId]
	gameState.players = players
	gameState.currentPlayerIndex = currentPlayerIndex
	gameState.masterCardplayer = masterCardplayer
	gameState.board = []
	gameState.firstCard = null
	gameState.round = round
	gameState.numCards = numCards

	broadcastGameState(roomId)
}

function broadcastGameState(roomId, action) {
	wss.clients.forEach(function each(client) {
		const clientData = clients[client.clientId] // client.clientId now exists
		if (
			clientData &&
			clientData.roomId === roomId &&
			client.readyState === WebSocket.OPEN
		) {
			const message = action
				? { ...rooms[roomId], ...action }
				: rooms[roomId]
			client.send(JSON.stringify(message))
		}
	})
}

function generateRoomId() {
	return Math.random().toString(36).substring(2, 8)
}

console.log(`Judgement is Live`)
