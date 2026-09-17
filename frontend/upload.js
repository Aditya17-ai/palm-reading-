/**
 * PALMISTRA AI - Dedicated Upload Photo Controller (upload.js)
 * High-precision photo upload, pre-processing transforms (rotate, flip, hand selection),
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
  const layerVisibility = {
    heart: true,
    head: true,
    life: true,
    fate: true,
    mounts: true
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

  function handleImageUrl(url, filename = 'archetype_palm.png') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImage = img;
      rotationAngle = 0;
      isFlippedH = false;

      metaFilename.innerText = filename;
      metaFilesize.innerText = 'Pre-rendered';

      renderTransformedImage();

      idleState.style.display = 'none';
      previewState.style.display = 'block';
    };
    img.src = url;
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

  // Clipboard paste listener (window-wide and button)
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
      alert('No image found in clipboard. Please copy an image first or press Ctrl+V directly.');
    } catch (err) {
      console.warn('Clipboard read error:', err);
      alert('Clipboard access requires permission or press Ctrl+V while on this page.');
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

  // Archetype preset buttons
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

  // Transform buttons
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
  // 5. API Call & Scanner Progress Modal
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
      scannerStatus.innerText = 'Synthesizing chiromancy reading & planetary mounts...';
    }, 1350);
  }

  function hideScanner() {
    scannerProgressFill.style.width = '100%';
    setTimeout(() => {
      scannerModal.style.display = 'none';
    }, 300);
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
        const err = await response.json();
        throw new Error(err.detail || 'Analysis request failed.');
      }

      const data = await response.json();
      currentAnalysis = data;
      hideScanner();
      renderDashboard(data);
    } catch (err) {
      hideScanner();
      alert(`Palm Analysis Error: ${err.message || err}`);
      console.error(err);
    }
  }

  async function analyzeSamplePreset(sampleId) {
    showScanner();
    try {
      const response = await fetch(`/api/analyze-sample/${sampleId}`, {
        method: 'POST'
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Sample analysis failed.');
      }

      const data = await response.json();
      currentAnalysis = data;
      hideScanner();
      renderDashboard(data);
    } catch (err) {
      hideScanner();
      alert(`Preset Load Error: ${err.message || err}`);
      console.error(err);
    }
  }

  // =========================================================================
  // 6. Interactive Results Dashboard Renderer
  // =========================================================================
  function renderDashboard(data) {
    const reading = data.reading;
    const elemental = reading.elemental_archetype;
    const lines = data.lines;
    const mounts = data.mounts;
    const visuals = data.visualizations;

    // 1. Reveal Dashboard & Scroll
    resultsDashboard.style.display = 'block';
    resultsDashboard.scrollIntoView({ behavior: 'smooth' });

    // 2. Populate Elemental Archetype Header
    const elementIcons = { Earth: '🌱', Air: '💨', Fire: '🔥', Water: '🌊' };
    document.getElementById('res-element-icon').innerText = elementIcons[elemental.element] || '✨';
    document.getElementById('res-archetype-title').innerText = `${elemental.archetype} (${elemental.element})`;
    document.getElementById('res-archetype-motto').innerText = `"${elemental.motto}"`;

    const strengthsContainer = document.getElementById('res-strengths-chips');
    strengthsContainer.innerHTML = '';
    elemental.strengths.forEach(str => {
      const chip = document.createElement('span');
      chip.className = 'strength-chip';
      chip.innerText = `✦ ${str}`;
      strengthsContainer.appendChild(chip);
    });

    // 3. Harmony Gauge Animation
    const harmonyScore = elemental.harmony_score || 88;
    animateHarmonyScore(harmonyScore);

    // Mini metric bars
    const scores = reading.destiny_overview.scores || {};
    animateMiniMetric('bar-vitality', 'val-vitality', scores.vitality || 85);
    animateMiniMetric('bar-intellect', 'val-intellect', scores.intellect || 90);
    animateMiniMetric('bar-emotion', 'val-emotion', scores.emotion || 82);
    animateMiniMetric('bar-destiny', 'val-destiny', scores.destiny || 78);

    // 4. Populate Line Interpretation Cards
    populateLineCard('life', reading.life_line, lines.life);
    populateLineCard('head', reading.head_line, lines.head);
    populateLineCard('heart', reading.heart_line, lines.heart);
    populateLineCard('fate', reading.fate_line, lines.fate);

    // 5. Populate Mounts Grid
    populateMounts(reading.mounts_analysis, mounts);

    // 6. Populate Auspicious Signs & Mindful Guidance
    populateSignsAndGuidance(reading.auspicious_signs, reading.guidance);

    // 7. Setup Interactive Studio Canvas
    setupStudioCanvas(visuals, lines, mounts);
  }

  function animateHarmonyScore(targetScore) {
    const scoreElem = document.getElementById('res-overall-harmony');
    const circleFill = document.getElementById('gauge-harmony-fill');
    
    // Circumference for r=42 is 2 * PI * 42 ≈ 263.89
    const circumference = 263.89;
    circleFill.style.strokeDasharray = `${circumference} ${circumference}`;
    circleFill.style.strokeDashoffset = `${circumference}`;

    let current = 0;
    const duration = 1200;
    const stepTime = 20;
    const steps = duration / stepTime;
    const increment = targetScore / steps;

    const timer = setInterval(() => {
      current += increment;
      if (current >= targetScore) {
        current = targetScore;
        clearInterval(timer);
      }
      scoreElem.innerText = Math.round(current);
      const offset = circumference - (current / 100) * circumference;
      circleFill.style.strokeDashoffset = offset;
    }, stepTime);
  }

  function animateMiniMetric(barId, valId, val) {
    const bar = document.getElementById(barId);
    const label = document.getElementById(valId);
    if (bar) bar.style.width = `${val}%`;
    if (label) label.innerText = val;
  }

  function populateLineCard(lineKey, lineData, cvLine) {
    if (!lineData) return;
    
    const summaryElem = document.getElementById(`${lineKey}-summary`);
    const clarityElem = document.getElementById(`${lineKey}-clarity`);
    if (summaryElem) summaryElem.innerText = lineData.summary || lineData.interpretation;
    if (clarityElem) clarityElem.innerText = lineData.clarity || 'Prominent';

    if (cvLine && cvLine.metrics) {
      const curElem = document.getElementById(`${lineKey}-curvature`);
      const lenElem = document.getElementById(`${lineKey}-length`);
      const scoreElem = document.getElementById(`${lineKey}-score`);
      if (curElem && cvLine.metrics.curvature) curElem.innerText = cvLine.metrics.curvature;
      if (lenElem && cvLine.metrics.length_ratio) lenElem.innerText = `${Math.round(cvLine.metrics.length_ratio * 100)}%`;
      if (scoreElem && lineData.prominence_score) scoreElem.innerText = `${lineData.prominence_score}/100`;
    }
  }

  function populateMounts(mountAnalysis, cvMounts) {
    const container = document.getElementById('mounts-list-container');
    container.innerHTML = '';

    const mountIcons = {
      jupiter: '⚡',
      saturn: '🪐',
      apollo: '☀️',
      mercury: '☿',
      venus: '🌸',
      luna: '🌙',
      mars: '⚔️'
    };

    for (const [key, info] of Object.entries(mountAnalysis)) {
      const card = document.createElement('div');
      card.className = 'mount-item';
      card.setAttribute('data-mount', key);

      const icon = mountIcons[key.toLowerCase()] || '🪐';
      card.innerHTML = `
        <div class="mount-item-top">
          <span class="mount-badge-icon">${icon}</span>
          <span class="mount-name">${info.mount || key}</span>
          <span class="mount-prominence">${info.prominence || 'Balanced'}</span>
        </div>
        <div class="mount-meaning">${info.meaning || ''}</div>
        <p class="mount-desc">${info.interpretation || info.energy_manifestation || ''}</p>
      `;
      container.appendChild(card);
    }
  }

  function populateSignsAndGuidance(signs, guidance) {
    const signsContainer = document.getElementById('signs-list-container');
    signsContainer.innerHTML = '';
    (signs || []).forEach(s => {
      const item = document.createElement('div');
      item.className = 'sign-badge';
      item.innerHTML = `
        <span class="sign-glyph">✦</span>
        <div>
          <div class="sign-title">${s.sign || s.name} (${s.location || 'Palm'})</div>
          <div class="sign-desc">${s.interpretation || s.meaning}</div>
        </div>
      `;
      signsContainer.appendChild(item);
    });

    const guidanceList = document.getElementById('guidance-list');
    guidanceList.innerHTML = '';
    (guidance || []).forEach(g => {
      const li = document.createElement('li');
      li.innerText = g;
      guidanceList.appendChild(li);
    });
  }

  // =========================================================================
  // 7. Interactive Vision Studio Canvas, SVG Overlay & Split Slider
  // =========================================================================
  function setupStudioCanvas(visuals, lines, mounts) {
    // Reset Zoom & Pan
    resetZoomPan();

    // Set initial visual image
    activeVisualImg.src = visuals.overlay;
    splitBeforeImg.src = visuals.roi;
    splitAfterImg.src = visuals.ridge_map;

    // Build SVG Overlay
    renderSvgOverlay(lines, mounts);

    // Setup Split Comparison Slider
    initSplitSlider();

    // Activate default 'overlay' view
    switchStudioView('overlay');
  }

  function renderSvgOverlay(lines, mounts) {
    svgLinesGroup.innerHTML = '';
    svgMountsGroup.innerHTML = '';

    const lineColors = {
      heart: '#f43f5e',
      head: '#0ea5e9',
      life: '#10b981',
      fate: '#f59e0b'
    };

    // Draw Destiny Lines
    for (const [name, data] of Object.entries(lines)) {
      const pts = data.points;
      if (!pts || pts.length < 2) continue;

      let d = `M ${pts[0][0]} ${pts[0][1]}`;
      for (let i = 1; i < pts.length; i++) {
        d += ` L ${pts[i][0]} ${pts[i][1]}`;
      }

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', lineColors[name] || '#8b5cf6');
      path.setAttribute('stroke-width', '4');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('class', `svg-line-path path-${name}`);
      path.setAttribute('filter', `url(#glow-${name})`);
      path.setAttribute('data-line', name);

      // Mouse events for tooltips and card highlighting
      path.addEventListener('mouseenter', (e) => handleLineHover(name, e));
      path.addEventListener('mouseleave', () => handleLineLeave(name));

      svgLinesGroup.appendChild(path);
    }

    // Draw Mount Markers
    for (const [k, v] of Object.entries(mounts)) {
      const cx = v.pos[0];
      const cy = v.pos[1];
      const r = v.radius || 24;

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', r);
      circle.setAttribute('fill', 'rgba(168, 85, 247, 0.12)');
      circle.setAttribute('stroke', 'rgba(168, 85, 247, 0.55)');
      circle.setAttribute('stroke-width', '1.5');
      circle.setAttribute('stroke-dasharray', '3 3');
      circle.setAttribute('class', 'svg-mount-circle');
      circle.setAttribute('data-mount', k);

      circle.addEventListener('mouseenter', (e) => {
        showCanvasTooltip(`<strong>${v.name}</strong><br>${v.meaning}`, e);
        circle.setAttribute('stroke', '#fde68a');
        circle.setAttribute('fill', 'rgba(245, 158, 11, 0.25)');
      });

      circle.addEventListener('mouseleave', () => {
        hideCanvasTooltip();
        circle.setAttribute('stroke', 'rgba(168, 85, 247, 0.55)');
        circle.setAttribute('fill', 'rgba(168, 85, 247, 0.12)');
      });

      svgMountsGroup.appendChild(circle);
    }
  }

  function handleLineHover(lineKey, e) {
    // 1. Dim other lines on SVG
    document.querySelectorAll('.svg-line-path').forEach(p => {
      if (p.getAttribute('data-line') === lineKey) {
        p.classList.add('highlighted');
      } else {
        p.classList.add('dimmed');
      }
    });

    // 2. Highlight matching reading card
    const card = document.getElementById(`card-line-${lineKey}`);
    if (card) {
      card.classList.add('card-glow-active');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // 3. Show tooltip
    const lineTitles = {
      heart: 'Heart Line (Emotions & Love)',
      head: 'Head Line (Intellect & Wisdom)',
      life: 'Life Line (Vitality & Path)',
      fate: 'Fate Line (Destiny & Vocation)'
    };
    showCanvasTooltip(`✦ <strong>${lineTitles[lineKey] || lineKey}</strong>`, e);
  }

  function handleLineLeave(lineKey) {
    document.querySelectorAll('.svg-line-path').forEach(p => {
      p.classList.remove('highlighted', 'dimmed');
    });

    const card = document.getElementById(`card-line-${lineKey}`);
    if (card) card.classList.remove('card-glow-active');

    hideCanvasTooltip();
  }

  // Bi-directional card hover: hovering a card highlights line on SVG
  document.querySelectorAll('.interactive-reading-card').forEach(card => {
    const lineKey = card.getAttribute('data-line');
    card.addEventListener('mouseenter', () => {
      document.querySelectorAll('.svg-line-path').forEach(p => {
        if (p.getAttribute('data-line') === lineKey) {
          p.classList.add('highlighted');
        } else {
          p.classList.add('dimmed');
        }
      });
    });

    card.addEventListener('mouseleave', () => {
      document.querySelectorAll('.svg-line-path').forEach(p => {
        p.classList.remove('highlighted', 'dimmed');
      });
    });
  });

  function showCanvasTooltip(html, e) {
    if (!canvasTooltip) return;
    canvasTooltip.innerHTML = html;
    canvasTooltip.style.display = 'block';

    const rect = canvasViewport.getBoundingClientRect();
    const x = e.clientX - rect.left + 14;
    const y = e.clientY - rect.top + 14;
    canvasTooltip.style.left = `${x}px`;
    canvasTooltip.style.top = `${y}px`;
  }

  function hideCanvasTooltip() {
    if (canvasTooltip) canvasTooltip.style.display = 'none';
  }

  // =========================================================================
  // 8. View Switcher (Overlay, Ridge Map, Blueprint, Raw ROI, Split Slider)
  // =========================================================================
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const viewMode = btn.getAttribute('data-view');
      switchStudioView(viewMode);
    });
  });

  function switchStudioView(mode) {
    activeView = mode;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.view-btn[data-view="${mode}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    if (!currentAnalysis) return;
    const visuals = currentAnalysis.visualizations;

    if (mode === 'split') {
      singleViewContainer.style.display = 'none';
      splitSliderContainer.style.display = 'block';
      svgOverlay.style.display = 'none';
      studioModeLabel.innerText = 'Mode: Before & After Crease Split Slider (Drag knob)';
    } else {
      splitSliderContainer.style.display = 'none';
      singleViewContainer.style.display = 'block';

      if (mode === 'overlay') {
        activeVisualImg.src = visuals.overlay;
        svgOverlay.style.display = 'block';
        studioModeLabel.innerText = 'Mode: Full Overlay • Interactive SVG active';
      } else if (mode === 'ridge') {
        activeVisualImg.src = visuals.ridge_map;
        svgOverlay.style.display = 'none';
        studioModeLabel.innerText = 'Mode: Multi-Scale Frangi Crease Heatmap';
      } else if (mode === 'blueprint') {
        activeVisualImg.src = visuals.blueprint;
        svgOverlay.style.display = 'none';
        studioModeLabel.innerText = 'Mode: Celestial Chiromancy Blueprint';
      } else if (mode === 'roi') {
        activeVisualImg.src = visuals.roi;
        svgOverlay.style.display = 'none';
        studioModeLabel.innerText = 'Mode: Raw Palm Region of Interest (ROI)';
      }
    }
  }

  // =========================================================================
  // 9. Split Comparison Slider Dragging
  // =========================================================================
  function initSplitSlider() {
    splitPercent = 50;
    updateSplitPosition();

    splitDividerHandle.addEventListener('mousedown', startSplitDrag);
    splitDividerHandle.addEventListener('touchstart', startSplitDrag, { passive: true });

    window.addEventListener('mousemove', onSplitDrag);
    window.addEventListener('touchmove', onSplitDrag, { passive: true });

    window.addEventListener('mouseup', stopSplitDrag);
    window.addEventListener('touchend', stopSplitDrag);
  }

  function startSplitDrag(e) {
    isDraggingSplit = true;
  }

  function onSplitDrag(e) {
    if (!isDraggingSplit) return;
    const rect = splitSliderContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let offset = clientX - rect.left;
    offset = Math.max(0, Math.min(offset, rect.width));
    splitPercent = (offset / rect.width) * 100;
    updateSplitPosition();
  }

  function stopSplitDrag() {
    isDraggingSplit = false;
  }

  function updateSplitPosition() {
    if (!splitOverlayWrapper || !splitDividerHandle) return;
    splitOverlayWrapper.style.width = `${splitPercent}%`;
    splitDividerHandle.style.left = `${splitPercent}%`;
  }

  // =========================================================================
  // 10. Zoom & Pan Viewport
  // =========================================================================
  function updateTransform() {
    canvasTransformWrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    zoomLevelText.innerText = `${Math.round(zoomLevel * 100)}%`;
  }

  function resetZoomPan() {
    zoomLevel = 1.0;
    panX = 0;
    panY = 0;
    updateTransform();
  }

  btnZoomIn.addEventListener('click', () => {
    zoomLevel = Math.min(3.0, zoomLevel + 0.25);
    updateTransform();
  });

  btnZoomOut.addEventListener('click', () => {
    zoomLevel = Math.max(0.75, zoomLevel - 0.25);
    updateTransform();
  });

  btnZoomReset.addEventListener('click', resetZoomPan);

  // Pan with mouse dragging when zoomed in
  canvasViewport.addEventListener('mousedown', (e) => {
    if (e.target.closest('#split-divider-handle')) return;
    isPanning = true;
    startPanX = e.clientX - panX;
    startPanY = e.clientY - panY;
    canvasViewport.style.cursor = 'grabbing';
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
      canvasViewport.style.cursor = 'grab';
    }
  });

  // =========================================================================
  // 11. Layer Visibility Filters
  // =========================================================================
  const toggleHeart = document.getElementById('toggle-heart');
  const toggleHead = document.getElementById('toggle-head');
  const toggleLife = document.getElementById('toggle-life');
  const toggleFate = document.getElementById('toggle-fate');
  const toggleMounts = document.getElementById('toggle-mounts');

  function updateLayerVisibility() {
    const heartPath = document.querySelector('.path-heart');
    const headPath = document.querySelector('.path-head');
    const lifePath = document.querySelector('.path-life');
    const fatePath = document.querySelector('.path-fate');

    if (heartPath) heartPath.style.display = toggleHeart.checked ? 'block' : 'none';
    if (headPath) headPath.style.display = toggleHead.checked ? 'block' : 'none';
    if (lifePath) lifePath.style.display = toggleLife.checked ? 'block' : 'none';
    if (fatePath) fatePath.style.display = toggleFate.checked ? 'block' : 'none';
    if (svgMountsGroup) svgMountsGroup.style.display = toggleMounts.checked ? 'block' : 'none';
  }

  [toggleHeart, toggleHead, toggleLife, toggleFate, toggleMounts].forEach(toggle => {
    if (toggle) toggle.addEventListener('change', updateLayerVisibility);
  });

  // =========================================================================
  // 12. Print & Reset Actions
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
