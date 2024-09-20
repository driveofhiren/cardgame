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

	const handleNumPlayersChange = (e) => {
		const count = parseInt(e.target.value, 10)
		setNumPlayers(count)
		setPlayerNames(Array.from({ length: count }, (_, i) => `P ${i + 1}`))
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
		console.log('presse')
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
					{/* <div className="form-group">
						<label>Number of Rounds:</label>
						<input
							type="number"
							value={numRounds}
							onChange={(e) => setNumRounds(e.target.value)}
							required
						/>
					</div> */}
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
		</div>
	)
}
