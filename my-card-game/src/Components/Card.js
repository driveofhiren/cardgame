import './Card.css'

export const Card = ({ id, suit, value }) => {
	let cardColor = '' // Initialize card color variable
	let fontColor = '' // Initialize font color variable

	// Assign background color and font color based on suit
	switch (suit) {
		case '♥':
			cardColor = 'linear-gradient(135deg, #FFB6C1, #FF69B4)' // Smooth gradient for hearts
			fontColor = '#E63946' // Deep red for the font
			break
		case '♦':
			cardColor = 'linear-gradient(135deg, #FFD700, #FFA500)' // Gradient for diamonds
			fontColor = '#FF6F61' // Coral red for the font
			break
		case '♠':
			cardColor = 'linear-gradient(135deg, #ADD8E6, #4682B4)' // Gradient for spades
			fontColor = '#1D3557' // Dark navy for the font
			break
		case '♣':
			cardColor = 'linear-gradient(135deg, #98FB98, #32CD32)' // Gradient for clubs
			fontColor = '#006400' // Dark green for the font
			break
		default:
			cardColor = 'linear-gradient(135deg, #F0F0F0, #D3D3D3)' // Gradient for unknown suits
			fontColor = '#333333' // Dark gray for the font
			break
	}

	// Define inline styles for card background color, font color, and box shadow
	const cardStyle = {
		background: cardColor,
		color: fontColor,
		width: '80px',
		height: '130px',
		position: 'relative',
		borderRadius: '15px',
		border: '2px solid #000',
		boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.2)',
		padding: '10px',
		textAlign: 'center',
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'space-between',
		transition: 'transform 0.3s ease-in-out',
	}

	return (
		<div key={id} className="card" style={cardStyle}>
			{/* Top-left corner: value and suit */}
			<div className="card-corner top-left">
				<div className="card-value">{value}</div>
				<div className="card-suit">{suit}</div>
			</div>

			{/* Middle of the card: larger suit symbol */}
			<div className="card-center">
				<span className="large-suit">{suit}</span>
			</div>

			{/* Bottom-right corner: value and suit */}
			<div className="card-corner bottom-right">
				<div className="card-value">{value}</div>
				<div className="card-suit">{suit}</div>
			</div>
		</div>
	)
}
