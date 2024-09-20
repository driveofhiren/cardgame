import React, { useState, useEffect } from 'react'
import './Card.css'
import './Default.css'
import { Card } from './Card'
import { Setup } from './Setup'
import { w3cwebsocket as W3CWebSocket } from 'websocket'
import 'bootstrap/dist/css/bootstrap.min.css'
import { FaPencilAlt, FaCheck } from 'react-icons/fa'
import { FaTimes } from 'react-icons/fa'
import Scoreboard from './Scoreboard'
import RenderBoard from './RenderBoard'

const serverAddress = 'wss://tartan-pond-catamaran.glitch.me'
const client = new W3CWebSocket(serverAddress)
// const client = new W3CWebSocket('ws://192.168.2.81:8080')

export const Deck = () => {
	const [gameState, setGameState] = useState(null)
	const [playerIndex, setPlayerIndex] = useState(-1)
	const [target, setTarget] = useState('')
	const [roomId, setRoomId] = useState(null)
	const [gameResult, setGameResult] = useState(null)
	const [showRules, setShowRules] = useState(false)

	const [editingPlayerIndex, setEditingPlayerIndex] = useState(null) // Track which player is being edited
	const [newName, setNewName] = useState('')

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
			// console.log(data)
			if (data.totalRounds) {
				setGameState(data)
			}

			if (data.playerIndex !== undefined) {
				setPlayerIndex(data.playerIndex) // Set player findex received from the server
			}
			if (data.roomId) {
				setRoomId(data.roomId) // Set roomId received from the server
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
			// const action = { action: 'createRoom', config }

			client.send(JSON.stringify(config))
		} else {
			client.onopen = () => {
				console.log('WebSocket Client Connected')
				// const action = { action: 'createRoom', config }
				client.send(JSON.stringify(config))
			}
		}
	}
	const resetGame = () => {
		setGameState(null) // Clear the game state
		setGameResult(null) // Clear any result message
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
			// const totalCards = gameState.numCards // Assuming total number of cards is available in gameState
			const totalCards = currentPlayer.hand.length

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

		// console.log('winning Card_' + winningCard.suit + winningCard.value)
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
					gameState.numCards--
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

						setGameResult(
							`It's a tie! The winners are ${winnersNames} with ${winners[0].fp}`
						)
					} else {
						setGameResult(
							`The winner is ${winners[0].name} with ${winners[0].fp} points!`
						)
					}
					setTimeout(() => {
						resetGame()
					}, 10000)
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

	const renderPlayers = () => {
		const handleNameChange = (index) => {
			const action = {
				action: 'updatePlayerName',
				playerIndex: index,
				newName,
			}
			sendMessage(action)
			setEditingPlayerIndex(null) // Hide the input field after name change
		}

		const startEditing = (index) => {
			setEditingPlayerIndex(index) // Set the player index to be edited
			setNewName('') // Reset newName when starting to edit
		}

		return gameState.players.map((player, index) => (
			<div key={index} className="player-container">
				{/* Conditionally render player name */}
				{playerIndex === index && (
					<div className="player-name-container">
						{editingPlayerIndex === index ? (
							<div className="edit-name-container">
								<input
									type="text"
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
									placeholder={player.name}
									className="name-input"
								/>
								<a
									onClick={() => handleNameChange(index)}
									className="save-icon"
									title="Save Name"
								>
									<FaCheck />
								</a>
							</div>
						) : (
							<>
								<h4 className="player-name">{player.name}</h4>
								<a
									onClick={() => startEditing(index)}
									className="edit-icon"
									title="Edit Name"
								>
									<FaPencilAlt />
								</a>
							</>
						)}
					</div>
				)}

				{/* Show the hand only for the visible player */}
				{playerIndex === index && (
					<div className="hand">
						{player.hand.map((card, cardIndex) => (
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
						))}
					</div>
				)}
			</div>
		))
	}
	{
		gameResult && (
			<div className="alert alert-success text-center">
				<h4>{gameResult}</h4>
			</div>
		)
	}

	const masterCard = gameState.masterSuit
		? { suit: gameState.masterSuit, value: 'Master' }
		: null

	return (
		<div className="container-fluid">
			{gameResult && (
				<div>
					<div className="alert alert-success text-center">
						<h4>{gameResult}</h4>
					</div>
					<div className="text-center mt-3">
						<button className="btn btn-primary" onClick={resetGame}>
							Start New Game
						</button>
					</div>
				</div>
			)}

			<div className="grid-container">
				{/* Left column */}
				<div className="players-hand-column">
					<div
						id="players-hand"
						className="d-flex flex-column align-items-center"
					>
						{renderPlayers()}
					</div>
					<div>
						{' '}
						<RenderBoard gameState={gameState} />
					</div>
					{renderTargetSetting()}
				</div>

				{/* Right column */}
				<div className="other-things-column">
					{/* Display Room ID */}
					{roomId && (
						<div className="room-info">
							<h3>Room ID: {roomId}</h3>{' '}
							{/* Display the roomId */}
						</div>
					)}

					{masterCard && (
						<div style={{ margin: '5px' }}>
							<Card
								value={null}
								suit={masterCard.suit}
								className="card-small"
							/>
						</div>
					)}

					<div className="row">
						{' '}
						{!gameState.masterSuit && (
							<button
								className="btn btn-primary deal-button"
								onClick={dealCards}
							>
								Deal Cards
							</button>
						)}
						<div
							id="labels"
							className="d-flex flex-column align-items-center"
						>
							<div className="mt-3">
								<h2>Scoreboard</h2>
							</div>
							<h6>
								Round {gameState.round}/{gameState.numCards}
							</h6>
							{/* <div className="row">
								<div className="mt-3">
									{renderMasterSuitSelection()}
								</div>
							</div> */}
							<Scoreboard gameState={gameState} />
							<button onClick={() => setShowRules(!showRules)}>
								{showRules ? 'Hide Rules' : 'Show Rules'}
							</button>
							{showRules && (
								<div
									className={`rules-panel ${
										showRules ? 'open' : ''
									}`}
								>
									<div className="rules-content">
										<h1>Judgement - Game Rules</h1>

										<section>
											<h2>Objective</h2>
											<p>
												The objective of{' '}
												<strong>Judgement</strong> is to
												earn points by predicting the
												number of rounds you can win.
												Points are awarded based on how
												close your prediction (target)
												is to your actual performance.
											</p>
										</section>

										<section>
											<h2>Setting Targets</h2>
											<ul>
												<li>
													At the start of the game,
													players are dealt a hand of
													cards. Each player sets a
													target for how many rounds
													they believe they can win.{' '}
												</li>
												<li>
													Players take turns setting a
													target. The last player to
													set a target cannot choose a
													number that would make the
													sum equal to the total
													number of cards.
												</li>
											</ul>
										</section>

										<section>
											<h2>Playing Cards</h2>
											<ul>
												<li>
													Players play one card per
													round. The first card played
													in each round determines the
													lead suit.
												</li>
												<li>
													Players must follow the lead
													suit if possible. If not,
													they can play any card.
												</li>
												<li>
													If no lead suit exists, the
													first player to play chooses
													any card.
												</li>
											</ul>
										</section>

										<section>
											<h2>Master Suit</h2>
											<p>
												A <strong>Master Suit</strong>{' '}
												is automatically selected at the
												start of each round and is
												stronger than the other suits.
											</p>
										</section>

										<section>
											<h2>Winning a Round</h2>
											<p>
												The player who plays the
												highest-ranked card of the lead
												suit earns CP, unless a card
												from the Master Suit is played.
											</p>
										</section>

										<section>
											<h2>Scoring</h2>
											<ul>
												<li>
													If a player they predicted,
													they score CP equal to their
													target, plus a bonus of 10
													points.
												</li>
												<li>
													Players are ranked based on
													their total points at the
													end of the game.
												</li>
											</ul>
										</section>

										<section>
											<h2>End of the Game</h2>
											<p>
												The game continues until the
												number of cards per hand
												decreases to 1. Ties are
												possible.
											</p>
										</section>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
