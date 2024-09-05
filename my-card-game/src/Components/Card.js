import './Card.css'

export const Card = ({ id, suit, value }) => {
	let cardColor = '' // Initialize card color variable
	let fontColor = '' // Initialize font color variable

	// Assign background color and font color based on suit
	switch (suit) {
		case '♥':
			cardColor = '#ff5789' // Pink for hearts
			fontColor = 'black' // Black font color for pink background
			break
		case '♦':
			cardColor = '#F58840' // Orange red for diamonds
			fontColor = 'black' // Black font color for orange red background
			break
		case '♠':
			cardColor = '#080030' // Black for spades
			fontColor = 'white' // White font color for black background
			break
		case '♣':
			cardColor = '#000080' // Navy blue for clubs
			fontColor = 'white' // White font color for navy blue background
			break
		default:
			cardColor = 'lightgray' // Default color for unknown suits
			fontColor = 'black' // Default font color
			break
	}

	// Define inline styles for card background color, font color and box shadow
	const cardStyle = {
		backgroundColor: cardColor,
		color: fontColor,
		fontSize: '25px',
		width: '60px',

		boxShadow: '5px 5px 5px rgba(0, 0, 0, 0.6)', // Added shadow with opacity
	}

	// Adjusted logic for comparing cards based on values and suits

	return (
		<div key={id} className="card border-dark mb-3" style={cardStyle}>
			<div>{suit}</div>
			<div>{value}</div>
		</div>
	)
}
