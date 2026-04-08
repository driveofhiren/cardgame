import React, { useState, useEffect } from 'react'
import './Card.css'
import './Default.css'
import { Card } from './Card'
import { Setup } from './Setup'
import { w3cwebsocket as W3CWebSocket } from 'websocket'
import 'bootstrap/dist/css/bootstrap.min.css'
import { FaPencilAlt, FaCheck } from 'react-icons/fa'
import Scoreboard from './Scoreboard'
import RenderBoard from './RenderBoard'

const client = new W3CWebSocket('ws://192.168.2.81:8080')

export const Deck = () => {
	const [gameState, setGameState] = useState(null)
	const [playerIndex, setPlayerIndex] = useState(-1)
	const [target, setTarget] = useState('')
	const [roomId, setRoomId] = useState(null)
	const [gameResult, setGameResult] = useState(null)
	const [showRules, setShowRules] = useState(false)

	const [editingPlayerIndex, setEditingPlayerIndex] = useState(null) // Track which player is being edited
	const [newName, setNewName] = useState('')

	const [hostTargets, setHostTargets] = useState({}) // Host sets all targets at once
	const [useHostMode, setUseHostMode] = useState(true) // Toggle between host mode and individual mode

	const [roundHistory, setRoundHistory] = useState([]) // Track scores for each completed round
	const [lastRecordedRound, setLastRecordedRound] = useState(0) // Track which round's scores we've recorded
	const [previousRoundFP, setPreviousRoundFP] = useState({}) // Track previous round's FP to calculate round-specific FP

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
			if (data.action === 'gameOver') {
				// Record the final round scores before showing winner
				const finalRoundNumber = data.round - 1
				const finalRoundScores = data.players.map((player) => ({
					name: player.name,
					target: player.target,
					points: player.points,
					fp: player.fp - (previousRoundFP[player.name] || 0),
					rank: player.rank,
				}))

				// Add final round to history if not already recorded
				setRoundHistory((prev) => {
					const alreadyRecorded = prev.some(
						(r) => r.roundNumber === finalRoundNumber,
					)
					if (!alreadyRecorded) {
						return [
							...prev,
							{
								roundNumber: finalRoundNumber,
								scores: finalRoundScores,
							},
						]
					}
					return prev
				})

				// Update game state with final scores
				setGameState(data)
				// Then display winners
				const winnerNames = data.winners
					.map((w) => w.name)
					.join(' and ')
				const resultMessage = `🏆 Game Over! Winner(s): ${winnerNames}`
				setGameResult(resultMessage)
				console.log('Game finished:', resultMessage)
			}
		}
	}, [])
	useEffect(() => {
		if (gameState) {
			const allHandsEmpty = gameState.players.every(
				(player) => player.hand.length === 0,
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

	// Track round completion and record scores
	useEffect(() => {
		if (gameState && gameState.round > lastRecordedRound) {
			// A new round started, which means the previous round just ended
			if (lastRecordedRound > 0) {
				// Record the scores from the completed round
				const completedRoundNumber = gameState.round - 1
				const roundScores = gameState.players.map((player, idx) => {
					// Calculate round-specific FP as the difference from previous round
					const currentFP = player.fp || 0
					const prevFP = previousRoundFP[player.name] || 0
					const roundFP = currentFP - prevFP
					return {
						name: player.name,
						target: player.target,
						points: player.points,
						fp: roundFP, // Round-specific FP, not cumulative
						rank: player.rank,
					}
				})
				setRoundHistory((prev) => [
					...prev,
					{
						roundNumber: completedRoundNumber,
						scores: roundScores,
					},
				])
				// Update previousRoundFP for next round
				const newPreviousRoundFP = {}
				gameState.players.forEach((player) => {
					newPreviousRoundFP[player.name] = player.fp
				})
				setPreviousRoundFP(newPreviousRoundFP)
			}
			setLastRecordedRound(gameState.round)
		}
	}, [gameState ? gameState.round : 0])

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

	// Host mode: Set all targets at once
	const handleHostSetAllTargets = () => {
		// Send all targets one by one
		if (client.readyState === WebSocket.OPEN) {
			gameState.players.forEach((player, idx) => {
				const playerTarget = Number(hostTargets[idx] || 0)
				const action = {
					action: 'setTarget',
					playerIndex: idx,
					target: playerTarget,
				}
				client.send(JSON.stringify(action))
			})
			// Keep host mode enabled for next round, just clear the input values
			setHostTargets({})
		}
	}

	const updateHostTarget = (playerIdx, value) => {
		setHostTargets((prev) => ({
			...prev,
			[playerIdx]: value,
		}))
	}

	const renderRoundHistory = () => {
		if (roundHistory.length === 0) return null

		return (
			<div className="mt-4 round-history-container">
				<h3 className="text-center mb-3">Round History</h3>
				<div style={{ overflowX: 'auto' }}>
					<table className="table table-striped table-sm table-bordered">
						<thead className="table-dark">
							<tr>
								<th>Round</th>
								{gameState &&
									gameState.players.map((player) => (
										<th key={player.name}>{player.name}</th>
									))}
							</tr>
						</thead>
						<tbody>
							{roundHistory.map((round) => (
								<React.Fragment key={round.roundNumber}>
									{/* Target Row */}

									{/* Points (CP) Row */}

									{/* FP (Final Points) Row */}
									<tr className="fp-row">
										<td className="fw-bold bg-light">
											R{round.roundNumber} - FP
										</td>
										{round.scores.map((score) => (
											<td
												key={`${round.roundNumber}-${score.name}-FP`}
											>
												{score.fp}
											</td>
										))}
									</tr>
								</React.Fragment>
							))}
						</tbody>
					</table>
				</div>
			</div>
		)
	}

	if (!gameState) {
		return <Setup onStartGame={startGame} />
	}

	const renderTargetSetting = () => {
		if (!gameState) return null

		const currentPlayer = gameState.players[gameState.currentPlayerIndex]
		const totalCards = currentPlayer.hand.length

		// Calculate sum of all targets set so far
		const sumOfTargets = gameState.players
			.filter((player) => player.target !== null)
			.reduce((sum, player) => sum + player.target, 0)

		// Find out how many players have set their targets so far
		const playersWhoSetTarget = gameState.players.filter(
			(player) => player.target !== null,
		).length

		// Determine if the current player is the last one to set the target for this round
		const isLastPlayerToSetTarget =
			playersWhoSetTarget === gameState.players.length - 1

		const remainingTarget = totalCards - sumOfTargets

		// Host can ALWAYS set targets if they're player 0 and targets need setting (any round)
		if (
			playerIndex === 0 &&
			gameState.players.some((p) => p.target === null)
		) {
			const validateHostTargets = () => {
				let totalHostTargets = 0

				for (let i = 0; i < gameState.players.length; i++) {
					// Check if field is empty
					if (
						hostTargets[i] === undefined ||
						hostTargets[i] === null ||
						hostTargets[i] === ''
					) {
						alert(`Player ${i + 1}: Please enter a target!`)
						return false
					}
					const val = Number(hostTargets[i])
					if (val < 0 || val > gameState.numCards) {
						alert(`Player ${i + 1}: Invalid target!`)
						return false
					}
					totalHostTargets += val
				}

				if (totalHostTargets === gameState.numCards) {
					alert(
						`Invalid targets! The sum of all targets cannot be equal to ${gameState.numCards}. Please adjust targets.`,
					)
					return false
				}

				return true
			}

			const handleSetAllTargets = () => {
				if (validateHostTargets()) {
					handleHostSetAllTargets()
				}
			}

			return (
				<div className="text-center mt-4">
					<h5 className="text-warning mb-3">
						Set All Player Targets:
					</h5>
					<div className="mb-3">
						{gameState.players.map((player, idx) => (
							<div
								key={idx}
								className="d-inline-flex align-items-center me-3 mb-2"
							>
								<label
									className="me-2"
									style={{
										minWidth: '120px',
										color: 'white',
									}}
								>
									{player.name}:
								</label>
								<input
									type="number"
									value={hostTargets[idx] || ''}
									onChange={(e) =>
										updateHostTarget(idx, e.target.value)
									}
									min="0"
									max="10"
									className="form-control form-control-sm"
									style={{ width: '80px' }}
									placeholder=""
								/>
							</div>
						))}
					</div>
					<button
						onClick={handleSetAllTargets}
						className="btn btn-lg btn-success"
					>
						Set All Targets
					</button>
				</div>
			)
		}

		// Individual target-setting mode (when it's your turn)
		if (
			playerIndex === gameState.currentPlayerIndex &&
			gameState.players[playerIndex].target === null &&
			gameState.players[playerIndex].hand.length !== 0
		) {
			return renderIndividualTargetUI(
				currentPlayer,
				totalCards,
				sumOfTargets,
				isLastPlayerToSetTarget,
				remainingTarget,
			)
		}

		return null
	}

	const renderIndividualTargetUI = (
		currentPlayer,
		totalCards,
		sumOfTargets,
		isLastPlayerToSetTarget,
		remainingTarget,
	) => {
		const handleSetTarget = () => {
			const numericTarget = Number(target)

			// Validation for the player setting the final target
			if (isLastPlayerToSetTarget && numericTarget === remainingTarget) {
				alert(
					`Invalid target! The sum of all targets cannot be equal to ${totalCards}. Please choose a different target.`,
				)
			} else if (
				numericTarget > gameState.numCards ||
				numericTarget < 0
			) {
				alert(`Please choose valid Target!`)
			} else {
				setPlayerTarget(numericTarget)
			}
		}

		return (
			<div className="text-center mt-4">
				<h5 className="text-warning mb-3">
					{currentPlayer.name}, Set Your Target:
				</h5>
				<div className="d-inline-flex align-items-center mb-3">
					<input
						type="number"
						value={target}
						onChange={(e) => setTarget(e.target.value)}
						min="0"
						max="10"
						className="form-control form-control-lg me-2"
						style={{ width: '100px' }}
						autoFocus
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
				(c) => c.suit === gameState.firstCard.suit,
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

	const handleCardDetected = (detectedInfo) => {
		// Card detection now happens in Python backend
		// This function is kept for compatibility but is no longer used
		console.log(
			'[DEPRECATED] Frontend card detection handler - use Python service instead',
			detectedInfo,
		)
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

		// return gameState.players.map((player, index) => (
		// 	<div key={index} className="player-container">
		// 		{/* Conditionally render player name */}
		// 		{playerIndex === index && (
		// 			<div className="player-name-container">
		// 				{gameState.currentPlayerIndex === index && (
		// 					<div
		// 						style={{
		// 							fontSize: '14px',
		// 							fontWeight: 'bold',
		// 							color: '#ff9800',
		// 							marginBottom: '8px',
		// 							textAlign: 'center',
		// 						}}
		// 					>
		// 						🎥 YOUR TURN - CAMERA READY
		// 					</div>
		// 				)}
		// 				{editingPlayerIndex === index ? (
		// 					<div className="edit-name-container">
		// 						<input
		// 							type="text"
		// 							value={newName}
		// 							onChange={(e) => setNewName(e.target.value)}
		// 							placeholder={player.name}
		// 							className="name-input"
		// 						/>
		// 						<a
		// 							onClick={() => handleNameChange(index)}
		// 							className="save-icon"
		// 							title="Save Name"
		// 						>
		// 							<FaCheck />
		// 						</a>
		// 					</div>
		// 				) : (
		// 					<>
		// 						<h4 className="player-name">{player.name}</h4>
		// 						<a
		// 							onClick={() => startEditing(index)}
		// 							className="edit-icon"
		// 							title="Edit Name"
		// 						>
		// 							<FaPencilAlt />
		// 						</a>
		// 					</>
		// 				)}
		// 			</div>
		// 		)}

		// 		{/* Show the hand only for the visible player - CAMERA DETECTION ONLY */}
		// 		{playerIndex === index && (
		// 			<div className="hand">
		// 				{gameState.currentPlayerIndex === index && (
		// 					<div
		// 						style={{
		// 							fontSize: '12px',
		// 							color: '#ff6b6b',
		// 							marginBottom: '8px',
		// 						}}
		// 					>
		// 						🎥 CAMERA DETECTION MODE - Cards are auto-played
		// 						from camera
		// 					</div>
		// 				)}
		// 				{player.hand.map((card, cardIndex) => (
		// 					<div
		// 						key={card.id}
		// 						className="card-display"
		// 						style={{
		// 							opacity: canPlayCard(card, index) ? 1 : 0.5,
		// 							border: canPlayCard(card, index)
		// 								? '2px solid #28a745'
		// 								: 'none',
		// 							borderRadius: '4px',
		// 							padding: '4px',
		// 							cursor: 'default',
		// 							transition: 'all 0.2s',
		// 						}}
		// 						title={
		// 							canPlayCard(card, index)
		// 								? 'Can be detected by camera'
		// 								: 'Invalid play'
		// 						}
		// 					>
		// 						<Card suit={card.suit} value={card.value} />
		// 					</div>
		// 				))}
		// 			</div>
		// 		)}
		// 	</div>
		// ))
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
								Round {gameState.round}/
								{Number(gameState.round) +
									Number(gameState.numCards) -
									1}
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
													they believe they can
													win.{' '}
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
							{renderRoundHistory()}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
