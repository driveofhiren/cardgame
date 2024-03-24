const WebSocket = require('ws');

const PORT = 8080;

const wss = new WebSocket.Server({ port: PORT });

let gameState = {
  players: [
    { name: 'A', hand: [], points: 0 },
    { name: 'B', hand: [], points: 0 },
    { name: 'C', hand: [], points: 0 }
  ],
  action: null,
  board: [],
  round : 1,
  firstCard : null,
  currentPlayerIndex : 1,
};
let nextClientId = 1; // Counter for assigning unique client IDs
let clients = {};
wss.on("connection", function connection(ws) {
  const clientId = nextClientId++;
  const playerName = gameState.players[clientId - 1].name; // Assign player name based on client ID
  console.log("New client connected " + clientId + " with name " + playerName);
  // Send gameState to new client along with the respective player's hand and assigned player index
  const playerGameState = {
    ...gameState,
    playerIndex: clientId - 1, // Assign player index to send to the client
  };
  ws.send(JSON.stringify(playerGameState));

  clients[clientId] = ws;

  ws.on("message", function incoming(message) {
    const data = JSON.parse(message);
    updateGameState(data);
  });
});



function updateGameState(data) {
  console.log('Received action:', data);
  if (data.action === 'dealCards') {
    dealCards();
   
  }
  if (data.action === 'playCard') {
    const { currentPlayerIndex, cardIndex, card } = data;
    
    playCard(currentPlayerIndex, cardIndex, card);
  }
  if(data.action === 'calculatePointsAndResetBoard') {
    console.log('Received action:', data);
    gameState.board = [];
    gameState.firstCard = null;
    gameState.currentPlayerIndex = data.currentPlayerIndex;
    gameState.players=data.players;
    console.log("Updated game state is ");
console.log(gameState);
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(gameState));
      }
    });
   
  }
}
function playCard(currentPlayerIndex, cardIndex, card) {
  const currentPlayer = gameState.players[currentPlayerIndex];

  if (gameState.firstCard === null) {
    gameState.firstCard = card;
  }

  const updatedPlayers = gameState.players.map((player, index) => {
    if (index === gameState.currentPlayerIndex) {
      return {
        ...player,
        hand: player.hand.filter((_, index) => index !== cardIndex)
      };
    }
    return player;
  });

  // Update currentPlayerIndex after updating the player's hand
  gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;

  // Push the card onto the board after updating currentPlayerIndex
  gameState.board.push({ currentPlayerIndex, cardIndex, card });

  if (updatedPlayers.every((player) => player.hand.length === 0)) {
    gameState.round++;
  }

  gameState.players = updatedPlayers;

  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(gameState));
    }
  });
}



function dealCards() {
  const suits = ['♥', '♦', '♠', '♣'];
  const values = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A']; // Adjusted for 235 game
  
  const excludedSuits = ['♣', '♦'];
  const excludedValue = '7';
  const deck = suits.flatMap(suit => values
    .filter(value => !(suit === excludedSuits[0] && value === excludedValue) && !(suit === excludedSuits[1] && value === excludedValue))
    .map(value => ({ id: `${suit}-${value}`, suit, value }))
  );
  
  // Shuffle the deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // Deal cards to players
  gameState.players.forEach((player, index) => {
    gameState.players[index].hand = deck.slice(index * 10, (index + 1) * 10);
  });

  // Broadcast the dealCards action along with the players array to all connected clients
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(gameState));
    }
  });
}

console.log(`WebSocket server listening on port ${PORT}`);