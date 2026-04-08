const WebSocket = require('ws')
const express = require('express')
const cors = require('cors')

const HTTP_PORT = 3001
const WS_PORT = 8080

const app = express()
app.use(cors())
app.use(express.json())

const wss = new WebSocket.Server({ port: WS_PORT })

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
		playedCardsThisRound: [],  // Track unique cards per round
		pauseDetectionUntil: 0,  // Timestamp when to pause card detection (0 = no pause)
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
	const characters = 'abcdefghijklmnopqrstuvwxyz0123456789'
	let roomId = ''
	for (let i = 0; i < 4; i++) {
		roomId += characters.charAt(
			Math.floor(Math.random() * characters.length)
		)
	}
	return roomId
}

// Helper: Determine winning card from board
function getWinningCard(board, masterSuit, firstCard) {
	const cardValueOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
	const getValueIndex = (value) => cardValueOrder.indexOf(value)

	return board.reduce((max, card) => {
		const isMasterSuit = card.card.suit === masterSuit
		const isInitialSuit = card.card.suit === firstCard.suit
		const isMaxSuitMaster = max.suit === masterSuit
		const isMaxSuitInitial = max.suit === firstCard.suit

		if (isMasterSuit && (!isMaxSuitMaster || (isMaxSuitInitial && !isInitialSuit))) {
			return card.card
		} else if (isInitialSuit && !isMaxSuitMaster && !isMaxSuitInitial) {
			return card.card
		} else if (isMasterSuit === isMaxSuitMaster && isInitialSuit === isMaxSuitInitial) {
			if (getValueIndex(card.card.value) > getValueIndex(max.value)) {
				return card.card
			}
		}

		return max
	}, board[0].card)
}

