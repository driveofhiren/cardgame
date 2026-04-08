import React, { useEffect, useRef, useState } from 'react'
import './CardDetection.css'

// Constants from the GitHub repo - properly ported from Python OpenCV implementation
const RANK_WIDTH = 70
const RANK_HEIGHT = 125
const SUIT_WIDTH = 70
const SUIT_HEIGHT = 100
const RANK_DIFF_MAX = 2000
const SUIT_DIFF_MAX = 700
const CARD_MAX_AREA = 120000
const CARD_MIN_AREA = 25000
const BKG_THRESH = 60
const CARD_THRESH = 30

const RANK_IMAGES = {
	A: 'Ace',
	'2': 'Two',
	'3': 'Three',
	'4': 'Four',
	'5': 'Five',
	'6': 'Six',
	'7': 'Seven',
	'8': 'Eight',
	'9': 'Nine',
	'10': 'Ten',
	J: 'Jack',
	Q: 'Queen',
	K: 'King',
}

const SUIT_IMAGES = {
	H: 'Hearts',
	D: 'Diamonds',
	C: 'Clubs',
	S: 'Spades',
}

const RANKS = Object.keys(RANK_IMAGES)
const SUITS = Object.keys(SUIT_IMAGES)

export const CardDetection = ({ gameState, playerIndex, onCardDetected }) => {
	const videoRef = useRef(null)
	const canvasRef = useRef(null)
	const animationIdRef = useRef(null)
	const [isEnabled, setIsEnabled] = useState(false)
	const [lastCard, setLastCard] = useState(null)
	const [cameraSource, setCameraSource] = useState('local')
	const [ipCameraUrl, setIpCameraUrl] = useState('https://192.168.2.106:8080/')
	const [cameraStatus, setCameraStatus] = useState('Ready')
	const frameCountRef = useRef(0)
	const refImagesRef = useRef(null)

	// Load reference image
	const loadReferenceImage = async (imageName) => {
		try {
			const img = new Image()
			img.crossOrigin = 'anonymous'
			img.src = `/card_refs/${imageName}.jpg`

			await new Promise((resolve, reject) => {
				img.onload = resolve
				img.onerror = reject
			})

			const canvas = document.createElement('canvas')
			canvas.width = img.width
			canvas.height = img.height
			const ctx = canvas.getContext('2d')
			ctx.drawImage(img, 0, 0)

			return ctx.getImageData(0, 0, img.width, img.height)
		} catch (error) {
			console.error(`Failed to load ${imageName}:`, error)
			return null
		}
	}

	// Initialize reference images
	useEffect(() => {
		const initRefs = async () => {
			const refs = {}

			for (const rank of RANKS) {
				const img = await loadReferenceImage(RANK_IMAGES[rank])
				if (img) refs[rank] = img
			}

			for (const suit of SUITS) {
				const img = await loadReferenceImage(SUIT_IMAGES[suit])
				if (img) refs[suit] = img
			}

			refImagesRef.current = refs
			console.log(`✅ Loaded ${Object.keys(refs).length} reference images`)
		}

		initRefs()
	}, [])

	// camera startup
	useEffect(() => {
		if (!isEnabled) return

		const startCamera = async () => {
			try {
				if (cameraSource === 'ip') {
					if (!ipCameraUrl) {
						alert('Enter IP camera URL')
						setIsEnabled(false)
						return
					}
					setCameraStatus('Connecting...')
					videoRef.current.src = ipCameraUrl
					videoRef.current.crossOrigin = 'anonymous'
					videoRef.current.onloadedmetadata = () => {
						videoRef.current?.play()
						setCameraStatus('Connected')
					}
					videoRef.current.onerror = () => {
						alert('IP camera failed')
						setIsEnabled(false)
					}
				} else {
					setCameraStatus('Requesting access...')
					const stream = await navigator.mediaDevices.getUserMedia({
						video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
					})
					videoRef.current.srcObject = stream
					videoRef.current.onloadedmetadata = () => {
						videoRef.current?.play()
						setCameraStatus('Connected')
					}
				}
			} catch (error) {
				console.error('Camera error:', error)
				alert('Camera error: ' + error.message)
				setIsEnabled(false)
			}
		}

		startCamera()

		return () => {
			//eslint-disable-next-line react-hooks/exhaustive-deps
			const video = videoRef.current
			if (video) {
				if (cameraSource === 'ip') {
					video.src = ''
				} else if (video.srcObject) {
					video.srcObject.getTracks().forEach((t) => t.stop())
				}
			}
		}
	}, [isEnabled, cameraSource, ipCameraUrl])

	// Preprocess image - adaptive thresholding based on background
	const preprocessImage = (imageData) => {
		const data = imageData.data
		const width = imageData.width
		const height = imageData.height

		// Convert to grayscale
		const gray = new Uint8Array(width * height)
		for (let i = 0; i < data.length; i += 4) {
			const r = data[i]
			const g = data[i + 1]
			const b = data[i + 2]
			gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
		}

		// Gaussian blur 5x5
		const blur = new Uint8Array(width * height)
		const kernel = [1, 4, 6, 4, 1]
		for (let y = 2; y < height - 2; y++) {
			for (let x = 2; x < width - 2; x++) {
				let sum = 0
				for (let ky = -2; ky <= 2; ky++) {
					for (let kx = -2; kx <= 2; kx++) {
						sum += gray[(y + ky) * width + (x + kx)] * kernel[kx + 2] * kernel[ky + 2]
					}
				}
				blur[y * width + x] = Math.min(255, Math.round(sum / 256))
			}
		}

		// Adaptive threshold - sample background level from top center
		const bkgLevel = blur[Math.floor(height / 100) * width + Math.floor(width / 2)]
		const threshLevel = Math.min(255, bkgLevel + BKG_THRESH)

		// Binary threshold
		const thresh = new Uint8Array(width * height)
		for (let i = 0; i < blur.length; i++) {
			thresh[i] = blur[i] > threshLevel ? 255 : 0
		}

		return thresh
	}

	// Find contours and filter for cards
	const findCards = (thresh, width, height) => {
		// Create ImageData for contour detection
		const threshImage = new ImageData(width, height)
		for (let i = 0; i < thresh.length; i++) {
			threshImage.data[i * 4] = thresh[i]
			threshImage.data[i * 4 + 1] = thresh[i]
			threshImage.data[i * 4 + 2] = thresh[i]
			threshImage.data[i * 4 + 3] = 255
		}

		// Find contours using canvas
		const canvas = document.createElement('canvas')
		canvas.width = width
		canvas.height = height
		const ctx = canvas.getContext('2d')
		ctx.putImageData(threshImage, 0, 0)

		// Simple contour detection - find connected white regions
		const visited = new Uint8Array(width * height)
		const contours = []

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const idx = y * width + x
				if (!visited[idx] && thresh[idx] === 255) {
					const contour = traceContour(thresh, visited, width, height, x, y)
					if (contour && contour.length > 20) {
						const area = contour.length
						const bbox = getBoundingBox(contour)
						if (area > CARD_MIN_AREA && area < CARD_MAX_AREA && hasCardRatio(bbox)) {
							contours.push({ points: contour, bbox, area })
						}
					}
				}
			}
		}

		// Sort by area (largest first)
		contours.sort((a, b) => b.area - a.area)
		return contours.slice(0, 5) // Return top 5 largest
	}

	// Trace contour boundary
	const traceContour = (thresh, visited, width, height, startX, startY) => {
		const contour = []
		const stack = [[startX, startY]]
		const maxSize = 10000

		while (stack.length > 0 && contour.length < maxSize) {
			const [x, y] = stack.pop()

			if (x < 0 || x >= width || y < 0 || y >= height) continue
			const idx = y * width + x
			if (visited[idx]) continue
			if (thresh[idx] !== 255) continue

			visited[idx] = 1
			contour.push([x, y])

			// Add neighbors
			stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
		}

		return contour
	}

	// Get bounding box from contour points
	const getBoundingBox = (contour) => {
		let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity

		for (const [x, y] of contour) {
			minX = Math.min(minX, x)
			maxX = Math.max(maxX, x)
			minY = Math.min(minY, y)
			maxY = Math.max(maxY, y)
		}

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
		}
	}

	// Check if bounding box has card-like ratio
	const hasCardRatio = (bbox) => {
		const ratio = bbox.width / bbox.height
		return ratio > 0.5 && ratio < 1.5 && bbox.width > 50 && bbox.height > 80
	}

	// Perspective transform (flattener from original code)
	const flattened = (canvas, contourBbox, imageData) => {
		// Extract the card region from the image
		const x = Math.max(0, Math.round(contourBbox.x))
		const y = Math.max(0, Math.round(contourBbox.y))
		const w = Math.round(Math.min(contourBbox.width, canvas.width - x))
		const h = Math.round(Math.min(contourBbox.height, canvas.height - y))

		// Create a canvas with the card region
		const cardCanvas = document.createElement('canvas')
		cardCanvas.width = w
		cardCanvas.height = h
		const cardCtx = cardCanvas.getContext('2d')
		cardCtx.putImageData(
			new ImageData(
				imageData.data.slice(0, imageData.data.length),
				imageData.width,
				imageData.height
			),
			-x,
			-y
		)

		// Scale to 200x300
		const warpCanvas = document.createElement('canvas')
		warpCanvas.width = 200
		warpCanvas.height = 300
		const warpCtx = warpCanvas.getContext('2d')
		warpCtx.drawImage(cardCanvas, 0, 0, w, h, 0, 0, 200, 300)

		// Convert to grayscale
		const warpData = warpCtx.getImageData(0, 0, 200, 300)
		const gray = new Uint8Array(200 * 300)
		for (let i = 0; i < warpData.data.length; i += 4) {
			const r = warpData.data[i]
			const g = warpData.data[i + 1]
			const b = warpData.data[i + 2]
			gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
		}

		return gray
	}

	// Extract and threshold rank corner
	const extractRank = (warp) => {
		// Sample white level from corner
		const cornerZoom = warp[15 * 200 + 100] // Sample pixel
		const threshLevel = Math.max(1, cornerZoom - CARD_THRESH)

		// Threshold the corner region
		const rankImg = new Uint8Array(RANK_WIDTH * RANK_HEIGHT)
		for (let y = 0; y < RANK_HEIGHT; y++) {
			for (let x = 0; x < RANK_WIDTH; x++) {
				const idx = y * 200 + x
				const val = warp[idx] > threshLevel ? 0 : 255
				rankImg[y * RANK_WIDTH + x] = val
			}
		}

		return rankImg
	}

	// Extract and threshold suit corner
	const extractSuit = (warp) => {
		const cornerZoom = warp[15 * 200 + 100]
		const threshLevel = Math.max(1, cornerZoom - CARD_THRESH)

		const suitImg = new Uint8Array(SUIT_WIDTH * SUIT_HEIGHT)
		const startY = 200

		for (let y = 0; y < SUIT_HEIGHT; y++) {
			if (startY + y >= 300) break
			for (let x = 0; x < SUIT_WIDTH; x++) {
				const idx = (startY + y) * 200 + x
				const val = warp[idx] > threshLevel ? 0 : 255
				suitImg[y * SUIT_WIDTH + x] = val
			}
		}

		return suitImg
	}

	// Image differencing - cv2.absdiff equivalent
	const imageDifference = (img1, img2, w, h) => {
		let totalDiff = 0
		const len = Math.min(img1.length, img2.length)

		for (let i = 0; i < len; i++) {
			totalDiff += Math.abs(img1[i] - img2[i])
		}

		return Math.round(totalDiff / len)
	}

	// Match card to references
	const matchCard = (rankImg, suitImg) => {
		let bestRank = 'Unknown'
		let bestSuit = 'Unknown'
		let bestRankDiff = 10000
		let bestSuitDiff = 10000

		if (!refImagesRef.current) return { rank: bestRank, suit: bestSuit, rankDiff: bestRankDiff, suitDiff: bestSuitDiff }

		// Match rank
		for (const rank of RANKS) {
			if (!refImagesRef.current[rank]) continue
			const refData = refImagesRef.current[rank].data

			const diff = imageDifference(rankImg, refData, RANK_WIDTH, RANK_HEIGHT)

			if (diff < bestRankDiff) {
				bestRankDiff = diff
				bestRank = rank
			}
		}

		// Match suit
		for (const suit of SUITS) {
			if (!refImagesRef.current[suit]) continue
			const refData = refImagesRef.current[suit].data

			const diff = imageDifference(suitImg, refData, SUIT_WIDTH, SUIT_HEIGHT)

			if (diff < bestSuitDiff) {
				bestSuitDiff = diff
				bestSuit = suit
			}
		}

		// Apply thresholds
		if (bestRankDiff > RANK_DIFF_MAX) bestRank = 'Unknown'
		if (bestSuitDiff > SUIT_DIFF_MAX) bestSuit = 'Unknown'

		console.log(`🎴 ${bestRank}${bestSuit} (rank: ${bestRankDiff}, suit: ${bestSuitDiff})`)

		return { rank: bestRank, suit: bestSuit, rankDiff: bestRankDiff, suitDiff: bestSuitDiff }
	}

	// Main detection loop
	//eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => {
		if (!isEnabled || !videoRef.current) return

		if (!refImagesRef.current || Object.keys(refImagesRef.current).length === 0) {
			return
		}

		const detect = async () => {
			try {
				frameCountRef.current++
				if (frameCountRef.current % 5 !== 0) {
					animationIdRef.current = requestAnimationFrame(detect)
					return
				}

				const canvas = canvasRef.current
				if (canvas?.getContext && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
					const ctx = canvas.getContext('2d')
					const w = videoRef.current.videoWidth
					const h = videoRef.current.videoHeight

					if (canvas.width !== w) canvas.width = w
					if (canvas.height !== h) canvas.height = h

					ctx.drawImage(videoRef.current, 0, 0, w, h)
					const imageData = ctx.getImageData(0, 0, w, h)

					// Preprocess
					const thresh = preprocessImage(imageData)

					// Find cards
					const contours = findCards(thresh, w, h)

					// Process each card
					const cards = []
					for (const contour of contours) {
						try {
							// Flatten (perspective transform)
							const warp = flattened(canvas, contour.bbox, imageData)

							// Extract rank and suit
							const rankImg = extractRank(warp)
							const suitImg = extractSuit(warp)

							// Match
							const match = matchCard(rankImg, suitImg)

							if (match.rank !== 'Unknown') {
								cards.push({
									bbox: contour.bbox,
									rank: match.rank,
									suit: match.suit,
									rankDiff: match.rankDiff,
									suitDiff: match.suitDiff,
								})
							}
						} catch (e) {
							console.warn('Error processing card:', e)
						}
					}

					// Play card if turn
					if (cards.length > 0 && gameState?.currentPlayerIndex >= 0 && onCardDetected) {
						const card = cards[0]
						const player = gameState.players[gameState.currentPlayerIndex]
						if (player) {
							const suitSymbol = { H: '♥', D: '♦', C: '♣', S: '♠' }[card.suit]
							onCardDetected({
								card: { value: card.rank, suit: suitSymbol },
								playerIndex: gameState.currentPlayerIndex,
								playerName: player.name,
							})
							setLastCard(card)
							console.log(`✅ Played: ${card.rank}${suitSymbol}`)
						}
					}

					// Draw results
					drawResults(ctx, cards, w, h, gameState)
				}

				animationIdRef.current = requestAnimationFrame(detect)
			} catch (e) {
				console.error('Detection error:', e)
				animationIdRef.current = requestAnimationFrame(detect)
			}
		}

		detect()

		return () => {
			if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current)
		}
		//eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isEnabled, gameState, onCardDetected])

	const drawResults = (ctx, cards, width, height, gameState) => {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
		ctx.fillRect(0, 0, width, height)

		cards.forEach((card) => {
			const bbox = card.bbox
			ctx.strokeStyle = '#00FF00'
			ctx.lineWidth = 3
			ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height)

			const suitSymbol = { H: '♥', D: '♦', C: '♣', S: '♠' }[card.suit]
			ctx.fillStyle = '#00FF00'
			ctx.font = 'bold 24px Arial'
			ctx.fillText(`${card.rank}${suitSymbol}`, bbox.x + 10, bbox.y + 35)
		})

		if (gameState?.players?.[gameState.currentPlayerIndex]) {
			const player = gameState.players[gameState.currentPlayerIndex]
			ctx.fillStyle = '#FFD700'
			ctx.font = 'bold 20px Arial'
			ctx.textAlign = 'left'
			ctx.fillText(`🎮 ${player.name}`, 20, height - 20)
		}

		ctx.fillStyle = '#00FF00'
		ctx.font = 'bold 16px Arial'
		ctx.textAlign = 'right'
		ctx.fillText(`📷 ${cards.length}`, width - 20, 30)
		ctx.textAlign = 'left'
	}

	return (
		<div className="card-detection-container">
			<div className="card-detection-controls">
				<div className="detection-button-group">
					<div className="camera-source-selector">
						<label>Camera:</label>
						<select
							value={cameraSource}
							onChange={(e) => !isEnabled && setCameraSource(e.target.value)}
							disabled={isEnabled}
							className="camera-select"
						>
							<option value="local">📱 Local</option>
							<option value="ip">📡 IP Camera</option>
						</select>
					</div>

					{cameraSource === 'ip' && !isEnabled && (
						<input
							type="text"
							value={ipCameraUrl}
							onChange={(e) => setIpCameraUrl(e.target.value)}
							placeholder="http://192.168.1.100:8080/stream"
							className="ip-camera-input"
						/>
					)}

					<button
						className={`btn ${isEnabled ? 'btn-danger' : 'btn-success'}`}
						onClick={() => setIsEnabled(!isEnabled)}
					>
						{isEnabled ? '📹 Stop' : '📹 Start'}
					</button>
				</div>

				{isEnabled && (
					<div className="detection-status">
						<span className="status-badge">{cameraStatus}</span>
						{lastCard && (
							<span className="card-badge">
								Last: {lastCard.rank}
								{({ H: '♥', D: '♦', C: '♣', S: '♠' }[lastCard.suit])}
							</span>
						)}
					</div>
				)}
			</div>

			{isEnabled && (
				<>
					<video ref={videoRef} style={{ display: 'none' }} width="1280" height="720" />
					<canvas ref={canvasRef} className="card-detection-canvas" width="1280" height="720" />
					<div className="detection-help-text">Dark background required. Position cards clearly in view.</div>
				</>
			)}
		</div>
	)
}
