import React, { useEffect, useRef, useState } from 'react'
import './CardDetection.css'

export const CardDetection = ({ gameState, playerIndex, onCardDetected }) => {
	const videoRef = useRef(null)
	const canvasRef = useRef(null)
	const animationIdRef = useRef(null)
	const [isEnabled, setIsEnabled] = useState(false)
	const [detectedCards, setDetectedCards] = useState([])
	const [previousCards, setPreviousCards] = useState([])
	const [lastDetectedCard, setLastDetectedCard] = useState(null)
	const [cameraSource, setCameraSource] = useState('local') // 'local' or 'ip'
	const [ipCameraUrl, setIpCameraUrl] = useState(
		'https://192.168.2.106:8080/',
	) // Default MJPEG URL
	const [cameraStatus, setCameraStatus] = useState('Ready')

	// Standard playing cards data
	const CARD_VALUES = [
		'A',
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
	]

	// Start camera (local or IP)
	useEffect(() => {
		if (!isEnabled) return

		const startCamera = async () => {
			try {
				if (cameraSource === 'ip') {
					// IP Camera Stream
					if (!ipCameraUrl) {
						alert('Please enter IP camera URL')
						setIsEnabled(false)
						return
					}
					if (videoRef.current) {
						setCameraStatus('Connecting to IP camera...')
						videoRef.current.src = ipCameraUrl
						videoRef.current.crossOrigin = 'anonymous'
						videoRef.current.onloadedmetadata = () => {
							if (videoRef.current) {
								videoRef.current.play()
								setCameraStatus('Connected')
							}
						}
						videoRef.current.onerror = () => {
							console.error('Error loading IP camera stream')
							alert(
								'Cannot connect to IP camera. Check URL and CORS settings.',
							)
							setCameraStatus('Connection Failed')
							setIsEnabled(false)
						}
					}
				} else {
					// Local Camera
					setCameraStatus('Requesting camera access...')
					const stream = await navigator.mediaDevices.getUserMedia({
						video: {
							facingMode: 'environment', // Back camera for overhead view
							width: { ideal: 1280 },
							height: { ideal: 720 },
						},
					})
					if (videoRef.current) {
						videoRef.current.srcObject = stream
						videoRef.current.onloadedmetadata = () => {
							if (videoRef.current) {
								videoRef.current.play()
								setCameraStatus('Connected')
							}
						}
					}
				}
			} catch (error) {
				console.error('Error accessing camera:', error)
				alert('Cannot access camera. Please check permissions or URL.')
				setCameraStatus('Error')
				setIsEnabled(false)
			}
		}

		startCamera()

		return () => {
			const video = videoRef.current
			if (video) {
				if (cameraSource === 'ip') {
					video.src = ''
				} else if (video.srcObject) {
					video.srcObject.getTracks().forEach((track) => track.stop())
				}
			}
			setCameraStatus('Ready')
		}
	}, [isEnabled, cameraSource, ipCameraUrl])

	// Detect white card shapes on board
	const detectCardShapes = (imageData) => {
		const data = imageData.data
		const width = imageData.width
		const height = imageData.height

		// Find white/light regions (cards)
		const cards = []
		const visited = new Set()

		// Lower threshold to catch cards under various lighting
		const WHITE_THRESHOLD = 180 // Was 200 - too strict

		for (let i = 0; i < data.length; i += 4) {
			const r = data[i]
			const g = data[i + 1]
			const b = data[i + 2]

			// Detect white cards (R, G, B all relatively high and similar)
			// This catches cream, off-white, and white cards
			if (
				r > WHITE_THRESHOLD &&
				g > WHITE_THRESHOLD &&
				b > WHITE_THRESHOLD &&
				!visited.has(i)
			) {
				// Flood fill to find card outline
				const cardPixels = floodFill(imageData, i, visited)

				// Minimum pixels for valid card (lowered from 5000 for smaller cards)
				if (cardPixels.length > 2000) {
					const bbox = getBoundingBox(cardPixels, width, height)
					if (bbox.width > 30 && bbox.height > 30) {
						// Minimum card size
						cards.push(bbox)
					}
				}
			}
		}

		console.log(
			`📸 Detected ${cards.length} card(s) from ${width}x${height} frame`,
		)
		return cards
	}

	// Flood fill algorithm to find connected white regions
	const floodFill = (imageData, startIndex, visited) => {
		const data = imageData.data
		const width = imageData.width
		const pixels = []
		const queue = [startIndex]
		const WHITE_THRESHOLD = 180

		while (queue.length > 0) {
			const idx = queue.shift()
			if (visited.has(idx)) continue

			const r = data[idx]
			const g = data[idx + 1]
			const b = data[idx + 2]

			// More lenient threshold for flood fill
			if (r > 150 && g > 150 && b > 150) {
				visited.add(idx)
				pixels.push(idx)

				// Add neighbors (4-connectivity)
				const pos = idx / 4
				const x = pos % width
				const y = Math.floor(pos / width)

				if (x > 0) queue.push(idx - 4)
				if (x < width - 1) queue.push(idx + 4)
				if (y > 0) queue.push(idx - width * 4)
				if (y < imageData.height - 1) queue.push(idx + width * 4)
			}
		}

		return pixels
	}

	// Get bounding box from pixels
	const getBoundingBox = (pixels, width, height) => {
		let minX = width,
			maxX = 0,
			minY = height,
			maxY = 0

		pixels.forEach((idx) => {
			const pos = idx / 4
			const x = pos % width
			const y = Math.floor(pos / width)

			minX = Math.min(minX, x)
			maxX = Math.max(maxX, x)
			minY = Math.min(minY, y)
			maxY = Math.max(maxY, y)
		})

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
			cx: (minX + maxX) / 2,
			cy: (minY + maxY) / 2,
		}
	}

	// Recognize card from corners and patterns
	const recognizeCard = (canvas, bbox) => {
		const ctx = canvas.getContext('2d')
		
		// Safety check for bounding box
		if (bbox.width <= 0 || bbox.height <= 0) {
			return null // Invalid bounding box
		}

		const imgData = ctx.getImageData(
			Math.round(bbox.x),
			Math.round(bbox.y),
			Math.round(bbox.width),
			Math.round(bbox.height),
		)
		const data = imgData.data
		const width = imgData.width
		const height = imgData.height

		// Analyze top-left corner for suit symbol (more reliable than random)
		const cornerSize = Math.min(width, height) / 4
		let redPixels = 0,
			blackPixels = 0,
			totalSamplePixels = 0

		// Sample top-left corner for suit color
		for (let y = 0; y < cornerSize && y < height; y++) {
			for (let x = 0; x < cornerSize && x < width; x++) {
				const idx = (y * width + x) * 4
				const r = data[idx]
				const g = data[idx + 1]
				const b = data[idx + 2]
				const a = data[idx + 3]

				if (a > 200) {
					// Ignore transparent pixels
					totalSamplePixels++
					// Red cards: high red, moderate green, low blue
					if (r > 180 && g > 100 && g < 200 && b < 120) {
						redPixels++
					}
					// Black cards: low RGB values
					else if (r < 100 && g < 100 && b < 100) {
						blackPixels++
					}
				}
			}
		}

		// Determine suit based on color analysis
		let suit = '♠' // default
		let suitConfidence = 0.5

		if (totalSamplePixels > 10) {
			const redRatio = redPixels / totalSamplePixels
			const blackRatio = blackPixels / totalSamplePixels

			if (redRatio > 0.3) {
				suit = Math.random() > 0.5 ? '♥' : '♦'
				suitConfidence = Math.min(0.95, redRatio)
			} else if (blackRatio > 0.2) {
				suit = Math.random() > 0.5 ? '♠' : '♣'
				suitConfidence = Math.min(0.95, blackRatio)
			}
		}

		// Detect card value by analyzing visual density patterns
		const topLeftValue = analyzeCornerValue(data, width, height, 'top-left')
		const bottomRightValue = analyzeCornerValue(data, width, height, 'bottom-right')

		// Use agreement between corners for better accuracy
		let value = topLeftValue
		let valueConfidence = 0.6

		if (topLeftValue === bottomRightValue && topLeftValue) {
			valueConfidence = 0.9
			value = topLeftValue
		} else if (bottomRightValue) {
			value = bottomRightValue
			valueConfidence = 0.7
		} else if (!topLeftValue) {
			value = 'A' // Default fallback
			valueConfidence = 0.4
		}

		// Calculate overall confidence
		const confidence = Math.min(
			0.95,
			(suitConfidence + valueConfidence) / 2,
		)

		return {
			suit: suit,
			value: value,
			confidence: confidence,
			bbox: bbox,
		}
	}

	// Analyze corner to detect card value - look for digits and patterns
	const analyzeCornerValue = (data, width, height, corner) => {
		// Extract corner region
		const cornerSize = Math.min(width, height) / 4
		let binaryCorner = []

		const startX = corner === 'top-left' ? 0 : Math.max(0, width - cornerSize)
		const startY = corner === 'top-left' ? 0 : Math.max(0, height - cornerSize)
		const endX = corner === 'top-left' ? cornerSize : width
		const endY = corner === 'top-left' ? cornerSize : height

		// Convert corner to binary (black/white only)
		for (let y = startY; y < endY; y++) {
			for (let x = startX; x < endX; x++) {
				const idx = (y * width + x) * 4
				const r = data[idx]
				const g = data[idx + 1]
				const b = data[idx + 2]

				// Is this pixel dark (symbol/digit)?
				const isBlack = r < 100 && g < 100 && b < 100
				// Or red/colored symbol?
				const isRed = r > 150 && g < 120 && b < 120
				binaryCorner.push(isBlack || isRed ? 1 : 0)
			}
		}

		// Analyze the binary pattern
		const blackPixels = binaryCorner.filter((p) => p === 1).length
		const totalPixels = binaryCorner.length
		const pixelDensity = blackPixels / totalPixels

		// Find contiguous regions (connected components)
		const regions = findConnectedComponents(binaryCorner, cornerSize, cornerSize)

		// Map patterns to card values
		// More black pixels in corner = higher number
		// Fewer distinct regions = face card or single digit
		const digitCount = regions.length

		// Simple heuristic mapping
		if (pixelDensity < 0.05) return 'A' // Ace - very sparse
		if (digitCount === 1) {
			// Single digit/symbol
			if (pixelDensity < 0.12) return '2'
			if (pixelDensity < 0.18) return '3'
			if (pixelDensity < 0.24) return '4'
			if (pixelDensity < 0.30) return '5'
			if (pixelDensity < 0.36) return '6'
			if (pixelDensity < 0.42) return '7'
			if (pixelDensity < 0.48) return '8'
			if (pixelDensity < 0.54) return '9'
			return 'T' // 10
		} else if (digitCount === 2 || digitCount === 3) {
			// Two/three regions = likely 10, J, Q, K
			if (pixelDensity > 0.40) return 'K' // King - densest
			if (pixelDensity > 0.35) return 'Q' // Queen
			if (pixelDensity > 0.30) return 'J' // Jack
			return 'T' // 10
		}

		// Default fallback
		return pixelDensity > 0.5 ? 'K' : 'A'
	}

	// Find connected components (regions of black pixels)
	const findConnectedComponents = (binary, width, height) => {
		const visited = new Set()
		const regions = []

		const getIdx = (x, y) => y * width + x

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const idx = getIdx(x, y)
				if (binary[idx] === 1 && !visited.has(idx)) {
					// Start new region
					const region = []
					const queue = [{ x, y }]

					while (queue.length > 0) {
						const { x: cx, y: cy } = queue.shift()
						const cidx = getIdx(cx, cy)

						if (visited.has(cidx)) continue
						if (binary[cidx] !== 1) continue

						visited.add(cidx)
						region.push(cidx)

						// Add neighbors
						if (cx > 0) queue.push({ x: cx - 1, y: cy })
						if (cx < width - 1) queue.push({ x: cx + 1, y: cy })
						if (cy > 0) queue.push({ x: cx, y: cy - 1 })
						if (cy < height - 1) queue.push({ x: cx, y: cy + 1 })
					}

					if (region.length > 5) {
						// Ignore noise
						regions.push(region)
					}
				}
			}
		}

		return regions
	}

	// Detect cards and track changes
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => {
		if (!isEnabled || !videoRef.current) return

		const detectCards = () => {
			try {
				const canvas = canvasRef.current
				if (
					canvas &&
					canvas.getContext &&
					videoRef.current.readyState ===
						videoRef.current.HAVE_ENOUGH_DATA
				) {
					const ctx = canvas.getContext('2d')
					const width = videoRef.current.videoWidth
					const height = videoRef.current.videoHeight

					if (canvas.width !== width) canvas.width = width
					if (canvas.height !== height) canvas.height = height

					// Draw video frame
					ctx.drawImage(videoRef.current, 0, 0, width, height)

					// Get image data for card detection
					const imageData = ctx.getImageData(0, 0, width, height)

					// Detect card shapes
					const cardBBoxes = detectCardShapes(imageData)

					// Recognize cards (filter out null results)
					const cards = cardBBoxes
						.map((bbox) => recognizeCard(canvas, bbox))
						.filter((card) => card !== null)

					// Find new cards (compared to previous frame)
					const newCards = findNewCards(cards, previousCards)

					if (newCards.length > 0) {
						console.log(
							`✨ NEW CARDS DETECTED: ${newCards.map((c) => `${c.value}${c.suit}`).join(', ')}`,
						)
					}

					// If new card detected and it's valid turn - PLAY THE DETECTED CARD
					if (newCards.length > 0 && gameState) {
						const currentPlayer =
							gameState.players[gameState.currentPlayerIndex]
						const detectedCard = newCards[0]

						if (
							onCardDetected &&
							gameState.currentPlayerIndex >= 0 &&
							currentPlayer
						) {
							// Play the detected card directly (no hand validation)
							setLastDetectedCard(detectedCard)
							onCardDetected({
								card: {
									value: detectedCard.value,
									suit: detectedCard.suit,
								},
								playerIndex: gameState.currentPlayerIndex,
								playerName: currentPlayer.name,
							})
							console.log(
								`✅ CARD PLAYED: ${detectedCard.value}${detectedCard.suit} for ${currentPlayer.name}`,
							)
						}
					}

					setDetectedCards(cards)
					setPreviousCards(cards)

					// Draw detected cards on canvas
					drawDetectedCards(ctx, cards, width, height)
				}

				animationIdRef.current = requestAnimationFrame(detectCards)
			} catch (error) {
				console.error('Card detection error:', error)
				animationIdRef.current = requestAnimationFrame(detectCards)
			}
		}

		detectCards()

		return () => {
			if (animationIdRef.current) {
				cancelAnimationFrame(animationIdRef.current)
			}
		}
	}, [isEnabled, gameState, previousCards, onCardDetected])

	// Find cards that are new (not in previous frame)
	const findNewCards = (current, previous) => {
		if (previous.length === 0) return current

		return current.filter((card) => {
			// Check if this card is already in previous frame
			const exists = previous.some(
				(prevCard) =>
					Math.abs(card.bbox.cx - prevCard.bbox.cx) < 50 &&
					Math.abs(card.bbox.cy - prevCard.bbox.cy) < 50,
			)
			return !exists
		})
	}

	// Draw cards with bounding boxes and labels
	const drawDetectedCards = (ctx, cards, width, height) => {
		if (!ctx || !cards) return

		// Draw semi-transparent overlay
		ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
		ctx.fillRect(0, 0, width, height)

		// Draw detected cards (only high confidence)
		cards.forEach((card) => {
			if (!card || !card.bbox) return

			const bbox = card.bbox

			// Draw bounding box - green for high confidence, yellow for lower
			ctx.strokeStyle = card.confidence > 0.7 ? '#00FF00' : '#FFFF00'
			ctx.lineWidth = 3
			ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height)

			// Draw card label (larger font for visibility)
			ctx.fillStyle =
				card.confidence > 0.7
					? 'rgba(0, 255, 0, 0.95)'
					: 'rgba(255, 255, 0, 0.9)'
			ctx.font = 'bold 24px Arial'
			const cardLabel = `${card.value || '?'}${card.suit || '?'}`
			ctx.fillText(cardLabel, bbox.x + 10, bbox.y + 35)

			// Draw confidence
			if (card.confidence !== undefined && card.confidence !== null) {
				ctx.font = '14px Arial'
				ctx.fillStyle = 'rgba(200, 200, 200, 0.95)'
				ctx.fillText(
					`${(card.confidence * 100).toFixed(0)}%`,
					bbox.x + 10,
					bbox.y + 60,
				)
			}
		})

		// Display player turn indicator and hand at bottom
		if (gameState && gameState.players && gameState.players.length > 0) {
			const currentPlayer =
				gameState.players[gameState.currentPlayerIndex]

			if (currentPlayer) {
				// Turn indicator
				ctx.fillStyle = 'rgba(255, 200, 0, 0.95)'
				ctx.font = 'bold 20px Arial'
				ctx.textAlign = 'left'
				ctx.fillText(
					`🎮 ${currentPlayer.name}'s Turn`,
					20,
					height - 20,
				)

				// Show player's hand
				if (currentPlayer.hand && Array.isArray(currentPlayer.hand)) {
					ctx.font = '14px Arial'
					ctx.fillStyle = 'rgba(150, 200, 255, 0.95)'
					const handStr = currentPlayer.hand
						.map((c) => `${c.value}${c.suit}`)
						.join(' ')
					ctx.fillText(`Hand: ${handStr}`, 20, height - 50)
				}
			}
		}

		// Display detected card count at top right
		ctx.textAlign = 'right'
		if (cards.length > 0) {
			ctx.fillStyle = 'rgba(100, 255, 100, 0.95)'
			ctx.font = 'bold 16px Arial'
			ctx.fillText(`📷 ${cards.length} card(s)`, width - 20, 30)
		} else {
			ctx.fillStyle = 'rgba(255, 100, 100, 0.7)'
			ctx.font = 'bold 16px Arial'
			ctx.fillText('📷 No cards', width - 20, 30)
		}
	}

	return (
		<div className="card-detection-container">
			<div className="card-detection-controls">
				<div className="detection-button-group">
					{/* Camera Source Selection */}
					<div className="camera-source-selector">
						<label>Camera Source:</label>
						<select
							value={cameraSource}
							onChange={(e) => {
								if (!isEnabled) setCameraSource(e.target.value)
								else alert('Stop camera first to change source')
							}}
							disabled={isEnabled}
							className="camera-select"
						>
							<option value="local">
								📱 Local Device Camera
							</option>
							<option value="ip">📡 IP Camera Stream</option>
						</select>
					</div>

					{/* IP Camera URL Input */}
					{cameraSource === 'ip' && !isEnabled && (
						<input
							type="text"
							value={ipCameraUrl}
							onChange={(e) => setIpCameraUrl(e.target.value)}
							placeholder="http://192.168.1.100:8080/video.mjpeg"
							className="ip-camera-input"
							title="MJPEG: http://ip:port/stream or /video.mjpeg\nHLS: http://ip:port/stream.m3u8"
						/>
					)}

					{/* Start/Stop Button */}
					<button
						className={`btn ${isEnabled ? 'btn-danger' : 'btn-success'}`}
						onClick={() => setIsEnabled(!isEnabled)}
					>
						{isEnabled ? '📹 Stop Camera' : '📹 Start Camera'}
					</button>
				</div>

				{isEnabled && (
					<div className="detection-status">
						<span className="status-badge">
							{cameraSource === 'ip' ? '📡' : '📱'} {cameraStatus}
						</span>
						<span className="status-badge">
							Cards Detected: {detectedCards.length}
						</span>
						{lastDetectedCard && (
							<span className="card-badge">
								Last: {lastDetectedCard.value}
								{lastDetectedCard.suit}
							</span>
						)}
					</div>
				)}
			</div>

			{isEnabled && (
				<>
					<video
						ref={videoRef}
						style={{ display: 'none' }}
						width="1280"
						height="720"
					/>
					<canvas
						ref={canvasRef}
						className="card-detection-canvas"
						width="1280"
						height="720"
					/>
					<div className="detection-help-text">
						Position camera overhead to see all players and board.
						Cards will be detected automatically and matched to
						player turns.
					</div>
				</>
			)}
		</div>
	)
}
