import cv2
import sys

print("OpenCV version:", cv2.__version__)
print("\nAvailable backends:")
print(cv2.videoio_registry.getBackends())

print("\n" + "="*50)
print("Trying different backends...")
print("="*50)

# Try with explicit backends
backends = [
    (cv2.CAP_DSHOW, "DirectShow"),
    (cv2.CAP_WINRT, "Windows Runtime"),
    (cv2.CAP_MSMF, "Media Foundation"),
    (cv2.CAP_VFW, "Video for Windows"),
]

for backend_id, backend_name in backends:
    print(f"\nTrying backend: {backend_name}")
    for i in range(3):
        print(f"  Attempting camera {i} with {backend_name}...")
        try:
            cap = cv2.VideoCapture(i, backend_id)
            if cap.isOpened():
                print(f"    ✓ Camera {i} opened!")
                ret, frame = cap.read()
                if ret:
                    print(f"    ✓ Frame captured! Shape: {frame.shape}")
                    print(f"    SUCCESS! Use camera index {i} with {backend_name}")
                    cap.release()
                    break
                else:
                    print(f"    ✗ No frame")
                cap.release()
            else:
                print(f"    ✗ Could not open")
        except Exception as e:
            print(f"    Error: {e}")
