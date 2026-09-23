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


def open_browser():
    time.sleep(1.2)
    print("[*] Opening Celestial Palm Reading Studio in your browser: http://localhost:8000")
    webbrowser.open("http://localhost:8000")


def main():
    print("=" * 65)
    print("      PALMISTRA AI - CELESTIAL CHIROLOGY & PALM READING STUDIO     ")
    print("=" * 65 )

    ensure_samples()

    # Launch browser in a background thread
    threading.Thread(target=open_browser, daemon=True).start()

    print("[*] Starting backend server on http://localhost:8000 (Press Ctrl+C to stop)...")
    uvicorn.run("backend.app:app", host="127.0.0.1", port=8000, reload=False, log_level="info")


if __name__ == "__main__":
    main()
