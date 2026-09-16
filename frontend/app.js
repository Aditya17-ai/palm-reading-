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

  // Camera Elements
  const cameraFeed = document.getElementById('camera-feed');
  const btnStartCamera = document.getElementById('btn-start-camera');
  const btnCapturePhoto = document.getElementById('btn-capture-photo');
  const btnStopCamera = document.getElementById('btn-stop-camera');

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
  // 5. Live Webcam Controller
  // =========================================================================
  async function startCamera() {
    try {
      if (cameraStream) return;
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      cameraFeed.srcObject = cameraStream;
      btnStartCamera.style.display = 'none';
      btnCapturePhoto.style.display = 'inline-flex';
      btnStopCamera.style.display = 'inline-flex';
    } catch (err) {
      console.warn('Camera access error:', err);
      alert('Camera access could not be initialized or permission was denied. You can still upload a photo or select an archetype preset!');
      switchTab('upload');
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    if (cameraFeed) cameraFeed.srcObject = null;
    if (btnStartCamera) btnStartCamera.style.display = 'inline-flex';
    if (btnCapturePhoto) btnCapturePhoto.style.display = 'none';
    if (btnStopCamera) btnStopCamera.style.display = 'none';
  }

  btnStartCamera.addEventListener('click', startCamera);
  btnStopCamera.addEventListener('click', stopCamera);

  btnCapturePhoto.addEventListener('click', () => {
    if (!cameraFeed.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = cameraFeed.videoWidth;
    canvas.height = cameraFeed.videoHeight;
    const ctx = canvas.getContext('2d');
    // Mirror horizontal to match displayed preview
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);
    const base64Img = canvas.toDataURL('image/png');
    stopCamera();
    analyzeBase64(base64Img);
  });

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

  // Hook up hover listeners on the Reading Cards as well!
  document.querySelectorAll('.interactive-reading-card').forEach(card => {
    const lineKey = card.dataset.line;
    card.addEventListener('mouseenter', () => {
      highlightLine(lineKey);
    });
    card.addEventListener('mouseleave', () => {
      resetLineHighlights();
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