// Handle detected card - auto-play and check for round completion
function handleDetectedCard(roomId, detectedRank, detectedSuit, confidence) {
	const gameState = rooms[roomId]
	if (!gameState) return { success: false, message: 'Room not found' }

	// Check if detection is paused (after round completion)
	const now = Date.now()
	if (gameState.pauseDetectionUntil > now) {
		const secondsLeft = Math.ceil((gameState.pauseDetectionUntil - now) / 1000)
		console.log(`\n  ⏸️  DETECTION PAUSED for new round (${secondsLeft}s left)`)
		return { success: false, message: `Detection paused. Please wait ${secondsLeft}s for next round.`, confidence }
	}

	const currentPlayerIndex = gameState.currentPlayerIndex
	const currentPlayer = gameState.players[currentPlayerIndex]

	console.log(`\n  🔍 Processing card detection...`)
	console.log(`    Player: ${currentPlayer.name}`)
	console.log(`    Detected card: ${detectedRank}${detectedSuit}`)

	// Create card object directly from camera detection (no hand validation needed)
	const card = {
		value: detectedRank,
		suit: detectedSuit,
		id: `${detectedSuit}-${detectedRank}`
	}
	
	console.log(`    ✓ Using detected card: ${card.value}${card.suit}`)

	// Check if card already played THIS ROUND (prevent duplicates in same round)
	const cardAlreadyPlayedThisRound = gameState.playedCardsThisRound.some(
		(playedCard) => playedCard.value === card.value && playedCard.suit === card.suit
	)
	
	if (cardAlreadyPlayedThisRound) {
		console.log(`    ❌ DUPLICATE THIS ROUND - ${card.value}${card.suit} already played!`)
		console.log(`    Cards played this round: ${gameState.playedCardsThisRound.map(c => `${c.value}${c.suit}`).join(', ')}`)
		return { success: false, message: 'Card already played in this round', confidence }
	}
	
	console.log(`    ✓ Card is unique this round`)

	// Check if round already has all players' cards
	if (gameState.board.length >= gameState.players.length) {
		console.log(`    ❌ BOARD FULL - Already have ${gameState.board.length} cards (need ${gameState.players.length})`)
		return { success: false, message: 'All players already played this round', confidence }
	}
	
	console.log(`    ✓ Board space available (${gameState.board.length + 1}/${gameState.players.length})`)

	// Check suit rules - if not first card, validate suit constraint
	if (gameState.firstCard) {
		console.log(`    Checking suit constraint (first card: ${gameState.firstCard.value}${gameState.firstCard.suit})`)
		// Note: We're accepting the camera detection directly, so we just log what would be the rule
		if (card.suit !== gameState.firstCard.suit) {
			console.log(`    ⚠️  Card is different suit than first card (${card.suit} vs ${gameState.firstCard.suit})`)
			console.log(`    → (Camera detection accepted directly - no hand validation)`)
		} else {
			console.log(`    ✓ Card matches lead suit`)
		}
	} else {
		console.log(`    ✓ First card of round`)
	}

	// Auto-play the card
	if (gameState.firstCard === null) {
		gameState.firstCard = card
		console.log(`    → Setting as first card of round`)
	}

	// Add card to board
	gameState.board.push({ currentPlayerIndex, cardIndex: -1, card })
	
	// Add card to played cards tracking (per round)
	gameState.playedCardsThisRound.push(card)
	console.log(`    → Added to played cards this round: ${gameState.playedCardsThisRound.map(c => `${c.value}${c.suit}`).join(', ')}`)
	
	// Remove one card from player's hand (any card - doesn't matter which)
	if (gameState.players[currentPlayerIndex].hand.length > 0) {
		gameState.players[currentPlayerIndex].hand.pop()
		console.log(`    ✓ Removed card from ${currentPlayer.name}'s hand (${gameState.players[currentPlayerIndex].hand.length} cards left)`)
	}
	
	console.log(`    ✓ Card played! Board now has ${gameState.board.length}/${gameState.players.length} cards`)

	// Check if all players have played
	if (gameState.board.length === gameState.players.length) {
		console.log(`    ✓ All players have played - calculating winner...`)
		// All players played - calculate winner
		const winningCard = getWinningCard(gameState.board, gameState.masterSuit, gameState.firstCard)
		const winningPlayerIndex = gameState.board.find((c) => c.card === winningCard).currentPlayerIndex

		console.log(`    Winner: ${gameState.players[winningPlayerIndex].name} with ${winningCard.value}${winningCard.suit}`)

		// Update points
		gameState.players[winningPlayerIndex].points += 1
		console.log(`    Points: ${gameState.players[winningPlayerIndex].name} = ${gameState.players[winningPlayerIndex].points}`)

		// Check if round is over (all players out of cards)
		const allHandsEmpty = gameState.players.every((p) => p.hand.length === 0)
		console.log(`    Hands remaining: ${gameState.players.map(p => `${p.name}:${p.hand.length}`).join(', ')}`)

		if (allHandsEmpty) {
			console.log(`    💯 Round complete - all hands empty`)
			// Round complete - calculate rankings and scores
			gameState.players.forEach((player) => {
				if (player.points === player.target) {
					player.fp = player.fp + player.target + 10
					console.log(`    ✓ ${player.name}: Points matched target! FP += ${player.target + 10}`)
				}
			})

			const ranks = {}
			const sortedPlayers = gameState.players.slice().sort((a, b) => b.fp - a.fp)
			let currentRank = 1
			sortedPlayers.forEach((player) => {
				const fp = player.fp
				if (!ranks[fp]) {
					ranks[fp] = currentRank
					currentRank++
				}
			})

			gameState.players.forEach((player) => {
				player.rank = ranks[player.fp]
			})

			// Check if game is over
			if (gameState.numCards > 1) {
				gameState.numCards--
				console.log(`    → Next round (${gameState.numCards} cards left)`)
			} else {
				// Game over - winners determined
				const winners = gameState.players.filter((p) => p.rank === 1)
				console.log(`    🏆 GAME OVER - Winners: ${winners.map(w => w.name).join(', ')}`)
				broadcastGameState(roomId, { action: 'gameOver', winners })
				return { success: true, message: 'Game over', confidence }
			}

			// Reset for new round
			gameState.players.forEach((player) => {
				player.target = null
				player.points = 0
			})
			gameState.round++
			gameState.currentPlayerIndex = (gameState.round - 1) % gameState.players.length
			gameState.board = []
			gameState.firstCard = null
			gameState.masterSuit = null
			gameState.playedCardsThisRound = []  // RESET for new round - cards can be reused
			gameState.pauseDetectionUntil = Date.now() + 5000  // Pause detection for 5 seconds
			console.log(`    → New round started! Pausing detection until next round ready.`)
			console.log(`    → Played cards cleared for round ${gameState.round}`)
		} else {
			// Continue to next player in SAME round
			gameState.currentPlayerIndex = winningPlayerIndex
			gameState.board = []
			gameState.firstCard = null
			// NOTE: playedCardsThisRound is NOT reset - cards stay tracked for this round
		}
	} else {
		// Move to next player
		gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length
		console.log(`    → Next player: ${gameState.players[gameState.currentPlayerIndex].name}`)
	}

	broadcastGameState(roomId)
	return { success: true, message: 'Card played', confidence, playerName: currentPlayer.name }
}

