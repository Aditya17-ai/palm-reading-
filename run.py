"""
Palm Reading AI - Universal Application Launcher
Starts the FastAPI backend and serves the interactive frontend at http://localhost:8000.
"""

import os
import sys
import webbrowser
import threading
import time
import uvicorn

from backend.generate_samples import generate_all_samples


def ensure_samples():
    if not os.path.exists("samples/sample_earth_palm.png"):
        print("[*] Generating preset sample palm images...")
        generate_all_samples()


def open_browser(port: int = 8000):
    time.sleep(1.2)
    # Only open browser if not running in headless/cloud environment
    if os.environ.get("HEADLESS") != "true" and os.environ.get("RENDER") != "true":
        print(f"[*] Opening Celestial Palm Reading Studio in your browser: http://localhost:{port}")
        webbrowser.open(f"http://localhost:{port}")


def main():
    print("=" * 65)
    print("      PALMISTRA AI - CELESTIAL CHIROLOGY & PALM READING STUDIO     ")
    print("=" * 65)

    ensure_samples()

    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1")

    # Launch browser in a background thread if local
    threading.Thread(target=open_browser, args=(port,), daemon=True).start()

    print(f"[*] Starting backend server on http://{host}:{port} (Press Ctrl+C to stop)...")
    uvicorn.run("backend.app:app", host=host, port=port, reload=False, log_level="info")


if __name__ == "__main__":
    main()

