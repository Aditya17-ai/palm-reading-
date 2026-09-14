/**
 * PALMISTRA AI - Frontend Application Controller
 * Handles Camera capture, drag-and-drop file upload, sample presets,
 * interactive canvas SVG overlay rendering, layer toggles, and report display.
 */

document.addEventListener('DOMContentLoaded', () => {
  // State variables
  let currentAnalysis = null;
  let activeView = 'overlay'; // 'overlay' | 'ridge' | 'blueprint' | 'roi'
  let cameraStream = null;

  // DOM Elements - Tabs
  const tabUpload = document.getElementById('tab-upload');
  const tabCamera = document.getElementById('tab-camera');
  const tabSamples = document.getElementById('tab-samples');
  const panelUpload = document.getElementById('panel-upload');
  const panelCamera = document.getElementById('panel-camera');
  const panelSamples = document.getElementById('panel-samples');

  // DOM Elements - Upload
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  // DOM Elements - Camera
  const cameraFeed = document.getElementById('camera-feed');
  const btnStartCamera = document.getElementById('btn-start-camera');
  const btnCapturePhoto = document.getElementById('btn-capture-photo');
  const btnStopCamera = document.getElementById('btn-stop-camera');
  const btnOpenCameraHeader = document.getElementById('btn-open-camera');

  // DOM Elements - Scanner Modal
  const scannerModal = document.getElementById('scanner-modal');
  const scannerStatus = document.getElementById('scanner-status');
  const scannerProgressFill = document.getElementById('scanner-progress-fill');

  // DOM Elements - Results Dashboard
  const resultsDashboard = document.getElementById('results-dashboard');
  const activeVisualImg = document.getElementById('active-visual-img');
  const svgOverlay = document.getElementById('interactive-svg-overlay');
  const svgMountsGroup = document.getElementById('svg-mounts-group');
  const svgLinesGroup = document.getElementById('svg-lines-group');
  const canvasTooltip = document.getElementById('canvas-tooltip');
  const canvasViewport = document.getElementById('canvas-viewport');

  // DOM Elements - Layer Toggles
  const toggleHeart = document.getElementById('toggle-heart');
  const toggleHead = document.getElementById('toggle-head');
  const toggleLife = document.getElementById('toggle-life');
  const toggleFate = document.getElementById('toggle-fate');
  const toggleMounts = document.getElementById('toggle-mounts');

  // DOM Elements - Actions
  const btnPrintReport = document.getElementById('btn-print-report');
  const btnReadAnother = document.getElementById('btn-read-another');

  // =========================================================================
  // 1. Tab Switching
  // =========================================================================
  function switchTab(target) {
    [tabUpload, tabCamera, tabSamples].forEach(t => t.classList.remove('active'));
    [panelUpload, panelCamera, panelSamples].forEach(p => p.classList.remove('active'));

    if (target === 'upload') {
      tabUpload.classList.add('active');
      panelUpload.classList.add('active');
    } else if (target === 'camera') {
      tabCamera.classList.add('active');
      panelCamera.classList.add('active');
      startCamera();
    } else if (target === 'samples') {
      tabSamples.classList.add('active');
      panelSamples.classList.add('active');
    }
  }

  tabUpload.addEventListener('click', () => switchTab('upload'));
  tabCamera.addEventListener('click', () => switchTab('camera'));
  tabSamples.addEventListener('click', () => switchTab('samples'));
  if (btnOpenCameraHeader) {
    btnOpenCameraHeader.addEventListener('click', () => {
      document.getElementById('input-section').scrollIntoView({ behavior: 'smooth' });
      switchTab('camera');
    });
  }

  // =========================================================================
  // 2. Drag & Drop File Upload
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
      handleImageFile(e.dataTransfer.files[0]);
    }
  });

  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleImageFile(e.target.files[0]);
    }
  });

  function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (JPEG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result;
      analyzeBase64(base64Data);
    };
    reader.readAsDataURL(file);
  }

  // =========================================================================
  // 3. Live Webcam Controller
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
      alert('Camera access could not be initialized or permission was denied. You can still upload a photo or select an archetype sample!');
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    cameraFeed.srcObject = null;
    btnStartCamera.style.display = 'inline-flex';
    btnCapturePhoto.style.display = 'none';
    btnStopCamera.style.display = 'none';
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
  // 4. Sample Preset Selection
  // =========================================================================
  document.querySelectorAll('.sample-card').forEach(card => {
    card.addEventListener('click', () => {
      const sampleId = card.getAttribute('data-sample');
      analyzeSamplePreset(sampleId);
    });
  });

  // =========================================================================
  // 5. API Requests & Scanner Animation
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
  // 6. Render Results Dashboard
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
    document.getElementById('life-curvature').innerText = lineMetrics.Life?.metrics?.curvature || '1.14';
    document.getElementById('life-length').innerText = `${lineMetrics.Life?.metrics?.normalized_length || 75}%`;
    document.getElementById('life-score').innerText = `${lines.life.score}/100`;
    document.getElementById('life-summary').innerText = lines.life.summary;

    // Head Line
    document.getElementById('head-clarity').innerText = lines.head.clarity;
    document.getElementById('head-slope').innerText = lines.head.slope_pattern ? lines.head.slope_pattern.split(' ')[0] : 'Slope';
    document.getElementById('head-curvature').innerText = lineMetrics.Head?.metrics?.curvature || '1.06';
    document.getElementById('head-score').innerText = `${lines.head.score}/100`;
    document.getElementById('head-summary').innerText = lines.head.summary;

    // Heart Line
    document.getElementById('heart-clarity').innerText = lines.heart.clarity;
    document.getElementById('heart-style').innerText = lines.heart.romantic_style ? lines.heart.romantic_style.split(',')[0] : 'Warm';
    document.getElementById('heart-curvature').innerText = lineMetrics.Heart?.metrics?.curvature || '1.12';
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
        <div class="mount-domain">${m.domain} • ${m.prominence}</div>
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

    // 6. Update Visual Canvas and interactive SVG
    updateCanvasView(activeView);
    renderInteractiveSVG();

    // Smooth scroll down to results
    resultsDashboard.scrollIntoView({ behavior: 'smooth' });
  }

  // =========================================================================
  // 7. Interactive Vision Studio Canvas & SVG Overlays
  // =========================================================================
  function updateCanvasView(viewName) {
    activeView = viewName;
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });

    if (!currentAnalysis || !currentAnalysis.visualizations) return;
    const visuals = currentAnalysis.visualizations;

    if (viewName === 'overlay') {
      activeVisualImg.src = visuals.overlay;
      svgOverlay.style.display = 'block';
    } else if (viewName === 'ridge') {
      activeVisualImg.src = visuals.ridge_map;
      svgOverlay.style.display = 'none'; // pure heatmap
    } else if (viewName === 'blueprint') {
      activeVisualImg.src = visuals.blueprint;
      svgOverlay.style.display = 'none';
    } else if (viewName === 'roi') {
      activeVisualImg.src = visuals.roi;
      svgOverlay.style.display = 'block';
    }
  }

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      updateCanvasView(btn.getAttribute('data-view'));
    });
  });

  function renderInteractiveSVG() {
    svgMountsGroup.innerHTML = '';
    svgLinesGroup.innerHTML = '';

    if (!currentAnalysis) return;
    const lines = currentAnalysis.lines || {};
    const mounts = currentAnalysis.mounts || {};

    // 1. Draw Mounts circles
    for (const [key, mount] of Object.entries(mounts)) {
      const cx = mount.pos[0];
      const cy = mount.pos[1];
      const r = mount.radius;

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', r);
      circle.setAttribute('fill', 'rgba(168, 85, 247, 0.18)');
      circle.setAttribute('stroke', 'rgba(192, 132, 252, 0.6)');
      circle.setAttribute('stroke-width', '1.5');
      circle.setAttribute('stroke-dasharray', '3 3');
      circle.classList.add('svg-mount-circle');
      circle.dataset.layer = 'mounts';

      circle.addEventListener('mouseenter', (e) => {
        showTooltip(e, `<strong>${mount.name}</strong><br>${mount.meaning}`);
      });
      circle.addEventListener('mousemove', moveTooltip);
      circle.addEventListener('mouseleave', hideTooltip);

      svgMountsGroup.appendChild(circle);
    }

    // 2. Draw Major Lines as smooth SVG paths
    const lineColors = {
      Heart: '#f43f5e',
      Head: '#0ea5e9',
      Life: '#10b981',
      Fate: '#f59e0b'
    };

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
      path.setAttribute('stroke-width', '3.5');
      path.classList.add('svg-interactive-line');
      path.dataset.layer = lineName.toLowerCase();

      const metrics = lineData.metrics || {};
      const tooltipText = `
        <strong>${lineName} Line</strong><br>
        Clarity: ${metrics.clarity || 'Defined'}<br>
        Curvature: ${metrics.curvature || '1.10'}<br>
        Depth Score: ${metrics.depth_score || 50}/100
      `;

      path.addEventListener('mouseenter', (e) => showTooltip(e, tooltipText));
      path.addEventListener('mousemove', moveTooltip);
      path.addEventListener('mouseleave', hideTooltip);

      svgLinesGroup.appendChild(path);
    }

    applyLayerToggles();
  }

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

  // Tooltip Helper
  function showTooltip(e, htmlContent) {
    canvasTooltip.innerHTML = htmlContent;
    canvasTooltip.style.display = 'block';
    moveTooltip(e);
  }

  function moveTooltip(e) {
    const rect = canvasViewport.getBoundingClientRect();
    const x = e.clientX - rect.left + 15;
    const y = e.clientY - rect.top + 15;
    canvasTooltip.style.left = `${Math.min(x, rect.width - 200)}px`;
    canvasTooltip.style.top = `${Math.min(y, rect.height - 80)}px`;
  }

  function hideTooltip() {
    canvasTooltip.style.display = 'none';
  }

  // =========================================================================
  // 8. Actions (Print & Reset)
  // =========================================================================
  btnPrintReport.addEventListener('click', () => {
    window.print();
  });

  btnReadAnother.addEventListener('click', () => {
    document.getElementById('input-section').scrollIntoView({ behavior: 'smooth' });
  });

  // Automatically trigger sample earth on load for immediate interactive demonstration!
  setTimeout(() => {
    analyzeSamplePreset('earth');
  }, 300);
});