console.log(`Judgement is Live`)

// HTTP endpoint for card detection from Python
app.post('/detect-card', (req, res) => {
	const { roomId, rank, suit, confidence } = req.body

	console.log('\n' + '='.repeat(70))
	console.log('🔵 RECEIVED CARD DETECTION FROM PYTHON')
	console.log('='.repeat(70))
	console.log(`Time: ${new Date().toLocaleTimeString()}`)
	console.log(`Room ID: ${roomId}`)
	console.log(`Card: ${rank}${suit}`)
	console.log(`Confidence: ${confidence}`)

	if (!roomId || !rank || !suit || confidence === undefined) {
		console.log('❌ ERROR: Missing required fields')
		console.log(`   Received: roomId=${roomId}, rank=${rank}, suit=${suit}, confidence=${confidence}`)
		console.log('='.repeat(70) + '\n')
		return res.status(400).json({ error: 'Missing required fields: roomId, rank, suit, confidence' })
	}

	// Check if room exists - use specified room or fallback to any available room
	let actualRoomId = roomId
	let gameState = rooms[roomId]
	
	if (!gameState) {
		// Try to find any available room
		const availableRooms = Object.keys(rooms)
		if (availableRooms.length > 0) {
			actualRoomId = availableRooms[0]
			gameState = rooms[actualRoomId]
			console.log(`⚠️  FALLBACK: Room "${roomId}" not found`)
			console.log(`   Using available room: ${actualRoomId}`)
		} else {
			console.log(`❌ ERROR: Room "${roomId}" not found and no rooms available`)
			console.log(`   Available rooms: NONE`)
			console.log('='.repeat(70) + '\n')
			return res.status(400).json({ success: false, message: 'No rooms available' })
		}
	}

	console.log(`✓ Room found: ${actualRoomId}`)
	console.log(`  Players: ${gameState.players.length}`)
	console.log(`  Current player index: ${gameState.currentPlayerIndex}`)
	console.log(`  Current player: ${gameState.players[gameState.currentPlayerIndex].name}`)
	
	const result = handleDetectedCard(actualRoomId, rank, suit, confidence)
	
	console.log(`📋 Result:`);
	console.log(`  Success: ${result.success}`)
	console.log(`  Message: ${result.message}`)
	if (result.playerName) console.log(`  Player: ${result.playerName}`)
	console.log('='.repeat(70) + '\n')
	
	if (result.success) {
		res.json({ 
			success: true, 
			message: result.message, 
			playerName: result.playerName,
			pauseUntil: gameState.pauseDetectionUntil
		})
	} else {
		res.status(400).json({ 
			success: false, 
			message: result.message,
			pauseUntil: gameState.pauseDetectionUntil
		})
	}
})

app.listen(HTTP_PORT, () => {
	console.log(`Card Detection HTTP endpoint listening on port ${HTTP_PORT}`)
})

console.log(`WebSocket server listening on port ${WS_PORT}`)
