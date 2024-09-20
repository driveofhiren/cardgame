import React from 'react'
import { FaTimes, FaCheck } from 'react-icons/fa'

const Scoreboard = ({ gameState }) => {
	const playerCount = gameState.players.length

	return (
		<div className={`scoreboard layout-${playerCount}`}>
			{gameState.players.map((player, index) => (
				<div
					key={index}
					className={`scoreboard-item ${
						index === gameState.currentPlayerIndex
							? 'current-player'
							: ''
					}`}
				>
					<div className="player-info">
						<div className="player-header">
							<div className="name-rank-container">
								<h4
									className={`player-name ${
										player.points > player.target
											? 'player-name-lost'
											: ''
									}`}
								>
									{player.name}
								</h4>
								<span className="rank">{player.rank}</span>
							</div>
							{player.clientId ? (
								<FaCheck
									className="status-icon connected"
									title="Connected"
								/>
							) : (
								<FaTimes
									className="status-icon disconnected"
									title="Disconnected"
								/>
							)}
						</div>

						<div className="player-stats">
							<div className="stat">
								<span className="stat-label">CP:</span>
								<span className="stat-value cp-value">
									{player.points}
								</span>
							</div>
							<div className="stat">
								<span className="stat-label">Points:</span>
								<span className="stat-value points-value">
									{player.fp}
								</span>
							</div>
							<div className="stat">
								<span className="stat-label">Target:</span>
								<span className="stat-value">
									{player.target}
								</span>
							</div>
						</div>
					</div>
				</div>
			))}
		</div>
	)
}

export default Scoreboard
