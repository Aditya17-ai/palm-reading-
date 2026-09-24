/**
 * PALMISTRA AI - Dedicated Upload Photo Controller (upload.js)
 * Version 2.0: High-precision photo upload, pre-processing transforms (rotate, flip, hand selection),
 * clipboard paste, Frangi ridge extraction, and Interactive Vision Studio results.
 */

document.addEventListener('DOMContentLoaded', () => {
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
  // 2. Upload State & DOM Elements
  // =========================================================================
  const dropZone = document.getElementById('upload-drop-zone');
  const fileInput = document.getElementById('upload-file-input');
  const idleState = document.getElementById('upload-idle-state');
  const previewState = document.getElementById('upload-preview-state');
  const previewCanvas = document.getElementById('pre-analysis-canvas');
  const preCanvasCtx = previewCanvas.getContext('2d');

  const btnBrowseFile = document.getElementById('btn-browse-file');
  const btnPasteClipboard = document.getElementById('btn-paste-clipboard');
  const btnQuickSample = document.getElementById('btn-quick-sample');

  const metaFilename = document.getElementById('meta-filename');
  const metaDims = document.getElementById('meta-dims');
  const metaFilesize = document.getElementById('meta-filesize');

  const btnRotateLeft = document.getElementById('btn-rotate-left');
  const btnRotateRight = document.getElementById('btn-rotate-right');
  const btnFlipH = document.getElementById('btn-flip-h');
  const btnResetTransform = document.getElementById('btn-reset-transform');
  const btnExecuteAnalysis = document.getElementById('btn-execute-analysis');
  const btnResetUpload = document.getElementById('btn-reset-upload');

  const handPillRight = document.getElementById('hand-pill-right');
  const handPillLeft = document.getElementById('hand-pill-left');

  // Scanner Modal Elements
  const scannerModal = document.getElementById('scanner-modal');
  const scannerProgressFill = document.getElementById('scanner-progress-fill');
  const scannerStatus = document.getElementById('scanner-status');

  // Results Dashboard Elements
  const resultsDashboard = document.getElementById('results-dashboard');
  const activeVisualImg = document.getElementById('active-visual-img');
  const svgOverlay = document.getElementById('interactive-svg-overlay');
  const svgLinesGroup = document.getElementById('svg-lines-group');
  const svgMountsGroup = document.getElementById('svg-mounts-group');
  const canvasTooltip = document.getElementById('canvas-tooltip');
  const studioModeLabel = document.getElementById('studio-mode-label');

  // Split Slider Elements
  const singleViewContainer = document.getElementById('single-view-container');
  const splitSliderContainer = document.getElementById('split-slider-container');
  const splitBeforeImg = document.getElementById('split-before-img');
  const splitAfterImg = document.getElementById('split-after-img');
  const splitOverlayWrapper = document.getElementById('split-overlay-wrapper');
  const splitDividerHandle = document.getElementById('split-divider-handle');

  // Zoom & Pan Elements
  const canvasViewport = document.getElementById('canvas-viewport');
  const canvasTransformWrapper = document.getElementById('canvas-transform-wrapper');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomReset = document.getElementById('btn-zoom-reset');
  const zoomLevelText = document.getElementById('zoom-level-text');

  // Footer buttons
  const btnPrintReport = document.getElementById('btn-print-report');
  const btnReadAnother = document.getElementById('btn-read-another');

  // Pre-Analysis Transform State
  let loadedImage = null;
  let currentFileObj = null;
  let rotationAngle = 0; // 0, 90, 180, 270
  let isFlippedH = false;
  let selectedHand = 'right';

  // Analysis & Visual Studio State
  let currentAnalysis = null;
  let activeView = 'overlay';
  let zoomLevel = 1.0;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let startPanX = 0;
  let startPanY = 0;
  let isDraggingSplit = false;
  let splitPercent = 50;

  // Layer filter state
  const layerToggles = {
    heart: document.getElementById('toggle-heart'),
    head: document.getElementById('toggle-head'),
    life: document.getElementById('toggle-life'),
    fate: document.getElementById('toggle-fate'),
    mounts: document.getElementById('toggle-mounts')
  };

  const lineColors = {
    Heart: '#f43f5e',
    Head: '#0ea5e9',
    Life: '#10b981',
    Fate: '#f59e0b'
  };

  // =========================================================================
  // 3. Pre-Analysis Image Rendering & Transforms
  // =========================================================================
  function renderTransformedImage() {
    if (!loadedImage) return;

    const naturalW = loadedImage.naturalWidth || loadedImage.width;
    const naturalH = loadedImage.naturalHeight || loadedImage.height;

    // Swap canvas dimensions if rotated 90 or 270 degrees
    const isSideways = rotationAngle === 90 || rotationAngle === 270;
    const targetW = isSideways ? naturalH : naturalW;
    const targetH = isSideways ? naturalW : naturalH;

    // Limit preview canvas size for smooth performance while maintaining aspect ratio
    const maxDim = 800;
    let canvasW = targetW;
    let canvasH = targetH;
    if (canvasW > maxDim || canvasH > maxDim) {
      if (canvasW > canvasH) {
        canvasH = Math.round((canvasH * maxDim) / canvasW);
        canvasW = maxDim;
      } else {
        canvasW = Math.round((canvasW * maxDim) / canvasH);
        canvasH = maxDim;
      }
    }

    previewCanvas.width = canvasW;
    previewCanvas.height = canvasH;

    preCanvasCtx.clearRect(0, 0, canvasW, canvasH);
    preCanvasCtx.save();

    // Center transform matrix
    preCanvasCtx.translate(canvasW / 2, canvasH / 2);
    preCanvasCtx.rotate((rotationAngle * Math.PI) / 180);
    if (isFlippedH) {
      preCanvasCtx.scale(-1, 1);
    }

    // Draw image centered
    const drawW = isSideways ? canvasH : canvasW;
    const drawH = isSideways ? canvasW : canvasH;
    preCanvasCtx.drawImage(loadedImage, -drawW / 2, -drawH / 2, drawW, drawH);
    preCanvasCtx.restore();

    // Update dimensions label
    metaDims.innerText = `${targetW} × ${targetH} px`;
  }

  function handleLoadedFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please provide a valid image file (PNG, JPEG, WEBP).');
      return;
    }

    currentFileObj = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        loadedImage = img;
        rotationAngle = 0;
        isFlippedH = false;

        metaFilename.innerText = file.name || 'clipboard_image.png';
        metaFilesize.innerText = `${(file.size / 1024).toFixed(1)} KB`;

        renderTransformedImage();

        idleState.style.display = 'none';
        previewState.style.display = 'block';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // =========================================================================
  // 4. File Drag & Drop, File Picker & Clipboard Paste
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
      handleLoadedFile(e.dataTransfer.files[0]);
    }
  });

  idleState.addEventListener('click', () => {
    fileInput.click();
  });

  if (btnBrowseFile) {
    btnBrowseFile.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleLoadedFile(e.target.files[0]);
    }
  });

  // Clipboard paste listener
  async function pasteFromClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              handleLoadedFile(new File([blob], 'clipboard_palm.png', { type }));
              return;
            }
          }
        }
      }
      alert('No image found in clipboard. Please copy an image first or press Ctrl+V directly on this page.');
    } catch (err) {
      console.warn('Clipboard read error:', err);
      alert('Clipboard access requires permission or press Ctrl+V directly on this page.');
    }
  }

  if (btnPasteClipboard) {
    btnPasteClipboard.addEventListener('click', (e) => {
      e.stopPropagation();
      pasteFromClipboard();
    });
  }

  window.addEventListener('paste', (e) => {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        handleLoadedFile(file);
      }
    }
  });

  // Preset archetype chips
  document.querySelectorAll('[data-sample]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sampleId = btn.getAttribute('data-sample');
      analyzeSamplePreset(sampleId);
    });
  });

  if (btnQuickSample) {
    btnQuickSample.addEventListener('click', () => {
      analyzeSamplePreset('earth');
    });
  }

  // Pre-Analysis Transform buttons
  btnRotateLeft.addEventListener('click', (e) => {
    e.stopPropagation();
    rotationAngle = (rotationAngle - 90 + 360) % 360;
    renderTransformedImage();
  });

  btnRotateRight.addEventListener('click', (e) => {
    e.stopPropagation();
    rotationAngle = (rotationAngle + 90) % 360;
    renderTransformedImage();
  });

  btnFlipH.addEventListener('click', (e) => {
    e.stopPropagation();
    isFlippedH = !isFlippedH;
    renderTransformedImage();
  });

  btnResetTransform.addEventListener('click', (e) => {
    e.stopPropagation();
    rotationAngle = 0;
    isFlippedH = false;
    renderTransformedImage();
  });

  // Hand selection chips
  handPillRight.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedHand = 'right';
    handPillRight.classList.add('active');
    handPillLeft.classList.remove('active');
  });

  handPillLeft.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedHand = 'left';
    handPillLeft.classList.add('active');
    handPillRight.classList.remove('active');
  });

  // Reset upload button
  btnResetUpload.addEventListener('click', (e) => {
    e.stopPropagation();
    loadedImage = null;
    currentFileObj = null;
    fileInput.value = '';
    previewState.style.display = 'none';
    idleState.style.display = 'block';
  });

  // =========================================================================
  // 5. API Requests & Scanner Modal
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

  btnExecuteAnalysis.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!previewCanvas) return;

    // Export transformed canvas to Base64 PNG
    const transformedBase64 = previewCanvas.toDataURL('image/png');
    analyzeBase64(transformedBase64);
  });

  async function analyzeBase64(base64Data) {
    showScanner();
    try {
      const response = await fetch('/api/analyze-base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      hideScanner();
      renderDashboard(data);
    } catch (err) {
      hideScanner();
      console.error('Analysis failed:', err);
      alert(`Palm Analysis Error: ${err.message || 'Please ensure the palm is clearly visible and well lit.'}`);
    }
  }

  async function analyzeSamplePreset(sampleId) {
    showScanner();
    try {
      const response = await fetch(`/api/analyze-sample/${sampleId}`, {
        method: 'POST'
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      hideScanner();
      renderDashboard(data);
    } catch (err) {
      hideScanner();
      console.error('Preset analysis failed:', err);
      alert(`Preset Load Error: ${err.message || 'Error processing sample palm.'}`);
    }
  }

  // =========================================================================
  // 6. Interactive Results Dashboard Renderer
  // =========================================================================
  function renderDashboard(data) {
    currentAnalysis = data;
    resultsDashboard.style.display = 'block';

    const reading = data.reading || {};
    const profile = reading.elemental_profile || {};
    const scores = reading.scores || {};
    const lines = reading.lines || {};
    const lineMetrics = data.lines || {};

    // 1. Archetype Header
    const elemIcons = { Earth: '🌱', Air: '💨', Fire: '🔥', Water: '💧' };
    const elemIconElem = document.getElementById('res-element-icon');
    if (elemIconElem) elemIconElem.innerText = elemIcons[profile.element] || '✦';

    const archTitleElem = document.getElementById('res-archetype-title');
    if (archTitleElem) archTitleElem.innerText = profile.archetype || 'Balanced Hand Archetype';

    const archMottoElem = document.getElementById('res-archetype-motto');
    if (archMottoElem) archMottoElem.innerText = profile.motto ? `"${profile.motto}"` : '';

    const chipsContainer = document.getElementById('res-strengths-chips');
    if (chipsContainer) {
      chipsContainer.innerHTML = '';
      (profile.strengths || []).forEach(str => {
        const chip = document.createElement('span');
        chip.className = 'strength-chip';
        chip.innerText = `✦ ${str}`;
        chipsContainer.appendChild(chip);
      });
    }

    // 2. Harmony Score & Circular Gauge
    const harmonyVal = scores.overall_harmony || 85;
    const scoreNumElem = document.getElementById('res-overall-harmony');
    if (scoreNumElem) scoreNumElem.innerText = harmonyVal;

    const circleFill = document.getElementById('gauge-harmony-fill');
    if (circleFill) {
      const circumference = 264;
      circleFill.style.strokeDasharray = `${circumference} ${circumference}`;
      const offset = circumference - (circumference * harmonyVal / 100);
      circleFill.style.strokeDashoffset = offset;
    }

    // Mini metric bars
    setMetricBar('vitality', scores.vitality || 85);
    setMetricBar('intellect', scores.intellect || 90);
    setMetricBar('emotion', scores.heart_harmony || 82);
    setMetricBar('destiny', scores.destiny || 78);

    // 3. Line Reading Cards
    // Life Line
    if (lines.life) {
      setText('life-clarity', lines.life.clarity || 'Deep & Clear');
      setText('life-curvature', lineMetrics.Life?.metrics?.curvature || '1.18');
      setText('life-length', `${lineMetrics.Life?.metrics?.normalized_length || 82}%`);
      setText('life-score', `${lines.life.score || 90}/100`);
      setText('life-summary', lines.life.summary || lines.life.interpretation || '');
    }

    // Head Line
    if (lines.head) {
      setText('head-clarity', lines.head.clarity || 'Well-Defined');
      setText('head-slope', lines.head.slope_pattern ? lines.head.slope_pattern.split(' ')[0] : 'Gentle Slope');
      setText('head-curvature', lineMetrics.Head?.metrics?.curvature || '1.08');
      setText('head-score', `${lines.head.score || 88}/100`);
      setText('head-summary', lines.head.summary || lines.head.interpretation || '');
    }

    // Heart Line
    if (lines.heart) {
      setText('heart-clarity', lines.heart.clarity || 'Prominent');
      setText('heart-style', lines.heart.romantic_style ? lines.heart.romantic_style.split(',')[0] : 'Idealistic');
      setText('heart-curvature', lineMetrics.Heart?.metrics?.curvature || '1.15');
      setText('heart-score', `${lines.heart.score || 85}/100`);
      setText('heart-summary', lines.heart.summary || lines.heart.interpretation || '');
    }

    // Fate Line
    if (lines.fate) {
      setText('fate-clarity', lines.fate.clarity || 'Clear');
      setText('fate-vocation', lines.fate.vocation ? lines.fate.vocation.split(',')[0] : 'Autonomous');
      setText('fate-continuity', (lineMetrics.Fate?.metrics?.depth_score > 50) ? 'Continuous' : 'Dynamic');
      setText('fate-score', `${lines.fate.score || 78}/100`);
      setText('fate-summary', lines.fate.summary || lines.fate.interpretation || '');
    }

    // 4. Palm Mounts
    const mountsContainer = document.getElementById('mounts-list-container');
    if (mountsContainer) {
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
    }

    // 5. Auspicious Signs & Guidance
    const signsContainer = document.getElementById('signs-list-container');
    if (signsContainer) {
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
    }

    const guidanceList = document.getElementById('guidance-list');
    if (guidanceList) {
      guidanceList.innerHTML = '';
      (reading.mindful_guidance || []).forEach(g => {
        const li = document.createElement('li');
        li.innerText = g;
        guidanceList.appendChild(li);
      });
    }

    // Reset zoom and pan on new reading
    resetZoomAndPan();

    // 6. Update Visual Canvas and interactive SVG
    updateCanvasView(activeView);
    renderInteractiveSVG();

    // Smooth scroll down to results
    resultsDashboard.scrollIntoView({ behavior: 'smooth' });
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  }

  function setMetricBar(name, val) {
    const bar = document.getElementById(`bar-${name}`);
    const valEl = document.getElementById(`val-${name}`);
    if (bar) bar.style.width = `${val}%`;
    if (valEl) valEl.innerText = val;
  }

  // =========================================================================
  // 7. Interactive Vision Studio: Canvas & View Modes
  // =========================================================================
  function updateCanvasView(viewName) {
    activeView = viewName;
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });

    if (!currentAnalysis || !currentAnalysis.visualizations) return;
    const visuals = currentAnalysis.visualizations;

    if (viewName === 'split') {
      singleViewContainer.style.display = 'none';
      splitSliderContainer.style.display = 'block';
      svgOverlay.style.display = 'none';

      splitBeforeImg.src = visuals.roi;
      splitAfterImg.src = visuals.ridge_map;
      updateSplitSliderPosition(splitPercent);
      studioModeLabel.innerHTML = 'Mode: <strong>Before & After Crease Split Slider</strong> (Drag knob)';
    } else {
      splitSliderContainer.style.display = 'none';
      singleViewContainer.style.display = 'block';

      if (viewName === 'overlay') {
        activeVisualImg.src = visuals.overlay;
        svgOverlay.style.display = 'block';
        studioModeLabel.innerHTML = 'Mode: <strong>Full Overlay</strong> &bull; Interactive SVG active';
      } else if (viewName === 'ridge') {
        activeVisualImg.src = visuals.ridge_map;
        svgOverlay.style.display = 'none';
        studioModeLabel.innerHTML = 'Mode: <strong>Multi-Scale Frangi Crease Heatmap</strong>';
      } else if (viewName === 'blueprint') {
        activeVisualImg.src = visuals.blueprint;
        svgOverlay.style.display = 'none';
        studioModeLabel.innerHTML = 'Mode: <strong>Celestial Chiromancy Blueprint</strong>';
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
  // 8. Split Comparison Slider Dragging
  // =========================================================================
  function updateSplitSliderPosition(percent) {
    splitPercent = Math.max(0, Math.min(100, percent));
    if (splitOverlayWrapper) splitOverlayWrapper.style.width = `${splitPercent}%`;
    if (splitDividerHandle) splitDividerHandle.style.left = `${splitPercent}%`;
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
    if (e.touches && e.touches[0]) handleSplitDrag(e.touches[0].clientX);
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isDraggingSplit) return;
    if (e.touches && e.touches[0]) handleSplitDrag(e.touches[0].clientX);
  }, { passive: true });

  window.addEventListener('touchend', () => {
    isDraggingSplit = false;
  });

  // =========================================================================
  // 9. Zoom & Pan Engine
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
  // 10. Interactive SVG Overlays & Bi-Directional Hover Inspector
  // =========================================================================
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

  // Hook up hover & tap listeners on Reading Cards for Desktop & Mobile
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
    const heart = layerToggles.heart?.checked;
    const head = layerToggles.head?.checked;
    const life = layerToggles.life?.checked;
    const fate = layerToggles.fate?.checked;
    const mounts = layerToggles.mounts?.checked;

    const pathHeart = document.getElementById('svg-path-heart');
    const pathHead = document.getElementById('svg-path-head');
    const pathLife = document.getElementById('svg-path-life');
    const pathFate = document.getElementById('svg-path-fate');

    if (pathHeart) pathHeart.style.display = heart ? 'block' : 'none';
    if (pathHead) pathHead.style.display = head ? 'block' : 'none';
    if (pathLife) pathLife.style.display = life ? 'block' : 'none';
    if (pathFate) pathFate.style.display = fate ? 'block' : 'none';
    if (svgMountsGroup) svgMountsGroup.style.display = mounts ? 'block' : 'none';
  }

  Object.values(layerToggles).forEach(toggle => {
    if (toggle) toggle.addEventListener('change', applyLayerToggles);
  });

  // Canvas Tooltip Helpers
  function showTooltip(e, html) {
    if (!canvasTooltip) return;
    canvasTooltip.innerHTML = html;
    canvasTooltip.style.display = 'block';
    moveTooltip(e);
  }

  function moveTooltip(e) {
    if (!canvasTooltip) return;
    const rect = canvasViewport.getBoundingClientRect();
    const x = e.clientX - rect.left + 15;
    const y = e.clientY - rect.top + 15;
    canvasTooltip.style.left = `${x}px`;
    canvasTooltip.style.top = `${y}px`;
  }

  function hideTooltip() {
    if (canvasTooltip) canvasTooltip.style.display = 'none';
  }

  // =========================================================================
  // 11. Print & Reset Actions
  // =========================================================================
  if (btnPrintReport) {
    btnPrintReport.addEventListener('click', () => {
      window.print();
    });
  }

  if (btnReadAnother) {
    btnReadAnother.addEventListener('click', () => {
      document.getElementById('upload-hub-section').scrollIntoView({ behavior: 'smooth' });
    });
  }
});
