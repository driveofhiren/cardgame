import cv2
import sys

print("Testing camera sources...")

# Try different camera indices
for i in range(5):
    print(f"\nTesting camera {i}...")
    cap = cv2.VideoCapture(i)
    
    if cap.isOpened():
        print(f"  ✓ Camera {i} opened successfully!")
        ret, frame = cap.read()
        if ret:
            print(f"  ✓ Frame captured! Shape: {frame.shape}")
            # Try to display
            cv2.imshow(f"Camera {i}", frame)
            print(f"  Window created for Camera {i}")
            print(f"  Press any key in the window to continue testing...")
            key = cv2.waitKey(0)
            cv2.destroyAllWindows()
        else:
            print(f"  ✗ Could not read frame from Camera {i}")
        cap.release()
    else:
        print(f"  ✗ Camera {i} not available")

print("\nCamera test complete!")
