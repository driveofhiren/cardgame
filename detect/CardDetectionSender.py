#!/usr/bin/env python3
"""
Card Detection Sender - sends detected cards to backend via HTTP
Uses the existing CardDetector logic and sends confirmed detections to the game server
"""

import cv2
import numpy as np
import time
import os
import sys
import requests
import json
from collections import deque
import Cards
import VideoStream

# Configuration
BACKEND_URL = "http://192.168.2.81:3001/detect-card"
ROOM_ID = os.getenv('ROOM_ID', 'o1en')  # Set via environment variable
CONFIDENCE_FRAMES = 1  # Set to 1 for immediate sending (no queue needed)
FRAME_RATE = 10

# Game constants (from Cards.py)
RANK_DIFF_MAX = 2000
SUIT_DIFF_MAX = 700

# Camera settings
IM_WIDTH = 1280
IM_HEIGHT = 720

# Frame tracking
frame_count = 0
last_sent_card = None
last_sent_frame = 0
detected_cards_queue = deque(maxlen=CONFIDENCE_FRAMES)
COOLDOWN_FRAMES = 15  # Wait 15 frames (~1.5 sec at 10 FPS) after successful send before detecting again
pause_until_time = 0  # Timestamp when to resume detection (0 = not paused)

print("[STARTUP] ✓ Script started", flush=True)
print(f"[STARTUP] ✓ Backend URL: {BACKEND_URL}", flush=True)
print(f"[STARTUP] ✓ Room ID: {ROOM_ID}", flush=True)
print(f"[STARTUP] ✓ Confidence threshold: {CONFIDENCE_FRAMES} frames", flush=True)
print(f"[STARTUP] ✓ Press 'q' to quit", flush=True)
print(f"{'='*60}", flush=True)
print("[STARTUP] Initializing camera...", flush=True)

try:
    # Initialize camera - use USB camera (PiOrUSB=2)
    videostream = VideoStream.VideoStream((IM_WIDTH, IM_HEIGHT), FRAME_RATE, 2, 0).start()
    time.sleep(1)
    print("[STARTUP] ✓ Camera initialized", flush=True)

    # Load training rank and suit images
    path = os.path.dirname(os.path.abspath(__file__))
    print(f"[STARTUP] Loading training images from: {path}/Card_Imgs/", flush=True)
    train_ranks = Cards.load_ranks(path + '/Card_Imgs/')
    train_suits = Cards.load_suits(path + '/Card_Imgs/')
    print("[STARTUP] ✓ Training images loaded", flush=True)
    print(f"{'='*60}", flush=True)
    print("[READY] Waiting for card detections...", flush=True)
    print(f"{'='*60}", flush=True)

