# Palmistra AI - Deployment Guide

This guide covers deploying Palmistra AI across all popular cloud platforms, containers, and local networks.

---

## 100% Free Deployment Options (No Docker Needed)

| Platform | Runtime | Cost | Credit Card? | Docker Needed? |
|---|---|---|---|---|
| **Render.com** | Native Python 3 | **100% Free** | **No** | **No** |
| **Localtunnel / Cloudflare** | Local Tunnel | **100% Free** | **No** | **No** |
| **Railway.app** | Native Python | Free Trial | No | No |
| **Koyeb** | Native Python | **100% Free** | No | No |


---

## 1. Deploying to Render.com (Recommended & Easiest)

Render automatically detects Python web services and provisions HTTPS for free (camera access requires HTTPS on public networks).

### Method A: Via Render Blueprint (`render.yaml`)
1. Push this repository to GitHub.
2. Go to [dashboard.render.com](https://dashboard.render.com) and click **"New +" -> "Blueprint"**.
3. Select your repository.
4. Render reads [`render.yaml`](file:///d:/Palm/render.yaml) and automatically configures:
   - **Environment**: Python 3.11
   - **Build Command**: `pip install -r requirements.txt && python -c "from backend.generate_samples import generate_all_samples; generate_all_samples()"`
   - **Start Command**: `uvicorn backend.app:app --host 0.0.0.0 --port $PORT`
   - **Health Check**: `/api/health`
5. Click **"Apply"** — your live app will be available at `https://palmistra-ai.onrender.com`.

### Method B: Manual Web Service
1. Click **"New +" -> "Web Service"**.
2. Connect your GitHub repository.
3. Settings:
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.app:app --host 0.0.0.0 --port $PORT`
4. Click **"Create Web Service"**.

> [!NOTE]
> Webcams require an HTTPS connection in modern browsers (Chrome/Safari/Firefox). Render provides automatic free SSL certificates, so camera features will work out-of-the-box.

---

## 2. Deploying to Railway.app

1. Go to [railway.app](https://railway.app) and click **"New Project"**.
2. Select **"Deploy from GitHub repo"** and choose your repository.
3. Railway automatically detects the [`Procfile`](file:///d:/Palm/Procfile) and [`requirements.txt`](file:///d:/Palm/requirements.txt):
   ```procfile
   web: uvicorn backend.app:app --host 0.0.0.0 --port $PORT
   ```
4. Click **"Generate Domain"** in your project settings to get a public `https://...up.railway.app` URL.

---

## 3. Deploying with Docker (Any Cloud or Self-Hosted)

The included [`Dockerfile`](file:///d:/Palm/Dockerfile) is optimized with a lean `python:3.11-slim` base, headless OpenCV (`opencv-python-headless`), and automated healthchecks.

### Build and Run Locally:
```bash
# 1. Build the Docker image
docker build -t palmistra-ai .

# 2. Run the container on port 8000
docker run -d -p 8000:8000 --name palm-app palmistra-ai
```
Visit `http://localhost:8000` in your browser.

### Deploy to Google Cloud Run:
```bash
# 1. Build and push to Google Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/palmistra-ai

# 2. Deploy to Cloud Run (Serverless)
gcloud run deploy palmistra-ai \
    --image gcr.io/YOUR_PROJECT_ID/palmistra-ai \
    --platform managed \
    --allow-unauthenticated \
    --port 8000 \
    --memory 1Gi
```

### Deploy to AWS App Runner / ECS:
1. Push `palmistra-ai` to Amazon ECR.
2. Create an App Runner service pointing to your ECR image on port 8000.

---

## 4. Deploying to Hugging Face Spaces

1. Create a new Space at [huggingface.co/spaces](https://huggingface.co/spaces).
2. Choose **"Docker"** as the Space SDK (Blank).
3. Set your Space to Public.
4. Clone the Space repo or push this repository directly:
   ```bash
   git remote add space https://huggingface.co/spaces/YOUR_USERNAME/palmistra-ai
   git push space main
   ```
5. Hugging Face Spaces will build your [`Dockerfile`](file:///d:/Palm/Dockerfile) and launch the app with free CPU resources and HTTPS!

---

## 5. Local Network Access (Test from Mobile Camera over WiFi)

If you want to use your mobile phone's camera on your local WiFi network without deploying to the cloud:

1. Run the app binding to all interfaces:
   ```bash
   python -c "import uvicorn, os; uvicorn.run('backend.app:app', host='0.0.0.0', port=8000)"
   ```
2. Find your computer's local IP address:
   - On Windows: Run `ipconfig` in CMD (look for *IPv4 Address*, e.g., `192.168.1.45`).
   - On Mac/Linux: Run `ifconfig` or `ip a`.
3. Open your mobile browser and navigate to:
   ```
   http://192.168.1.45:8000
   ```
   *(Replace with your actual IP address)*.
