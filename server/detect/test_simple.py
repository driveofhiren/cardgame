import cv2

print("Attempting basic VideoCapture with default settings...\n")

# Try with CAP_ANY (default)
cap = cv2.VideoCapture(0, cv2.CAP_ANY)

if cap.isOpened():
    print("✓ Camera opened with CAP_ANY backend")
    
    # Set properties
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    # Try to read frames
    for i in range(5):
        ret, frame = cap.read()
        if ret:
            print(f"✓ Frame {i+1} captured - Shape: {frame.shape}")
        else:
            print(f"✗ Frame {i+1} failed")
    
    # Try to display a frame
    ret, frame = cap.read()
    if ret:
        print("\nAttempting to display frame...")
        cv2.imshow("Test Camera", frame)
        print("Window displayed - press any key to close")
        cv2.waitKey(0)
        cv2.destroyAllWindows()
    
    cap.release()
else:
    print("✗ Could not open camera with CAP_ANY")
    print("\nNo camera detected! Possible solutions:")
    print("1. Check if camera is properly connected")
    print("2. Check Windows Device Manager for camera driver issues")
    print("3. Try a different USB port")
    print("4. Reinstall camera drivers")
