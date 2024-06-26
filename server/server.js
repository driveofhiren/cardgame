const WebSocket = require('ws')
const PORT = 8080
const wss = new WebSocket.Server({ port: PORT })

let gameState = {
	players: [
		{ name: 'P1', hand: [], points: 0, target: 2 },
		{ name: 'P2', hand: [], points: 0, target: 3 },
		{ name: 'P3', hand: [], points: 0, target: 5 },
	],
	masterCardplayer: 2,
	board: [],
	round: 1,
	firstCard: null,
	currentPlayerIndex: 2,
	masterSuit: null,
}
let nextClientId = 1 // Counter for assigning unique client IDs
let clients = {}

wss.on('connection', function connection(ws) {
	const clientId = nextClientId++
	const playerName = gameState.players[clientId - 1].name // Assign player name based on client ID
	console.log('New client connected ' + clientId + ' with name ' + playerName)
	// Send gameState to new client along with the respective player's hand and assigned player index
	const playerGameState = {
		...gameState,
		playerIndex: clientId - 1, // Assign player index to send to the client
	}
	ws.send(JSON.stringify(playerGameState))

	clients[clientId] = ws

	ws.on('message', function incoming(message) {
		const data = JSON.parse(message)
		updateGameState(data)
	})
})

function updateGameState(data) {
	// console.log('****ACTION LOGS*****', data);
	if (data.action === 'dealCards') {
		dealCards()
	}
	if (data.action === 'playCard') {
		playCard(data.currentPlayerIndex, data.cardIndex, data.card)
	}
	if (data.action === 'decideMasterSuit') {
		decideMasterSuit(data.masterSuit)
	}
	if (data.action === 'calculatePointsAndResetBoard') {
		calculatePointsAndResetBoard(
			data.currentPlayerIndex,
			data.players,
			data.masterCardplayer,
			data.round
		)
	}
}

function dealCards() {
	const suits = ['♥', '♦', '♠', '♣']
	const values = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'] // Adjusted for 235 game

	const excludedSuits = ['♣', '♦']
	const excludedValue = '7'
	const deck = suits.flatMap((suit) =>
		values
			.filter(
				(value) =>
					!(suit === excludedSuits[0] && value === excludedValue) &&
					!(suit === excludedSuits[1] && value === excludedValue)
			)
			.map((value) => ({ id: `${suit}-${value}`, suit, value }))
	)

	// Shuffle the deck
	for (let i = deck.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[deck[i], deck[j]] = [deck[j], deck[i]]
	}

	// Deal cards to players orignal
	gameState.players.forEach((player, index) => {
		gameState.players[index].hand = deck.slice(index * 10, (index + 1) * 10)
	})

	// gameState.players.forEach((player, index) => {
	// 	gameState.players[index].hand = deck.slice(index * 3, (index + 1) * 3)
	// })

	// Notify the clients to decide the master suit
	const action = {
		action: 'chooseMasterSuit',
	}

	broadcastGameState(action)
}

function playCard(currentPlayerIndex, cardIndex, card) {
	const currentPlayer = gameState.players[currentPlayerIndex]

	if (gameState.firstCard === null) {
		gameState.firstCard = card
	}

	const updatedPlayers = gameState.players.map((player, index) => {
		if (index === gameState.currentPlayerIndex) {
			return {
				...player,
				hand: player.hand.filter((_, index) => index !== cardIndex),
			}
		}
		return player
	})

	// Update currentPlayerIndex after updating the player's hand
	gameState.currentPlayerIndex =
		(gameState.currentPlayerIndex + 1) % gameState.players.length

	// Push the card onto the board after updating currentPlayerIndex
	gameState.board.push({ currentPlayerIndex, cardIndex, card })

	if (updatedPlayers.every((player) => player.hand.length === 0)) {
		gameState.round++
	}

	gameState.players = updatedPlayers

	broadcastGameState()
}

function decideMasterSuit(suit) {
	gameState.masterSuit = suit

	broadcastGameState()
}

function calculatePointsAndResetBoard(
	currentPlayerIndex,
	players,
	masterCardplayer,
	round
) {
	gameState.players = players
	gameState.currentPlayerIndex = currentPlayerIndex
	gameState.masterCardplayer = masterCardplayer
	gameState.board = []
	gameState.firstCard = null
	gameState.round = round

	broadcastGameState()
}

function broadcastGameState(action) {
	wss.clients.forEach(function each(client) {
		if (client.readyState === WebSocket.OPEN) {
			console.log(gameState)
			const message = action ? { ...gameState, ...action } : gameState
			client.send(JSON.stringify(message))
		}
	})
}

console.log(`WebSocket server listening on port ${PORT}`)
