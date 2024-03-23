import React, { useState, useEffect } from 'react';
import "./Card.css";
import "./Default.css";
import { Card } from './Card'; 
import { w3cwebsocket as W3CWebSocket } from 'websocket'; 

const client = new W3CWebSocket('ws://10.0.0.205:8080');


export const Deck = () => { 
  
  const [gameState, setGameState] = useState({
    players: [{ name: 'A', hand: [], points: 0 },
    { name: 'B', hand: [], points: 0 },
    { name: 'C', hand: [], points: 0 }],
    action: null,
    board: [],
    round : 1,
    firstCard : null,
    currentPlayerIndex : 1,
    
  });
  const suits = ['♥', '♦', '♠', '♣'];
  const values = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A']; // Adjusted for 235 game

  const [round, setRound] = useState(1);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(1);
  const [firstCard, setFirstCard] = useState(null);
  const [board, setBoard] = useState([]); // Array to store played cards
  const [cardsDealt, setCardsDealt] = useState(false); 

  const sendMessage = (action) => {
    if (client.readyState === WebSocket.OPEN) {
      const message = JSON.stringify(action);
      client.send(message);
    } else {
      console.error("WebSocket connection is not open.");
    }
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
    // console.log(gameState);
  
    // const excludedSuits = ['♣', '♦'];
    // const excludedValue = '7';
    // const deck = suits.flatMap(suit => values
    //   .filter(value => !(suit === excludedSuits[0] && value === excludedValue) && !(suit === excludedSuits[1] && value === excludedValue))
    //   .map(value => ({ id: `${suit}-${value}`, suit, value }))
    // );
    // for (let i = deck.length - 1; i > 0; i--) {
    //   const j = Math.floor(Math.random() * (i + 1));
    //   [deck[i], deck[j]] = [deck[j], deck[i]];
    // }
    // const updatedPlayers = players.map(player => ({
    //   ...player,
    //   hand: deck.splice(0, 10)
    // }));
    // setPlayers(updatedPlayers);
    // setCurrentPlayerIndex(round % 3);
    // setFirstCard(null);

    const action = { action: 'dealCards' };
    sendMessage(action);
  


  };

  const canPlayCard = (card, playerIndex) => {
    if (playerIndex !==   gameState.currentPlayerIndex) {
      return false;
    }
    if (!gameState.firstCard) {
      return true;
    } else {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      const hasLeadSuitCard = currentPlayer.hand.some(c => c.suit === gameState.firstCard.suit);
      return !hasLeadSuitCard || card.suit === gameState.firstCard.suit;
    }
  };

  const playCard = (cardIndex) => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const currentPlayerIndex=gameState.currentPlayerIndex;
    const card = currentPlayer.hand[cardIndex];
    // if (firstCard === null) {
    //   setFirstCard(card);
    // }
    // const updatedPlayers = [...gameState.players];
    // updatedPlayers[currentPlayerIndex].hand.splice(cardIndex, 1);
    // setBoard([...board, { card, playerIndex: currentPlayerIndex }]);
    // setCurrentPlayerIndex((currentPlayerIndex + 1) % gameState.players.length);
    // if (updatedPlayers.every((player) => player.hand.length === 0)) {
    //   setRound(round + 1);
    // } else {
    //   setCurrentPlayerIndex((currentPlayerIndex + 1) % gameState.players.length);
    // }
    // gameState.players=updatedPlayers;
    
    const action = {
      currentPlayerIndex,
      action: 'playCard',
      cardIndex,
      card: { suit: card.suit, value: card.value }
    };
    sendMessage(action);

  };

  useEffect(() => {
    if (gameState.board.length === 3) {
      calculatePointsAndResetBoard();
    }
    
  },[gameState.board]);

  const calculatePointsAndResetBoard = () => {
    console.log(gameState.board)
    const winningCard = gameState.board.reduce((max, card) => {
      if (card.card.suit !== gameState.firstCard.suit && max.suit === gameState.firstCard.suit) {
        return max;
      } else if (card.card.suit === gameState.firstCard.suit && max.suit !== gameState.firstCard.suit) {
        return card.card;
      } else if (card.card.suit === gameState.firstCard.suit && max.suit === gameState.firstCard.suit) {
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
    }, gameState.board[0].card);
    
    console.log('Winning card:', winningCard);
    
    const winningPlayerIndex = 
    //currentplayerindex property of winning card  
    gameState.board.find(card => card.card === winningCard).currentPlayerIndex;
      console.log('Winning PLAYER:', winningPlayerIndex);
    
    if (winningPlayerIndex !== -1) {
      // Create a copy of gameState.players
      const updatedPlayers = [...gameState.players];
      // Update the points for the winning player
      updatedPlayers[winningPlayerIndex] = {
        ...updatedPlayers[winningPlayerIndex],
        points: updatedPlayers[winningPlayerIndex].points + 1
      };
      // Update gameState with the new players array
      // setGameState(prevState => ({
      //   ...prevState,
      //   board: [],
      //   firstCard: null,
      //   players: updatedPlayers,
      //   currentPlayerIndex: winningPlayerIndex 
      // }));


      const action = { action: 'calculatePointsAndResetBoard', 
                       currentPlayerIndex : winningPlayerIndex, 
                       players: updatedPlayers 
                      };
      sendMessage(action);
  
    }


 
  };
  
  
  const renderBoard = () => {
    if (!gameState.board || gameState.board.length === 0) {
      return <div>No cards played yet.</div>;
    }
    return (
      <div className="board-container">
        <div className="board">
          {gameState.board.map((play, index) => (
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
        {/* Left column */}
        <div className="players-hand-column">
          <div id="players-hand">{renderPlayers()}</div>
        </div>
  
        {/* Right column */}
        <div className="other-things-column">
          <div className="row">
          <div id="labels">
            <button className="deal-button" onClick={dealCards}>Deal Cards</button>
            <div>Round: {round}</div>
            <div><h2>Scoreboard</h2></div>
            <div>
            {gameState.players.map((player, index) => (
            <p key={index}>{player.name} - Points: {player.points}</p>))}
            </div>
            </div>
            </div>
            <div className="row">
            <div>{renderBoard()}  </div>
          </div>
        </div>
      </div>
    </div>
  );
  }   