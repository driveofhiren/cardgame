import React, { useState, useEffect } from 'react'
import './Card.css'
import './Default.css'
import { Card } from './Card'
import { Setup } from './Setup'
import { w3cwebsocket as W3CWebSocket } from 'websocket'
import 'bootstrap/dist/css/bootstrap.min.css'

const client = new W3CWebSocket('ws://192.168.2.81:8080')

export const Deck = () => {
	const [gameState, setGameState] = useState(null)
	const [playerIndex, setPlayerIndex] = useState(-1)
	const [target, setTarget] = useState('')

	const sendMessage = (action) => {
		if (client.readyState === WebSocket.OPEN) {
			const message = JSON.stringify(action)
			client.send(message)
		} else {
			console.error('WebSocket connection is not open.')
		}
	}

	useEffect(() => {
		client.onmessage = (message) => {
			const data = JSON.parse(message.data)
			if (data.totalRounds) {
				setGameState(data)
			}

			if (data.playerIndex !== undefined) {
				setPlayerIndex(data.playerIndex) // Set player index received from the server
			}
			if (data.action === 'chooseMasterSuit') {
				const action = {
					action: 'decideMasterSuit',
					masterSuit: null,
				}
				sendMessage(action)
			}
		}
	}, [])
	useEffect(() => {
		if (gameState && gameState.board.length === gameState.players.length) {
			setTimeout(() => {
				calculatePointsAndResetBoard()
			}, 1000)
		}
	}, [gameState ? gameState.board : []])

	useEffect(() => {
		if (gameState) {
			const allHandsEmpty = gameState.players.every(
				(player) => player.hand.length === 0
			)
			if (allHandsEmpty) {
				setGameState((prevState) => ({
					...prevState,
					masterSuit: null,
				}))
				// const action = {
				// 	action: 'chooseMasterSuit',
				// 	masterSuit: null,
				// }
				// sendMessage(action)
			}

			if (!gameState.masterSuit) {
				// Determine the master suit based on the round number
				const suits = ['♠', '♦', '♣', '♥'] // Cycles through Spades, Diamonds, Hearts
				const suitIndex = (gameState.round - 1) % suits.length
				const selectedSuit = suits[suitIndex]

				// Automate the master suit selection
				const action = {
					action: 'decideMasterSuit',
					masterSuit: selectedSuit,
				}
				sendMessage(action)
			}
			//if mastersuit is null
		}
	}, [gameState ? gameState.players : []])

	const startGame = (config) => {
		if (client.readyState === WebSocket.OPEN) {
			const action = { action: 'setup', config }
			client.send(JSON.stringify(action))
		} else {
			client.onopen = () => {
				console.log('WebSocket Client Connected')
				const action = { action: 'setup', config }
				client.send(JSON.stringify(action))
			}
		}
	}
	const setPlayerTarget = (target) => {
		if (client.readyState === WebSocket.OPEN) {
			const action = { action: 'setTarget', playerIndex, target }
			client.send(JSON.stringify(action))
		}
	}
	if (!gameState) {
		return <Setup onStartGame={startGame} />
	}

	const renderTargetSetting = () => {
		if (gameState && !gameState.players[playerIndex].target) {
			return (
				<div>
					<h3>Set Your Target</h3>
					<input
						type="number"
						value={target}
						onChange={(e) => setTarget(e.target.value)}
						min="1"
						max="10"
					/>
					<button onClick={() => setPlayerTarget(Number(target))}>
						Set Target
					</button>
				</div>
			)
		}
		return null
	}

	const dealCards = () => {
		const action = { action: 'dealCards' }
		sendMessage(action)
	}

	const canPlayCard = (card, playerIndex) => {
		if (playerIndex !== gameState.currentPlayerIndex) {
			return false
		}
		//if any player with null target
		if (gameState.players.some((p) => p.target === null)) return false
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
					if (player.points === player.target)
						player.fp = player.fp + player.target + 10
				})

				if (gameState.numCards > 1) {
					//decrement it
					gameState.numCards = gameState.numCards - 1
				} else {
					//find max fp of players.fp
					const maxFP = Math.max(
						...gameState.players.map((player) => player.fp)
					)
					//find index of player with maxfp
					const maxFPIndex = gameState.players.findIndex(
						(player) => player.fp === maxFP
					)
					alert(
						gameState.players[maxFPIndex].name +
							'_Won with_' +
							maxFP +
							'-Points!'
					)
				}
				//make all player point 0
				updatedPlayers.forEach((player) => {
					player.target = null
					player.points = 0
				})

				//logic for deciding mastercard based on max target
				// let MasterCardPlayer = null
				// let maxTarget = -Infinity // Initialize maxTarget to a very low value

				// updatedPlayers.forEach((player, index) => {
				// 	if (player.target > maxTarget) {
				// 		maxTarget = player.target
				// 		MasterCardPlayer = index
				// 	}
				// })
				gameState.currentPlayerIndex =
					(gameState.round - 1) % gameState.players.length

				const action = {
					action: 'calculatePointsAndResetBoard',
					masterCardplayer: null,
					currentPlayerIndex: gameState.currentPlayerIndex,
					players: updatedPlayers,
					round: gameState.round,
					masterSuit: null,
					numCards: gameState.numCards,
				}
				sendMessage(action)
			} else {
				// let MasterCardPlayer = null
				// gameState.players.forEach((player, index) => {
				// 	if (player.target === 5) {
				// 		MasterCardPlayer = index
				// 	}
				// })

				setGameState((prevState) => ({
					...prevState,
					players: updatedPlayers,
					currentPlayerIndex: winningPlayerIndex,
				}))

				const action = {
					action: 'calculatePointsAndResetBoard',
					masterCardplayer: gameState.masterCardplayer,
					currentPlayerIndex: winningPlayerIndex,
					players: updatedPlayers,
					round: gameState.round,
					masterSuit: gameState.masterSuit,
					numCards: gameState.numCards,
				}
				sendMessage(action)
			}
		}
	}

	const chooseMasterSuit = (suit) => {
		const action = {
			action: 'decideMasterSuit',
			masterSuit: suit,
		}
		sendMessage(action)
	}

	const renderMasterSuitSelection = () => {
		if (
			gameState &&
			playerIndex === gameState.masterCardplayer &&
			gameState.masterSuit
		) {
			const chooseMasterSuitAndUpdatePlayer = (suit) => {
				chooseMasterSuit(suit)
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
		return null
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
							<div className="mt-3">
								<h2>Scoreboard</h2>
							</div>
							{/* <div className="row">
								<div className="mt-3">
									{renderMasterSuitSelection()}
								</div>
							</div> */}
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
										{player.name} - CP: {player.points} -
										Points: {player.fp} - Target :{' '}
										{player.target}
									</p>
								))}
							</div>

							{renderTargetSetting()}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
