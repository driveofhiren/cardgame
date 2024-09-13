import React, { useState, useEffect } from 'react'
import './Card.css'
import './Default.css'
import { Card } from './Card'
import { Setup } from './Setup'
import { w3cwebsocket as W3CWebSocket } from 'websocket'
import 'bootstrap/dist/css/bootstrap.min.css'

const serverAddress = 'wss://tartan-pond-catamaran.glitch.me'
const client = new W3CWebSocket(serverAddress)
// const client = new W3CWebSocket('ws://192.168.2.81:8080')

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
				setPlayerIndex(data.playerIndex) // Set player findex received from the server
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
		if (gameState) {
			const currentPlayer =
				gameState.players[gameState.currentPlayerIndex]
			const totalCards = gameState.numCards // Assuming total number of cards is available in gameState

			// Calculate sum of all targets set so far (excluding current player)
			const sumOfTargets = gameState.players
				.filter((player) => player.target !== null) // Only include players who have already set a target
				.reduce((sum, player) => sum + player.target, 0)

			// Find out how many players have set their targets so far
			const playersWhoSetTarget = gameState.players.filter(
				(player) => player.target !== null
			).length

			// Determine if the current player is the last one to set the target for this round
			const isLastPlayerToSetTarget =
				playersWhoSetTarget === gameState.players.length - 1

			const remainingTarget = totalCards - sumOfTargets

			// Show the target setting UI if the current player's target is not set yet
			if (
				playerIndex === gameState.currentPlayerIndex &&
				currentPlayer.target === null &&
				gameState.players[playerIndex].hand.length !== 0
			) {
				const handleSetTarget = () => {
					const numericTarget = Number(target)

					// Validation for the player setting the final target
					if (
						isLastPlayerToSetTarget &&
						numericTarget === remainingTarget
					) {
						alert(
							`Invalid target! The sum of all targets cannot be equal to ${totalCards}. Please choose a different target.`
						)
					} else {
						setPlayerTarget(numericTarget)
					}
				}

				return (
					<div className="text-center mt-4">
						<h5 className="text-warning mb-3">
							{currentPlayer.name}, Set Your Target:
						</h5>
						<div className="d-inline-flex align-items-center">
							<input
								type="number"
								value={target}
								onChange={(e) => setTarget(e.target.value)}
								min="0"
								max="10"
								className="form-control form-control-lg me-2"
								style={{ width: '100px' }} // Bootstrap does not have a direct width control for small inputs
							/>
							<button
								onClick={handleSetTarget}
								className="btn btn-lg btn-danger"
							>
								Set Target
							</button>
						</div>
					</div>
				)
			}
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
			// Extract card values for easier comparison
			const cardValueOrder = [
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
			const getValueIndex = (value) => cardValueOrder.indexOf(value)

			// Check if the card's suit matches either masterSuit or the suit of the first card
			const isMasterSuit = card.card.suit === masterSuit
			const isInitialSuit =
				card.card.suit === gameState.board[0].card.suit
			const isMaxSuitMaster = max.suit === masterSuit
			const isMaxSuitInitial = max.suit === gameState.board[0].card.suit

			// Compare based on suit priority
			if (
				isMasterSuit &&
				(!isMaxSuitMaster || (isMaxSuitInitial && !isInitialSuit))
			) {
				// Current card is masterSuit and max card is not, or max card is of initial suit only
				return card.card
			} else if (isInitialSuit && !isMaxSuitMaster && !isMaxSuitInitial) {
				// Current card is of initial suit and max card is neither masterSuit nor initial suit
				return card.card
			} else if (
				isMasterSuit === isMaxSuitMaster &&
				isInitialSuit === isMaxSuitInitial
			) {
				// Both cards are of the same suit priority, compare their values
				if (getValueIndex(card.card.value) > getValueIndex(max.value)) {
					return card.card
				}
			}

			return max
		}, gameState.board[0].card)

		console.log('winning Card_' + winningCard.suit + winningCard.value)
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

				const ranks = {}
				const sortedPlayers = updatedPlayers
					.slice()
					.sort((a, b) => b.fp - a.fp)
				let currentRank = 1

				sortedPlayers.forEach((player) => {
					const fp = player.fp
					if (!ranks[fp]) {
						ranks[fp] = currentRank
						currentRank++
					}
				})

				updatedPlayers.forEach((player) => {
					player.rank = ranks[player.fp]
				})

				if (gameState.numCards > 1) {
					//decrement it
					gameState.numCards = gameState.numCards - 1
				} else {
					//decide winners with rank 1
					const winners = updatedPlayers.filter(
						(player) => player.rank === 1
					)
					//give alert print message with winners name and point if they are many
					if (winners.length > 1) {
						const winnersNames = winners
							.map((winner) => winner.name)
							.join(', ')

						alert(
							`It's a tie! The winners are ${winnersNames} with ${winners[0].fp}`
						)
					} else {
						alert(
							`The winner is ${winners[0].name} with ${winners[0].fp} points!`
						)
					}
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
								className="card-container"
								style={{
									left: `${index * 60}px`,
									zIndex: index,
								}}
							>
								<div className="player-name-small">
									{
										gameState.players[
											play.currentPlayerIndex
										].name
									}
								</div>
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
									opacity: canPlayCard(card, index) ? 1 : 0.5,
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
										value={null}
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
							<div className="scoreboard">
								{gameState.players.map((player, index) => (
									<div
										key={index}
										className={`scoreboard-item ${
											index ===
											gameState.currentPlayerIndex
												? 'current-player'
												: ''
										}`}
									>
										<div className="player-info">
											<h3
												className={`player-name ${
													player.points +
														player.hand.length <
														player.target ||
													player.points >
														player.target
														? 'player-name-lost'
														: ''
												}`}
											>
												{player.name}
											</h3>
											<div className="player-stats">
												<div className="stat">
													<span className="stat-label">
														CP:
													</span>
													<span className="stat-value">
														{player.points}
													</span>
												</div>
												<div className="stat">
													<span className="stat-label">
														Points:
													</span>
													<span className="stat-value">
														{player.fp}
													</span>
												</div>
												<div className="stat">
													<span className="stat-label">
														Target:
													</span>
													<span className="stat-value">
														{player.target}
													</span>
												</div>
												<div className="stat">
													<span className="stat-label">
														Rank:
													</span>
													<span className="stat-value">
														{player.rank}
													</span>
												</div>
											</div>
										</div>
									</div>
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
