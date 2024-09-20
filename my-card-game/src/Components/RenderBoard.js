import React from 'react'
import { Card } from './Card'

const RenderBoard = ({ gameState }) => {
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
								left: `${index * 60}px`, // Increased spacing between cards
								zIndex: index,
							}}
						>
							<div className="player-name-small">
								{
									gameState.players[play.currentPlayerIndex]
										.name
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

export default RenderBoard