except Exception as e:
    print(f"[ERROR] Failed to initialize: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

def get_rank_name(rank_obj):
    """Convert rank object to single character or '10'"""
    rank_map = {
        'Ace': 'A',
        'Two': '2',
        'Three': '3',
        'Four': '4',
        'Five': '5',
        'Six': '6',
        'Seven': '7',
        'Eight': '8',
        'Nine': '9',
        'Ten': '10',
        'Jack': 'J',
        'Queen': 'Q',
        'King': 'K',
    }
    return rank_map.get(rank_obj, '?')

def get_suit_symbol(suit_obj):
    """Convert suit object name to symbol"""
    suit_map = {
        'Hearts': '♥',
        'Diamonds': '♦',
        'Clubs': '♣',
        'Spades': '♠',
    }
    return suit_map.get(suit_obj, '?')

def send_detected_card(rank, suit, confidence):
    """Send detected card to backend"""
    global pause_until_time
    print(f"\n[HTTP] >>> ENTERING send_detected_card({rank}, {suit}, {confidence})", flush=True)
    try:
        payload = {
            'roomId': ROOM_ID,
            'rank': rank,
            'suit': suit,
            'confidence': confidence
        }
        
        print(f"[HTTP] Payload: {payload}", flush=True)
        print(f"[HTTP] Target: {BACKEND_URL}", flush=True)
        print(f"[HTTP] Calling requests.post()...", flush=True)
        sys.stdout.flush()
        
        response = requests.post(BACKEND_URL, json=payload, timeout=2)
        print(f"[HTTP] ✓ Got response code: {response.status_code}", flush=True)
        
        response.raise_for_status()
        
        result = response.json()
        print(f"[HTTP] ✓ Response data: {result}", flush=True)
        
        # Check if backend wants us to pause
        if 'pauseUntil' in result:
            pause_until_time = result['pauseUntil'] / 1000.0  # Convert ms to seconds
            if pause_until_time > 0:
                print(f"[HTTP] ⏸️  Backend requesting pause until {pause_until_time}", flush=True)
        
        if result.get('success'):
            print(f"[HTTP] ✅ SUCCESS from backend: {result.get('message')}", flush=True)
            return True
        else:
            print(f"[HTTP] ❌ Backend error: {result.get('message')}", flush=True)
            return False
    except requests.exceptions.ConnectionError as e:
        print(f"[HTTP] ❌ CONNECTION ERROR: {e}", flush=True)
        return False
    except requests.exceptions.Timeout:
        print(f"[HTTP] ❌ TIMEOUT", flush=True)
        return False
    except Exception as e:
        print(f"[HTTP] ❌ Exception: {type(e).__name__}: {e}", flush=True)
        import traceback
        traceback.print_exc()
        return False

def is_same_card(card1, card2):
    """Check if two card detections are the same"""
    if card1 is None or card2 is None:
        return False
    return card1['rank'] == card2['rank'] and card1['suit'] == card2['suit']

# Main detection loop
cam_quit = 0
frame_rate_calc = 0
freq = cv2.getTickFrequency()

try:
    while cam_quit == 0:
        frame_count += 1
        image = videostream.read()
        t1 = cv2.getTickCount()

        # Check if frame is empty
        if image is None or (isinstance(image, np.ndarray) and image.size == 0):
            print(f"[ERROR] Empty frame from camera - checking stream connection", flush=True)
            time.sleep(0.1)
            continue
        current_time = time.time()
        if pause_until_time > 0 and current_time < pause_until_time:
            seconds_left = int(pause_until_time - current_time)
            print(f"[PAUSE] Detection paused... ({seconds_left}s remaining)", flush=True)
            cv2.putText(image, f"PAUSED FOR NEW ROUND ({seconds_left}s)", 
                        (10, 360), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 2, cv2.LINE_AA)
            cv2.imshow("Card Detection Sender", image)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                cam_quit = 1
            continue  # Skip detection

        # Reset last card when pause ends (new round starting)
        if pause_until_time > 0 and current_time >= pause_until_time:
            print(f"[ROUND] 🔄 New round started - resetting last card", flush=True)
            last_sent_card = None
            last_sent_frame = 0
            pause_until_time = 0  # Clear the pause time so this only runs once

        # Check if we're still in cooldown after last successful send
        frames_since_send = frame_count - last_sent_frame if last_sent_card else 0
        in_cooldown = last_sent_card is not None and frames_since_send < COOLDOWN_FRAMES

        if in_cooldown:
            print(f"[COOLDOWN] Waiting... ({COOLDOWN_FRAMES - frames_since_send} frames left)", flush=True)
            # Skip detection during cooldown
            detected_cards = []
        else:
            # Preprocess
            pre_proc = Cards.preprocess_image(image)
            cnts_sort, cnt_is_card = Cards.find_cards(pre_proc)

            detected_cards = []

            if len(cnts_sort) != 0:
                for i in range(len(cnts_sort)):
                    if cnt_is_card[i] == 1:
                        card = Cards.preprocess_card(cnts_sort[i], image)
                        card.best_rank_match, card.best_suit_match, card.rank_diff, card.suit_diff = \
                            Cards.match_card(card, train_ranks, train_suits)

                        # Check confidence thresholds
                        if card.rank_diff < RANK_DIFF_MAX and card.suit_diff < SUIT_DIFF_MAX:
                            rank = get_rank_name(card.best_rank_match)
                            suit = get_suit_symbol(card.best_suit_match)
                            confidence = 1.0 - (card.rank_diff / RANK_DIFF_MAX + card.suit_diff / SUIT_DIFF_MAX) / 2
                            
                            print(f"[DETECT] Frame {frame_count}: Found {rank}{suit} (conf: {confidence:.2f})", flush=True)
                            
                            detected_cards.append({
                                'rank': rank,
                                'suit': suit,
                                'confidence': confidence,
                                'rank_diff': card.rank_diff,
                                'suit_diff': card.suit_diff
                            })

                            # Draw for visualization
                            image = Cards.draw_results(image, card)

                # Sort by confidence (highest first)
                detected_cards.sort(key=lambda c: c['confidence'], reverse=True)

        # Process detected cards - take best one (highest confidence)
        if detected_cards:
            best_card = detected_cards[0]
            detected_cards_queue.append(best_card)

            # Check if we have a card to send
            if len(detected_cards_queue) >= CONFIDENCE_FRAMES:
                current_card = detected_cards_queue[0]
                
                # Validate card is not "unknown"
                if current_card['rank'] != 'unknown' and current_card['suit'] != 'unknown':
                    # Only send if different from last sent card
                    if last_sent_card is None or not is_same_card(current_card, last_sent_card):
                        print(f"\n[SEND] Sending {current_card['rank']}{current_card['suit']} to backend", flush=True)
                        result = send_detected_card(current_card['rank'], current_card['suit'], current_card['confidence'])
                        if result:
                            last_sent_card = current_card
                            last_sent_frame = frame_count
                        detected_cards_queue.clear()
                else:
                    detected_cards_queue.clear()

        # Draw debug info
        cv2.putText(image, f"FPS: {int(frame_rate_calc)}", (10, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 255), 2, cv2.LINE_AA)
        
        if last_sent_card:
            frames_since_send = frame_count - last_sent_frame
            if frames_since_send < COOLDOWN_FRAMES:
                frames_left = COOLDOWN_FRAMES - frames_since_send
                cv2.putText(image, f"Last: {last_sent_card['rank']}{last_sent_card['suit']} (cooldown: {frames_left})", 
                            (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2, cv2.LINE_AA)
            else:
                cv2.putText(image, f"Last: {last_sent_card['rank']}{last_sent_card['suit']} (waiting for NEW card)", 
                            (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 200, 0), 2, cv2.LINE_AA)

        cv2.imshow("Card Detection Sender", image)

        # Calculate frame rate
        t2 = cv2.getTickCount()
        time1 = (t2 - t1) / freq
        frame_rate_calc = 1 / time1

        # Poll for quit
        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            cam_quit = 1

except KeyboardInterrupt:
    print("\n[STOPPED] User interrupted (Ctrl+C)", flush=True)
except Exception as e:
    print(f"\n[ERROR] Exception in main loop: {e}", flush=True)
    import traceback
    traceback.print_exc()
finally:
    print("[CLEANUP] Shutting down...", flush=True)
    cv2.destroyAllWindows()
    videostream.stop()
    print("[DONE] Card Detection Sender stopped", flush=True)
