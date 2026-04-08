# Card Detection Integration Guide

This document explains the card game detection architecture and how to set everything up.

## Architecture Overview

```
┌─────────────────┐
│  Python Service │
│  (CardDetector) │  
│  detect/        │
└────────┬────────┘
         │ (HTTP POST with card rank, suit, confidence)
         ▼
┌─────────────────────────────────┐
│    Node.js Backend Server       │
│    server/                      │
│  ┌────────────────────────────┐ │
│  │ Auto-plays card            │ │
│  │ Calculates points/winner   │ │
│  │ Manages game state         │ │
│  └────────────────────────────┘ │
└────────┬────────────────────────┘
         │ (WebSocket broadcast of gameState)
         ▼
┌─────────────────────────────┐
│   React Frontend            │
│   (my-card-game)            │
│   - Displays UI             │
│   - Receives stream of      │
│     game state updates      │
│   - Players can manually    │
│     play cards              │
└─────────────────────────────┘
```

## Components

### 1. **Python Card Detection Service** (`detect/CardDetectionSender.py`)
- **What it does**: Detects playing cards using OpenCV
- **How it works**:
  - Captures frames from camera
  - Processes each frame to detect cards
  - Maintains a queue of detections (default: 5 consecutive frames)
  - When a card is consistently detected, sends it to backend
  - Only sends if card is new (different from last sent)

- **Start it**:
  ```bash
  cd detect
  # Set the room ID via environment variable
  set ROOM_ID=your_room_id  # On Windows PowerShell
  export ROOM_ID=your_room_id  # On Linux/Mac
  
  python CardDetectionSender.py
  ```

- **Configuration**: 
  - `CONFIDENCE_FRAMES = 5` - Number of consecutive frames needed to confirm a card
  - `BACKEND_URL = "http://192.168.2.81:3001/detect-card"` - Update IP/port if needed
  - `ROOM_ID` - Set via environment variable, defaults to 'test' if not set

### 2. **Backend Server** (`server/server.js`)
- **Ports**:
  - `8080` - WebSocket for game clients (frontend players)
  - `3001` - HTTP endpoint for card detections from Python
  
- **New Endpoint**: `POST /detect-card`
  - **Request body**:
    ```json
    {
      "roomId": "abcd",
      "rank": "K",
      "suit": "H",
      "confidence": 0.95
    }
    ```
  - **Response**:
    ```json
    {
      "success": true,
      "message": "Card played",
      "playerName": "Player 1"
    }
    ```

- **What it does on card detection**:
  1. Validates card is in current player's hand
  2. Validates move is legal (follow suit if possible)
  3. Auto-plays the card
  4. Checks if all players have played
  5. If yes: Calculates winner and updates points
  6. If no: Moves to next player
  7. Broadcasts updated gameState to all players

- **Start it**:
  ```bash
  cd server
  npm install  # Install dependencies if needed
  npm start
  ```

### 3. **Frontend Game** (`my-card-game/`)
- **What changed**: Removed local game logic (calculatePointsAndResetBoard)
- **Now**:
  - Frontend receives gameState updates via WebSocket
  - Frontend just displays the game state
  - No more calculation logic on frontend
  - Players can manually click to play cards (for testing)

- **Start it**:
  ```bash
  cd my-card-game
  npm start
  ```

## Setup Instructions

### Prerequisites
- Python 3.7+
- Node.js 14+
- OpenCV (in detect/ environment)
- pip packages: `opencv-python`, `requests` (for Python service)

### Step 1: Install Python Dependencies
```bash
cd detect
pip install opencv-python requests
```

### Step 2: Start Backend Server
```bash
cd server
npm install  # First time only
npm start
# Should see: 
# - Card Detection HTTP endpoint listening on port 3001
# - WebSocket server listening on port 8080
```

### Step 3: Start Frontend App
```bash
cd my-card-game
npm install  # First time only
npm start
# Opens at http://localhost:3000
```

### Step 4: Create a Game
- Click "Create Game" in frontend
- Set number of players, rounds, cards
- All players should connect (join same room)
- Set targets when prompted

### Step 5: Start Python Card Detection
```bash
cohere
# Set room ID to match the room created in step 4
set ROOM_ID=room_id_from_step_4  # Windows
python CardDetectionSender.py
# Should see: [INFO] Starting Card Detection Sender
```

## How It Works

1. **Game Flow**:
   - Frontend creates game, all players join via WebSocket
   - Python service detects a card
   - Python sends: `POST /detect-card` with card data
   - Backend validates and auto-plays the card
   - Backend broadcasts updated gameState
   - Frontend displays the card being played

2. **Points Calculation** (Now on Backend):
   - When all players have played: Backend calculates winner
   - Compares suit priorities (master suit > initial suit > other)
   - Compares card values for same suit
   - Updates player points
   - When all hands empty: Calculates scores and rankings

3. **Confidence System** (Python):
   - Needs 5 consecutive frames of same card detection
   - Calculates average confidence
   - Only sends if different from last sent card
   - Prevents sending duplicate cards

## Troubleshooting

### Python script says "Failed to send card"
- Check backend is running on correct port (3001)
- Check `BACKEND_URL` matches your server IP
- Check `ROOM_ID` environment variable is set correctly

### Backend gives "Card not in current player hand"
- Card detected might be wrong (low confidence)
- Increase `CONFIDENCE_FRAMES` in Python script
- Check camera angle and lighting

### "Must follow suit" error
- Player must follow the suit of the first card played
- Camera might have detected the card multiple times in a round

### Frontend not updating
- Check WebSocket connection (should be on port 8080)
- Frontend URL might not match backend address
- Check browser console for errors

## Development Notes

### Files Modified
- **server/server.js**: Added `handleDetectedCard()` function and `/detect-card` endpoint
- **my-card-game/src/Components/Deck.js**: Removed `calculatePointsAndResetBoard()`, removed CardDetection component
- **detect/CardDetectionSender.py**: New file - Python service for card detection

### Backend Functions
- `getWinningCard()` - Determines winner from board of cards
- `handleDetectedCard()` - Processes detected card, auto-plays, calculates points if round complete
- `POST /detect-card` - HTTP endpoint to receive detections

### Next Steps (Optional)
- Add database to persist game history
- Add confidence threshold settings via API
- Add authentication for players
- Add real-time video stream overlay to show confidence
- Add undo/replay functionality
