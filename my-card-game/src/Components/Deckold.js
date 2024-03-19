import React, { useState, useEffect } from 'react';
import "./Card.css";
import "./Default.css";
import { Card } from './Card'; 
import { w3cwebsocket as W3CWebSocket } from 'websocket'; 

const client = new W3CWebSocket('ws://10.0.0.205:8080');


export const Deck = () => {

  const [gameState, setGameState] = useState({
    players: [],
    action: null
  });
  


  const suits = ['♥', '♦', '♠', '♣'];
  const values = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A']; // Adjusted for 235 game
  const [players, setPlayers] = useState([
    { name: 'Player 1', hand: [], points: 0 },
    { name: 'Player 2', hand: [], points: 0 },
    { name: 'Player 3', hand: [], points: 0 }
  ]);
  const [round, setRound] = useState(1);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(1);
  const [firstCard, setFirstCard] = useState(null);
  const [board, setBoard] = useState([]); // Array to store played cards
  const [cardsDealt, setCardsDealt] = useState(false); 

  const sendMessage = (action) => {
    const message = JSON.stringify(action);
    client.send(message);
  };


  useEffect(() => {
    client.onopen = () => {
      console.log('WebSocket Client Connected');
    };
    client.onmessage = (message) => {
      const data = JSON.parse(message.data);
      console.log('Received action:', data);
      setGameState(data);
    };
  }, []); 

 
  const dealCards = () => {

  
    const excludedSuits = ['♣', '♦'];
    const excludedValue = '7';
    const deck = suits.flatMap(suit => values
      .filter(value => !(suit === excludedSuits[0] && value === excludedValue) && !(suit === excludedSuits[1] && value === excludedValue))
      .map(value => ({ id: `${suit}-${value}`, suit, value }))
    );
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const updatedPlayers = players.map(player => ({
      ...player,
      hand: deck.splice(0, 10)
    }));
    setPlayers(updatedPlayers);
    setCurrentPlayerIndex(round % 3);
    setFirstCard(null);

    const action = { action: 'dealCards' };
    sendMessage(action);
  


  };

  const canPlayCard = (card, playerIndex) => {
    if (playerIndex !== currentPlayerIndex) {
      return false;
    }
    if (!firstCard) {
      return true;
    } else {
      const currentPlayer = players[currentPlayerIndex];
      const hasLeadSuitCard = currentPlayer.hand.some(c => c.suit === firstCard.suit);
      return !hasLeadSuitCard || card.suit === firstCard.suit;
    }
  };

  const playCard = (cardIndex) => {
    const currentPlayer = players[currentPlayerIndex];
    const card = currentPlayer.hand[cardIndex];
    if (firstCard === null) {
      setFirstCard(card);
    }
    const updatedPlayers = [...players];
    updatedPlayers[currentPlayerIndex].hand.splice(cardIndex, 1);
    setBoard([...board, { card, playerIndex: currentPlayerIndex }]);
    setCurrentPlayerIndex((currentPlayerIndex + 1) % players.length);
    if (updatedPlayers.every((player) => player.hand.length === 0)) {
      setRound(round + 1);
    } else {
      setCurrentPlayerIndex((currentPlayerIndex + 1) % players.length);
    }
    setPlayers(updatedPlayers);
    const action = {
      currentPlayerIndex,
      action: 'playCard',
      cardIndex,
      card: { suit: card.suit, value: card.value }
    };
    sendMessage(action);

  };

  useEffect(() => {
    if (board.length === 3) {
      calculatePointsAndResetBoard();
    }
    
  });

  const calculatePointsAndResetBoard = () => {
    const winningCard = board.reduce((max, card) => {
      if (card.card.suit !== firstCard.suit && max.suit === firstCard.suit) {
        return max;
      } else if (card.card.suit === firstCard.suit && max.suit !== firstCard.suit) {
        return card.card;
      } else if (card.card.suit === firstCard.suit && max.suit === firstCard.suit) {
        if (
          card.card.value === 'A' ||
          (card.card.value === 'K' && max.value !== 'A') ||
          (card.card.value === 'Q' && max.value !== 'A' && max.value !== 'K') ||
          (card.card.value === 'J' && max.value !== 'A' && max.value !== 'K' && max.value !== 'Q') ||
          (parseInt(card.card.value) > parseInt(max.value) && max.value !== 'A' && max.value !== 'K' && max.value !== 'Q' && max.value !== 'J')
        ) {
          return card.card;
        }
      }
      return max;
    }, board[0].card);
    const winningPlayerIndex = board.find(card => card.card.id === winningCard.id).playerIndex;
    if (winningPlayerIndex !== -1) {
      players[winningPlayerIndex].points++;
    }
    setBoard([]);
    setFirstCard(null);
    setCurrentPlayerIndex(winningPlayerIndex);
    const message = JSON.stringify({ winningPlayerIndex, action: 'calculatePointsAndResetBoard' });
    client.send(message);
  };

  const renderBoard = () => {
    return (
      <div className="board-container">
        <div className="board">
          {board.map((play, index) => (
            <div key={index} style={{ margin: '5px' }}>
              <Card suit={play.card.suit} value={play.card.value} className="card-small"/>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPlayers = () => {
    return gameState.players.map((player, index) => (
      <div key={index} className="player-container">
        <p>{player.name}</p>
        <div className="hand">
          {player.hand.map((card, cardIndex) => (
            <button
              key={card.id}
              className="card-button"
              onClick={() => playCard(cardIndex)}
              disabled={!canPlayCard(card, index)}
              style={{ opacity: canPlayCard(card, index) ? 1 : 0.3 }}
            >
              <Card suit={card.suit} value={card.value} />
            </button>
          ))}
        </div>
      </div>
    ));
  };
  
  return (
    <div className="container-fluid">
      <div className="grid-container">
        <div className="players-hand-column">
          <div id="players-hand">{renderPlayers()}</div>
        </div>
  
        <div className="other-things-column">
          <div className="row">
            <div id="labels">
              <button className="deal-button" onClick={dealCards}>Deal Cards</button>
            </div>
          </div>
          <div className="row">
            <div>{renderBoard()}  </div>
          </div>
        </div>
      </div>
    </div>
  );
};