import socket
import sys
import os
import subprocess

def get_primary_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '165.101.251.196'

def main():
    target_ip = get_primary_ip()
    novnc_dir = os.path.dirname(os.path.abspath(__file__))
    port = "6080"
    target = f"{target_ip}:5900"
    
    print("=" * 60)
    print(" noVNC Web Bridge starting...")
    print(f" Web UI:     http://localhost:{port}/index.html")
    print(f"             http://{target_ip}:{port}/index.html")
    print(f" VNC Target: {target}")
    print(f" Password:   965243")
    print(" Persistent: Keep-alive (30s heartbeat) enabled")
    print("=" * 60)
    
    # --heartbeat 30 sends WebSocket ping frames to prevent idle disconnections
    cmd = [
        sys.executable,
        "-m", "websockify",
        "--heartbeat", "30",
        "--web", novnc_dir,
        port,
        target
    ]
    
    try:
        subprocess.run(cmd)
    except KeyboardInterrupt:
        print("\nStopping noVNC...")

if __name__ == "__main__":
    main()
