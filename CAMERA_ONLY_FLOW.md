# ⚡ Camera-Only Game Flow

## Complete Game Loop (Now Fully Automated via Camera)

```
┌─────────────────────────────────────────────────────────────────────┐
│  GAME SETUP                                                         │
│  1. Frontend: Create room & set player names                        │
│  2. Backend: Deal cards to all players                              │
│  3. Frontend: All players set targets                               │
│  4. Backend: Pick master suit automatically                         │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ROUND STARTS                                                       │
│  Frontend shows: Current player name + "🎥 YOUR TURN - CAMERA READY"│
│  Frontend shows: Player's hand (display only, NOT clickable)        │
│  Frontend shows: Empty game board                                   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CAMERA DETECTS CARD (Python Service)                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 1. Capture frame from camera                                 │   │
│  │ 2. Process with OpenCV (detect contours, extract rank/suit) │   │
│  │ 3. Wait for 5 consecutive frames with same card detection   │   │
│  │ 4. Calculate average confidence score                        │   │
│  │ 5. Send HTTP POST: /detect-card [rank, suit, confidence]   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND RECEIVES DETECTION                                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 1. Validate card is in current player's hand                │   │
│  │    ❌ If not in hand: Return error "Card not in hand"       │   │
│  │ 2. Validate move is legal                                   │   │
│  │    ❌ If must follow suit but doesn't: Return "Follow suit" │   │
│  │ 3. AUTO-PLAY the card                                       │   │
│  │    └─ Remove from player's hand                             │   │
│  │    └─ Add to game board                                     │   │
│  │ 4. Move to next player's turn                               │   │
│  │    └─ currentPlayerIndex = (currentPlayerIndex + 1) % numPlayers│
│  │ 5. Broadcast updated gameState via WebSocket                │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND UPDATES (All Players See)                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 1. Card appears on board with player's name                 │   │
│  │ 2. Remove card from player's hand                            │   │
│  │ 3. If NOT this player's turn: Just watches                  │   │
│  │ 4. If THIS player's turn: Shows "🎥 YOUR TURN"              │   │
│  │ 5. Ready for next camera detection                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
            ┌──────────────┴──────────────┐
            │                             │
    YES (all played)                NO (still more players)
            │                             │
            ▼                             ▼
    ┌──────────────┐          ┌──────────────────────────────┐
    │ All players  │          │ Next player's turn           │
    │ played their │          │ Camera waits for their card  │
    │ card on board│          │ REPEAT from "CAMERA DETECTS" │
    └──────┬───────┘          └──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND CALCULATES WINNER                                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 1. Compare cards by suit priority:                           │   │
│  │    - Master suit wins over normal suit                       │   │
│  │    - Initial suit wins if no master suit                     │   │
│  │ 2. If same suit: Compare by card value (2 < 3 < ... < A)   │   │
│  │ 3. Winner takes the trick + 1 point                          │   │
│  │ 4. Clear board for next trick                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
            ┌──────────────┴──────────────┐
            │                             │
    All hands empty?              No - Continue this round
    (round complete?)                   │
            │                            ▼
           YES         ┌────────────────────────────────────┐
            │          │ Reset board                        │
            │          │ Move to next player (winner leads) │
            │          │ REPEAT from "ROUND STARTS"         │
            │          └────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND CALCULATES ROUND SCORES                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 1. For each player:                                          │   │
│  │    ✓ If points === target: +target +10 bonus                │   │
│  │    ✗ If points ≠ target: 0 points                            │   │
│  │ 2. Update total FP (Final Points) score                      │   │
│  │ 3. Calculate rank (1st, 2nd, 3rd, etc)                       │   │
│  │ 4. Reset player targets & points for next round              │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
            ┌──────────────┴──────────────┐
            │                             │
    More rounds?              Game is OVER
    (numCards > 1)                 │
            │                       ▼
           YES             ┌──────────────────────┐
            │              │ Announce winners:    │
    ┌─────────────────┐    │ - Rank 1 player(s)  │
    │ Decrement       │    │ - Final FP scores    │
    │ numCards        │    │ GAME COMPLETE        │
    │ Reset for       │    └──────────────────────┘
    │ new round       │
    │ REPEAT          │
    └────────┬────────┘
             │
             ▼
    ┌──────────────────┐
    │ Next round setup │
    │ REPEAT           │
    └──────────────────┘
```

## Key Differences From Manual Play

| Aspect             | Manual               | Camera-Only        |
| ------------------ | -------------------- | ------------------ |
| Card input         | Player clicks button | Camera detects     |
| Validation         | Frontend checks      | Backend checks     |
| Board update       | Frontend updates     | Backend broadcasts |
| Turn tracking      | Manual               | Automatic          |
| Point calculation  | Frontend (❌ OLD)    | Backend (✅ NOW)   |
| Player interaction | Click cards          | Watch & wait       |

## Frontend Display Now Shows

1. **Current player's name** (bright yellow if their turn)
2. **"🎥 YOUR TURN - CAMERA READY"** when camera should be pointed at them
3. **Player's hand** (green border = can play, faded = cannot)
4. **"🎥 CAMERA DETECTION MODE"** reminder in hand section
5. **Game board** with cards as they're played
6. **Scoreboard** with points and ranking
7. **Master suit** symbol
8. **Current round** number

## What NO LONGER Happens on Frontend

- ❌ Clicking cards to play them
- ❌ Calculating who won the trick
- ❌ Calculating points for the round
- ❌ Determining rankings
- ❌ Card validation
- ❌ Turn management

**All now on backend!** ✅

## Testing the Flow

1. **Start Backend**: `npm start` (listenports 3001 HTTP + 8080 WebSocket)
2. **Start Frontend**: In another terminal, `npm start`
3. **Create Game**: Set up players and cards
4. **All Join**: Each player connects to room
5. **Set Targets**: Each player sets their prediction
6. **Start Python**: In detect folder, `python CardDetectionSender.py`
7. **Point Camera**: At current player when "YOUR TURN" appears
8. **Watch Automation**: Cards auto-play, board updates, points calculated

**That's it!** The game runs on camera input only now.
