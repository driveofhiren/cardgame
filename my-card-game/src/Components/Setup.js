import React, { useState } from 'react'
import './Card.css'
import './Default.css'

export const Setup = ({ onStartGame }) => {
	const [isHost, setIsHost] = useState(true)
	const [roomId, setRoomId] = useState('')
	const [numPlayers, setNumPlayers] = useState(3)
	const [numRounds, setNumRounds] = useState(1)
	const [numCards, setNumCards] = useState(4)
	const [playerNames, setPlayerNames] = useState(['Host', 'P2', 'P3'])
	const [showRules, setShowRules] = useState(false)

	const handleNumPlayersChange = (e) => {
		const count = parseInt(e.target.value, 10)
		setNumPlayers(count)
		setPlayerNames(Array.from({ length: count }, (_, i) => `P${i + 1}`))
	}

	const handlePlayerNameChange = (index, name) => {
		const newPlayerNames = [...playerNames]
		newPlayerNames[index] = name
		setPlayerNames(newPlayerNames)
	}

	const handleHostSubmit = (e) => {
		e.preventDefault()
		onStartGame({
			action: 'createRoom',
			config: { numPlayers, numRounds, playerNames, numCards },
		})
	}

	const handleJoinSubmit = (e) => {
		e.preventDefault()
		if (roomId.trim()) {
			onStartGame({
				action: 'joinRoom',
				roomId,
			})
		}
	}

	return (
		<div className="setup-container">
			{isHost ? (
				<form className="form-container" onSubmit={handleHostSubmit}>
					<div className="form-group">
						<label>Number of Players:</label>
						<input
							type="number"
							value={numPlayers}
							onChange={handleNumPlayersChange}
							min="2"
							max="6"
							required
						/>
					</div>
					<div className="form-group">
						<label>Rounds</label>
						<input
							type="number"
							value={numCards}
							onChange={(e) => setNumCards(e.target.value)}
							required
						/>
					</div>
					{playerNames.map((name, index) => (
						<div className="form-group" key={index}>
							<label>Player {index + 1} Name:</label>
							<input
								type="text"
								value={name}
								onChange={(e) =>
									handlePlayerNameChange(
										index,
										e.target.value
									)
								}
								required
							/>
						</div>
					))}
					<button type="submit">Create Game</button>
					<button type="button" onClick={() => setIsHost(false)}>
						Join a Game
					</button>
				</form>
			) : (
				<form className="form-container" onSubmit={handleJoinSubmit}>
					<div className="form-group">
						<label>Enter Room ID:</label>
						<input
							type="text"
							value={roomId}
							onChange={(e) => setRoomId(e.target.value)}
							required
						/>
					</div>
					<button type="submit">Join Game</button>
					<button type="button" onClick={() => setIsHost(true)}>
						Host a Game
					</button>
				</form>
			)}

			{/* Button to show/hide the game rules */}
			<button onClick={() => setShowRules(!showRules)}>
				{showRules ? 'Hide Rules' : 'Show Rules'}
			</button>

			{showRules && (
				<div className={`rules-panel ${showRules ? 'open' : ''}`}>
					<div className="rules-content">
						<h1>Judgement - Game Rules</h1>

						<section>
							<h2>Objective</h2>
							<p>
								The objective of <strong>Judgement</strong> is
								to earn points by predicting the number of
								rounds you can win. Points are awarded based on
								how close your prediction (target) is to your
								actual performance.
							</p>
						</section>

						<section>
							<h2>Setting Targets</h2>
							<ul>
								<li>
									At the start of the game, players are dealt
									a hand of cards. Each player sets a target
									for how many rounds they believe they can
									win.{' '}
								</li>
								<li>
									Players take turns setting a target. The
									last player to set a target cannot choose a
									number that would make the sum equal to the
									total number of cards.
								</li>
							</ul>
						</section>

						<section>
							<h2>Playing Cards</h2>
							<ul>
								<li>
									Players play one card per round. The first
									card played in each round determines the
									lead suit.
								</li>
								<li>
									Players must follow the lead suit if
									possible. If not, they can play any card.
								</li>
								<li>
									If no lead suit exists, the first player to
									play chooses any card.
								</li>
							</ul>
						</section>

						<section>
							<h2>Master Suit</h2>
							<p>
								A <strong>Master Suit</strong> is automatically
								selected at the start of each round and is
								stronger than the other suits.
							</p>
						</section>

						<section>
							<h2>Winning a Round</h2>
							<p>
								The player who plays the highest-ranked card of
								the lead suit earns CP, unless a card from the
								Master Suit is played.
							</p>
						</section>

						<section>
							<h2>Scoring</h2>
							<ul>
								<li>
									If a player wins exactly the number of
									rounds they predicted, they score CP equal
									to their target, plus a bonus of 10 points.
								</li>
								<li>
									Players are ranked based on their total
									points at the end of the game.
								</li>
							</ul>
						</section>

						<section>
							<h2>End of the Game</h2>
							<p>
								The game continues until the number of cards per
								hand decreases to 1. Ties are possible.
							</p>
						</section>
					</div>
				</div>
			)}
		</div>
	)
}
