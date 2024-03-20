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

wss.on('connection', function connection(ws) {
  console.log('New client connected');

  ws.send(JSON.stringify(gameState));

  ws.on('message', function incoming(message) {
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
}

function playCard(currentPlayerIndex, cardIndex, card) {
  const currentPlayer = gameState.players[currentPlayerIndex];

  if(gameState.firstCard===null){
    gameState.firstCard=card;
  }

  const updatedPlayers = [...gameState.players];
  const updatedPlayer = {
    ...currentPlayer,
    hand: currentPlayer.hand.filter((_, index) => index !== cardIndex)
  };
  updatedPlayers[currentPlayerIndex] = updatedPlayer;
  gameState.board.push({ currentPlayerIndex, cardIndex, card });
  console.log(gameState.board);


  gameState.currentPlayerIndex=(gameState.currentPlayerIndex + 1) % gameState.players.length;
  if (updatedPlayers.every((player) => player.hand.length === 0)) {
    gameState.round++;
     } else {
      gameState.currentPlayerIndex=(gameState.currentPlayerIndex + 1) % gameState.players.length;
     }
  gameState.players = updatedPlayers;


  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ action: 'playCard', gameState }));
    }
  });
  
  // Update board
  // gameState.board = [...gameState.board, { card, playerIndex: currentPlayerIndex }];
 
  // const action = {
  //   currentPlayerIndex,
  //   action: 'playCard',
  //   cardIndex,
  //   card: { suit: card.suit, value: card.value }
  // };
  // updateGameState(action);
  // console.log(gameState.currentPlayerIndex);
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
      client.send(JSON.stringify({ action: 'dealCards'}));
    }
  });
}

console.log(`WebSocket server listening on port ${PORT}`);