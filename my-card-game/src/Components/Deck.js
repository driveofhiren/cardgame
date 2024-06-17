import React, { useState, useEffect } from 'react'
import './Card.css'
import './Default.css'
import { Card } from './Card'
import { w3cwebsocket as W3CWebSocket } from 'websocket'
import 'bootstrap/dist/css/bootstrap.min.css'

const client = new W3CWebSocket('ws://192.168.0.21:8080')

export const Deck = () => {
	const [gameState, setGameState] = useState({
		players: [
			{ name: 'A', hand: [], points: 0, target: 2 },
			{ name: 'B', hand: [], points: 0, target: 3 },
			{ name: 'C', hand: [], points: 0, target: 5 },
		],
		masterCardplayer: 2,
		board: [],
		round: 1,
		firstCard: null,
		currentPlayerIndex: 2,
		masterSuit: null,
	})

	const [playerIndex, setPlayerIndex] = useState(-1)
	const [masterCardplayer, setmasterCardplayer] = useState(
		gameState.masterCardplayer
	)

	const sendMessage = (action) => {
		if (client.readyState === WebSocket.OPEN) {
			const message = JSON.stringify(action)
			client.send(message)
		} else {
			console.error('WebSocket connection is not open.')
		}
	}

	useEffect(() => {
		client.onopen = () => {
			console.log('WebSocket Client Connected')
		}
		client.onmessage = (message) => {
			const data = JSON.parse(message.data)
			console.log('Received action:', data)
			setGameState(data)
			if (data.playerIndex !== undefined) {
				setPlayerIndex(data.playerIndex) // Set player index received from the server
			}
			if (data.action === 'chooseMasterSuit') {
				// If the current player is prompted to choose the master suit
				// Implement logic to allow the player to choose the master suit
				// For simplicity, you can display a prompt or UI to select a suit and then send it back to the server.
				// Example:
				// const suit = prompt('Choose the master suit (♥, ♦, ♠, ♣):');
				const action = {
					action: 'decideMasterSuit',
					masterSuit: null,
				}
				sendMessage(action)
			}
		}
	}, [])

	const dealCards = () => {
		const action = { action: 'dealCards' }
		sendMessage(action)
	}

	const canPlayCard = (card, playerIndex) => {
		if (playerIndex !== gameState.currentPlayerIndex) {
			return false
		}
		if (!gameState.firstCard) {
			if (!gameState.masterSuit) {
				return false
			} else {
				return true
			}
		} else {
			const currentPlayer =
				gameState.players[gameState.currentPlayerIndex]
			const hasLeadSuitCard = currentPlayer.hand.some(
				(c) => c.suit === gameState.firstCard.suit
			)

			return !hasLeadSuitCard || card.suit === gameState.firstCard.suit
		}
	}

	const playCard = (cardIndex) => {
		const currentPlayer = gameState.players[gameState.currentPlayerIndex]
		const card = currentPlayer.hand[cardIndex]

		const action = {
			currentPlayerIndex: gameState.currentPlayerIndex,
			action: 'playCard',
			cardIndex,
			card: { suit: card.suit, value: card.value },
		}
		sendMessage(action)
	}

	useEffect(() => {
		if (gameState.board.length === 3) {
			setTimeout(() => {
				calculatePointsAndResetBoard()
			}, 1000)
		}
	}, [gameState.board])

	useEffect(() => {
		const allHandsEmpty = gameState.players.every(
			(player) => player.hand.length === 0
		)

		if (allHandsEmpty) {
			setGameState((prevState) => ({
				...prevState,
				masterSuit: null,
			}))
		}
	}, [gameState.players])

	const calculatePointsAndResetBoard = () => {
		const masterSuit = gameState.masterSuit
		const winningCard = gameState.board.reduce((max, card) => {
			if (card.card.suit === masterSuit && max.suit !== masterSuit) {
				return card.card
			} else if (
				card.card.suit !== masterSuit &&
				max.suit === masterSuit
			) {
				return max
			}
			if (
				card.card.value === 'A' ||
				(card.card.value === 'K' && max.value !== 'A') ||
				(card.card.value === 'Q' &&
					max.value !== 'A' &&
					max.value !== 'K') ||
				(card.card.value === 'J' &&
					max.value !== 'A' &&
					max.value !== 'K' &&
					max.value !== 'Q') ||
				(parseInt(card.card.value) > parseInt(max.value) &&
					max.value !== 'A' &&
					max.value !== 'K' &&
					max.value !== 'Q' &&
					max.value !== 'J')
			) {
				return card.card
			}
			return max
		}, gameState.board[0].card)

		const winningPlayerIndex = gameState.board.find(
			(card) => card.card === winningCard
		).currentPlayerIndex

		if (winningPlayerIndex !== -1) {
			const updatedPlayers = [...gameState.players]
			updatedPlayers[winningPlayerIndex] = {
				...updatedPlayers[winningPlayerIndex],
				points: updatedPlayers[winningPlayerIndex].points + 1,
			}

			const allHandsEmpty = gameState.players.every(
				(player) => player.hand.length === 0
			)

			if (allHandsEmpty) {
				updatedPlayers.forEach((player) => {
					if (player.target === 5) {
						player.target = 2
					} else if (player.target === 2) {
						player.target = 3
					} else if (player.target === 3) {
						player.target = 5
					}
				})

				let MasterCardPlayer = null
				updatedPlayers.forEach((player, index) => {
					if (player.target === 5) {
						MasterCardPlayer = index
					}
				})

				updatedPlayers.forEach((player) => {
					player.points = player.points - player.target
				})

				const action = {
					action: 'calculatePointsAndResetBoard',
					masterCardplayer: MasterCardPlayer,
					currentPlayerIndex: MasterCardPlayer,
					players: updatedPlayers,
					round: gameState.round,
					masterSuit: null,
				}
				sendMessage(action)
			} else {
				let MasterCardPlayer = null
				gameState.players.forEach((player, index) => {
					if (player.target === 5) {
						MasterCardPlayer = index
					}
				})
				setGameState((prevState) => ({
					...prevState,
					players: updatedPlayers,
					currentPlayerIndex: winningPlayerIndex,
				}))

				const action = {
					action: 'calculatePointsAndResetBoard',
					masterCardplayer: MasterCardPlayer,
					currentPlayerIndex: winningPlayerIndex,
					players: updatedPlayers,
					round: gameState.round,
					masterSuit: gameState.masterSuit,
				}
				sendMessage(action)
			}
		}
	}

	const chooseMasterSuit = (suit) => {
		// setMasterSuitSelection(suit); // Set selected master suit
		const action = {
			action: 'decideMasterSuit',
			masterSuit: suit,
		}
		sendMessage(action)
	}

	const renderMasterSuitSelection = () => {
		// Check if it's the first player's turn, the master suit hasn't been chosen yet, and the player hasn't selected a suit
		if (
			playerIndex === gameState.masterCardplayer && // Only allow the first player to choose the master suit
			// Check if the master suit hasn't been selected yet
			!gameState.masterSuit // Check if the master suit hasn't been set yet
		) {
			const chooseMasterSuitAndUpdatePlayer = (suit) => {
				chooseMasterSuit(suit) // Call chooseMasterSuit function with the selected suit
				// Set masterCardPlayer to the current player index
			}

			return (
				<div style={{ display: 'flex', flexWrap: 'wrap' }}>
					<div
						style={{
							width: '50%',
							display: 'flex',
							justifyContent: 'center',
						}}
					>
						<a
							onClick={() => chooseMasterSuitAndUpdatePlayer('♥')}
							style={{ margin: '5px' }}
						>
							<Card suit="♥" value="" />
						</a>
						<a
							onClick={() => chooseMasterSuitAndUpdatePlayer('♦')}
							style={{ margin: '5px' }}
						>
							<Card suit="♦" value="" />
						</a>
					</div>
					<div
						style={{
							width: '50%',
							display: 'flex',
							justifyContent: 'center',
						}}
					>
						<a
							onClick={() => chooseMasterSuitAndUpdatePlayer('♠')}
							style={{ margin: '5px' }}
						>
							<Card suit="♠" value="" />
						</a>
						<a
							onClick={() => chooseMasterSuitAndUpdatePlayer('♣')}
							style={{ margin: '5px' }}
						>
							<Card suit="♣" value="" />
						</a>
					</div>
				</div>
			)
		}
		return null // Return null if the condition isn't met
	}

	const renderBoard = () => {
		return (
			<div className="board-container">
				<div className="board">
					{gameState.board &&
						gameState.board.length > 0 &&
						gameState.board.map((play, index) => (
							<div
								key={index}
								style={{
									position: 'absolute',
									left: `${index * 50}px`,
									top: '50%',
									transform: 'translateY(-50%)',
									zIndex: index,
								}}
								className="card-container"
							>
								<Card
									suit={play.card.suit}
									value={play.card.value}
									className="card-small"
								/>
							</div>
						))}
				</div>
			</div>
		)
	}

	const renderPlayers = () => {
		return gameState.players.map((player, index) => (
			<div key={index} className={`player-container`}>
				<h4>{player.name}</h4>
				<div className="hand">
					{playerIndex === index ? (
						player.hand.map((card, cardIndex) => (
							<button
								key={card.id}
								className="card-button"
								onClick={() => playCard(cardIndex)}
								disabled={!canPlayCard(card, index)}
								style={{
									opacity: canPlayCard(card, index) ? 1 : 0.3,
								}}
							>
								<Card suit={card.suit} value={card.value} />
							</button>
						))
					) : (
						<div>
							<i>Hidden</i>
						</div>
					)}
				</div>
			</div>
		))
	}

	const masterCard = gameState.masterSuit
		? { suit: gameState.masterSuit, value: 'Master' }
		: null

	return (
		<div className="container-fluid">
			<div className="grid-container">
				{/* Left column */}
				<div className="players-hand-column">
					<div
						id="players-hand"
						className="d-flex flex-column align-items-center"
					>
						{renderPlayers()}
					</div>
					<div className="row">
						<div className="mt-3">{renderBoard()}</div>
					</div>
				</div>

				{/* Right column */}
				<div className="other-things-column">
					<div className="row">
						<div
							id="labels"
							className="d-flex flex-column align-items-center"
						>
							{!gameState.masterSuit && (
								<button
									className="btn btn-primary deal-button"
									onClick={dealCards}
								>
									Deal Cards
								</button>
							)}
							<div className="mt-3">Round: {gameState.round}</div>

							{masterCard && (
								<div style={{ margin: '5px' }}>
									<Card
										suit={masterCard.suit}
										className="card-small"
									/>
								</div>
							)}
							<div className="row">
								<div className="mt-3">
									{renderMasterSuitSelection()}
								</div>
							</div>
							<div className="mt-3">
								<h2>Scoreboard</h2>
							</div>

							<div>
								{gameState.players.map((player, index) => (
									<p
										key={index}
										className={`${
											index ===
											gameState.currentPlayerIndex
												? 'current-player'
												: ''
										}`}
									>
										{player.name} - Points: {player.points}{' '}
										- Target : {player.target}
									</p>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
