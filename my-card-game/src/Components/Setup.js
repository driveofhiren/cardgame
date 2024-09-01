import React, { useState } from 'react'
import './Card.css'
import './Default.css'
import { Card } from './Card'

export const Setup = ({ onStartGame }) => {
	const [numPlayers, setNumPlayers] = useState(3)
	const [numRounds, setNumRounds] = useState(1)
	const [numCards, setNumCards] = useState(3)
	const [playerNames, setPlayerNames] = useState([
		'Player 1',
		'Player 2',
		'Player 3',
	])

	const handleNumPlayersChange = (e) => {
		const count = parseInt(e.target.value, 10)
		setNumPlayers(count)
		setPlayerNames(
			Array.from({ length: count }, (_, i) => `Player ${i + 1}`)
		)
	}

	const handlePlayerNameChange = (index, name) => {
		const newPlayerNames = [...playerNames]
		newPlayerNames[index] = name
		setPlayerNames(newPlayerNames)
	}

	const handleSubmit = (e) => {
		e.preventDefault()
		onStartGame({ numPlayers, numRounds, numCards, playerNames })
	}

	return (
		<div className="setup-container">
			<form onSubmit={handleSubmit}>
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
					<label>Number of Rounds:</label>
					<input
						type="number"
						value={numRounds}
						onChange={(e) => setNumRounds(e.target.value)}
						required
					/>
				</div>
				<div className="form-group">
					<label>Number of Cards in Hand:</label>
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
								handlePlayerNameChange(index, e.target.value)
							}
							required
						/>
					</div>
				))}
				<button type="submit">Start Game</button>
			</form>
		</div>
	)
}
