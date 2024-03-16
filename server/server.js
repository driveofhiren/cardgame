const WebSocket = require('ws');

const PORT = 8080;

const wss = new WebSocket.Server({ port: PORT });

let gameState = {
  players: [],
  action: null, 
};

wss.on('connection', function connection(ws) {
  console.log('New client connected');

  ws.send(JSON.stringify(gameState));

  ws.on('message', function incoming(message) {
    const data = JSON.parse(message);
    updateGameState(data);
    // wss.clients.forEach(function each(client) {
    //   if (client.readyState === WebSocket.OPEN) {
    //     client.send(JSON.stringify(gameState));
    //   }
    // }); 
  });
});

function updateGameState(data) {
  console.log('Received action:', data);
  if (data.action === 'dealCards') {
    // Broadcast the dealCards action along with the players array to all connected clients
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ action: 'dealCards', players: gameState.players }));
      }
    });
  }
}



console.log(`WebSocket server listening on port ${PORT}`);
