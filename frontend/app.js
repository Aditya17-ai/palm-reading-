/**
 * PALMISTRA AI - Frontend Application Controller
 * Version 2.0: Ultra-Premium Celestial Glassmorphism & Interactive Vision Studio
 * Features:
 *   - Stardust particle canvas simulation with subtle twinkle & cursor parallax
 *   - Drag & drop with instant preview before analysis
 *   - Web camera feed with palm alignment guide & countdown capture
 *   - Interactive Vision Studio:
 *       * Zoom (1x to 3x) & Pan viewport
 *       * Before/After Crease Split Comparison Slider
 *       * Bi-directional Line Hover (hover card -> glows on canvas, hover line -> glows card)
 *       * Layer filter toggles
 *   - Harmony score circular gauge animation
 *   - Responsive report printing
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let currentAnalysis = null;
  let activeView = 'overlay'; // 'overlay' | 'ridge' | 'blueprint' | 'roi' | 'split'
  let cameraStream = null;

  // Zoom & Pan State
  let zoomLevel = 1.0;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let startPanX = 0;
  let startPanY = 0;

  // Split Slider State
  let isDraggingSplit = false;
  let splitPercent = 50;

  // Selected File State
  let selectedFileBase64 = null;

  // =========================================================================
  // 1. Ambient Stardust Canvas Simulation
  // =========================================================================
  const starCanvas = document.getElementById('starfield-canvas');
  let starCtx = starCanvas ? starCanvas.getContext('2d') : null;
  let stars = [];
  let mouseX = 0;
  let mouseY = 0;

  function initStarfield() {
    if (!starCanvas || !starCtx) return;
    
    function resizeCanvas() {
      starCanvas.width = window.innerWidth;
      starCanvas.height = window.innerHeight;
      createStars();
    }

    function createStars() {
      stars = [];
      const count = Math.floor((starCanvas.width * starCanvas.height) / 8000);
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * starCanvas.width,
          y: Math.random() * starCanvas.height,
          radius: Math.random() * 1.5 + 0.4,
          alpha: Math.random() * 0.7 + 0.2,
          speed: Math.random() * 0.02 + 0.005,
          phase: Math.random() * Math.PI * 2,
          color: Math.random() > 0.8 ? '#fde68a' : (Math.random() > 0.6 ? '#c4b5fd' : '#ffffff')
        });
      }
    }

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX - window.innerWidth / 2) * 0.02;
      mouseY = (e.clientY - window.innerHeight / 2) * 0.02;
    });

    resizeCanvas();

    function renderStars() {
      starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
      for (let s of stars) {
        s.phase += s.speed;
        const currentAlpha = Math.max(0.1, s.alpha + Math.sin(s.phase) * 0.3);

        starCtx.beginPath();
        starCtx.arc(s.x + mouseX * s.radius, s.y + mouseY * s.radius, s.radius, 0, Math.PI * 2);
        starCtx.fillStyle = s.color;
        starCtx.globalAlpha = currentAlpha;
        starCtx.shadowBlur = s.radius > 1 ? 4 : 0;
        starCtx.shadowColor = s.color;
        starCtx.fill();
      }
      starCtx.globalAlpha = 1.0;
      requestAnimationFrame(renderStars);
    }
    renderStars();
  }
  initStarfield();

  // =========================================================================
  // 2. DOM Elements Mapping
  // =========================================================================
  // Tabs & Panels
  const tabUpload = document.getElementById('tab-upload');
  const tabCamera = document.getElementById('tab-camera');
  const tabSamples = document.getElementById('tab-samples');
  const panelUpload = document.getElementById('panel-upload');
  const panelCamera = document.getElementById('panel-camera');
  const panelSamples = document.getElementById('panel-samples');

  // Hero & Header Actions
  const btnHeaderDemo = document.getElementById('btn-header-demo');
  const heroBtnDemo = document.getElementById('hero-btn-demo');
  const btnOpenCamera = document.getElementById('btn-open-camera');

  // Upload Elements
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const dropZoneIdle = document.getElementById('drop-zone-idle');
  const dropZonePreview = document.getElementById('drop-zone-preview');
  const previewImg = document.getElementById('preview-img');
  const previewFilename = document.getElementById('preview-filename');
  const btnAnalyzePreview = document.getElementById('btn-analyze-preview');
  const btnChangePreview = document.getElementById('btn-change-preview');

  // Camera Elements & Live Studio HUD
  const cameraFeed = document.getElementById('camera-feed');
  const cameraDetectionCanvas = document.getElementById('camera-detection-canvas');
  const btnStartCamera = document.getElementById('btn-start-camera');
  const btnCapturePhoto = document.getElementById('btn-capture-photo');
  const btnStopCamera = document.getElementById('btn-stop-camera');
  const cameraStatusIndicator = document.getElementById('camera-status-indicator');
  const cameraStatusLabel = document.getElementById('camera-status-label');
  const chipArLines = document.getElementById('chip-ar-lines');
  const chipMounts = document.getElementById('chip-mounts');
  const chipAutoCapture = document.getElementById('chip-auto-capture');
  const btnFlipCam = document.getElementById('btn-flip-cam');
  const cameraViewportContainer = document.getElementById('camera-viewport-container');
  const cameraHudTop = document.getElementById('camera-hud-top');
  const hudArchetypeBadge = document.getElementById('hud-archetype-badge');
  const hudArchetypeIcon = document.getElementById('hud-archetype-icon');
  const hudArchetypeText = document.getElementById('hud-archetype-text');
  const hudAlignmentGauge = document.getElementById('hud-alignment-gauge');
  const hudGaugeFill = document.getElementById('hud-gauge-fill');
  const hudGaugeVal = document.getElementById('hud-gauge-val');
  const hudFpsBadge = document.getElementById('hud-fps-badge');
  const hudFpsVal = document.getElementById('hud-fps-val');
  const autoCaptureOverlay = document.getElementById('auto-capture-overlay');
  const countdownProgressCircle = document.getElementById('countdown-progress-circle');
  const countdownNumberText = document.getElementById('countdown-number-text');
  const cameraGuidancePill = document.getElementById('camera-guidance-pill');
  const cameraGuidanceText = document.getElementById('camera-guidance-text');
  const palmGuideOverlay = document.getElementById('palm-guide-overlay');
  const liveTelemetryDrawer = document.getElementById('live-telemetry-drawer');
  const liveDrawerIcon = document.getElementById('live-drawer-icon');
  const liveDrawerArchetype = document.getElementById('live-drawer-archetype');
  const liveDrawerDesc = document.getElementById('live-drawer-desc');
  const liveDrawerAspect = document.getElementById('live-drawer-aspect');
  const liveDrawerSolidity = document.getElementById('live-drawer-solidity');
  const liveDrawerHarmony = document.getElementById('live-drawer-harmony');
  const liveDrawerHarmonyBar = document.getElementById('live-drawer-harmony-bar');
  const liveDrawerStatusTag = document.getElementById('live-drawer-status-tag');
  const liveValHeart = document.getElementById('live-val-heart');
  const liveBarHeart = document.getElementById('live-bar-heart');
  const liveValHead = document.getElementById('live-val-head');
  const liveBarHead = document.getElementById('live-bar-head');
  const liveValLife = document.getElementById('live-val-life');
  const liveBarLife = document.getElementById('live-bar-life');
  const liveValFate = document.getElementById('live-val-fate');
  const liveBarFate = document.getElementById('live-bar-fate');

  // Scanner Modal
  const scannerModal = document.getElementById('scanner-modal');
  const scannerStatus = document.getElementById('scanner-status');
  const scannerProgressFill = document.getElementById('scanner-progress-fill');

  // Results Dashboard
  const resultsDashboard = document.getElementById('results-dashboard');
  const canvasViewport = document.getElementById('canvas-viewport');
  const canvasTransformWrapper = document.getElementById('canvas-transform-wrapper');
  const singleViewContainer = document.getElementById('single-view-container');
  const activeVisualImg = document.getElementById('active-visual-img');
  const svgOverlay = document.getElementById('interactive-svg-overlay');
  const svgMountsGroup = document.getElementById('svg-mounts-group');
  const svgLinesGroup = document.getElementById('svg-lines-group');
  const canvasTooltip = document.getElementById('canvas-tooltip');
  const studioModeLabel = document.getElementById('studio-mode-label');

  // Split Comparison Elements
  const splitSliderContainer = document.getElementById('split-slider-container');
  const splitBeforeImg = document.getElementById('split-before-img');
  const splitOverlayWrapper = document.getElementById('split-overlay-wrapper');
  const splitAfterImg = document.getElementById('split-after-img');
  const splitDividerHandle = document.getElementById('split-divider-handle');

  // Zoom & Pan Toolbar
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomReset = document.getElementById('btn-zoom-reset');
  const zoomLevelText = document.getElementById('zoom-level-text');

  // Layer Toggles
  const toggleHeart = document.getElementById('toggle-heart');
  const toggleHead = document.getElementById('toggle-head');
  const toggleLife = document.getElementById('toggle-life');
  const toggleFate = document.getElementById('toggle-fate');
  const toggleMounts = document.getElementById('toggle-mounts');

  // Actions
  const btnPrintReport = document.getElementById('btn-print-report');
  const btnReadAnother = document.getElementById('btn-read-another');

  // =========================================================================
  // 3. Tab Switching
  // =========================================================================
  function switchTab(target) {
    [tabUpload, tabCamera, tabSamples].forEach(t => t.classList.remove('active'));
    [panelUpload, panelCamera, panelSamples].forEach(p => p.classList.remove('active'));

    if (target === 'upload') {
      tabUpload.classList.add('active');
      panelUpload.classList.add('active');
      stopCamera();
    } else if (target === 'camera') {
      tabCamera.classList.add('active');
      panelCamera.classList.add('active');
      startCamera();
    } else if (target === 'samples') {
      tabSamples.classList.add('active');
      panelSamples.classList.add('active');
      stopCamera();
    }
  }

  tabUpload.addEventListener('click', () => switchTab('upload'));
  tabCamera.addEventListener('click', () => switchTab('camera'));
  tabSamples.addEventListener('click', () => switchTab('samples'));

  if (btnOpenCamera) {
    btnOpenCamera.addEventListener('click', () => {
      document.getElementById('input-section').scrollIntoView({ behavior: 'smooth' });
      switchTab('camera');
    });
  }

  const heroBtnCamera = document.getElementById('hero-btn-camera');
  if (heroBtnCamera) {
    heroBtnCamera.addEventListener('click', () => {
      document.getElementById('input-section').scrollIntoView({ behavior: 'smooth' });
      switchTab('camera');
    });
  }

  // Quick Demo Buttons
  if (btnHeaderDemo) {
    btnHeaderDemo.addEventListener('click', () => analyzeSamplePreset('earth'));
  }
  if (heroBtnDemo) {
    heroBtnDemo.addEventListener('click', () => analyzeSamplePreset('earth'));
  }


  // =========================================================================
  // 4. Drag & Drop File Upload with Preview
  // =========================================================================
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  });

  dropZoneIdle.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  });

  function processSelectedFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (JPEG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      selectedFileBase64 = event.target.result;
      previewImg.src = selectedFileBase64;
      previewFilename.innerText = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      dropZoneIdle.style.display = 'none';
      dropZonePreview.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  }

  btnAnalyzePreview.addEventListener('click', () => {
    if (selectedFileBase64) {
      analyzeBase64(selectedFileBase64);
    }
  });

  btnChangePreview.addEventListener('click', () => {
    selectedFileBase64 = null;
    dropZonePreview.style.display = 'none';
    dropZoneIdle.style.display = 'block';
    fileInput.value = '';
  });

  // =========================================================================
  // 5. Live Webcam Controller & Real-Time AR Detection Engine (60 FPS MediaPipe + CV)
  // =========================================================================
  let currentFacingMode = 'user';
  let isDetectingLive = false;
  let isDetectionRequestInFlight = false;
  let arLinesEnabled = true;
  let mountsEnabled = true;
  let autoCaptureEnabled = true;
  let autoCaptureStartTime = null;
  const AUTO_CAPTURE_DURATION = 1500; // 1.5 seconds of steady alignment

  // MediaPipe Hands State
  let mediaPipeHands = null;
  let mediaPipeReady = false;
  let isProcessingMpFrame = false;
  let rawHandLandmarks = null;
  let smoothedLandmarks = null;
  let lastTelemetrySyncTime = 0;

  let latestDetection = null;
  let smoothedData = {
    cx: null,
    cy: null,
    radius: 0,
    bbox: null,
    alignmentScore: 0
  };

  let compassAngle = 0;
  let arAnimFrameId = null;
  let serverDetectionTimeout = null;
  let videoFrameReqId = null;
  let fpsFrames = 0;
  let fpsLastCheck = performance.now();
  let currentFps = 0;

  // Offscreen canvas for ultra-fast frame downscaling for server telemetry
  const offscreenCanvas = document.createElement('canvas');
  const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

  // Mount glyph symbols mapping
  const mountGlyphs = {
    "Venus": "♀",
    "Jupiter": "♃",
    "Saturn": "♄",
    "Apollo": "☉",
    "Mercury": "☿",
    "Luna": "☽",
    "Mars_Inner": "♂",
    "Mars_Outer": "🛡"
  };

  const archetypeIcons = {
    "Earth": "🌱",
    "Air": "💨",
    "Fire": "🔥",
    "Water": "💧"
  };

  // Initialize MediaPipe Hands client engine
  function initMediaPipeHands() {
    if (typeof window.Hands === 'function') {
      try {
        mediaPipeHands = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        mediaPipeHands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.55,
          minTrackingConfidence: 0.55
        });
        mediaPipeHands.onResults(onMediaPipeResults);
        mediaPipeReady = true;
        console.log('[+] MediaPipe Hands 60 FPS client engine initialized.');
      } catch (err) {
        console.warn('[!] Failed to initialize MediaPipe Hands, will use server-side CV:', err);
        mediaPipeReady = false;
      }
    } else {
      console.warn('[!] window.Hands not yet defined, will fallback to server-side CV.');
      mediaPipeReady = false;
    }
  }
  // Try initializing early
  initMediaPipeHands();

  function syncCanvasDimensions() {
    if (!cameraFeed.videoWidth || !cameraDetectionCanvas) return;
    cameraDetectionCanvas.width = cameraFeed.videoWidth;
    cameraDetectionCanvas.height = cameraFeed.videoHeight;
  }

  window.addEventListener('resize', syncCanvasDimensions);

  // Chip Toggles
  if (chipArLines) {
    chipArLines.addEventListener('click', () => {
      arLinesEnabled = !arLinesEnabled;
      chipArLines.classList.toggle('active', arLinesEnabled);
    });
  }

  if (chipMounts) {
    chipMounts.addEventListener('click', () => {
      mountsEnabled = !mountsEnabled;
      chipMounts.classList.toggle('active', mountsEnabled);
    });
  }

  if (chipAutoCapture) {
    chipAutoCapture.addEventListener('click', () => {
      autoCaptureEnabled = !autoCaptureEnabled;
      chipAutoCapture.classList.toggle('active', autoCaptureEnabled);
      if (!autoCaptureEnabled) {
        autoCaptureStartTime = null;
        if (autoCaptureOverlay) autoCaptureOverlay.style.display = 'none';
      }
    });
  }

  if (btnFlipCam) {
    btnFlipCam.addEventListener('click', async () => {
      currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      if (cameraStream) {
        stopCamera();
        await startCamera();
      }
    });
  }

  async function startCamera() {
    try {
      if (cameraStream) stopCamera();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support camera access (getUserMedia).');
      }

      // 1. Try with ideal HD constraints, fallback progressively
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: currentFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (err1) {
        console.warn('Ideal camera constraints failed, attempting facingMode fallback...', err1);
        try {
          cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode },
            audio: false
          });
        } catch (err2) {
          console.warn('FacingMode failed, falling back to basic video...', err2);
          cameraStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      cameraFeed.srcObject = cameraStream;
      cameraFeed.setAttribute('playsinline', '');
      cameraFeed.setAttribute('webkit-playsinline', '');
      cameraFeed.muted = true;
      cameraFeed.classList.toggle('rear-cam', currentFacingMode === 'environment');

      try {
        await cameraFeed.play();
      } catch (playErr) {
        console.warn('cameraFeed.play warning:', playErr);
      }

      btnStartCamera.style.display = 'none';
      btnCapturePhoto.style.display = 'inline-flex';
      btnStopCamera.style.display = 'inline-flex';

      if (cameraStatusIndicator) cameraStatusIndicator.classList.add('active');
      if (cameraStatusLabel) cameraStatusLabel.textContent = 'Live Detection Active';
      if (palmGuideOverlay) palmGuideOverlay.style.opacity = '0.25';

      if (hudFpsBadge) hudFpsBadge.style.display = 'inline-flex';
      if (hudAlignmentGauge) hudAlignmentGauge.style.display = 'inline-flex';
      if (hudArchetypeBadge) hudArchetypeBadge.style.display = 'inline-flex';
      if (liveTelemetryDrawer) liveTelemetryDrawer.style.display = 'grid';

      const setupActiveStream = () => {
        if (cameraFeed.videoWidth && cameraFeed.videoHeight) {
          if (cameraViewportContainer) {
            cameraViewportContainer.style.aspectRatio = `${cameraFeed.videoWidth} / ${cameraFeed.videoHeight}`;
          }
        }
        syncCanvasDimensions();
        isDetectingLive = true;
        autoCaptureStartTime = null;
        smoothedLandmarks = null;
        rawHandLandmarks = null;

        // Ensure MediaPipe is initialized if script finished loading
        if (!mediaPipeReady && typeof window.Hands === 'function') {
          initMediaPipeHands();
        }

        // Start processing loops
        startCameraProcessingLoop();
        runARRenderLoop();
      };

      if (cameraFeed.readyState >= 2) {
        setupActiveStream();
      } else {
        cameraFeed.onloadedmetadata = setupActiveStream;
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      alert('Camera access could not be initialized (' + (err.message || 'permission denied') + '). Please ensure your webcam is connected and permission is granted in your browser.');
    }
  }

  function stopCamera() {
    isDetectingLive = false;
    isDetectionRequestInFlight = false;
    autoCaptureStartTime = null;
    rawHandLandmarks = null;
    smoothedLandmarks = null;

    if (arAnimFrameId) {
      cancelAnimationFrame(arAnimFrameId);
      arAnimFrameId = null;
    }
    if (serverDetectionTimeout) {
      clearTimeout(serverDetectionTimeout);
      serverDetectionTimeout = null;
    }
    if (videoFrameReqId) {
      if ('cancelVideoFrameCallback' in cameraFeed && typeof cameraFeed.cancelVideoFrameCallback === 'function') {
        cameraFeed.cancelVideoFrameCallback(videoFrameReqId);
      } else {
        cancelAnimationFrame(videoFrameReqId);
      }
      videoFrameReqId = null;
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    if (cameraFeed) {
      cameraFeed.srcObject = null;
      cameraFeed.classList.remove('rear-cam');
    }

    if (cameraDetectionCanvas) {
      const ctx = cameraDetectionCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, cameraDetectionCanvas.width, cameraDetectionCanvas.height);
    }

    if (btnStartCamera) btnStartCamera.style.display = 'inline-flex';
    if (btnCapturePhoto) btnCapturePhoto.style.display = 'none';
    if (btnStopCamera) btnStopCamera.style.display = 'none';

    if (cameraStatusIndicator) cameraStatusIndicator.classList.remove('active');
    if (cameraStatusLabel) cameraStatusLabel.textContent = 'Camera Inactive';
    if (palmGuideOverlay) palmGuideOverlay.style.opacity = '1';

    if (hudFpsBadge) hudFpsBadge.style.display = 'none';
    if (hudAlignmentGauge) hudAlignmentGauge.style.display = 'none';
    if (hudArchetypeBadge) hudArchetypeBadge.style.display = 'none';
    if (autoCaptureOverlay) autoCaptureOverlay.style.display = 'none';
    if (liveTelemetryDrawer) liveTelemetryDrawer.style.display = 'none';

    if (cameraViewportContainer) cameraViewportContainer.classList.remove('aligned');
    if (cameraGuidancePill) cameraGuidancePill.classList.remove('aligned');
    if (cameraGuidanceText) cameraGuidanceText.textContent = 'Click "Start Live Camera" to begin real-time live detection';

    latestDetection = null;
    smoothedData = { cx: null, cy: null, radius: 0, bbox: null, alignmentScore: 0 };
  }

  btnStartCamera.addEventListener('click', startCamera);
  btnStopCamera.addEventListener('click', stopCamera);

  function captureAndAnalyzePhoto() {
    if (!cameraFeed.videoWidth) return;

    // Flash animation
    if (cameraViewportContainer) {
      cameraViewportContainer.classList.add('capture-flash');
      setTimeout(() => cameraViewportContainer.classList.remove('capture-flash'), 350);
    }

    const canvas = document.createElement('canvas');
    canvas.width = cameraFeed.videoWidth;
    canvas.height = cameraFeed.videoHeight;
    const ctx = canvas.getContext('2d');

    // Mirror horizontal if using front-facing user camera
    if (currentFacingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);
    const base64Img = canvas.toDataURL('image/png');

    stopCamera();
    analyzeBase64(base64Img);
  }

  btnCapturePhoto.addEventListener('click', captureAndAnalyzePhoto);

  // =========================================================================
  // MediaPipe Results Handler (60 FPS Landmark Intelligence)
  // =========================================================================
  function onMediaPipeResults(results) {
    if (!isDetectingLive) return;

    fpsFrames++;
    const now = performance.now();
    if (now - fpsLastCheck >= 500) {
      currentFps = Math.round((fpsFrames * 1000) / (now - fpsLastCheck));
      fpsFrames = 0;
      fpsLastCheck = now;
      if (hudFpsVal) hudFpsVal.textContent = `${currentFps} FPS (WebGPU/WASM)`;
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const rawLms = results.multiHandLandmarks[0];
      const cw = cameraDetectionCanvas.width || 640;
      const ch = cameraDetectionCanvas.height || 480;
      const isMirrored = (currentFacingMode === 'user');

      // Convert normalized [0,1] coordinates to mirrored screen space
      const screenPoints = rawLms.map(p => ({
        x: (isMirrored ? (1.0 - p.x) : p.x) * cw,
        y: p.y * ch,
        z: p.z * cw
      }));

      // Apply Exponential Moving Average (EMA) smoothing (alpha = 0.38)
      const alpha = 0.38;
      if (!smoothedLandmarks || smoothedLandmarks.length !== 21) {
        smoothedLandmarks = screenPoints.map(p => ({ ...p }));
      } else {
        for (let i = 0; i < 21; i++) {
          smoothedLandmarks[i].x += (screenPoints[i].x - smoothedLandmarks[i].x) * alpha;
          smoothedLandmarks[i].y += (screenPoints[i].y - smoothedLandmarks[i].y) * alpha;
          smoothedLandmarks[i].z += (screenPoints[i].z - smoothedLandmarks[i].z) * alpha;
        }
      }

      rawHandLandmarks = screenPoints;
      processHandGeometry(smoothedLandmarks, cw, ch);
    } else {
      rawHandLandmarks = null;
      smoothedLandmarks = null;
      updateLiveFeedbackNoHand();
    }
  }

  // Analyzes palm geometry, open fingers, orientation, and alignment
  function processHandGeometry(lms, cw, ch) {
    const wrist = lms[0];
    const thumbTip = lms[4];
    const thumbMcp = lms[2];
    const idxMcp = lms[5];
    const idxTip = lms[8];
    const midMcp = lms[9];
    const midTip = lms[12];
    const rngMcp = lms[13];
    const rngTip = lms[16];
    const pnkMcp = lms[17];
    const pnkTip = lms[20];

    // Palm Center & Radius
    const palmCx = (wrist.x * 0.36 + (idxMcp.x + midMcp.x + rngMcp.x + pnkMcp.x) * 0.64 / 4);
    const palmCy = (wrist.y * 0.36 + (idxMcp.y + midMcp.y + rngMcp.y + pnkMcp.y) * 0.64 / 4);
    const palmRadius = Math.hypot(midMcp.x - wrist.x, midMcp.y - wrist.y) * 0.48;

    // Smooth palm position
    smoothedData.cx = smoothedData.cx !== null ? smoothedData.cx + (palmCx - smoothedData.cx) * 0.35 : palmCx;
    smoothedData.cy = smoothedData.cy !== null ? smoothedData.cy + (palmCy - smoothedData.cy) * 0.35 : palmCy;
    smoothedData.radius = smoothedData.radius ? smoothedData.radius + (palmRadius - smoothedData.radius) * 0.35 : palmRadius;

    // Check Thumb side in screen space
    const thumbOnLeft = thumbTip.x < pnkTip.x;

    // Check Open Palm: distance from wrist to tips vs MCPs
    const fingersExtended = [
      Math.hypot(idxTip.x - wrist.x, idxTip.y - wrist.y) > Math.hypot(idxMcp.x - wrist.x, idxMcp.y - wrist.y) * 1.18,
      Math.hypot(midTip.x - wrist.x, midTip.y - wrist.y) > Math.hypot(midMcp.x - wrist.x, midMcp.y - wrist.y) * 1.18,
      Math.hypot(rngTip.x - wrist.x, rngTip.y - wrist.y) > Math.hypot(rngMcp.x - wrist.x, rngMcp.y - wrist.y) * 1.18,
      Math.hypot(pnkTip.x - wrist.x, pnkTip.y - wrist.y) > Math.hypot(pnkMcp.x - wrist.x, pnkMcp.y - wrist.y) * 1.18,
    ];
    const numExtended = fingersExtended.filter(Boolean).length;
    const isOpen = numExtended >= 3;

    // Hand Facing Orientation Check: 2D cross product of (wrist->index) and (wrist->pinky)
    const vecA = { x: idxMcp.x - wrist.x, y: idxMcp.y - wrist.y };
    const vecB = { x: pnkMcp.x - wrist.x, y: pnkMcp.y - wrist.y };
    const crossZ = vecA.x * vecB.y - vecA.y * vecB.x;
    // For palm facing camera: when thumb is on left, crossZ > 0; when thumb is on right, crossZ < 0
    const palmFacingCamera = thumbOnLeft ? (crossZ > -50) : (crossZ < 50);

    // Target alignment check
    const tgtCx = cw / 2;
    const tgtCy = ch * 0.50;
    const tgtR = Math.min(cw, ch) * 0.22;

    const dCenter = Math.hypot(smoothedData.cx - tgtCx, smoothedData.cy - tgtCy);
    const rRatio = smoothedData.radius / Math.max(1, tgtR);

    const centerScore = Math.max(0.0, 1.0 - (dCenter / (cw * 0.28)));
    const sizeScore = Math.max(0.0, 1.0 - Math.abs(rRatio - 1.0) / 0.55);
    const alignmentScore = Math.round(Math.min(100, Math.max(0, (centerScore * 0.55 + sizeScore * 0.45) * 100)));
    smoothedData.alignmentScore = alignmentScore;

    // Guidance feedback logic
    let feedback = 'Align palm with central celestial circle';
    let isAligned = false;

    if (!palmFacingCamera) {
      feedback = 'Turn your palm to face the camera';
    } else if (!isOpen) {
      feedback = 'Open your fingers flat facing the camera';
    } else if (dCenter > cw * 0.16) {
      feedback = 'Center your open palm inside the guide circle';
    } else if (rRatio < 0.65) {
      feedback = 'Bring your palm slightly closer';
    } else if (rRatio > 1.65) {
      feedback = 'Move your palm back slightly';
    } else if (alignmentScore >= 68) {
      feedback = 'Palm Centered! Hold steady for reading';
      isAligned = true;
    } else {
      feedback = 'Adjusting palm alignment...';
    }

    // Update Top Alignment Gauge
    if (hudGaugeFill) hudGaugeFill.style.width = `${alignmentScore}%`;
    if (hudGaugeVal) hudGaugeVal.textContent = `${alignmentScore}%`;
    if (cameraGuidanceText) cameraGuidanceText.textContent = feedback;

    // Archetype Preview based on palm aspect ratio
    const palmAspect = (midMcp.y < wrist.y) ?
      (Math.hypot(idxMcp.x - pnkMcp.x, idxMcp.y - pnkMcp.y) / Math.max(1, Math.hypot(midMcp.x - wrist.x, midMcp.y - wrist.y))) : 1.0;
    let archetype = 'Earth';
    if (palmAspect > 1.1) archetype = 'Fire';
    else if (palmAspect < 0.85) archetype = 'Water';
    else if (numExtended === 4) archetype = 'Air';

    if (hudArchetypeBadge) {
      hudArchetypeBadge.style.display = 'inline-flex';
      if (hudArchetypeIcon) hudArchetypeIcon.textContent = archetypeIcons[archetype] || '🌱';
      if (hudArchetypeText) hudArchetypeText.textContent = `${archetype} Hand`;
    }

    // Auto-capture countdown
    if (isAligned && autoCaptureEnabled) {
      if (cameraViewportContainer) cameraViewportContainer.classList.add('aligned');
      if (cameraGuidancePill) cameraGuidancePill.classList.add('aligned');

      if (!autoCaptureStartTime) {
        autoCaptureStartTime = performance.now();
      }
      const elapsed = performance.now() - autoCaptureStartTime;
      const progress = Math.min(1.0, elapsed / AUTO_CAPTURE_DURATION);

      if (autoCaptureOverlay) autoCaptureOverlay.style.display = 'flex';
      if (countdownProgressCircle) {
        const circ = 326.7;
        countdownProgressCircle.style.strokeDashoffset = `${circ * (1.0 - progress)}`;
      }
      if (countdownNumberText) {
        countdownNumberText.textContent = Math.max(1, Math.ceil((AUTO_CAPTURE_DURATION - elapsed) / 500));
      }

      if (elapsed >= AUTO_CAPTURE_DURATION) {
        autoCaptureStartTime = null;
        if (autoCaptureOverlay) autoCaptureOverlay.style.display = 'none';
        captureAndAnalyzePhoto();
      }
    } else {
      if (cameraViewportContainer) cameraViewportContainer.classList.remove('aligned');
      if (cameraGuidancePill) cameraGuidancePill.classList.remove('aligned');
      autoCaptureStartTime = null;
      if (autoCaptureOverlay) autoCaptureOverlay.style.display = 'none';
    }
  }

  function updateLiveFeedbackNoHand() {
    if (hudGaugeFill) hudGaugeFill.style.width = '0%';
    if (hudGaugeVal) hudGaugeVal.textContent = '0%';
    if (cameraGuidanceText) cameraGuidanceText.textContent = 'Show an open palm inside the glowing celestial guide';
    if (cameraViewportContainer) cameraViewportContainer.classList.remove('aligned');
    if (cameraGuidancePill) cameraGuidancePill.classList.remove('aligned');
    autoCaptureStartTime = null;
    if (autoCaptureOverlay) autoCaptureOverlay.style.display = 'none';
  }

  // =========================================================================
  // Primary Video Processing Loop (Native 30-60 FPS)
  // =========================================================================
  async function startCameraProcessingLoop() {
    async function processFrame() {
      if (!isDetectingLive || !cameraFeed || cameraFeed.readyState < 2) {
        if (isDetectingLive) {
          if ('requestVideoFrameCallback' in cameraFeed) {
            videoFrameReqId = cameraFeed.requestVideoFrameCallback(processFrame);
          } else {
            videoFrameReqId = requestAnimationFrame(processFrame);
          }
        }
        return;
      }

      // If MediaPipe is active, process locally
      if (mediaPipeHands && mediaPipeReady && !isProcessingMpFrame) {
        isProcessingMpFrame = true;
        try {
          await mediaPipeHands.send({ image: cameraFeed });
        } catch (err) {
          console.warn('MediaPipe send error:', err);
        } finally {
          isProcessingMpFrame = false;
        }
      }

      // Periodic Server Telemetry Sync (Every ~400ms in background)
      const now = performance.now();
      if (now - lastTelemetrySyncTime >= 400 && !isDetectionRequestInFlight) {
        lastTelemetrySyncTime = now;
        syncServerTelemetry();
      }

      // If MediaPipe failed or is not available, execute server fallback tick
      if (!mediaPipeReady && !isDetectionRequestInFlight) {
        syncServerTelemetry();
      }

      if (isDetectingLive) {
        if ('requestVideoFrameCallback' in cameraFeed) {
          videoFrameReqId = cameraFeed.requestVideoFrameCallback(processFrame);
        } else {
          videoFrameReqId = requestAnimationFrame(processFrame);
        }
      }
    }

    if ('requestVideoFrameCallback' in cameraFeed) {
      videoFrameReqId = cameraFeed.requestVideoFrameCallback(processFrame);
    } else {
      videoFrameReqId = requestAnimationFrame(processFrame);
    }
  }

  // Background Server Telemetry Sync: sends downscaled frame to /api/detect-live
  async function syncServerTelemetry() {
    if (!cameraFeed || cameraFeed.readyState < 2 || isDetectionRequestInFlight) return;
    const vw = cameraFeed.videoWidth;
    const vh = cameraFeed.videoHeight;
    if (!vw || !vh) return;

    const maxDim = 320;
    const scale = Math.min(1.0, maxDim / Math.max(vw, vh));
    const dw = Math.round(vw * scale);
    const dh = Math.round(vh * scale);

    if (offscreenCanvas.width !== dw || offscreenCanvas.height !== dh) {
      offscreenCanvas.width = dw;
      offscreenCanvas.height = dh;
    }

    offscreenCtx.drawImage(cameraFeed, 0, 0, dw, dh);
    const jpegDataUrl = offscreenCanvas.toDataURL('image/jpeg', 0.65);

    isDetectionRequestInFlight = true;
    try {
      const response = await fetch('/api/detect-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: jpegDataUrl,
          mirror: (currentFacingMode === 'user')
        })
      });

      if (response.ok) {
        const data = await response.json();
        latestDetection = data;

        // If MediaPipe is not available, update UI and FPS from server response
        if (!mediaPipeReady) {
          fpsFrames++;
          const now = performance.now();
          if (now - fpsLastCheck >= 500) {
            currentFps = Math.round((fpsFrames * 1000) / (now - fpsLastCheck));
            fpsFrames = 0;
            fpsLastCheck = now;
            if (hudFpsVal) hudFpsVal.textContent = `${currentFps} FPS (Server CV)`;
          }
          updateLiveUIFromDetection(data);
        } else {
          // Just update telemetry drawer from server's deep Frangi metrics
          updateTelemetryDrawerOnly(data);
        }
      }
    } catch (err) {
      console.warn('Server telemetry sync warning:', err);
    } finally {
      isDetectionRequestInFlight = false;
    }
  }

  function updateTelemetryDrawerOnly(data) {
    if (!data || !data.detected) return;
    if (data.hand_type) {
      const at = data.hand_type.type;
      if (liveDrawerIcon) liveDrawerIcon.textContent = archetypeIcons[at] || '🌱';
      if (liveDrawerArchetype) liveDrawerArchetype.textContent = `${at} Hand`;
      if (liveDrawerDesc) liveDrawerDesc.textContent = data.hand_type.description || '';
      if (liveDrawerAspect) liveDrawerAspect.textContent = data.hand_type.aspect_ratio || '1.0';
      if (liveDrawerSolidity) liveDrawerSolidity.textContent = `${Math.round((data.hand_type.solidity || 0.8) * 100)}%`;
    }
    if (data.scores) {
      if (liveDrawerHarmony) liveDrawerHarmony.textContent = data.scores.overall_harmony || '--';
      if (liveDrawerHarmonyBar) liveDrawerHarmonyBar.style.width = `${data.scores.overall_harmony || 0}%`;
      if (liveValHeart) liveValHeart.textContent = `${data.scores.heart_harmony || '--'}%`;
      if (liveBarHeart) liveBarHeart.style.width = `${data.scores.heart_harmony || 0}%`;
      if (liveValHead) liveValHead.textContent = `${data.scores.intellect || '--'}%`;
      if (liveBarHead) liveBarHead.style.width = `${data.scores.intellect || 0}%`;
      if (liveValLife) liveValLife.textContent = `${data.scores.vitality || '--'}%`;
      if (liveBarLife) liveBarLife.style.width = `${data.scores.vitality || 0}%`;
      if (liveValFate) liveValFate.textContent = `${data.scores.destiny || '--'}%`;
      if (liveBarFate) liveBarFate.style.width = `${data.scores.destiny || 0}%`;
    }
  }

  function updateLiveUIFromDetection(data) {
    if (!data) return;
    const alignScore = data.alignment_score || 0;
    const isAligned = Boolean(data.is_aligned);

    if (hudGaugeFill) hudGaugeFill.style.width = `${alignScore}%`;
    if (hudGaugeVal) hudGaugeVal.textContent = `${alignScore}%`;
    if (cameraGuidanceText) cameraGuidanceText.textContent = data.guide_feedback || 'Align open palm with center circle';

    if (data.detected) {
      if (hudArchetypeBadge) {
        hudArchetypeBadge.style.display = 'inline-flex';
        const at = data.hand_type ? data.hand_type.type : 'Earth';
        if (hudArchetypeIcon) hudArchetypeIcon.textContent = archetypeIcons[at] || '🌱';
        if (hudArchetypeText) hudArchetypeText.textContent = `${at} Hand`;
      }
      updateTelemetryDrawerOnly(data);

      if (isAligned) {
        if (cameraViewportContainer) cameraViewportContainer.classList.add('aligned');
        if (cameraGuidancePill) cameraGuidancePill.classList.add('aligned');

        if (autoCaptureEnabled) {
          if (!autoCaptureStartTime) autoCaptureStartTime = performance.now();
          const elapsed = performance.now() - autoCaptureStartTime;
          const progress = Math.min(1.0, elapsed / AUTO_CAPTURE_DURATION);

          if (autoCaptureOverlay) autoCaptureOverlay.style.display = 'flex';
          if (countdownProgressCircle) {
            countdownProgressCircle.style.strokeDashoffset = `${326.7 * (1.0 - progress)}`;
          }
          if (countdownNumberText) {
            countdownNumberText.textContent = Math.max(1, Math.ceil((AUTO_CAPTURE_DURATION - elapsed) / 500));
          }
          if (elapsed >= AUTO_CAPTURE_DURATION) {
            autoCaptureStartTime = null;
            if (autoCaptureOverlay) autoCaptureOverlay.style.display = 'none';
            captureAndAnalyzePhoto();
          }
        }
      } else {
        if (cameraViewportContainer) cameraViewportContainer.classList.remove('aligned');
        if (cameraGuidancePill) cameraGuidancePill.classList.remove('aligned');
        autoCaptureStartTime = null;
        if (autoCaptureOverlay) autoCaptureOverlay.style.display = 'none';
      }
    } else {
      updateLiveFeedbackNoHand();
    }
  }

  // =========================================================================
  // Smooth AR Overlay Canvas Rendering (60 FPS Celestial Renderer)
  // =========================================================================
  function runARRenderLoop() {
    if (!isDetectingLive || !cameraDetectionCanvas) return;

    const ctx = cameraDetectionCanvas.getContext('2d');
    const cw = cameraDetectionCanvas.width;
    const ch = cameraDetectionCanvas.height;

    ctx.clearRect(0, 0, cw, ch);
    compassAngle = (compassAngle + 0.02) % (Math.PI * 2);

    const tgtCx = cw / 2;
    const tgtCy = ch * 0.50;
    const tgtR = Math.min(cw, ch) * 0.22;

    const isAligned = smoothedData.alignmentScore >= 68;
    const alignScore = smoothedData.alignmentScore;

    // 1. Draw Target Reticle at frame center
    ctx.save();
    const reticleColor = isAligned ? 'rgba(16, 185, 129, 0.88)' : (alignScore > 40 ? 'rgba(245, 158, 11, 0.78)' : 'rgba(139, 92, 246, 0.65)');
    ctx.strokeStyle = reticleColor;
    ctx.lineWidth = 2.5;

    // Segmented rotating celestial target ring
    ctx.beginPath();
    ctx.arc(tgtCx, tgtCy, tgtR, 0, Math.PI * 2);
    ctx.setLineDash([12, 10]);
    ctx.stroke();

    // Center Crosshairs
    ctx.setLineDash([]);
    ctx.lineWidth = 1.5;
    const chLen = 14;
    ctx.beginPath();
    ctx.moveTo(tgtCx - chLen, tgtCy); ctx.lineTo(tgtCx + chLen, tgtCy);
    ctx.moveTo(tgtCx, tgtCy - chLen); ctx.lineTo(tgtCx, tgtCy + chLen);
    ctx.stroke();
    ctx.restore();

    // 2. Render Live Hand Tracking
    if (smoothedLandmarks && smoothedLandmarks.length === 21) {
      renderMediaPipeAR(ctx, smoothedLandmarks, cw, ch, isAligned);
    } else if (latestDetection && latestDetection.detected) {
      renderServerFallbackAR(ctx, latestDetection, cw, ch, isAligned);
    }

    arAnimFrameId = requestAnimationFrame(runARRenderLoop);
  }

  // Renders 60 FPS ultra-real palm tracing from MediaPipe landmarks
  function renderMediaPipeAR(ctx, lms, cw, ch, isAligned) {
    const wrist = lms[0];
    const thumbCmc = lms[1];
    const thumbMcp = lms[2];
    const thumbIp = lms[3];
    const thumbTip = lms[4];
    const idxMcp = lms[5];
    const idxPip = lms[6];
    const idxDip = lms[7];
    const idxTip = lms[8];
    const midMcp = lms[9];
    const midPip = lms[10];
    const midDip = lms[11];
    const midTip = lms[12];
    const rngMcp = lms[13];
    const rngPip = lms[14];
    const rngDip = lms[15];
    const rngTip = lms[16];
    const pnkMcp = lms[17];
    const pnkPip = lms[18];
    const pnkDip = lms[19];
    const pnkTip = lms[20];

    const px = smoothedData.cx;
    const py = smoothedData.cy;
    const pr = smoothedData.radius;

    const thumbOnLeft = thumbTip.x < pnkTip.x;
    const ulnMcp = thumbOnLeft ? pnkMcp : idxMcp; // Pinky side / percussion edge

    // A. Constellation Stardust Skeleton (Bones & Joints)
    ctx.save();
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.40)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(168, 85, 247, 0.6)';
    ctx.shadowBlur = 6;

    const fingerChains = [
      [wrist, thumbCmc, thumbMcp, thumbIp, thumbTip],
      [wrist, idxMcp, idxPip, idxDip, idxTip],
      [wrist, midMcp, midPip, midDip, midTip],
      [wrist, rngMcp, rngPip, rngDip, rngTip],
      [wrist, pnkMcp, pnkPip, pnkDip, pnkTip],
      [idxMcp, midMcp, rngMcp, pnkMcp] // Knuckle arch
    ];

    for (const chain of fingerChains) {
      ctx.beginPath();
      ctx.moveTo(chain[0].x, chain[0].y);
      for (let i = 1; i < chain.length; i++) {
        ctx.lineTo(chain[i].x, chain[i].y);
      }
      ctx.stroke();
    }

    // Joint stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 21; i++) {
      ctx.beginPath();
      const ptRadius = (i % 4 === 0) ? 3.0 : 2.0;
      ctx.arc(lms[i].x, lms[i].y, ptRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // B. Palm Perimeter Glowing Boundary
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(wrist.x, wrist.y);
    ctx.lineTo(thumbCmc.x, thumbCmc.y);
    ctx.lineTo(thumbMcp.x, thumbMcp.y);
    ctx.lineTo(idxMcp.x, idxMcp.y);
    ctx.lineTo(midMcp.x, midMcp.y);
    ctx.lineTo(rngMcp.x, rngMcp.y);
    ctx.lineTo(pnkMcp.x, pnkMcp.y);
    // Lower percussion edge
    const hypothenarBulgeX = wrist.x * 0.45 + pnkMcp.x * 0.55 + (thumbOnLeft ? 1 : -1) * pr * 0.22;
    const hypothenarBulgeY = wrist.y * 0.50 + pnkMcp.y * 0.50;
    ctx.lineTo(hypothenarBulgeX, hypothenarBulgeY);
    ctx.closePath();

    ctx.strokeStyle = isAligned ? 'rgba(16, 185, 129, 0.45)' : 'rgba(139, 92, 246, 0.35)';
    ctx.lineWidth = 2.0;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.fillStyle = isAligned ? 'rgba(16, 185, 129, 0.05)' : 'rgba(139, 92, 246, 0.04)';
    ctx.fill();
    ctx.restore();

    // C. Center Celestial Compass
    if (pr > 15) {
      ctx.save();
      ctx.translate(px, py);

      ctx.beginPath();
      ctx.arc(0, 0, pr * 0.85, 0, Math.PI * 2);
      ctx.strokeStyle = isAligned ? 'rgba(16, 185, 129, 0.75)' : 'rgba(245, 158, 11, 0.65)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([8, 6]);
      ctx.stroke();

      ctx.rotate(compassAngle);
      ctx.beginPath();
      ctx.arc(0, 0, pr * 0.60, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 6]);
      ctx.stroke();

      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(pr * 0.50, 0);
        ctx.lineTo(pr * 0.72, 0);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([]);
        ctx.stroke();
      }
      ctx.restore();

      // Center Core Beacon
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = isAligned ? '#10b981' : '#f59e0b';
      ctx.shadowColor = isAligned ? '#10b981' : '#f59e0b';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.restore();
    }

    // D. Chirological Mounts
    const jupPos = { x: idxMcp.x + (px - idxMcp.x) * 0.24, y: idxMcp.y + (py - idxMcp.y) * 0.24 };
    const satPos = { x: midMcp.x + (px - midMcp.x) * 0.22, y: midMcp.y + (py - midMcp.y) * 0.22 };
    const apoPos = { x: rngMcp.x + (px - rngMcp.x) * 0.22, y: rngMcp.y + (py - rngMcp.y) * 0.22 };
    const merPos = { x: pnkMcp.x + (px - pnkMcp.x) * 0.24, y: pnkMcp.y + (py - pnkMcp.y) * 0.24 };
    const venPos = { x: wrist.x * 0.38 + thumbCmc.x * 0.34 + thumbMcp.x * 0.28, y: wrist.y * 0.38 + thumbCmc.y * 0.34 + thumbMcp.y * 0.28 };
    const lunPos = { x: wrist.x * 0.50 + ulnMcp.x * 0.50 + (thumbOnLeft ? 1 : -1) * pr * 0.28, y: wrist.y * 0.48 + ulnMcp.y * 0.52 };
    const marsInnPos = { x: (thumbMcp.x + idxMcp.x) / 2, y: (thumbMcp.y + idxMcp.y) / 2 };
    const marsOutPos = { x: merPos.x * 0.45 + lunPos.x * 0.55, y: merPos.y * 0.45 + lunPos.y * 0.55 };

    if (mountsEnabled) {
      const mountsList = [
        { name: "Jupiter", glyph: "♃", pos: jupPos },
        { name: "Saturn", glyph: "♄", pos: satPos },
        { name: "Apollo", glyph: "☉", pos: apoPos },
        { name: "Mercury", glyph: "☿", pos: merPos },
        { name: "Venus", glyph: "♀", pos: venPos },
        { name: "Luna", glyph: "☽", pos: lunPos },
        { name: "Mars", glyph: "♂", pos: marsInnPos },
        { name: "Mars+", glyph: "🛡", pos: marsOutPos }
      ];

      ctx.save();
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';

      for (const m of mountsList) {
        const mr = pr * 0.22;
        // Mount Halo
        ctx.beginPath();
        ctx.arc(m.pos.x, m.pos.y, mr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
        ctx.lineWidth = 1.3;
        ctx.setLineDash([3, 4]);
        ctx.stroke();

        // Mount Core
        ctx.beginPath();
        ctx.arc(m.pos.x, m.pos.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#c084fc';
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 6;
        ctx.fill();

        // Label
        ctx.setLineDash([]);
        ctx.fillStyle = '#fde68a';
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 4;
        ctx.fillText(`${m.glyph} ${m.name}`, m.pos.x, m.pos.y - mr - 3);
      }
      ctx.restore();
    }

    // E. Super-Real Anatomical Palm Crease Tracing
    if (arLinesEnabled) {
      // 1. Heart Line (Percussion edge below pinky -> curves upward between Jupiter & Saturn)
      const heartPts = [
        { x: ulnMcp.x + (thumbOnLeft ? 1 : -1) * pr * 0.16, y: ulnMcp.y + pr * 0.24 },
        { x: rngMcp.x + (px - rngMcp.x) * 0.38, y: rngMcp.y + (py - rngMcp.y) * 0.38 },
        { x: midMcp.x + (px - midMcp.x) * 0.40, y: midMcp.y + (py - midMcp.y) * 0.40 },
        { x: (jupPos.x + satPos.x) / 2, y: (jupPos.y + satPos.y) / 2 + pr * 0.06 }
      ];

      // 2. Head Line (Radial margin between index & thumb -> sweeps across toward Luna)
      const headOriginX = idxMcp.x * 0.65 + thumbMcp.x * 0.35 + (thumbOnLeft ? -1 : 1) * pr * 0.12;
      const headOriginY = idxMcp.y * 0.65 + thumbMcp.y * 0.35;
      const headPts = [
        { x: headOriginX, y: headOriginY },
        { x: px * 0.75 + idxMcp.x * 0.25, y: py * 0.85 + idxMcp.y * 0.15 },
        { x: px + (thumbOnLeft ? 1 : -1) * pr * 0.18, y: py + pr * 0.10 },
        { x: lunPos.x * 0.55 + px * 0.45, y: lunPos.y * 0.55 + py * 0.45 }
      ];

      // 3. Life Line (Originates near Head line -> wide arc around Venus -> wrist crease)
      const lifePts = [
        { x: headOriginX, y: headOriginY - pr * 0.03 },
        { x: venPos.x + (thumbOnLeft ? 1 : -1) * pr * 0.32, y: venPos.y - pr * 0.32 },
        { x: venPos.x + (thumbOnLeft ? 1 : -1) * pr * 0.42, y: venPos.y },
        { x: venPos.x + (thumbOnLeft ? 1 : -1) * pr * 0.26, y: venPos.y + pr * 0.38 },
        { x: wrist.x + (thumbOnLeft ? -1 : 1) * pr * 0.08, y: wrist.y - pr * 0.12 }
      ];

      // 4. Fate Line (Wrist base / lower palm -> ascends vertically to Saturn mount)
      const fatePts = [
        { x: wrist.x * 0.72 + px * 0.28, y: wrist.y - pr * 0.18 },
        { x: px * 0.95 + satPos.x * 0.05, y: py + pr * 0.12 },
        { x: px * 0.50 + satPos.x * 0.50, y: py - pr * 0.18 },
        { x: satPos.x, y: satPos.y + pr * 0.10 }
      ];

      const linesToDraw = [
        { name: "Heart", color: "#f43f5e", glow: "#fb7185", pts: heartPts },
        { name: "Head", color: "#f59e0b", glow: "#fde68a", pts: headPts },
        { name: "Life", color: "#10b981", glow: "#34d399", pts: lifePts },
        { name: "Fate", color: "#8b5cf6", glow: "#c084fc", pts: fatePts }
      ];

      for (const line of linesToDraw) {
        drawOrganicSplineLine(ctx, line.pts, line.color, line.glow, line.name);
      }
    }
  }

  // Renders smooth multi-pass organic glowing spline line
  function drawOrganicSplineLine(ctx, points, color, glowColor, label) {
    if (!points || points.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function tracePath() {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      if (points.length === 2) {
        ctx.lineTo(points[1].x, points[1].y);
      } else {
        for (let i = 0; i < points.length - 1; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2;
          const yc = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        const last = points[points.length - 1];
        ctx.lineTo(last.x, last.y);
      }
    }

    // 1. Soft Outer Atmosphere Glow
    tracePath();
    ctx.strokeStyle = glowColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 7.0;
    ctx.globalAlpha = 0.25;
    ctx.stroke();

    // 2. Saturated Vivid Crease Core
    tracePath();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 3.4;
    ctx.globalAlpha = 0.90;
    ctx.stroke();

    // 3. Ultra-Crisp White Luminous Spine
    tracePath();
    ctx.strokeStyle = '#ffffff';
    ctx.shadowBlur = 3;
    ctx.lineWidth = 1.3;
    ctx.globalAlpha = 0.95;
    ctx.stroke();

    // 4. Stardust Endpoint Nodes
    const pStart = points[0];
    const pEnd = points[points.length - 1];

    ctx.beginPath();
    ctx.arc(pStart.x, pStart.y, 4.0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(pEnd.x, pEnd.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = glowColor;
    ctx.fill();

    // 5. Chic Line Label Tag
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = glowColor;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 6;
    ctx.fillText(`${label} Line`, pStart.x + 8, pStart.y - 4);

    ctx.restore();
  }

  // Fallback rendering when using server-side CV exclusively
  function renderServerFallbackAR(ctx, data, cw, ch, isAligned) {
    const fw = (data.frame_size && data.frame_size.width) || (data.bbox ? (data.bbox[0] + data.bbox[2]) : 320);
    const fh = (data.frame_size && data.frame_size.height) || (data.bbox ? (data.bbox[1] + data.bbox[3]) : 240);
    const scaleX = cw / Math.max(1, fw);
    const scaleY = ch / Math.max(1, fh);

    smoothedData.cx = smoothedData.cx !== null ? smoothedData.cx + (data.center[0] - smoothedData.cx) * 0.35 : data.center[0];
    smoothedData.cy = smoothedData.cy !== null ? smoothedData.cy + (data.center[1] - smoothedData.cy) * 0.35 : data.center[1];
    smoothedData.radius = smoothedData.radius ? smoothedData.radius + (data.radius - smoothedData.radius) * 0.35 : data.radius;

    const px = smoothedData.cx * scaleX;
    const py = smoothedData.cy * scaleY;
    const pr = smoothedData.radius * scaleX;

    // Corner brackets
    if (data.bbox) {
      const [raw_bx, raw_by, raw_bw, raw_bh] = data.bbox;
      const bx = raw_bx * scaleX;
      const by = raw_by * scaleY;
      const bw = raw_bw * scaleX;
      const bh = raw_bh * scaleY;
      const cornerLen = Math.min(26, bw * 0.25, bh * 0.25);

      ctx.save();
      ctx.strokeStyle = isAligned ? '#10b981' : '#06b6d4';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = isAligned ? '#10b981' : '#06b6d4';
      ctx.shadowBlur = 10;

      ctx.beginPath();
      ctx.moveTo(bx + cornerLen, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by + cornerLen);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx + bw - cornerLen, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cornerLen);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx, by + bh - cornerLen); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + cornerLen, by + bh);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx + bw - cornerLen, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - cornerLen);
      ctx.stroke();
      ctx.restore();
    }

    // Dynamic Palm Center Compass
    if (pr > 10) {
      ctx.save();
      ctx.translate(px, py);
      ctx.beginPath();
      ctx.arc(0, 0, pr, 0, Math.PI * 2);
      ctx.strokeStyle = isAligned ? 'rgba(16, 185, 129, 0.7)' : 'rgba(245, 158, 11, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.restore();
    }

    // Live Server Traced Real Palm Lines
    if (arLinesEnabled && data.lines) {
      for (const [lineName, lineObj] of Object.entries(data.lines)) {
        const rawPts = lineObj.points;
        if (!rawPts || rawPts.length < 2) continue;
        const pts = rawPts.map(p => ({ x: p[0] * scaleX, y: p[1] * scaleY }));
        const rgb = lineObj.color_rgb || [255, 255, 255];
        const colorHex = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        drawOrganicSplineLine(ctx, pts, colorHex, '#ffffff', lineName);
      }
    }

    // Chirological Mounts
    if (mountsEnabled && data.mounts) {
      ctx.save();
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      for (const [key, mount] of Object.entries(data.mounts)) {
        const mx = mount.pos[0] * scaleX;
        const my = mount.pos[1] * scaleY;
        const mr = (mount.radius || 16) * scaleX;
        const glyph = mountGlyphs[key] || '✦';
        const shortName = mount.name.replace('Mount of ', '').replace(' / Apollo', '').replace(' / Moon', '');

        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 4]);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#c084fc';
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 8;
        ctx.fill();

        ctx.setLineDash([]);
        ctx.fillStyle = '#fde68a';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 4;
        ctx.fillText(`${glyph} ${shortName}`, mx, my - mr - 4);
      }
      ctx.restore();
    }
  }


  // =========================================================================
  // 6. Preset Archetype Selection
  // =========================================================================
  document.querySelectorAll('.sample-card').forEach(card => {
    card.addEventListener('click', () => {
      const sampleId = card.getAttribute('data-sample');
      analyzeSamplePreset(sampleId);
    });
  });

  // =========================================================================
  // 7. API Requests & Scanner Animation
  // =========================================================================
  function showScanner() {
    scannerModal.style.display = 'flex';
    scannerProgressFill.style.width = '15%';
    scannerStatus.innerText = 'Detecting skin contour and isolating palm center...';

    setTimeout(() => {
      scannerProgressFill.style.width = '45%';
      scannerStatus.innerText = 'Applying multi-scale Frangi Hessian ridge filters...';
    }, 450);

    setTimeout(() => {
      scannerProgressFill.style.width = '75%';
      scannerStatus.innerText = 'Segmenting Heart, Head, Life, and Fate lines...';
    }, 900);

    setTimeout(() => {
      scannerProgressFill.style.width = '95%';
      scannerStatus.innerText = 'Synthesizing Chiromancy reading & Mounts...';
    }, 1350);
  }

  function hideScanner() {
    scannerProgressFill.style.width = '100%';
    setTimeout(() => {
      scannerModal.style.display = 'none';
    }, 250);
  }

  async function analyzeBase64(base64Data) {
    showScanner();
    try {
      const response = await fetch('/api/analyze-base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data })
      });
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      const data = await response.json();
      hideScanner();
      renderResults(data);
    } catch (err) {
      hideScanner();
      console.error('Analysis failed:', err);
      alert('Error processing palm image. Please ensure the palm is clearly visible and well lit.');
    }
  }

  async function analyzeSamplePreset(sampleId) {
    showScanner();
    try {
      const response = await fetch(`/api/analyze-sample/${sampleId}`, {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      const data = await response.json();
      hideScanner();
      renderResults(data);
    } catch (err) {
      hideScanner();
      console.error('Sample analysis failed:', err);
      alert('Error processing sample palm.');
    }
  }

  // =========================================================================
  // 8. Render Results Dashboard
  // =========================================================================
  function renderResults(data) {
    currentAnalysis = data;
    resultsDashboard.style.display = 'block';

    const reading = data.reading;
    const profile = reading.elemental_profile;
    const scores = reading.scores;

    // 1. Archetype Box
    const elemIcons = { Earth: '🌱', Air: '💨', Fire: '🔥', Water: '💧' };
    document.getElementById('res-element-icon').innerText = elemIcons[profile.element] || '✦';
    document.getElementById('res-archetype-title').innerText = profile.archetype;
    document.getElementById('res-archetype-motto').innerText = `"${profile.motto}"`;

    const chipsContainer = document.getElementById('res-strengths-chips');
    chipsContainer.innerHTML = '';
    (profile.strengths || []).forEach(str => {
      const chip = document.createElement('span');
      chip.className = 'strength-chip';
      chip.innerText = str;
      chipsContainer.appendChild(chip);
    });

    // 2. Harmony Gauges
    document.getElementById('res-overall-harmony').innerText = scores.overall_harmony;
    // Circular gauge stroke-dashoffset (circumference ~ 264)
    const circleFill = document.getElementById('gauge-harmony-fill');
    const offset = 264 - (264 * scores.overall_harmony / 100);
    circleFill.style.strokeDashoffset = offset;

    // Mini bars
    document.getElementById('val-vitality').innerText = scores.vitality;
    document.getElementById('bar-vitality').style.width = `${scores.vitality}%`;

    document.getElementById('val-intellect').innerText = scores.intellect;
    document.getElementById('bar-intellect').style.width = `${scores.intellect}%`;

    document.getElementById('val-emotion').innerText = scores.heart_harmony;
    document.getElementById('bar-emotion').style.width = `${scores.heart_harmony}%`;

    document.getElementById('val-destiny').innerText = scores.destiny;
    document.getElementById('bar-destiny').style.width = `${scores.destiny}%`;

    // 3. Line Reading Cards
    const lines = reading.lines;
    const lineMetrics = data.lines;

    // Life Line
    document.getElementById('life-clarity').innerText = lines.life.clarity;
    document.getElementById('life-curvature').innerText = lineMetrics.Life?.metrics?.curvature || '1.18';
    document.getElementById('life-length').innerText = `${lineMetrics.Life?.metrics?.normalized_length || 82}%`;
    document.getElementById('life-score').innerText = `${lines.life.score}/100`;
    document.getElementById('life-summary').innerText = lines.life.summary;

    // Head Line
    document.getElementById('head-clarity').innerText = lines.head.clarity;
    document.getElementById('head-slope').innerText = lines.head.slope_pattern ? lines.head.slope_pattern.split(' ')[0] : 'Slope';
    document.getElementById('head-curvature').innerText = lineMetrics.Head?.metrics?.curvature || '1.08';
    document.getElementById('head-score').innerText = `${lines.head.score}/100`;
    document.getElementById('head-summary').innerText = lines.head.summary;

    // Heart Line
    document.getElementById('heart-clarity').innerText = lines.heart.clarity;
    document.getElementById('heart-style').innerText = lines.heart.romantic_style ? lines.heart.romantic_style.split(',')[0] : 'Warm';
    document.getElementById('heart-curvature').innerText = lineMetrics.Heart?.metrics?.curvature || '1.15';
    document.getElementById('heart-score').innerText = `${lines.heart.score}/100`;
    document.getElementById('heart-summary').innerText = lines.heart.summary;

    // Fate Line
    document.getElementById('fate-clarity').innerText = lines.fate.clarity;
    document.getElementById('fate-vocation').innerText = lines.fate.vocation ? lines.fate.vocation.split(',')[0] : 'Purpose';
    document.getElementById('fate-continuity').innerText = lineMetrics.Fate?.metrics?.depth_score > 50 ? 'Continuous' : 'Dynamic';
    document.getElementById('fate-score').innerText = `${lines.fate.score}/100`;
    document.getElementById('fate-summary').innerText = lines.fate.summary;

    // 4. Palm Mounts
    const mountsContainer = document.getElementById('mounts-list-container');
    mountsContainer.innerHTML = '';
    (reading.mounts || []).forEach(m => {
      const item = document.createElement('div');
      item.className = 'mount-item';
      item.innerHTML = `
        <div class="mount-title">${m.name}</div>
        <div class="mount-domain">${m.domain} &bull; ${m.prominence}</div>
        <div class="mount-desc">${m.interpretation}</div>
      `;
      mountsContainer.appendChild(item);
    });

    // 5. Auspicious Signs & Guidance
    const signsContainer = document.getElementById('signs-list-container');
    signsContainer.innerHTML = '';
    (reading.auspicious_signs || []).forEach(s => {
      const signBox = document.createElement('div');
      signBox.className = 'sign-box';
      signBox.innerHTML = `
        <div class="sign-name">${s.name}</div>
        <div class="sign-desc">${s.significance}</div>
      `;
      signsContainer.appendChild(signBox);
    });

    const guidanceList = document.getElementById('guidance-list');
    guidanceList.innerHTML = '';
    (reading.mindful_guidance || []).forEach(g => {
      const li = document.createElement('li');
      li.innerText = g;
      guidanceList.appendChild(li);
    });

    // Reset zoom and pan on new reading
    resetZoomAndPan();

    // 6. Update Visual Canvas and interactive SVG
    updateCanvasView(activeView);
    renderInteractiveSVG();

    // Smooth scroll down to results
    resultsDashboard.scrollIntoView({ behavior: 'smooth' });
  }

  // =========================================================================
  // 9. Interactive Vision Studio: Canvas & View Modes
  // =========================================================================
  function updateCanvasView(viewName) {
    activeView = viewName;
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });

    if (!currentAnalysis || !currentAnalysis.visualizations) return;
    const visuals = currentAnalysis.visualizations;

    if (viewName === 'split') {
      // Split Comparison Mode
      singleViewContainer.style.display = 'none';
      splitSliderContainer.style.display = 'block';
      svgOverlay.style.display = 'none';
      
      splitBeforeImg.src = visuals.roi;
      splitAfterImg.src = visuals.ridge_map;
      
      updateSplitSliderPosition(50);
      studioModeLabel.innerHTML = 'Mode: <strong>Split Comparison</strong> &bull; Drag slider to reveal crease heatmap';
    } else {
      // Single View Modes
      singleViewContainer.style.display = 'flex';
      splitSliderContainer.style.display = 'none';

      if (viewName === 'overlay') {
        activeVisualImg.src = visuals.overlay;
        svgOverlay.style.display = 'block';
        studioModeLabel.innerHTML = 'Mode: <strong>Full Overlay</strong> &bull; Interactive SVG active';
      } else if (viewName === 'ridge') {
        activeVisualImg.src = visuals.ridge_map;
        svgOverlay.style.display = 'none';
        studioModeLabel.innerHTML = 'Mode: <strong>Frangi Ridge Heatmap</strong> &bull; Vessel creasemap';
      } else if (viewName === 'blueprint') {
        activeVisualImg.src = visuals.blueprint;
        svgOverlay.style.display = 'none';
        studioModeLabel.innerHTML = 'Mode: <strong>Celestial Blueprint</strong> &bull; Inverted contrast';
      } else if (viewName === 'roi') {
        activeVisualImg.src = visuals.roi;
        svgOverlay.style.display = 'block';
        studioModeLabel.innerHTML = 'Mode: <strong>Raw Palm ROI</strong> &bull; Segmented palm area';
      }
    }
  }

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      updateCanvasView(btn.getAttribute('data-view'));
    });
  });

  // =========================================================================
  // 10. Split Comparison Slider Dragging
  // =========================================================================
  function updateSplitSliderPosition(percent) {
    splitPercent = Math.max(0, Math.min(100, percent));
    splitOverlayWrapper.style.width = `${splitPercent}%`;
    splitDividerHandle.style.left = `${splitPercent}%`;
  }

  function handleSplitDrag(clientX) {
    const rect = splitSliderContainer.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = (x / rect.width) * 100;
    updateSplitSliderPosition(percent);
  }

  splitSliderContainer.addEventListener('mousedown', (e) => {
    if (activeView !== 'split') return;
    isDraggingSplit = true;
    handleSplitDrag(e.clientX);
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDraggingSplit) return;
    handleSplitDrag(e.clientX);
  });

  window.addEventListener('mouseup', () => {
    isDraggingSplit = false;
  });

  // Touch support for split slider
  splitSliderContainer.addEventListener('touchstart', (e) => {
    if (activeView !== 'split') return;
    isDraggingSplit = true;
    if (e.touches[0]) handleSplitDrag(e.touches[0].clientX);
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isDraggingSplit) return;
    if (e.touches[0]) handleSplitDrag(e.touches[0].clientX);
  }, { passive: true });

  window.addEventListener('touchend', () => {
    isDraggingSplit = false;
  });

  // =========================================================================
  // 11. Zoom & Pan Engine
  // =========================================================================
  function updateTransform() {
    canvasTransformWrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    zoomLevelText.innerText = `${Math.round(zoomLevel * 100)}%`;
  }

  function zoomIn() {
    if (zoomLevel < 3.0) {
      zoomLevel = Math.min(3.0, +(zoomLevel + 0.25).toFixed(2));
      updateTransform();
    }
  }

  function zoomOut() {
    if (zoomLevel > 1.0) {
      zoomLevel = Math.max(1.0, +(zoomLevel - 0.25).toFixed(2));
      if (zoomLevel === 1.0) {
        panX = 0;
        panY = 0;
      }
      updateTransform();
    }
  }

  function resetZoomAndPan() {
    zoomLevel = 1.0;
    panX = 0;
    panY = 0;
    updateTransform();
  }

  btnZoomIn.addEventListener('click', zoomIn);
  btnZoomOut.addEventListener('click', zoomOut);
  btnZoomReset.addEventListener('click', resetZoomAndPan);

  // Mouse Wheel Zooming
  canvasViewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  }, { passive: false });

  // Pan / Dragging
  canvasViewport.addEventListener('mousedown', (e) => {
    // If in split mode or clicking slider, don't pan
    if (activeView === 'split' || isDraggingSplit) return;
    if (zoomLevel > 1.0) {
      isPanning = true;
      startPanX = e.clientX - panX;
      startPanY = e.clientY - panY;
      canvasViewport.classList.add('panning');
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    panX = e.clientX - startPanX;
    panY = e.clientY - startPanY;
    updateTransform();
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      canvasViewport.classList.remove('panning');
    }
  });

  // Touch Pan / Dragging for Mobile Phones
  canvasViewport.addEventListener('touchstart', (e) => {
    if (activeView === 'split' || isDraggingSplit) return;
    if (zoomLevel > 1.0 && e.touches.length === 1) {
      isPanning = true;
      startPanX = e.touches[0].clientX - panX;
      startPanY = e.touches[0].clientY - panY;
      canvasViewport.classList.add('panning');
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isPanning || !e.touches || !e.touches[0]) return;
    panX = e.touches[0].clientX - startPanX;
    panY = e.touches[0].clientY - startPanY;
    updateTransform();
  }, { passive: true });

  window.addEventListener('touchend', () => {
    if (isPanning) {
      isPanning = false;
      canvasViewport.classList.remove('panning');
    }
  });

  // =========================================================================
  // 12. Interactive SVG Overlays & Bi-Directional Hover Inspector
  // =========================================================================
  const lineColors = {
    Heart: '#f43f5e',
    Head: '#0ea5e9',
    Life: '#10b981',
    Fate: '#f59e0b'
  };

  function renderInteractiveSVG() {
    svgMountsGroup.innerHTML = '';
    svgLinesGroup.innerHTML = '';

    if (!currentAnalysis) return;
    const lines = currentAnalysis.lines || {};
    const mounts = currentAnalysis.mounts || {};

    // 1. Draw Planetary Mount Circles
    for (const [key, mount] of Object.entries(mounts)) {
      const cx = mount.pos[0];
      const cy = mount.pos[1];
      const r = mount.radius;

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', r);
      circle.setAttribute('fill', 'rgba(168, 85, 247, 0.16)');
      circle.setAttribute('stroke', 'rgba(192, 132, 252, 0.7)');
      circle.setAttribute('stroke-width', '1.5');
      circle.setAttribute('stroke-dasharray', '3 3');
      circle.classList.add('svg-mount-circle');
      circle.dataset.layer = 'mounts';

      circle.addEventListener('mouseenter', (e) => {
        showTooltip(e, `<strong>${mount.name}</strong><br><span style="color:#c084fc;">Domain:</span> ${mount.meaning}`);
      });
      circle.addEventListener('mousemove', moveTooltip);
      circle.addEventListener('mouseleave', hideTooltip);

      svgMountsGroup.appendChild(circle);
    }

    // 2. Draw Major Lines
    for (const [lineName, lineData] of Object.entries(lines)) {
      const pts = lineData.points;
      if (!pts || pts.length < 2) continue;

      let d = `M ${pts[0][0]} ${pts[0][1]}`;
      for (let i = 1; i < pts.length; i++) {
        d += ` L ${pts[i][0]} ${pts[i][1]}`;
      }

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', lineColors[lineName] || '#ffffff');
      path.setAttribute('stroke-width', '4');
      path.classList.add('svg-interactive-line');
      
      const lineKey = lineName.toLowerCase();
      path.dataset.layer = lineKey;
      path.id = `svg-path-${lineKey}`;

      const metrics = lineData.metrics || {};
      const tooltipText = `
        <strong style="color:${lineColors[lineName]};">${lineName} Line</strong><br>
        Clarity: ${metrics.clarity || 'Defined'}<br>
        Curvature: ${metrics.curvature || '1.10'}<br>
        Depth Score: ${metrics.depth_score || 50}/100
      `;

      // Line Hover Events (Bi-directional)
      path.addEventListener('mouseenter', (e) => {
        highlightLine(lineKey);
        showTooltip(e, tooltipText);
      });
      path.addEventListener('mousemove', moveTooltip);
      path.addEventListener('mouseleave', () => {
        resetLineHighlights();
        hideTooltip();
      });

      svgLinesGroup.appendChild(path);
    }

    applyLayerToggles();
  }

  // Bi-directional Highlights
  function highlightLine(lineKey) {
    // 1. Canvas SVG paths
    const allPaths = svgLinesGroup.querySelectorAll('.svg-interactive-line');
    allPaths.forEach(p => {
      if (p.dataset.layer === lineKey) {
        p.classList.add('line-highlighted');
        p.classList.remove('line-dimmed');
      } else {
        p.classList.add('line-dimmed');
        p.classList.remove('line-highlighted');
      }
    });

    // 2. Reading Cards
    document.querySelectorAll('.interactive-reading-card').forEach(card => {
      if (card.dataset.line === lineKey) {
        card.classList.add('card-highlighted');
        card.classList.remove('card-dimmed');
      } else {
        card.classList.add('card-dimmed');
        card.classList.remove('card-highlighted');
      }
    });
  }

  function resetLineHighlights() {
    svgLinesGroup.querySelectorAll('.svg-interactive-line').forEach(p => {
      p.classList.remove('line-highlighted', 'line-dimmed');
    });
    document.querySelectorAll('.interactive-reading-card').forEach(card => {
      card.classList.remove('card-highlighted', 'card-dimmed');
    });
  }

  // Hook up hover & tap listeners on the Reading Cards for Desktop & Mobile!
  let activeHighlightedLine = null;
  document.querySelectorAll('.interactive-reading-card').forEach(card => {
    const lineKey = card.dataset.line;
    card.addEventListener('mouseenter', () => {
      highlightLine(lineKey);
    });
    card.addEventListener('mouseleave', () => {
      if (!activeHighlightedLine) {
        resetLineHighlights();
      } else {
        highlightLine(activeHighlightedLine);
      }
    });
    card.addEventListener('click', () => {
      if (activeHighlightedLine === lineKey) {
        activeHighlightedLine = null;
        resetLineHighlights();
      } else {
        activeHighlightedLine = lineKey;
        highlightLine(lineKey);
      }
    });
  });

  // Layer Toggles
  function applyLayerToggles() {
    const showHeart = toggleHeart.checked;
    const showHead = toggleHead.checked;
    const showLife = toggleLife.checked;
    const showFate = toggleFate.checked;
    const showMounts = toggleMounts.checked;

    svgLinesGroup.querySelectorAll('path').forEach(p => {
      const layer = p.dataset.layer;
      if (layer === 'heart') p.style.display = showHeart ? 'block' : 'none';
      if (layer === 'head') p.style.display = showHead ? 'block' : 'none';
      if (layer === 'life') p.style.display = showLife ? 'block' : 'none';
      if (layer === 'fate') p.style.display = showFate ? 'block' : 'none';
    });

    svgMountsGroup.querySelectorAll('circle').forEach(c => {
      c.style.display = showMounts ? 'block' : 'none';
    });
  }

  [toggleHeart, toggleHead, toggleLife, toggleFate, toggleMounts].forEach(chk => {
    chk.addEventListener('change', applyLayerToggles);
  });

  // Tooltip Helpers
  function showTooltip(e, htmlContent) {
    canvasTooltip.innerHTML = htmlContent;
    canvasTooltip.style.display = 'block';
    moveTooltip(e);
  }

  function moveTooltip(e) {
    const rect = canvasViewport.getBoundingClientRect();
    const x = e.clientX - rect.left + 14;
    const y = e.clientY - rect.top + 14;
    canvasTooltip.style.left = `${Math.min(x, rect.width - 220)}px`;
    canvasTooltip.style.top = `${Math.min(y, rect.height - 90)}px`;
  }

  function hideTooltip() {
    canvasTooltip.style.display = 'none';
  }

  // =========================================================================
  // 13. Actions (Print & Reset)
  // =========================================================================
  btnPrintReport.addEventListener('click', () => {
    window.print();
  });

  btnReadAnother.addEventListener('click', () => {
    document.getElementById('input-section').scrollIntoView({ behavior: 'smooth' });
  });

});
