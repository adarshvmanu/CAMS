/**
 * CAMS STUDIO v3.0 — HIGH-PERFORMANCE TELEMETRY & MOTION ENGINE
 * Apple HIG / Linear Swiss Architecture · Two-Speed Telemetry · 60/120fps rAF · 4Hz Tabular Throttle
 */

// ============================================================================
// 1. SESSION CONFIGURATION & BOOT MANAGEMENT (NO HARDCODED VALUES)
// ============================================================================

const SESSION_STORAGE_KEY = 'cams_session_config';

let sessionConfig = {
  className: '',
  room: '',
  instructor: '',
  topic: '',
  startTime: Date.now()
};

let bootloaderRunning = false;
let bootAnimationId = null;

function runBootloaderSequence(force = false) {
  const overlay = document.getElementById('bootloader-overlay');
  if (!overlay) return;

  const alreadyShown = sessionStorage.getItem('cams_bootloader_completed');
  if (alreadyShown && !force) {
    overlay.classList.add('dismissed');
    return;
  }

  overlay.classList.remove('dismissed');
  bootloaderRunning = true;

  const topPath = document.getElementById('eyelid-top-path');
  const botPath = document.getElementById('eyelid-bottom-path');
  const clipShape = document.getElementById('eye-clip-shape');
  const radarLine = document.getElementById('radar-sweep-line');
  const progressBar = document.getElementById('boot-progress-bar');
  const logText = document.getElementById('boot-log-text');
  const pupil = document.getElementById('boot-pupil');
  const constellation = document.getElementById('constellation-group');

  const BOOT_DURATION = 900; // Snappy, clean system wake sequence
  const startTime = performance.now();

  const bootStages = [
    { p: 0.25, text: 'Connecting to Local Telemetry Stream & Camera...' },
    { p: 0.55, text: 'Initializing MediaPipe 3D Mesh & Head-Pose Engine...' },
    { p: 0.85, text: 'Synchronizing Real-Time Biometric Buffer...' },
    { p: 1.00, text: 'Optical Telemetry Stream Active · Launching Studio' }
  ];

  function animateBoot(now) {
    if (!bootloaderRunning) return;

    const elapsed = now - startTime;
    const progress = Math.min(1.0, elapsed / BOOT_DURATION);

    // Easing for eye opening: starts closed (Y=70), smoothly curves open (Y=20 for top, Y=120 for bottom)
    const eyeOpenFactor = Math.min(1.0, Math.max(0, (progress - 0.10) / 0.72));
    const easedOpen = 1 - Math.pow(1 - eyeOpenFactor, 3); // cubic ease-out

    const topY = 70 - easedOpen * 50;  // 70 -> 20
    const botY = 70 + easedOpen * 50;  // 70 -> 120

    if (topPath) topPath.setAttribute('d', `M 20,70 Q 120,${topY.toFixed(1)} 220,70`);
    if (botPath) botPath.setAttribute('d', `M 20,70 Q 120,${botY.toFixed(1)} 220,70`);
    if (clipShape) {
      clipShape.setAttribute('d', `M 20,70 Q 120,${topY.toFixed(1)} 220,70 Q 120,${botY.toFixed(1)} 20,70 Z`);
    }

    // Rotate Radar Line inside iris
    if (radarLine) {
      const angle = (now * 0.45) % 360;
      const rad = (angle * Math.PI) / 180;
      const rx = 120 + 32 * Math.cos(rad);
      const ry = 70 + 32 * Math.sin(rad);
      radarLine.setAttribute('x2', rx.toFixed(1));
      radarLine.setAttribute('y2', ry.toFixed(1));
    }

    // Subtle pupil dilation
    if (pupil) {
      const pupilR = 9 + Math.sin(now * 0.008) * 1.5 + (easedOpen * 1.5);
      pupil.setAttribute('r', pupilR.toFixed(1));
    }

    // Constellation mesh pulse
    if (constellation) {
      constellation.style.opacity = (0.2 + easedOpen * 0.75).toFixed(2);
    }

    // Progress bar and stage logs
    if (progressBar) {
      progressBar.style.width = `${(progress * 100).toFixed(0)}%`;
    }

    if (logText) {
      for (const stage of bootStages) {
        if (progress <= stage.p) {
          logText.textContent = stage.text;
          break;
        }
      }
    }

    if (progress < 1.0) {
      bootAnimationId = requestAnimationFrame(animateBoot);
    } else {
      finishBootloader();
    }
  }

  function finishBootloader() {
    bootloaderRunning = false;
    if (logText) logText.textContent = 'TELEMETRY ENGINE READY · LAUNCHING STUDIO';
    if (progressBar) progressBar.style.width = '100%';

    setTimeout(() => {
      overlay.classList.add('dismissed');
      sessionStorage.setItem('cams_bootloader_completed', 'true');
    }, 250);
  }

  window.skipBootloader = finishBootloader;

  const btnSkip = document.getElementById('btn-skip-boot');
  if (btnSkip) {
    btnSkip.onclick = finishBootloader;
  }

  bootAnimationId = requestAnimationFrame(animateBoot);
}

function loadSessionConfig() {
  try {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (saved) {
      sessionConfig = JSON.parse(saved);
      if (!sessionConfig.startTime) sessionConfig.startTime = Date.now();
      applySessionConfig();
      return true;
    }
  } catch (err) {
    console.error('Failed to load session config:', err);
  }
  return false;
}

function saveSessionConfig(config) {
  sessionConfig = { ...sessionConfig, ...config };
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionConfig));
  } catch (err) {
    console.error('Failed to save session config:', err);
  }
  applySessionConfig();
}

function applySessionConfig() {
  const courseEl = document.getElementById('breadcrumb-course');
  const roomEl = document.getElementById('breadcrumb-room');

  if (courseEl) courseEl.textContent = sessionConfig.className || 'Class Session';
  if (roomEl) roomEl.textContent = sessionConfig.room ? `· ${sessionConfig.room}` : '· Optical Studio';

  updateSessionStatusFooter();
}

function openSessionModal(isEdit = false) {
  const backdrop = document.getElementById('session-modal-backdrop');
  const btnCancel = document.getElementById('btn-modal-cancel');
  const inputClass = document.getElementById('input-class-name');
  const inputRoom = document.getElementById('input-room');
  const inputInstructor = document.getElementById('input-instructor');

  if (!backdrop) return;

  if (inputClass) inputClass.value = sessionConfig.className || '';
  if (inputRoom) inputRoom.value = sessionConfig.room || '';
  if (inputInstructor) inputInstructor.value = sessionConfig.instructor || '';

  if (btnCancel) {
    btnCancel.style.display = isEdit ? 'inline-block' : 'none';
  }

  backdrop.classList.add('show');
}

function closeSessionModal() {
  const backdrop = document.getElementById('session-modal-backdrop');
  if (backdrop) backdrop.classList.remove('show');
}

function initSessionSetup() {
  const hasConfig = loadSessionConfig();

  // If no session config exists, prompt user after boot sequence completes
  if (!hasConfig || !sessionConfig.className) {
    setTimeout(() => openSessionModal(false), 1750);
  }

  // Edit button in header
  const btnEdit = document.getElementById('btn-edit-session');
  if (btnEdit) {
    btnEdit.addEventListener('click', () => openSessionModal(true));
  }

  // Click on Brand Emblem replays the awakening eye bootloader sequence
  const brandBtn = document.getElementById('brand-emblem-btn');
  if (brandBtn) {
    brandBtn.addEventListener('click', () => runBootloaderSequence(true));
  }

  // Cancel button
  const btnCancel = document.getElementById('btn-modal-cancel');
  if (btnCancel) {
    btnCancel.addEventListener('click', closeSessionModal);
  }

  // Form submit
  const form = document.getElementById('session-config-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const className = document.getElementById('input-class-name')?.value.trim() || 'Class Session';
      const room = document.getElementById('input-room')?.value.trim() || 'Classroom';
      const instructor = document.getElementById('input-instructor')?.value.trim() || '';

      saveSessionConfig({
        className,
        room,
        instructor,
        startTime: sessionConfig.startTime || Date.now()
      });

      closeSessionModal();
      showToast(`Session Initialized: ${className}`);
      logIncident(`Session initialized: ${className} (${room})`, 'blue', instructor ? `Lead: ${instructor}` : '');
    });
  }
}

// Real telemetry session elapsed time & frames counter
function updateSessionStatusFooter() {
  const start = sessionConfig.startTime || Date.now();
  const diffSec = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const hrs = String(Math.floor(diffSec / 3600)).padStart(2, '0');
  const mins = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
  const secs = String(diffSec % 60).padStart(2, '0');

  const elapsedEl = document.getElementById('timeline-session-elapsed');
  const framesEl = document.getElementById('timeline-frame-counter');

  if (elapsedEl) elapsedEl.textContent = `${hrs}:${mins}:${secs}`;
  if (framesEl) framesEl.textContent = String(engine.frameCount);
}

// ============================================================================
// 2. TELEMETRY & SPATIAL ENGINE DEFINITIONS
// ============================================================================

const MAX_HISTORY_POINTS = 100;
let sessionLogs = [];
let prevStudentStates = {};
let lastStateChangeTimes = {};
let maxSessionStudents = 0;
let selectedStudentId = 1;
let deskExerciseMode = false;
let deskExerciseTimeout = null;

// Layer toggles
const layerState = {
  reticle: true,
  gizmo: true,
  mesh: false,
  blur: false
};

// Retina Canvas Configurator
function configureRetinaCanvas(canvas, cssWidth, cssHeight) {
  const dpr = window.devicePixelRatio || 1;
  const targetW = Math.round(cssWidth * dpr);
  const targetH = Math.round(cssHeight * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

// 3D Axial Head-Pose Wireframe Sphere
function draw3DPoseSphere(ctx, yawDeg, pitchDeg, isAlert = false, rollDeg = 0) {
  const W = 68;
  const H = 68;
  const cx = W / 2;
  const cy = H / 2;
  const r = 26;

  ctx.clearRect(0, 0, W, H);

  // 1. Outer Wireframe Sphere
  ctx.strokeStyle = 'rgba(161, 161, 170, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // 2. Equator & Meridian Ellipses with 3D Roll Rotation
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rollDeg * Math.PI) / 180);

  ctx.strokeStyle = 'rgba(161, 161, 170, 0.32)';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, 9, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, 0, 9, r, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 3. Project 3D Head Normal Vector from Yaw & Pitch
  const radYaw = (yawDeg * Math.PI) / 180;
  const radPitch = (-pitchDeg * Math.PI) / 180;
  const vx = cx + r * Math.sin(radYaw) * Math.cos(radPitch);
  const vy = cy + r * Math.sin(radPitch);

  const vecColor = isAlert ? '#FF9F0A' : '#30D158';

  ctx.strokeStyle = vecColor;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(vx, vy);
  ctx.stroke();

  // 4. Vector Tip & Origin Anchor
  ctx.fillStyle = vecColor;
  ctx.beginPath();
  ctx.arc(vx, vy, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx, cy, 2.0, 0, Math.PI * 2);
  ctx.fill();
}

// High-DPI Video Reticle & Face HUD Overlay
const lerpedReticle = { x: 0, y: 0, w: 0, h: 0, opacity: 0, initialized: false };

function renderVideoReticleCanvas() {
  const canvas = document.getElementById('video-reticle-canvas');
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const ctx = configureRetinaCanvas(canvas, rect.width, rect.height);
  if (!ctx) return;
  ctx.clearRect(0, 0, rect.width, rect.height);

  if (!layerState.reticle) return;

  const students = engine.target.students || [];
  if (students.length === 0) {
    lerpedReticle.opacity += (0 - lerpedReticle.opacity) * 0.15;
    return;
  }

  const primary = students.find(s => s.id === selectedStudentId) || students[0];
  if (!primary) return;

  const rawBbox = primary.bbox && primary.bbox.length === 4 ? primary.bbox : [0.30, 0.20, 0.40, 0.55];
  const targetX = rawBbox[0] * rect.width;
  const targetY = rawBbox[1] * rect.height;
  const targetW = rawBbox[2] * rect.width;
  const targetH = rawBbox[3] * rect.height;

  if (!lerpedReticle.initialized) {
    lerpedReticle.x = targetX;
    lerpedReticle.y = targetY;
    lerpedReticle.w = targetW;
    lerpedReticle.h = targetH;
    lerpedReticle.opacity = 1.0;
    lerpedReticle.initialized = true;
  } else {
    const alpha = 0.22;
    lerpedReticle.x += (targetX - lerpedReticle.x) * alpha;
    lerpedReticle.y += (targetY - lerpedReticle.y) * alpha;
    lerpedReticle.w += (targetW - lerpedReticle.w) * alpha;
    lerpedReticle.h += (targetH - lerpedReticle.h) * alpha;
    lerpedReticle.opacity += (1.0 - lerpedReticle.opacity) * 0.15;
  }

  const { x, y, w, h } = lerpedReticle;
  if (w <= 12 || h <= 12) return;

  ctx.save();
  ctx.globalAlpha = Math.min(1.0, Math.max(0.0, lerpedReticle.opacity));

  const isAlert = primary.mar > 0.60 || primary.ear < 0.20;
  const isWarn = primary.status !== 'Attentive';
  const bracketColor = isAlert ? '#FF3B30' : (isWarn ? '#FF9F0A' : 'rgba(255, 255, 255, 0.95)');

  // 1. Sleek 1px rounded boundary box
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  // 2. Corner brackets (22px length, 2.5px thickness)
  const len = Math.min(22, w * 0.25, h * 0.25);
  ctx.strokeStyle = bracketColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';

  // Top-Left
  ctx.beginPath();
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);
  ctx.stroke();

  // Top-Right
  ctx.beginPath();
  ctx.moveTo(x + w - len, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + len);
  ctx.stroke();

  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(x, y + h - len);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + len, y + h);
  ctx.stroke();

  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(x + w - len, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - len);
  ctx.stroke();

  // 3. Floating Frosted Pill Above Face (Apple visionOS / Linear style)
  let statusTag = primary.status || 'Attentive';
  if (primary.mar > 0.60) {
    statusTag = `Yawn Hold ${(engine.gateHoldMs / 1000).toFixed(1)}s`;
  } else if (primary.ear < 0.20) {
    statusTag = `Drowsy Hold ${(engine.gateHoldMs / 1000).toFixed(1)}s`;
  }
  const scoreVal = Number(primary.score || 82).toFixed(0);
  const pillText = `0${primary.id} · ${scoreVal}% · ${statusTag}`;

  ctx.font = '600 11px "JetBrains Mono", Menlo, monospace';
  const tm = ctx.measureText(pillText);
  const pillW = tm.width + 24;
  const pillH = 22;
  const pillX = x + (w - pillW) / 2;
  const pillY = Math.max(12, y - pillH - 8);

  // Pill Glass Base
  ctx.fillStyle = 'rgba(24, 24, 27, 0.88)';
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 9999);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Indicator Dot inside Pill
  ctx.fillStyle = bracketColor;
  ctx.beginPath();
  ctx.arc(pillX + 10, pillY + pillH / 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Text inside Pill
  ctx.fillStyle = '#FAFAFA';
  ctx.fillText(pillText, pillX + 18, pillY + 15);

  ctx.restore();
}

// Inline 5-Second Biometric Waveform Sparkline
function drawStudentSparkline(ctx, samples, isThresholdExceeded) {
  const W = 130;
  const H = 22;
  ctx.clearRect(0, 0, W, H);
  if (!samples || samples.length < 2) return;

  ctx.strokeStyle = isThresholdExceeded ? '#FF3B30' : '#18181B';
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.beginPath();

  const len = samples.length;
  for (let i = 0; i < len; i++) {
    const px = 2 + (i / (len - 1)) * (W - 4);
    const clamped = Math.min(1, Math.max(0, samples[i]));
    const py = H - 3 - clamped * (H - 6);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

// ============================================================================
// 3. TWO-SPEED TELEMETRY ENGINE (60FPS rAF + 4HZ TABULAR THROTTLE)
// ============================================================================

class TwoSpeedTelemetryEngine {
  constructor() {
    this.target = {
      focus: 0,
      facing: 0,
      ear: 0.28,
      mar: 0.08,
      yaw: 0,
      pitch: 0,
      roll: 0,
      drowsyPct: 0,
      yawnPct: 0,
      activeCount: 0,
      attentiveCount: 0,
      students: []
    };

    this.current = { ...this.target };
    this.gateHoldMs = 0;
    this.sumFocus = 0;
    this.frameCount = 0;
    this.sessionMean = 0;
    this.hasReceivedData = false;

    // Per-student waveform buffer
    this.studentSparklines = {};
    this.studentGateMs = {};

    this.lastFrameTime = performance.now();
    this.fpsEstimate = 30.0;
    this.fpsFrameCounter = 0;
    this.fpsTimer = performance.now();
  }

  ingestPacket(packet) {
    const chart = packet.chart || packet;
    const students = chart.students || [];

    const focusVal = Number(chart.overall_score ?? packet.classAttention ?? 0);
    const rawFacing = Number(chart.facing_classroom ?? packet.facingBoardPct ?? 0);
    if (this.smoothedFacing === undefined) this.smoothedFacing = rawFacing;
    this.smoothedFacing = this.smoothedFacing * 0.70 + rawFacing * 0.30;
    const facingVal = this.smoothedFacing;
    const countVal = Number(chart.count ?? packet.totalStudents ?? students.length);
    const attentiveVal = Number(chart.attention_count ?? packet.attentiveCount ?? 0);
    const sleepVal = Number(chart.sleep_detected ?? packet.drowsyPct ?? 0);
    const yawnVal = Number(chart.yawn_detected ?? packet.yawnPct ?? 0);

    this.target.focus = focusVal;
    this.target.facing = facingVal;
    this.target.activeCount = countVal;
    this.target.attentiveCount = attentiveVal;
    this.target.drowsyPct = sleepVal;
    this.target.yawnPct = yawnVal;
    this.target.students = students;

    this.hasReceivedData = true;

    // Cumulative Session Mean (only if count > 0)
    if (countVal > 0) {
      this.sumFocus += focusVal;
      this.frameCount += 1;
      this.sessionMean = this.frameCount > 0 ? (this.sumFocus / this.frameCount) : focusVal;
    }

    // Find selected or primary student
    let primary = students.find(s => s.id === selectedStudentId);
    if (!primary && students.length > 0) {
      primary = students[0];
      selectedStudentId = primary.id;
    }

    if (primary) {
      this.target.ear = Number(primary.ear ?? 0.28);
      this.target.mar = Number(primary.mar ?? 0.08);
      this.target.yaw = Number(primary.yaw ?? 0);
      this.target.pitch = Number(primary.pitch ?? 0);
      this.target.roll = Number(primary.roll ?? 0);
    } else {
      this.target.ear = 0.28;
      this.target.mar = 0.08;
      this.target.yaw = 0;
      this.target.pitch = 0;
      this.target.roll = 0;
    }

    // Update Sparklines for each student
    students.forEach(s => {
      if (!this.studentSparklines[s.id]) {
        this.studentSparklines[s.id] = new Array(25).fill(Number(s.mar || 0.08));
      }
      const buffer = this.studentSparklines[s.id];
      const normVal = Math.min(1.0, (Number(s.mar || 0.08)) / 0.80);
      buffer.push(normVal);
      if (buffer.length > 80) buffer.shift();
    });

    // Clean departed students
    const activeIds = new Set(students.map(s => s.id));
    Object.keys(this.studentSparklines).forEach(idStr => {
      const id = parseInt(idStr, 10);
      if (!activeIds.has(id)) {
        delete this.studentSparklines[id];
        delete this.studentGateMs[id];
      }
    });

    // FPS estimation
    if (chart.fps) {
      this.fpsEstimate = Number(chart.fps);
    } else {
      this.fpsFrameCounter++;
      const now = performance.now();
      if (now - this.fpsTimer >= 1000) {
        this.fpsEstimate = Math.min(30.0, Math.max(10.0, (this.fpsFrameCounter * 1000) / (now - this.fpsTimer)));
        this.fpsFrameCounter = 0;
        this.fpsTimer = now;
      }
    }
  }

  stepAnimation(now) {
    const dt = Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    const decay = 1 - Math.exp(-14 * dt);

    this.current.focus += (this.target.focus - this.current.focus) * decay;
    this.current.facing += (this.target.facing - this.current.facing) * decay;
    this.current.ear += (this.target.ear - this.current.ear) * decay;
    this.current.mar += (this.target.mar - this.current.mar) * decay;
    this.current.yaw += (this.target.yaw - this.current.yaw) * decay;
    this.current.pitch += (this.target.pitch - this.current.pitch) * decay;

    // Hysteresis Gate Hold Timer (0ms -> 2000ms)
    const isGateActive =
      this.target.students.length > 0 &&
      (this.target.mar > 0.60 ||
       this.target.ear < 0.20 ||
       (this.target.pitch < -15 && !deskExerciseMode));

    if (isGateActive) {
      this.gateHoldMs = Math.min(2000, this.gateHoldMs + dt * 1000);
    } else {
      this.gateHoldMs = Math.max(0, this.gateHoldMs - dt * 1500);
    }

    return {
      current: this.current,
      target: this.target,
      sessionMean: this.sessionMean,
      gateProgress: this.gateHoldMs / 2000,
      gateSeconds: this.gateHoldMs / 1000,
      fps: this.fpsEstimate,
      hasData: this.hasReceivedData
    };
  }
}

const engine = new TwoSpeedTelemetryEngine();

// ============================================================================
// 4. CHART.JS CUBIC-BEZIER STREAM ENGINE
// ============================================================================

let chartInstance = null;
let modalChartInstance = null;

// Master telemetry archive for entire lecture session (supports deep-dive crop & zoom across all session frames)
const masterTelemetryStream = {
  labels: [],
  focus: [],
  mean: [],
  facing: [],
  fatigue: [],
  frames: []
};

// Interactive Chart Zoom & Deep Insight State
const chartZoomState = {
  isZoomed: false,
  startIndex: 0,
  endIndex: 0,
  bufferedCount: 0,
  activeFilter: 'all',
  sliceStats: null
};

const chartHistory = {
  labels: [],
  focus: [],
  mean: [],
  facing: [],
  fatigue: []
};

function initMasterChart() {
  const canvas = document.getElementById('master-chart-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartHistory.labels,
      datasets: [
        {
          label: 'Live Focus %',
          data: chartHistory.focus,
          borderColor: '#18181B',
          borderWidth: 2.2,
          backgroundColor: 'rgba(24, 24, 27, 0.04)',
          fill: true,
          tension: 0.28,
          pointRadius: (context) => {
            if (chartZoomState.isZoomed) return 4;
            return context.dataIndex === context.dataset.data.length - 1 ? 4 : 0;
          },
          pointHoverRadius: 7,
          pointBackgroundColor: '#18181B',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 1.8
        },
        {
          label: 'Session Mean %',
          data: chartHistory.mean,
          borderColor: '#A1A1AA',
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false,
          tension: 0.1
        },
        {
          label: 'Board Alignment %',
          data: chartHistory.facing,
          borderColor: '#0071E3',
          borderWidth: 1.6,
          pointRadius: (context) => (chartZoomState.isZoomed ? 3 : 0),
          pointHoverRadius: 6,
          pointBackgroundColor: '#0071E3',
          fill: false,
          tension: 0.28
        },
        {
          label: 'MAR / Fatigue %',
          data: chartHistory.fatigue,
          borderColor: '#FF3B30',
          borderWidth: 1.5,
          pointRadius: (context) => (chartZoomState.isZoomed ? 3 : 0),
          pointHoverRadius: 6,
          pointBackgroundColor: '#FF3B30',
          fill: false,
          tension: 0.28
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      onHover: (event, chartElements) => {
        if (chartElements && chartElements.length > 0) {
          const idx = chartElements[0].index;
          if (chartInstance && chartInstance.data && chartInstance.data.datasets) {
            const fVal = chartInstance.data.datasets[0].data[idx];
            const mVal = chartInstance.data.datasets[1].data[idx];
            const gVal = chartInstance.data.datasets[2].data[idx];
            const fatVal = chartInstance.data.datasets[3].data[idx];

            const legFocus = document.getElementById('leg-focus');
            const legMean = document.getElementById('leg-mean');
            const legFacing = document.getElementById('leg-facing');
            const legMar = document.getElementById('leg-mar');
            if (legFocus && typeof fVal === 'number') legFocus.textContent = `${fVal.toFixed(1)}%`;
            if (legMean && typeof mVal === 'number') legMean.textContent = `${mVal.toFixed(1)}%`;
            if (legFacing && typeof gVal === 'number') legFacing.textContent = `${gVal.toFixed(1)}%`;
            if (legMar && typeof fatVal === 'number') legMar.textContent = `${(fatVal / 100 * 0.80).toFixed(2)}`;
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(24, 24, 27, 0.94)',
          titleFont: { family: 'JetBrains Mono', size: 11 },
          bodyFont: { family: 'Inter', size: 12 },
          cornerRadius: 8,
          padding: 10,
          callbacks: {
            label: function(context) {
              const datasetLabel = context.dataset.label || '';
              const value = context.parsed.y;
              return `  ${datasetLabel}: ${value !== null && value !== undefined ? value.toFixed(1) : ''}%`;
            },
            afterBody: function(context) {
              if (!context || !context[0]) return '';
              const dataIdx = context[0].dataIndex;
              let frame = null;
              if (chartZoomState.isZoomed && chartZoomState.sliceStats && chartZoomState.sliceStats.frames) {
                frame = chartZoomState.sliceStats.frames[dataIdx];
              } else if (masterTelemetryStream.frames.length > 0) {
                const currentOffset = Math.max(0, masterTelemetryStream.labels.length - (chartInstance.data.labels ? chartInstance.data.labels.length : 0));
                frame = masterTelemetryStream.frames[currentOffset + dataIdx];
              }

              if (frame && frame.students && frame.students[0]) {
                const s = frame.students[0];
                const p = typeof s.pitch === 'number' ? s.pitch.toFixed(1) : '0.0';
                const y = typeof s.yaw === 'number' ? s.yaw.toFixed(1) : '0.0';
                const ear = typeof s.ear === 'number' ? s.ear.toFixed(2) : '0.30';
                const mar = typeof s.mar === 'number' ? s.mar.toFixed(2) : '0.08';
                return [
                  `  Posture: Pitch ${s.pitch > 0 ? '+' : ''}${p}° · Yaw ${y}°`,
                  `  Biometrics: EAR ${ear} · MAR ${mar} · [${s.status || 'Active'}]`
                ];
              }
              return '';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'JetBrains Mono', size: 10.5 },
            color: '#A1A1AA',
            maxRotation: 0,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: 7
          },
          border: { display: false }
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: '#F0F0F4' },
          ticks: {
            stepSize: 25,
            callback: (v) => `${v}%`,
            color: '#A1A1AA',
            font: { family: 'JetBrains Mono', size: 10.5 }
          },
          border: { display: false }
        }
      }
    }
  });

  // Filter Buttons with Dynamic Y-Axis Scaling & Legend Dimming
  document.querySelectorAll('.filter-tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (this.id === 'btn-header-reset-zoom' || this.id === 'btn-open-deep-insight') return;
      document.querySelectorAll('.filter-tab-btn:not(.btn-header-reset):not(.btn-deep-insight-trigger)').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const filter = this.getAttribute('data-filter');
      chartZoomState.activeFilter = filter;

      if (!chartInstance) return;

      // Update Dataset Visibility
      if (filter === 'all') {
        chartInstance.setDatasetVisibility(0, true);
        chartInstance.setDatasetVisibility(1, true);
        chartInstance.setDatasetVisibility(2, true);
        chartInstance.setDatasetVisibility(3, true);
      } else if (filter === 'focus') {
        chartInstance.setDatasetVisibility(0, true);
        chartInstance.setDatasetVisibility(1, true);
        chartInstance.setDatasetVisibility(2, false);
        chartInstance.setDatasetVisibility(3, false);
      } else if (filter === 'gaze') {
        chartInstance.setDatasetVisibility(0, false);
        chartInstance.setDatasetVisibility(1, false);
        chartInstance.setDatasetVisibility(2, true);
        chartInstance.setDatasetVisibility(3, false);
      } else if (filter === 'fatigue') {
        chartInstance.setDatasetVisibility(0, false);
        chartInstance.setDatasetVisibility(1, false);
        chartInstance.setDatasetVisibility(2, false);
        chartInstance.setDatasetVisibility(3, true);
      }

      // Update Legend Dimming for Instant Visual Focus
      const legendItems = document.querySelectorAll('.curve-legend-strip .legend-item');
      if (legendItems && legendItems.length === 4) {
        if (filter === 'all') {
          legendItems.forEach(item => item.style.opacity = '1');
        } else if (filter === 'focus') {
          legendItems[0].style.opacity = '1';
          legendItems[1].style.opacity = '1';
          legendItems[2].style.opacity = '0.25';
          legendItems[3].style.opacity = '0.25';
        } else if (filter === 'gaze') {
          legendItems[0].style.opacity = '0.25';
          legendItems[1].style.opacity = '0.25';
          legendItems[2].style.opacity = '1';
          legendItems[3].style.opacity = '0.25';
        } else if (filter === 'fatigue') {
          legendItems[0].style.opacity = '0.25';
          legendItems[1].style.opacity = '0.25';
          legendItems[2].style.opacity = '0.25';
          legendItems[3].style.opacity = '1';
        }
      }

      // Dynamic Y-axis Auto-Scaling
      if (!chartZoomState.isZoomed) {
        if (filter === 'fatigue') {
          const fatData = chartInstance.data.datasets[3].data;
          const maxFat = fatData.length > 0 ? Math.max(...fatData.filter(v => typeof v === 'number')) : 15;
          chartInstance.options.scales.y.min = 0;
          chartInstance.options.scales.y.max = Math.max(25, Math.ceil(maxFat + 5));
          chartInstance.options.scales.y.ticks.stepSize = Math.max(5, Math.round(chartInstance.options.scales.y.max / 4));
          chartInstance.options.scales.y.ticks.callback = (v) => `${(v / 100 * 0.80).toFixed(2)} MAR`;
        } else if (filter === 'gaze') {
          chartInstance.options.scales.y.min = 30;
          chartInstance.options.scales.y.max = 100;
          chartInstance.options.scales.y.ticks.stepSize = 20;
          chartInstance.options.scales.y.ticks.callback = (v) => `${v}%`;
        } else {
          chartInstance.options.scales.y.min = 0;
          chartInstance.options.scales.y.max = 100;
          chartInstance.options.scales.y.ticks.stepSize = 25;
          chartInstance.options.scales.y.ticks.callback = (v) => `${v}%`;
        }
      }

      chartInstance.update('none');
    });
  });

  // --------------------------------------------------------------------------
  // INTERACTIVE CROP & ZOOM MARQUEE CONTROLLER (MOUSE DRAG / BRUSH SELECTION)
  // --------------------------------------------------------------------------
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  const marquee = document.getElementById('chart-crop-marquee');
  const cropBadge = document.getElementById('crop-badge');

  function onMouseDown(e) {
    if (e.button !== 0 || !chartInstance) return;
    const ca = chartInstance.chartArea;
    if (!ca) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < ca.left || x > ca.right || y < ca.top || y > ca.bottom) return;

    isDragging = true;
    dragStartX = x;
    dragStartY = y;

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    if (!isDragging || !chartInstance) return;
    const ca = chartInstance.chartArea;
    const rect = canvas.getBoundingClientRect();
    const curX = Math.max(ca.left, Math.min(ca.right, e.clientX - rect.left));
    const curY = Math.max(ca.top, Math.min(ca.bottom, e.clientY - rect.top));

    const left = Math.min(dragStartX, curX);
    const top = Math.min(dragStartY, curY);
    const width = Math.abs(curX - dragStartX);
    const height = Math.abs(curY - dragStartY);

    if (width > 6 && marquee) {
      marquee.classList.remove('hidden');
      marquee.style.left = `${left}px`;
      marquee.style.top = `${top}px`;
      marquee.style.width = `${width}px`;
      marquee.style.height = `${height}px`;

      if (cropBadge && chartInstance.data.labels && chartInstance.data.labels.length > 0) {
        const labels = chartInstance.data.labels;
        const idxA = Math.max(0, Math.min(labels.length - 1, Math.round(chartInstance.scales.x.getValueForPixel(left))));
        const idxB = Math.max(0, Math.min(labels.length - 1, Math.round(chartInstance.scales.x.getValueForPixel(left + width))));
        const tA = labels[idxA] || '--:--:--';
        const tB = labels[idxB] || '--:--:--';
        const count = Math.abs(idxB - idxA) + 1;
        cropBadge.textContent = `Crop: ${tA} ➔ ${tB} (${count} pts)`;
      }
    }
  }

  function onMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);

    if (marquee) marquee.classList.add('hidden');

    if (!chartInstance) return;
    const rect = canvas.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const width = Math.abs(curX - dragStartX);

    // If dragged width >= 15px, execute crop & zoom into that exact interval
    if (width >= 15 && chartInstance.data.labels && chartInstance.data.labels.length > 1) {
      const ca = chartInstance.chartArea;
      const leftX = Math.max(ca.left, Math.min(ca.right, Math.min(dragStartX, curX)));
      const rightX = Math.max(ca.left, Math.min(ca.right, Math.max(dragStartX, curX)));

      const labels = chartInstance.data.labels;
      const localStart = Math.max(0, Math.min(labels.length - 1, Math.round(chartInstance.scales.x.getValueForPixel(leftX))));
      const localEnd = Math.max(0, Math.min(labels.length - 1, Math.round(chartInstance.scales.x.getValueForPixel(rightX))));

      if (localEnd - localStart >= 1) {
        let masterStart, masterEnd;
        if (!chartZoomState.isZoomed) {
          const currentWindowOffset = Math.max(0, masterTelemetryStream.labels.length - labels.length);
          masterStart = currentWindowOffset + localStart;
          masterEnd = currentWindowOffset + localEnd;
        } else {
          masterStart = chartZoomState.startIndex + localStart;
          masterEnd = chartZoomState.startIndex + localEnd;
        }
        applyChartZoom(masterStart, masterEnd);
        showToast('Zoomed into cropped telemetry slice', '🔍');
      }
    }
  }

  canvas.addEventListener('mousedown', onMouseDown);

  // --------------------------------------------------------------------------
  // DOUBLE CLICK TO ZOOM IN / RESET ZOOM
  // --------------------------------------------------------------------------
  canvas.addEventListener('dblclick', function(e) {
    if (chartZoomState.isZoomed) {
      // If already zoomed in, double-click resets to live streaming
      resetChartZoom();
      showToast('Reset to Live Telemetry Stream', '⟲');
      return;
    }

    if (masterTelemetryStream.labels.length < 5) {
      showToast('Awaiting more stream data to inspect interval', '⏳');
      return;
    }

    const ca = chartInstance.chartArea;
    if (!ca) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clampedX = Math.max(ca.left, Math.min(ca.right, x));
    const labels = chartInstance.data.labels || [];
    if (labels.length === 0) return;

    const localIdx = Math.max(0, Math.min(labels.length - 1, Math.round(chartInstance.scales.x.getValueForPixel(clampedX))));
    const currentWindowOffset = Math.max(0, masterTelemetryStream.labels.length - labels.length);
    const masterCenter = currentWindowOffset + localIdx;

    const halfWindow = 12; // 24-point focused inspection window
    const masterStart = Math.max(0, masterCenter - halfWindow);
    const masterEnd = Math.min(masterTelemetryStream.labels.length - 1, masterCenter + halfWindow);

    applyChartZoom(masterStart, masterEnd);
    showToast('Deep Insight: Zoomed into interval · Double-click to reset', '🔍');
  });

  // --------------------------------------------------------------------------
  // MOUSE WHEEL / PINCH TO ZOOM
  // --------------------------------------------------------------------------
  canvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    if (masterTelemetryStream.labels.length < 5 || !chartInstance) return;

    const delta = Math.sign(e.deltaY);
    const curLen = chartInstance.data.labels ? chartInstance.data.labels.length : 0;

    if (delta < 0) {
      // Zoom in (shrink window by 20%)
      if (curLen <= 5) return;
      const step = Math.max(2, Math.floor(curLen * 0.2));
      let start = chartZoomState.isZoomed ? chartZoomState.startIndex : Math.max(0, masterTelemetryStream.labels.length - curLen);
      let end = chartZoomState.isZoomed ? chartZoomState.endIndex : masterTelemetryStream.labels.length - 1;

      start = Math.min(end - 4, start + Math.floor(step / 2));
      end = Math.max(start + 4, end - Math.ceil(step / 2));
      applyChartZoom(start, end);
    } else {
      // Zoom out (expand window by 20%)
      if (!chartZoomState.isZoomed) return;
      const step = Math.max(2, Math.floor(curLen * 0.2));
      let start = Math.max(0, chartZoomState.startIndex - Math.floor(step / 2));
      let end = Math.min(masterTelemetryStream.labels.length - 1, chartZoomState.endIndex + Math.ceil(step / 2));

      if (start === 0 && end === masterTelemetryStream.labels.length - 1) {
        resetChartZoom();
      } else {
        applyChartZoom(start, end);
      }
    }
  }, { passive: false });
}

// ----------------------------------------------------------------------------
// CHART ZOOM & DEEP INSIGHT APPLIED HANDLERS
// ----------------------------------------------------------------------------

function applyChartZoom(startIndex, endIndex) {
  if (!chartInstance) return;
  const maxIdx = masterTelemetryStream.labels.length - 1;
  startIndex = Math.max(0, Math.min(maxIdx, startIndex));
  endIndex = Math.max(0, Math.min(maxIdx, endIndex));

  if (endIndex - startIndex < 2) {
    if (startIndex > 0) startIndex--;
    if (endIndex < maxIdx) endIndex++;
  }

  chartZoomState.isZoomed = true;
  chartZoomState.startIndex = startIndex;
  chartZoomState.endIndex = endIndex;
  chartZoomState.bufferedCount = 0;

  const sliceLabels = masterTelemetryStream.labels.slice(startIndex, endIndex + 1);
  const sliceFocus = masterTelemetryStream.focus.slice(startIndex, endIndex + 1);
  const sliceMean = masterTelemetryStream.mean.slice(startIndex, endIndex + 1);
  const sliceFacing = masterTelemetryStream.facing.slice(startIndex, endIndex + 1);
  const sliceFatigue = masterTelemetryStream.fatigue.slice(startIndex, endIndex + 1);
  const sliceFrames = masterTelemetryStream.frames.slice(startIndex, endIndex + 1);

  chartInstance.data.labels = sliceLabels;
  chartInstance.data.datasets[0].data = sliceFocus;
  chartInstance.data.datasets[1].data = sliceMean;
  chartInstance.data.datasets[2].data = sliceFacing;
  chartInstance.data.datasets[3].data = sliceFatigue;

  // Auto-fit Y-scale to amplitude of selected data slice
  const allVals = [...sliceFocus, ...sliceFacing, ...sliceFatigue].filter(v => typeof v === 'number' && !isNaN(v));
  if (allVals.length > 0) {
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);
    const pad = Math.max(4, (maxVal - minVal) * 0.12);
    chartInstance.options.scales.y.min = Math.max(0, Math.floor(minVal - pad));
    chartInstance.options.scales.y.max = Math.min(100, Math.ceil(maxVal + pad));
    const range = chartInstance.options.scales.y.max - chartInstance.options.scales.y.min;
    chartInstance.options.scales.y.ticks.stepSize = Math.max(5, Math.round(range / 4));
  }

  chartInstance.update();

  // Compute slice statistics
  const stats = calculateSliceStats(sliceLabels, sliceFocus, sliceMean, sliceFacing, sliceFatigue, sliceFrames, startIndex, endIndex);
  chartZoomState.sliceStats = stats;

  // Render Floating HUD Bar
  const hud = document.getElementById('curve-insight-hud');
  if (hud) {
    hud.classList.remove('hidden');
    const hudZoom = document.getElementById('hud-zoom-level');
    const hudTime = document.getElementById('hud-time-range');
    const hudFocus = document.getElementById('hud-avg-focus');
    const hudMinMax = document.getElementById('hud-min-max');
    const hudGaze = document.getElementById('hud-gaze');
    const hudTrend = document.getElementById('hud-trend');

    if (hudZoom) hudZoom.textContent = `${stats.zoomLevel}x`;
    if (hudTime) hudTime.innerHTML = `${stats.startTime} ➔ ${stats.endTime} (<span id="hud-duration">${stats.sampleCount}s</span>)`;
    if (hudFocus) hudFocus.textContent = `${stats.meanFocus.toFixed(1)}%`;
    if (hudMinMax) hudMinMax.textContent = `${stats.minFocus.toFixed(0)}% / ${stats.maxFocus.toFixed(0)}%`;
    if (hudGaze) hudGaze.textContent = `${stats.meanFacing.toFixed(0)}%`;
    if (hudTrend) {
      if (stats.slope > 0.3) {
        hudTrend.innerHTML = `<span style="color:#34C759">▲ +${stats.slope.toFixed(1)}%/s</span>`;
      } else if (stats.slope < -0.3) {
        hudTrend.innerHTML = `<span style="color:#FF3B30">▼ ${stats.slope.toFixed(1)}%/s</span>`;
      } else {
        hudTrend.innerHTML = `<span style="color:var(--ink-secondary)">— Stable</span>`;
      }
    }
  }

  // Update Header & Footer Indicators
  const btnHeaderReset = document.getElementById('btn-header-reset-zoom');
  if (btnHeaderReset) btnHeaderReset.classList.remove('hidden');

  const footerDesc = document.getElementById('timeline-footer-desc');
  if (footerDesc) footerDesc.textContent = '⏸ Zoomed Slice Inspection (Double-click or Esc to return to live)';

  const bufferPill = document.getElementById('timeline-buffer-pill');
  if (bufferPill) {
    bufferPill.classList.remove('hidden');
    const bufCount = document.getElementById('timeline-buffered-count');
    if (bufCount) bufCount.textContent = '0';
  }
}

function resetChartZoom() {
  if (!chartInstance) return;
  chartZoomState.isZoomed = false;
  chartZoomState.bufferedCount = 0;
  chartZoomState.sliceStats = null;

  const len = masterTelemetryStream.labels.length;
  const start = Math.max(0, len - MAX_HISTORY_POINTS);

  chartInstance.data.labels = masterTelemetryStream.labels.slice(start);
  chartInstance.data.datasets[0].data = masterTelemetryStream.focus.slice(start);
  chartInstance.data.datasets[1].data = masterTelemetryStream.mean.slice(start);
  chartInstance.data.datasets[2].data = masterTelemetryStream.facing.slice(start);
  chartInstance.data.datasets[3].data = masterTelemetryStream.fatigue.slice(start);

  chartInstance.options.scales.y.min = 0;
  chartInstance.options.scales.y.max = 100;
  chartInstance.options.scales.y.ticks.stepSize = 25;

  chartInstance.update();

  const hud = document.getElementById('curve-insight-hud');
  if (hud) hud.classList.add('hidden');

  const btnHeaderReset = document.getElementById('btn-header-reset-zoom');
  if (btnHeaderReset) btnHeaderReset.classList.add('hidden');

  const bufferPill = document.getElementById('timeline-buffer-pill');
  if (bufferPill) bufferPill.classList.add('hidden');

  const footerDesc = document.getElementById('timeline-footer-desc');
  if (footerDesc) footerDesc.textContent = '100-pt Sliding Window · 4-Trace Telemetry Stream';
}

function calculateSliceStats(labels, focus, mean, facing, fatigue, frames, startIndex, endIndex) {
  const sampleCount = focus.length;
  const sumFocus = focus.reduce((a, b) => a + b, 0);
  const meanFocus = sampleCount > 0 ? sumFocus / sampleCount : 0;
  const minFocus = sampleCount > 0 ? Math.min(...focus) : 0;
  const maxFocus = sampleCount > 0 ? Math.max(...focus) : 0;

  const variance = sampleCount > 0 ? focus.reduce((acc, v) => acc + Math.pow(v - meanFocus, 2), 0) / sampleCount : 0;
  const stdDev = Math.sqrt(variance);

  const sumFacing = facing.reduce((a, b) => a + b, 0);
  const meanFacing = sampleCount > 0 ? sumFacing / sampleCount : 0;

  const peakFatigue = fatigue.length > 0 ? Math.max(...fatigue) : 0;
  const slope = sampleCount > 1 ? (focus[focus.length - 1] - focus[0]) / (sampleCount - 1) : 0;

  const totalStreamLen = Math.max(1, masterTelemetryStream.labels.length);
  const zoomLevel = (totalStreamLen / Math.max(1, sampleCount)).toFixed(1);

  // Extract student kinematics across frames
  let pitchList = [];
  let yawList = [];
  let earList = [];
  let marList = [];
  let sleepCount = 0;
  let yawnCount = 0;

  frames.forEach(frame => {
    if (!frame) return;
    if (frame.sleep) sleepCount++;
    if (frame.yawn) yawnCount++;
    if (frame.students && Array.isArray(frame.students)) {
      frame.students.forEach(s => {
        if (typeof s.pitch === 'number') pitchList.push(s.pitch);
        if (typeof s.yaw === 'number') yawList.push(s.yaw);
        if (typeof s.ear === 'number') earList.push(s.ear);
        if (typeof s.mar === 'number') marList.push(s.mar);
      });
    }
  });

  const avgPitch = pitchList.length > 0 ? pitchList.reduce((a, b) => a + b, 0) / pitchList.length : 0;
  const avgYaw = yawList.length > 0 ? yawList.reduce((a, b) => a + b, 0) / yawList.length : 0;
  const minEar = earList.length > 0 ? Math.min(...earList) : 0.28;
  const maxMar = marList.length > 0 ? Math.max(...marList) : 0.08;

  return {
    startIndex, endIndex,
    labels, focus, mean, facing, fatigue, frames,
    sampleCount,
    meanFocus, minFocus, maxFocus, stdDev,
    meanFacing, peakFatigue, slope, zoomLevel,
    startTime: labels[0] || '--:--:--',
    endTime: labels[labels.length - 1] || '--:--:--',
    avgPitch, avgYaw, minEar, maxMar, sleepCount, yawnCount
  };
}

function openDeepInsightModal(customSlice) {
  let stats = customSlice || chartZoomState.sliceStats;
  if (!stats) {
    if (masterTelemetryStream.labels.length === 0) {
      showToast('No telemetry data available yet to inspect', '⚠️');
      return;
    }
    const len = masterTelemetryStream.labels.length;
    const start = Math.max(0, len - 30);
    const end = len - 1;
    stats = calculateSliceStats(
      masterTelemetryStream.labels.slice(start),
      masterTelemetryStream.focus.slice(start),
      masterTelemetryStream.mean.slice(start),
      masterTelemetryStream.facing.slice(start),
      masterTelemetryStream.fatigue.slice(start),
      masterTelemetryStream.frames.slice(start),
      start, end
    );
  }

  // Populate Modal Header & Tags
  const sliceTag = document.getElementById('modal-slice-tag');
  if (sliceTag) sliceTag.textContent = `Interval: ${stats.startTime} ➔ ${stats.endTime} (${stats.sampleCount}s)`;

  // Populate 4 KPI Cards
  const kpiMean = document.getElementById('modal-kpi-mean');
  const kpiDelta = document.getElementById('modal-kpi-delta');
  const kpiRange = document.getElementById('modal-kpi-range');
  const kpiFacing = document.getElementById('modal-kpi-facing');
  const kpiFacingTag = document.getElementById('modal-kpi-facing-tag');
  const kpiGazeDesc = document.getElementById('modal-kpi-gaze-desc');
  const kpiFatigue = document.getElementById('modal-kpi-fatigue');
  const kpiFatigueTag = document.getElementById('modal-kpi-fatigue-tag');
  const kpiFatigueDesc = document.getElementById('modal-kpi-fatigue-desc');
  const kpiTraj = document.getElementById('modal-kpi-trajectory');
  const kpiTrajTag = document.getElementById('modal-kpi-traj-tag');
  const kpiTrajDesc = document.getElementById('modal-kpi-traj-desc');

  if (kpiMean) kpiMean.textContent = `${stats.meanFocus.toFixed(1)}%`;
  if (kpiDelta) {
    const diff = stats.meanFocus - engine.sessionMean;
    kpiDelta.textContent = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}% vs session`;
    kpiDelta.style.color = diff >= 0 ? '#34C759' : '#FF3B30';
  }
  if (kpiRange) kpiRange.textContent = `Min: ${stats.minFocus.toFixed(0)}% · Max: ${stats.maxFocus.toFixed(0)}% · StdDev: ±${stats.stdDev.toFixed(1)}%`;

  if (kpiFacing) kpiFacing.textContent = `${stats.meanFacing.toFixed(1)}%`;
  if (kpiFacingTag) {
    if (stats.meanFacing >= 80) {
      kpiFacingTag.textContent = 'Frontal Sync';
      kpiFacingTag.className = 'kpi-tag-status';
    } else if (stats.meanFacing >= 50) {
      kpiFacingTag.textContent = 'Partial Deflection';
      kpiFacingTag.className = 'kpi-tag-status warn';
    } else {
      kpiFacingTag.textContent = 'Averted';
      kpiFacingTag.className = 'kpi-tag-status alert';
    }
  }
  if (kpiGazeDesc) kpiGazeDesc.textContent = `Avg Pitch ${stats.avgPitch.toFixed(1)}° · Avg Yaw ${stats.avgYaw.toFixed(1)}°`;

  if (kpiFatigue) kpiFatigue.textContent = `${stats.maxMar.toFixed(2)} MAR`;
  if (kpiFatigueTag) {
    if (stats.maxMar >= 0.60 || stats.yawnCount > 0) {
      kpiFatigueTag.textContent = 'Yawn Alert';
      kpiFatigueTag.className = 'kpi-tag-status alert';
    } else if (stats.minEar < 0.20 || stats.sleepCount > 0) {
      kpiFatigueTag.textContent = 'Drowsy / Eyelids';
      kpiFatigueTag.className = 'kpi-tag-status warn';
    } else {
      kpiFatigueTag.textContent = 'Normal';
      kpiFatigueTag.className = 'kpi-tag-status';
    }
  }
  if (kpiFatigueDesc) kpiFatigueDesc.textContent = `${stats.yawnCount} yawn events · Min EAR: ${stats.minEar.toFixed(2)}`;

  if (kpiTraj) {
    if (stats.slope > 0.3) {
      kpiTraj.textContent = `▲ +${stats.slope.toFixed(2)}%/s`;
      kpiTraj.style.color = '#34C759';
      if (kpiTrajTag) { kpiTrajTag.textContent = 'Surging'; kpiTrajTag.className = 'kpi-tag-status'; }
    } else if (stats.slope < -0.3) {
      kpiTraj.textContent = `▼ ${stats.slope.toFixed(2)}%/s`;
      kpiTraj.style.color = '#FF3B30';
      if (kpiTrajTag) { kpiTrajTag.textContent = 'Dipping'; kpiTrajTag.className = 'kpi-tag-status warn'; }
    } else {
      kpiTraj.textContent = `— ${stats.slope.toFixed(2)}%/s`;
      kpiTraj.style.color = 'var(--ink-primary)';
      if (kpiTrajTag) { kpiTrajTag.textContent = 'Stable'; kpiTrajTag.className = 'kpi-tag-status'; }
    }
  }
  if (kpiTrajDesc) kpiTrajDesc.textContent = `Linear velocity across ${stats.sampleCount} sampled seconds`;

  // Render High-Definition Modal Waveform Chart
  const modalCanvas = document.getElementById('modal-chart-canvas');
  if (modalCanvas) {
    if (modalChartInstance) {
      modalChartInstance.destroy();
    }
    const mCtx = modalCanvas.getContext('2d');
    modalChartInstance = new Chart(mCtx, {
      type: 'line',
      data: {
        labels: stats.labels,
        datasets: [
          {
            label: 'Active Focus %',
            data: stats.focus,
            borderColor: '#18181B',
            borderWidth: 2.2,
            backgroundColor: 'rgba(24, 24, 27, 0.05)',
            fill: true,
            tension: 0.25,
            pointRadius: 4,
            pointBackgroundColor: '#18181B',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 1.5,
            pointHoverRadius: 7
          },
          {
            label: 'Session Mean %',
            data: stats.mean,
            borderColor: '#A1A1AA',
            borderWidth: 1.5,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false,
            tension: 0.1
          },
          {
            label: 'Board Gaze Alignment %',
            data: stats.facing,
            borderColor: '#0071E3',
            borderWidth: 1.8,
            pointRadius: 3,
            pointBackgroundColor: '#0071E3',
            fill: false,
            tension: 0.25
          },
          {
            label: 'Mouth Aspect Ratio (MAR %)',
            data: stats.fatigue,
            borderColor: '#FF3B30',
            borderWidth: 1.6,
            pointRadius: 3,
            pointBackgroundColor: '#FF3B30',
            fill: false,
            tension: 0.25
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(24, 24, 27, 0.94)',
            titleFont: { family: 'JetBrains Mono', size: 11 },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 10,
            cornerRadius: 8
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(0, 0, 0, 0.04)' },
            ticks: {
              font: { family: 'JetBrains Mono', size: 10 },
              color: '#A1A1AA',
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8
            }
          },
          y: {
            min: Math.max(0, Math.floor(stats.minFocus - 5)),
            max: Math.min(100, Math.ceil(Math.max(stats.maxFocus, ...stats.facing) + 5)),
            grid: { color: '#F0F0F4' },
            ticks: {
              font: { family: 'JetBrains Mono', size: 10 },
              color: '#A1A1AA',
              callback: (v) => `${v}%`
            }
          }
        }
      }
    });
  }

  // Synthesize Deterministic Pedagogical Narrative
  const diagText = document.getElementById('modal-diagnosis-text');
  if (diagText) {
    let diagnosis = '';
    if (stats.maxMar >= 0.60 || stats.yawnCount > 0) {
      diagnosis = `Fatigue signature identified during this interval. Mouth aspect ratio peaked at ${stats.maxMar.toFixed(2)} with ocular narrowing (EAR ${stats.minEar.toFixed(2)}). Engagement dipped to ${stats.minFocus.toFixed(0)}%. Recommended pedagogical action: introduce an active problem-solving prompt or direct audience inquiry.`;
    } else if (stats.minFocus < 60 && stats.avgPitch < -12) {
      diagnosis = `Transient attention dip to ${stats.minFocus.toFixed(0)}% was accompanied by downward head pitch deflection (mean ${stats.avgPitch.toFixed(1)}°). Oral kinematics remained baseline (MAR ${stats.maxMar.toFixed(2)}). This kinetic signature is consistent with desk problem solving, notebook writing, or slide copy rather than mental distraction.`;
    } else if (stats.meanFacing < 70) {
      diagnosis = `Lateral gaze divergence recorded: Cohort departed frontal presentation alignment for multiple samples (mean board alignment ${stats.meanFacing.toFixed(0)}%, peak yaw ${stats.avgYaw.toFixed(1)}°). This reflects lateral peer discussion or room inspection rather than sleepiness.`;
    } else if (stats.meanFocus >= 80) {
      diagnosis = `High cognitive synchrony: Cohort demonstrated sustained frontal engagement (${stats.meanFocus.toFixed(1)}% mean attention, ${stats.meanFacing.toFixed(0)}% board alignment). Head kinematics were centered within the primary lecture cone.`;
    } else if (stats.slope > 0.4) {
      diagnosis = `Rapid engagement recovery: Attention rebounded by +${(stats.focus[stats.focus.length - 1] - stats.focus[0]).toFixed(1)}% across this window, returning to forward presentation synchronization.`;
    } else {
      diagnosis = `Equilibrium phase: Attention remained stable around ${stats.meanFocus.toFixed(1)}% (StdDev ±${stats.stdDev.toFixed(1)}%). Zero oral or ocular fatigue anomalies detected.`;
    }
    diagText.textContent = diagnosis;
  }

  // Populate Forensic Ledger Table
  const tbody = document.getElementById('modal-ledger-tbody');
  const frameCountEl = document.getElementById('modal-frame-count');
  if (frameCountEl) frameCountEl.textContent = stats.sampleCount;

  // Render rows and cache for rapid client-side filtering
  function renderModalLedgerRows(filterMode = 'all') {
    if (!tbody) return;
    tbody.innerHTML = '';
    let visibleCount = 0;

    stats.labels.forEach((t, i) => {
      const f = stats.focus[i];
      const facing = stats.facing[i];
      const fat = stats.fatigue[i];
      const frameObj = stats.frames[i];
      const student = (frameObj && frameObj.students && frameObj.students[0]) || {};

      const pitch = typeof student.pitch === 'number' ? student.pitch.toFixed(1) : (stats.avgPitch.toFixed(1));
      const yaw = typeof student.yaw === 'number' ? student.yaw.toFixed(1) : (stats.avgYaw.toFixed(1));
      const ear = typeof student.ear === 'number' ? student.ear.toFixed(2) : (stats.minEar.toFixed(2));
      const mar = typeof student.mar === 'number' ? student.mar.toFixed(2) : ((fat / 100 * 0.80).toFixed(2));
      const status = student.status || (f >= 70 ? 'Attentive' : (mar >= 0.60 ? 'Yawning' : (ear < 0.20 ? 'Sleeping' : 'Distracted')));

      // Filter matching
      if (filterMode === 'divergent') {
        if (status === 'Attentive' && facing >= 80) return;
      } else if (filterMode === 'fatigue') {
        if (Number(mar) < 0.50 && Number(ear) >= 0.22 && status !== 'Yawning' && status !== 'Sleeping') return;
      }

      visibleCount++;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono tabular-nums font-medium">${t}</td>
        <td class="mono tabular-nums font-semibold">${f.toFixed(1)}%</td>
        <td class="mono tabular-nums">P: ${pitch}&deg; · Y: ${yaw}&deg;</td>
        <td><span class="mono tabular-nums">${facing}%</span> <span class="text-xs" style="color:var(--ink-tertiary)">(${facing >= 75 ? 'Frontal' : 'Deflected'})</span></td>
        <td class="mono tabular-nums">${ear}</td>
        <td class="mono tabular-nums">${mar}</td>
        <td><span class="kpi-tag-status ${status === 'Attentive' ? '' : (status === 'Yawning' || status === 'Sleeping' ? 'alert' : 'warn')}">${status}</span></td>
      `;
      tbody.appendChild(tr);
    });

    if (frameCountEl) frameCountEl.textContent = visibleCount;
  }

  renderModalLedgerRows('all');

  // Bind modal filter chips
  document.querySelectorAll('.modal-filter-chip').forEach(chip => {
    chip.onclick = function() {
      document.querySelectorAll('.modal-filter-chip').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      renderModalLedgerRows(this.getAttribute('data-filter'));
    };
  });

  // Open Backdrop and reset scroll to top
  const backdrop = document.getElementById('deep-insight-modal-backdrop');
  if (backdrop) backdrop.classList.add('show');
  const modalBody = document.querySelector('.modal-studio-body');
  if (modalBody) modalBody.scrollTop = 0;
}

function closeDeepInsightModal() {
  const backdrop = document.getElementById('deep-insight-modal-backdrop');
  if (backdrop) backdrop.classList.remove('show');
}

function exportSliceToCsv(stats) {
  if (!stats || !stats.labels || stats.labels.length === 0) {
    showToast('No slice data to export', '⚠️');
    return;
  }
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Timestamp,Focus_Pct,Session_Mean_Pct,Board_Alignment_Pct,Mouth_MAR,Pitch_Deg,Yaw_Deg,EAR,Status\n";

  stats.labels.forEach((t, i) => {
    const f = stats.focus[i];
    const m = stats.mean[i];
    const facing = stats.facing[i];
    const fat = stats.fatigue[i];
    const frameObj = stats.frames[i];
    const student = (frameObj && frameObj.students && frameObj.students[0]) || {};

    const pitch = typeof student.pitch === 'number' ? student.pitch : stats.avgPitch;
    const yaw = typeof student.yaw === 'number' ? student.yaw : stats.avgYaw;
    const ear = typeof student.ear === 'number' ? student.ear : stats.minEar;
    const mar = typeof student.mar === 'number' ? student.mar : (fat / 100 * 0.80);
    const status = student.status || (f >= 70 ? 'Attentive' : 'Distracted');

    csvContent += `${t},${f},${m},${facing},${mar.toFixed(3)},${pitch.toFixed(1)},${yaw.toFixed(1)},${ear.toFixed(2)},${status}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `cams_slice_${stats.startTime.replace(/:/g, '')}_${stats.endTime.replace(/:/g, '')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Interval Slice CSV Exported!', '⬇');
}

function copySliceReport(stats) {
  if (!stats) return;
  const diagEl = document.getElementById('modal-diagnosis-text');
  const report = [
    `=======================================================`,
    `CAMS TELEMETRY DEEP INSIGHT — INTERVAL FORENSIC REPORT`,
    `=======================================================`,
    `Interval: ${stats.startTime} to ${stats.endTime} (${stats.sampleCount} samples)`,
    `Course: ${sessionConfig.className || 'Session'} | Room: ${sessionConfig.room || 'Studio'}`,
    `Mean Focus: ${stats.meanFocus.toFixed(1)}% (Min: ${stats.minFocus.toFixed(1)}%, Max: ${stats.maxFocus.toFixed(1)}%)`,
    `Variance / StdDev: ±${stats.stdDev.toFixed(1)}%`,
    `Board Gaze Alignment: ${stats.meanFacing.toFixed(1)}%`,
    `Fatigue Kinematics: Peak MAR ${stats.maxMar.toFixed(2)}, Min EAR ${stats.minEar.toFixed(2)} (${stats.yawnCount} yawns)`,
    `Trajectory Slope: ${stats.slope >= 0 ? '+' : ''}${stats.slope.toFixed(2)}%/s`,
    ``,
    `DIAGNOSIS:`,
    diagEl ? diagEl.textContent.trim() : 'Cohort telemetry captured.',
    `=======================================================`
  ].join("\n");

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(report).then(() => {
      showToast('Interval Report copied to clipboard!', '✓');
    });
  } else {
    showToast('Interval Report copied!');
  }
}

function pushChartPoint(timestamp, focus, mean, facing, fatiguePct, frameData = null) {
  // Always buffer full telemetry packet into masterTelemetryStream
  masterTelemetryStream.labels.push(timestamp);
  masterTelemetryStream.focus.push(focus);
  masterTelemetryStream.mean.push(mean);
  masterTelemetryStream.facing.push(facing);
  masterTelemetryStream.fatigue.push(fatiguePct);
  masterTelemetryStream.frames.push(frameData || (sessionLogs.length > 0 ? sessionLogs[sessionLogs.length - 1] : null));

  // Update Legend Values in real-time
  const legFocus = document.getElementById('leg-focus');
  const legMean = document.getElementById('leg-mean');
  const legFacing = document.getElementById('leg-facing');
  const legMar = document.getElementById('leg-mar');
  if (legFocus) legFocus.textContent = `${focus.toFixed(1)}%`;
  if (legMean) legMean.textContent = `${mean.toFixed(1)}%`;
  if (legFacing) legFacing.textContent = `${facing.toFixed(1)}%`;
  if (legMar) legMar.textContent = `${(fatiguePct / 100 * 0.80).toFixed(2)}`;

  if (!chartInstance) return;

  if (!chartZoomState.isZoomed) {
    // Normal Live Streaming Mode: display sliding window of last MAX_HISTORY_POINTS
    const len = masterTelemetryStream.labels.length;
    const start = Math.max(0, len - MAX_HISTORY_POINTS);

    chartInstance.data.labels = masterTelemetryStream.labels.slice(start);
    chartInstance.data.datasets[0].data = masterTelemetryStream.focus.slice(start);
    chartInstance.data.datasets[1].data = masterTelemetryStream.mean.slice(start);
    chartInstance.data.datasets[2].data = masterTelemetryStream.facing.slice(start);
    chartInstance.data.datasets[3].data = masterTelemetryStream.fatigue.slice(start);

    chartInstance.update('none');
  } else {
    // Zoomed / Deep Insight Mode: maintain user's cropped interval and buffer incoming points
    chartZoomState.bufferedCount++;
    const bufCount = document.getElementById('timeline-buffered-count');
    if (bufCount) bufCount.textContent = chartZoomState.bufferedCount;
  }
}

// ============================================================================
// 5. DETERMINISTIC AI LECTURE PULSE SYNTHESIZER
// ============================================================================

function synthesizeLecturePulse({ focusMean, focusDelta, facingPct, primaryStudent, isDeskMode, hasData }) {
  if (!hasData || !primaryStudent) {
    return {
      severity: 'stable',
      headline: 'Scanning optical feed — awaiting participants in camera field of view.',
      detail: 'Auto-Adaptive tracking is ready to measure eye closure, yawning kinematics, and head pose.'
    };
  }

  const { id, mar = 0, ear = 0.28, pitch = 0, yaw = 0 } = primaryStudent;

  // 1. Fatigue / Yawn Alert
  if (mar >= 0.60 || ear < 0.20) {
    return {
      severity: 'alert',
      headline: `Fatigue signature detected on Subject 0${id} (${mar >= 0.60 ? `MAR ${mar.toFixed(2)} yawn` : `EAR ${ear.toFixed(2)} closure`}).`,
      detail: `Coincides with ${pitch.toFixed(1)}° head pitch (${focusDelta >= 0 ? '+' : ''}${focusDelta.toFixed(1)}% vs mean). Consider an interactive check-in.`
    };
  }

  // 2. Desk Note-Taking vs. Distraction
  const isLookingDown = (pitch < -14 || pitch > 22);
  if (isLookingDown && mar < 0.45 && ear >= 0.20) {
    return {
      severity: 'warn',
      headline: isDeskMode
        ? `Desk Exercise Mode active — Subject 0${id} downward gaze (${pitch.toFixed(1)}°) classified as on-task.`
        : `Subject 0${id} shifted to downward pitch (${pitch.toFixed(1)}°) with normal ocular/mouth vectors.`,
      detail: `Pattern matches desk note-taking rather than drowsiness (EAR ${ear.toFixed(2)}, MAR ${mar.toFixed(2)}).`
    };
  }

  // 3. Lateral Gaze Drift
  if (Math.abs(yaw) > 22) {
    return {
      severity: 'warn',
      headline: `Lateral gaze drift observed (${yaw > 0 ? '+' : ''}${yaw.toFixed(1)}° yaw) outside primary board cone.`,
      detail: `Board alignment dipped to ${facingPct.toFixed(0)}%, though ocular alertness remains normal (EAR ${ear.toFixed(2)}).`
    };
  }

  // 4. Default High-Engagement State
  const alignmentText = facingPct > 35 ? `${facingPct.toFixed(0)}% board gaze alignment` : `stable desk focus`;
  return {
    severity: 'stable',
    headline: `Cohort engagement steady at ${focusMean.toFixed(1)}% with ${alignmentText}.`,
    detail: `Subject 0${id} maintaining stable posture (Pitch ${pitch >= 0 ? '+' : ''}${pitch.toFixed(1)}°, EAR ${ear.toFixed(2)}) across rolling window.`
  };
}

function updateAIPulseCard() {
  const primary = engine.target.students.find(s => s.id === selectedStudentId) || engine.target.students[0];
  const delta = engine.current.focus - engine.sessionMean;

  const pulse = synthesizeLecturePulse({
    focusMean: engine.sessionMean,
    focusDelta: delta,
    facingPct: engine.current.facing,
    primaryStudent: primary,
    isDeskMode: deskExerciseMode,
    hasData: engine.hasReceivedData && engine.target.students.length > 0
  });

  const card = document.getElementById('ai-pulse-card');
  const headline = document.getElementById('ai-pulse-headline');
  const detail = document.getElementById('ai-pulse-detail');

  if (card && headline && detail) {
    card.className = `ai-pulse-card ${pulse.severity}`;

    headline.style.animation = 'none';
    detail.style.animation = 'none';
    void headline.offsetWidth;
    void detail.offsetWidth;
    headline.style.animation = 'pulseTextReveal 320ms var(--ease-out-expo) forwards';
    detail.style.animation = 'pulseTextReveal 360ms var(--ease-out-expo) forwards';

    headline.textContent = pulse.headline;
    detail.textContent = pulse.detail;
  }
}

// ============================================================================
// 6. 60/120FPS FAST ANIMATION LOOP (CANVAS & BAR RAF)
// ============================================================================

let gizmoCanvas = null;

function runAnimationFrameLoop(now) {
  const animState = engine.stepAnimation(now);
  const cur = animState.current;

  // 1. Draw 3D Head-Pose Sphere Gizmo
  if (layerState.gizmo && gizmoCanvas) {
    const isAlert = Math.abs(cur.pitch) > 15 || Math.abs(cur.yaw) > 20;
    const ctx = configureRetinaCanvas(gizmoCanvas, 68, 68);
    draw3DPoseSphere(ctx, cur.yaw, cur.pitch, isAlert, cur.roll || 0);
  }

  // 2. Draw Video Reticle Overlay on Video Canvas
  renderVideoReticleCanvas();

  // 2. Dynamic Island Ring
  const islandRing = document.getElementById('island-ring-progress');
  if (islandRing) {
    const circumference = 50.26;
    const offset = circumference * (1 - Math.min(1, animState.gateProgress));
    islandRing.style.strokeDashoffset = offset.toFixed(2);
    if (animState.gateProgress > 0.6) {
      islandRing.style.stroke = 'var(--signal-red)';
    } else if (animState.gateProgress > 0.1) {
      islandRing.style.stroke = 'var(--signal-amber)';
    } else {
      islandRing.style.stroke = 'var(--signal-green)';
    }
  }

  // 3. Ribbon Fill Bars (GPU scaleX)
  const barFocus = document.getElementById('bar-focus-fill');
  const barMean = document.getElementById('bar-mean-fill');
  const barFacing = document.getElementById('bar-facing-fill');
  const barFatigue = document.getElementById('bar-fatigue-fill');

  if (barFocus) barFocus.style.transform = `scaleX(${(Math.max(0, Math.min(100, cur.focus)) / 100).toFixed(4)})`;
  if (barMean) barMean.style.transform = `scaleX(${(Math.max(0, Math.min(100, animState.sessionMean)) / 100).toFixed(4)})`;
  if (barFacing) barFacing.style.transform = `scaleX(${(Math.max(0, Math.min(100, cur.facing)) / 100).toFixed(4)})`;
  if (barFatigue) barFatigue.style.transform = `scaleX(${(Math.max(0, Math.min(1.0, cur.mar)) / 1.0).toFixed(4)})`;

  // 4. Update Student Row Sparklines and Ring Meters (Real Students Only)
  engine.target.students.forEach(s => {
    const sparkCanvas = document.getElementById(`sparkline-canvas-${s.id}`);
    if (sparkCanvas) {
      const ctx = configureRetinaCanvas(sparkCanvas, 130, 22);
      const buffer = engine.studentSparklines[s.id];
      const isExceeded = s.mar > 0.60 || s.ear < 0.20;
      drawStudentSparkline(ctx, buffer, isExceeded);
    }

    const rowRing = document.getElementById(`ring-student-${s.id}`);
    if (rowRing) {
      const circumference = 56.55;
      const rowOffset = circumference * (1 - Math.min(1, animState.gateProgress));
      rowRing.style.strokeDashoffset = rowOffset.toFixed(2);
      if (s.mar > 0.60 || s.ear < 0.20) {
        rowRing.style.stroke = 'var(--signal-red)';
      } else if (animState.gateProgress > 0.05) {
        rowRing.style.stroke = 'var(--signal-amber)';
      } else {
        rowRing.style.stroke = 'var(--signal-green)';
      }
    }
  });

  requestAnimationFrame(runAnimationFrameLoop);
}

// ============================================================================
// 7. 4HZ (250MS) TABULAR DOM TEXT UPDATER
// ============================================================================

function runTabularThrottle() {
  const cur = engine.current;
  const target = engine.target;
  const mean = engine.sessionMean;
  const delta = cur.focus - mean;
  const hasStudents = target.students.length > 0;

  // 1. Metric Ribbon Numerals
  const focusHero = document.getElementById('metric-focus-hero');
  const meanHero = document.getElementById('metric-mean-hero');
  const facingHero = document.getElementById('metric-facing-hero');
  const fatigueHero = document.getElementById('metric-fatigue-hero');
  const focusDelta = document.getElementById('focus-delta');
  const focusDot = document.getElementById('focus-dot');
  const metaCohort = document.getElementById('meta-cohort-stable');
  const metaPitch = document.getElementById('meta-pitch-angle');
  const metaYawn = document.getElementById('meta-yawn-trigger');
  const metaHysteresis = document.getElementById('meta-hysteresis-gate');
  const yawnDot = document.getElementById('yawn-dot');

  if (focusHero) focusHero.textContent = hasStudents ? `${cur.focus.toFixed(1)}%` : '--.-%';
  if (meanHero) meanHero.textContent = (engine.frameCount > 0) ? `${mean.toFixed(1)}%` : '--.-%';
  if (facingHero) facingHero.textContent = hasStudents ? `${cur.facing.toFixed(1)}%` : '--.-%';
  if (fatigueHero) {
    if (!hasStudents) {
      fatigueHero.textContent = '0.00';
      fatigueHero.style.color = 'var(--ink-primary)';
    } else if (cur.ear < 0.20) {
      fatigueHero.textContent = `${cur.ear.toFixed(2)} EAR`;
      fatigueHero.style.color = 'var(--signal-red)';
    } else if (cur.mar > 0.60) {
      fatigueHero.textContent = `${cur.mar.toFixed(2)} MAR`;
      fatigueHero.style.color = 'var(--signal-red)';
    } else {
      fatigueHero.textContent = `${cur.mar.toFixed(2)} MAR`;
      fatigueHero.style.color = 'var(--ink-primary)';
    }
  }

  if (focusDelta) {
    if (hasStudents && engine.frameCount > 0) {
      const sign = delta >= 0 ? '+' : '';
      focusDelta.textContent = `${sign}${delta.toFixed(1)}% vs mean`;
    } else {
      focusDelta.textContent = 'Awaiting lock';
    }
  }
  if (focusDot) {
    focusDot.className = `dot-indicator ${cur.focus >= 80 ? 'green' : (hasStudents ? 'amber' : 'green')}`;
  }

  if (metaCohort) {
    if (hasStudents) {
      metaCohort.textContent = `Cohort stable (${target.attentiveCount}/${target.activeCount} Attentive)`;
    } else {
      metaCohort.textContent = 'Scanning camera FOV';
    }
  }

  if (metaPitch) {
    metaPitch.textContent = hasStudents ? `${cur.pitch >= 0 ? '+' : ''}${cur.pitch.toFixed(1)}° pitch` : '0.0° pitch';
  }

  if (metaYawn) {
    if (!hasStudents) {
      metaYawn.textContent = 'Awaiting subjects';
    } else if (cur.ear < 0.20) {
      metaYawn.textContent = 'Ocular closure alert (Drowsy)';
    } else if (cur.mar > 0.60) {
      metaYawn.textContent = 'MAR > 0.60 yawn trigger';
    } else {
      metaYawn.textContent = 'Normal closure rate (Attentive)';
    }
  }
  if (yawnDot) {
    yawnDot.className = `dot-indicator ${cur.mar > 0.60 || cur.ear < 0.20 ? 'red' : 'green'}`;
  }
  if (metaHysteresis) {
    const gatePct = Math.round((engine.gateHoldMs / 2000) * 100);
    const holdSec = (engine.gateHoldMs / 1000).toFixed(1);
    metaHysteresis.textContent = `Hysteresis gate: ${gatePct}% (${holdSec}s)`;
  }

  // 2. Dynamic Session Island Text
  const islandFps = document.getElementById('island-stream-fps');
  const islandText = document.getElementById('island-hysteresis-text');
  const islandFocus = document.getElementById('island-focus-val');

  if (islandFps) islandFps.textContent = `LIVE ${engine.fpsEstimate.toFixed(1)} fps`;
  if (islandFocus) {
    if (hasStudents) {
      islandFocus.textContent = `${cur.focus.toFixed(1)}% Focus`;
      islandFocus.style.color = cur.focus >= 80 ? 'var(--signal-green)' : 'var(--signal-amber)';
    } else {
      islandFocus.textContent = 'Awaiting Subject';
      islandFocus.style.color = 'var(--ink-secondary)';
    }
  }
  if (islandText) {
    if (engine.gateHoldMs > 100) {
      islandText.textContent = `Subject 0${selectedStudentId} · Gate ${(engine.gateHoldMs / 1000).toFixed(1)}s / 2.0s`;
    } else if (deskExerciseMode) {
      islandText.textContent = 'Desk Exercise Mode · Alerts Muted';
    } else if (hasStudents) {
      islandText.textContent = `Cohort Stable · ${target.activeCount}/${target.activeCount} Locked`;
    } else {
      islandText.textContent = 'Scanning Optical Field...';
    }
  }

  // 3. Optical Feed Readouts & Gizmo Readout
  const lockedCount = document.getElementById('feed-locked-count');
  if (lockedCount) {
    lockedCount.textContent = `${target.activeCount} subject(s) locked`;
  }

  const pVal = document.getElementById('gizmo-pitch-val');
  const yVal = document.getElementById('gizmo-yaw-val');
  const rVal = document.getElementById('gizmo-roll-val');

  if (pVal) {
    pVal.textContent = `P: ${cur.pitch >= 0 ? '+' : ''}${cur.pitch.toFixed(1)}°`;
    pVal.className = cur.pitch < -12 ? 'mono tabular-nums gizmo-angle-row pitch alert' : 'mono tabular-nums gizmo-angle-row pitch';
  }
  if (yVal) yVal.textContent = `Y: ${cur.yaw >= 0 ? '+' : ''}${cur.yaw.toFixed(1)}°`;
  if (rVal) rVal.textContent = `R: ${cur.roll >= 0 ? '+' : ''}${cur.roll.toFixed(1)}°`;

  // 4. Custom Legend Strip
  const legFocus = document.getElementById('leg-focus');
  const legMean = document.getElementById('leg-mean');
  const legFacing = document.getElementById('leg-facing');
  const legMar = document.getElementById('leg-mar');

  if (legFocus) legFocus.textContent = hasStudents ? `${cur.focus.toFixed(1)}%` : '--.-%';
  if (legMean) legMean.textContent = (engine.frameCount > 0) ? `${mean.toFixed(1)}%` : '--.-%';
  if (legFacing) legFacing.textContent = hasStudents ? `${cur.facing.toFixed(1)}%` : '--.-%';
  if (legMar) legMar.textContent = hasStudents ? cur.mar.toFixed(2) : '0.00';

  // 5. Render Biometric Ledger Table (REAL PARTICIPANTS ONLY)
  renderBiometricLedgerTable(target.students);

  // 6. Update Real Session Elapsed Time & Telemetry Counters
  updateSessionStatusFooter();
}

// ============================================================================
// 8. PARTICIPANT BIOMETRIC LEDGER TABLE RENDERER (NO FAKE ROWS)
// ============================================================================

function renderBiometricLedgerTable(students) {
  const tbody = document.getElementById('ledger-table-body');
  const slotsLabel = document.getElementById('ledger-active-slots');
  if (!tbody) return;

  if (!students || students.length === 0) {
    if (slotsLabel) slotsLabel.textContent = '0 participants locked · waiting for camera detection';
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 28px 16px; text-align: center;">
          <div class="empty-roster-wrap">
            <div class="empty-icon-ring">🔍</div>
            <div style="font-size: 13px; font-weight: 600; color: var(--ink-primary); margin-bottom: 3px;">Awaiting Participants in Camera Field of View</div>
            <div style="font-size: 11.5px; color: var(--ink-secondary);">Sit in front of the camera or frame classroom seats to begin real-time telemetry analysis.</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  if (slotsLabel) {
    const activeCount = students.length;
    slotsLabel.textContent = `${activeCount} participant${activeCount === 1 ? '' : 's'} tracked · active telemetry`;
  }

  let rowsHtml = '';
  students.forEach(student => {
    const isSelected = student.id === selectedStudentId;
    const earVal = Number(student.ear || 0.28);
    const marVal = Number(student.mar || 0.08);
    const focusVal = Number(student.score || 0);
    const yawVal = Number(student.yaw || 0);
    const pitchVal = Number(student.pitch || 0);
    const position = student.position || 'Center';

    const isEarAlert = earVal < 0.20;
    const isMarAlert = marVal > 0.60;

    let postureTitle = 'Attentive';
    let postureSub = 'Within normal cone';
    if (isMarAlert) {
      postureTitle = 'Yawning';
      postureSub = `MAR ${marVal.toFixed(2)} > 0.60 trigger`;
    } else if (isEarAlert) {
      postureTitle = 'Drowsy';
      postureSub = `EAR ${earVal.toFixed(2)} < 0.20 threshold`;
    } else if (pitchVal < -12) {
      postureTitle = deskExerciseMode ? 'Desk Work' : 'Looking Down';
      postureSub = `${pitchVal.toFixed(1)}° pitch`;
    } else if (Math.abs(yawVal) > 20) {
      postureTitle = yawVal > 0 ? 'Looking Right' : 'Looking Left';
      postureSub = `${yawVal.toFixed(1)}° yaw`;
    }

    const earScale = Math.min(1.0, Math.max(0.0, earVal / 0.40)).toFixed(3);
    const marScale = Math.min(1.0, Math.max(0.0, marVal / 1.00)).toFixed(3);
    const focusScale = (Math.min(100, Math.max(0, focusVal)) / 100).toFixed(3);

    rowsHtml += `
      <tr class="student-row ${isSelected ? 'spotlight' : ''}" data-student-id="${student.id}" onclick="selectParticipant(${student.id})">
        <!-- Col 1: PARTICIPANT -->
        <td>
          <div class="participant-cell">
            <div class="participant-avatar-badge mono">0${student.id}</div>
            <div class="participant-info">
              <span class="participant-name">Student #${student.id}</span>
              <span class="participant-sub">${position} · Locked</span>
            </div>
          </div>
        </td>

        <!-- Col 2: POSTURE & HYSTERESIS -->
        <td>
          <div class="posture-cell">
            <svg class="table-hysteresis-ring" viewBox="0 0 22 22">
              <circle class="ring-track" cx="11" cy="11" r="9"></circle>
              <circle id="ring-student-${student.id}" class="ring-progress" cx="11" cy="11" r="9" stroke-dasharray="56.55" stroke-dashoffset="56.55"></circle>
            </svg>
            <div class="posture-text-group">
              <span class="posture-state-title" style="color: ${isMarAlert || isEarAlert ? 'var(--signal-red)' : 'var(--ink-primary)'}">${postureTitle}</span>
              <span class="posture-state-sub mono">${postureSub}</span>
            </div>
          </div>
        </td>

        <!-- Col 3: FOCUS (EMA) -->
        <td>
          <div class="meter-cell-group">
            <div class="meter-cell-readout">
              <span class="mono tabular-nums font-semibold" style="font-size: 13.5px;">${focusVal.toFixed(1)}%</span>
              <span style="font-size: 10.5px; color: var(--ink-tertiary);">Tabular</span>
            </div>
            <div class="ratio-track-with-tick">
              <div class="ratio-track-fill" style="transform: scaleX(${focusScale}); background-color: var(--ink-primary);"></div>
            </div>
          </div>
        </td>

        <!-- Col 4: OCULAR RATIO (EAR >= 0.20) -->
        <td>
          <div class="meter-cell-group">
            <div class="meter-cell-readout">
              <span class="mono tabular-nums font-semibold" style="font-size: 13.5px; color: ${isEarAlert ? 'var(--signal-red)' : 'var(--ink-primary)'}">${earVal.toFixed(2)}</span>
              <span style="font-size: 10.5px; color: ${isEarAlert ? 'var(--signal-red)' : 'var(--ink-secondary)'}">${isEarAlert ? 'Closure Alert' : 'Normal'}</span>
            </div>
            <div class="ratio-track-with-tick">
              <div class="ratio-track-fill" style="transform: scaleX(${earScale}); background-color: ${isEarAlert ? 'var(--signal-red)' : 'var(--ink-primary)'};"></div>
              <div class="ratio-threshold-tick ear-tick" title="0.20 Sleep Threshold"></div>
            </div>
          </div>
        </td>

        <!-- Col 5: MOUTH RATIO (MAR <= 0.60) -->
        <td>
          <div class="meter-cell-group">
            <div class="meter-cell-readout">
              <span class="dot-indicator ${isMarAlert ? 'red' : 'green'}"></span>
              <span class="mono tabular-nums font-semibold" style="font-size: 13.5px; color: ${isMarAlert ? 'var(--signal-red)' : 'var(--ink-primary)'}">${marVal.toFixed(2)}</span>
              <span style="font-size: 10.5px; color: ${isMarAlert ? 'var(--signal-red)' : 'var(--ink-secondary)'}">${isMarAlert ? '> 0.60 Max' : 'Normal'}</span>
            </div>
            <div class="ratio-track-with-tick">
              <div class="ratio-track-fill" style="transform: scaleX(${marScale}); background-color: ${isMarAlert ? 'var(--signal-red)' : 'var(--ink-primary)'};"></div>
              <div class="ratio-threshold-tick mar-tick" title="0.60 Yawn Threshold"></div>
            </div>
          </div>
        </td>

        <!-- Col 6: 5S WAVEFORM -->
        <td>
          <div class="sparkline-box">
            <span class="sparkline-micro-tag mono">Yaw ${yawVal >= 0 ? '+' : ''}${yawVal.toFixed(0)}° · Pitch ${pitchVal >= 0 ? '+' : ''}${pitchVal.toFixed(0)}°</span>
            <canvas id="sparkline-canvas-${student.id}" class="sparkline-canvas" width="130" height="22"></canvas>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = rowsHtml;
}

// Student Row Spotlight Selection
window.selectParticipant = function(id) {
  selectedStudentId = id;
  const primary = engine.target.students.find(s => s.id === id);
  if (primary) {
    engine.target.ear = Number(primary.ear ?? 0.28);
    engine.target.mar = Number(primary.mar ?? 0.08);
    engine.target.yaw = Number(primary.yaw ?? 0);
    engine.target.pitch = Number(primary.pitch ?? 0);
    engine.target.roll = Number(primary.roll ?? 0);
  }
  showToast(`Subject 0${id} Isolated in 3D Pose Gizmo`);
  logIncident(`Subject 0${id} spotlighted for telemetry inspection`, 'blue');
};

// ============================================================================
// 9. TELEMETRY EVENT STREAM & LOGGING (24-HR TIMESTAMPS NO WRAP)
// ============================================================================

function logIncident(text, type = 'green', techContext = '') {
  const list = document.getElementById('telemetry-event-list');
  if (!list) return;

  const row = document.createElement('div');
  row.className = 'telemetry-event-row';

  // Clean 24-hr timestamp: HH:MM:SS
  const timeStr = new Date().toTimeString().split(' ')[0];
  row.innerHTML = `
    <span class="event-time-stamp mono tabular-nums">${timeStr}</span>
    <div class="event-hollow-node ${type}"></div>
    <div class="event-content-box">
      <span class="event-primary-text">${text}</span>
      ${techContext ? `<span class="event-tech-context">${techContext}</span>` : ''}
    </div>
  `;

  list.prepend(row);

  while (list.children.length > 30) {
    list.removeChild(list.lastChild);
  }
}

// Toast helper
function showToast(msg, icon = '🎯') {
  const toast = document.getElementById('toast-notice');
  const msgEl = document.getElementById('toast-msg');
  const iconEl = document.getElementById('toast-icon');
  if (!toast) return;

  if (msgEl) msgEl.textContent = msg;
  if (iconEl) iconEl.textContent = icon;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

// ============================================================================
// 10. INTERACTIVE ACTION HANDLERS & CSV EXPORT
// ============================================================================

function initActionHandlers() {
  // 1. Calibrate Pose Button
  const btnCalibrate = document.getElementById('btn-calibrate');
  if (btnCalibrate) {
    btnCalibrate.addEventListener('click', () => {
      fetch('/api/calibrate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(res => res.json())
        .then(() => {
          showToast('Camera Calibrated! Normal posture set to Forward Facing.');
          logIncident('Head pose baseline auto-calibrated to current posture', 'blue', 'Screen tilt zeroed');
        })
        .catch(() => {
          showToast('Calibration failed. Ensure face is in camera view.', '⚠️');
        });
    });
  }

  // 2. Capacity Mode Selector
  const capacitySelect = document.getElementById('capacity-select');
  if (capacitySelect) {
    capacitySelect.addEventListener('change', function() {
      const val = this.value;
      const maxFaces = val === 'auto' ? 16 : parseInt(val, 10);
      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_faces: maxFaces, mode: val })
      }).catch(err => console.error('Failed to update capacity:', err));
      logIncident(`Classroom capacity set to: ${val === 'auto' ? 'Auto-Adaptive' : val + ' Seats'}`, 'blue');
    });
  }

  // 3. Export CSV Button
  const btnExport = document.getElementById('btn-export-csv');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      if (sessionLogs.length === 0) {
        showToast('No session data recorded yet.', '⚠️');
        return;
      }

      const maxId = Math.max(maxSessionStudents, 1);
      let csvContent = "data:text/csv;charset=utf-8,";
      let headers = [
        "Timestamp", "Course", "Room", "Overall_Score", "Active_Count",
        "Attentive_Count", "Facing_Pct", "Sleep_Pct", "Yawn_Pct"
      ];
      for (let i = 1; i <= maxId; i++) {
        headers.push(`S${i}_Score`, `S${i}_Status`, `S${i}_EAR`, `S${i}_MAR`, `S${i}_Pitch`, `S${i}_Yaw`);
      }
      csvContent += headers.join(",") + "\n";

      sessionLogs.forEach(entry => {
        let sCols = [];
        for (let i = 1; i <= maxId; i++) {
          const s = entry.students.find(x => x.id === i);
          if (s) {
            sCols.push(s.score, `"${s.status}"`, s.ear, s.mar, s.pitch ?? 0, s.yaw ?? 0);
          } else {
            sCols.push("", '""', "", "", "", "");
          }
        }
        const row = [
          entry.timestamp,
          `"${sessionConfig.className || 'CAMS'}"`,
          `"${sessionConfig.room || 'Hall'}"`,
          entry.overall,
          entry.count,
          entry.attentive,
          entry.facing,
          entry.sleep,
          entry.yawn,
          ...sCols
        ].join(",");
        csvContent += row + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `cams_${(sessionConfig.className || 'session').toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Session CSV Exported!', '⬇');
    });
  }

  // 4. Layer Control Pills
  document.querySelectorAll('.layer-pill-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const layer = this.getAttribute('data-layer');
      layerState[layer] = !layerState[layer];
      this.classList.toggle('active', layerState[layer]);

      if (layer === 'blur') {
        const feedImg = document.getElementById('camera-feed');
        if (feedImg) feedImg.classList.toggle('identity-blurred', layerState.blur);
      } else if (layer === 'gizmo') {
        const gizmoBox = document.getElementById('gizmo-hud-container');
        if (gizmoBox) gizmoBox.classList.toggle('hidden', !layerState.gizmo);
      }
    });
  });

  // 5. Copy Session Brief Action Chip
  const btnCopyBrief = document.getElementById('btn-copy-brief');
  const btnCopyBriefText = document.getElementById('btn-copy-brief-text');
  if (btnCopyBrief) {
    btnCopyBrief.addEventListener('click', () => {
      const cur = engine.current;
      const mean = engine.sessionMean;
      const delta = cur.focus - mean;
      const pitch = cur.pitch.toFixed(1);
      const yaw = cur.yaw.toFixed(1);

      const briefText = [
        `=======================================================`,
        `CAMS CLASSROOM ATTENTION MONITORING SYSTEM — REPORT`,
        `=======================================================`,
        `Course: ${sessionConfig.className || 'Classroom Session'}`,
        `Room: ${sessionConfig.room || 'Optical Studio'}`,
        sessionConfig.instructor ? `Instructor: ${sessionConfig.instructor}` : null,
        `Date: ${new Date().toLocaleDateString()} | Time: ${new Date().toLocaleTimeString()}`,
        ``,
        `ENGAGEMENT TELEMETRY:`,
        `• Session Rolling Mean Focus: ${mean.toFixed(1)}%`,
        `• Instantaneous Attention: ${cur.focus.toFixed(1)}%`,
        `• Board / Presentation Alignment: ${cur.facing.toFixed(1)}%`,
        `• Primary Head Angle: Pitch ${pitch}°, Yaw ${yaw}°`,
        `• Kinematic Baselines: EAR ${cur.ear.toFixed(2)} (Eyelids), MAR ${cur.mar.toFixed(2)} (Mouth)`,
        ``,
        `OBSERVATION NOTES:`,
        `• ${document.getElementById('ai-pulse-headline')?.textContent || 'Cohort maintaining stable engagement.'}`,
        `=======================================================`
      ].filter(Boolean).join("\n");

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(briefText).then(() => {
          if (btnCopyBriefText) btnCopyBriefText.textContent = '✓ Summary Copied';
          setTimeout(() => {
            if (btnCopyBriefText) btnCopyBriefText.textContent = 'Copy Session Summary';
          }, 2000);
        });
      } else {
        showToast('Summary copied to clipboard!');
      }
    });
  }

  // 6. Mute Desk-Gaze Alerts Chip
  const btnMuteDesk = document.getElementById('btn-mute-desk');
  const btnMuteDeskText = document.getElementById('btn-mute-desk-text');
  if (btnMuteDesk) {
    btnMuteDesk.addEventListener('click', () => {
      deskExerciseMode = !deskExerciseMode;
      btnMuteDesk.classList.toggle('active', deskExerciseMode);
      if (deskExerciseMode) {
        if (btnMuteDeskText) btnMuteDeskText.textContent = '✓ Desk Mode Active';
        showToast('Desk-Work Mode Active: Downward pitch classified as on-task note-taking.');
        logIncident('Desk-Work Mode enabled: Downward gaze muted', 'blue', 'Downward head posture classified as active problem-solving');
        if (deskExerciseTimeout) clearTimeout(deskExerciseTimeout);
        deskExerciseTimeout = setTimeout(() => {
          deskExerciseMode = false;
          btnMuteDesk.classList.remove('active');
          if (btnMuteDeskText) btnMuteDeskText.textContent = 'Toggle Desk-Work Mode';
          logIncident('Desk-Work Mode expired: Standard gaze cone restored', 'green');
        }, 300000);
      } else {
        if (btnMuteDeskText) btnMuteDeskText.textContent = 'Toggle Desk-Work Mode';
        if (deskExerciseTimeout) clearTimeout(deskExerciseTimeout);
        showToast('Desk-Work Mode Disabled');
      }
      updateAIPulseCard();
    });
  }

  // 7. Temporal Curve Deep Insight & Zoom Controls
  const btnOpenDeep = document.getElementById('btn-open-deep-insight');
  if (btnOpenDeep) {
    btnOpenDeep.addEventListener('click', () => openDeepInsightModal());
  }

  const btnHeaderReset = document.getElementById('btn-header-reset-zoom');
  if (btnHeaderReset) {
    btnHeaderReset.addEventListener('click', () => {
      resetChartZoom();
      showToast('Reset to Live Stream', '⟲');
    });
  }

  // Floating HUD Bar Action Buttons
  const btnHudModal = document.getElementById('btn-hud-modal');
  if (btnHudModal) {
    btnHudModal.addEventListener('click', () => openDeepInsightModal());
  }

  const btnHudCopy = document.getElementById('btn-hud-copy');
  if (btnHudCopy) {
    btnHudCopy.addEventListener('click', () => {
      if (chartZoomState.sliceStats) copySliceReport(chartZoomState.sliceStats);
    });
  }

  const btnHudReset = document.getElementById('btn-hud-reset');
  if (btnHudReset) {
    btnHudReset.addEventListener('click', () => {
      resetChartZoom();
      showToast('Reset to Live Stream', '⟲');
    });
  }

  // Deep Insight Modal Action Buttons
  const btnCloseDeepModal = document.getElementById('btn-close-deep-modal');
  if (btnCloseDeepModal) btnCloseDeepModal.addEventListener('click', closeDeepInsightModal);

  const btnModalClose = document.getElementById('btn-modal-close');
  if (btnModalClose) btnModalClose.addEventListener('click', closeDeepInsightModal);

  const btnModalResetLive = document.getElementById('btn-modal-reset-live');
  if (btnModalResetLive) {
    btnModalResetLive.addEventListener('click', () => {
      closeDeepInsightModal();
      resetChartZoom();
      showToast('Reset to Live Stream', '⟲');
    });
  }

  const btnModalExportSlice = document.getElementById('btn-modal-export-slice');
  if (btnModalExportSlice) {
    btnModalExportSlice.addEventListener('click', () => {
      exportSliceToCsv(chartZoomState.sliceStats);
    });
  }

  const btnModalCopySummary = document.getElementById('btn-modal-copy-summary');
  if (btnModalCopySummary) {
    btnModalCopySummary.addEventListener('click', () => {
      copySliceReport(chartZoomState.sliceStats);
    });
  }

  // Global Keyboard Escape Handler
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modalBackdrop = document.getElementById('deep-insight-modal-backdrop');
      if (modalBackdrop && modalBackdrop.classList.contains('show')) {
        closeDeepInsightModal();
      } else if (chartZoomState.isZoomed) {
        resetChartZoom();
        showToast('Reset to Live Telemetry Stream', '⟲');
      }
    }
  });
}

// ============================================================================
// 11. WEBSOCKET & REST TELEMETRY INGESTION
// ============================================================================

let socket = null;
let reconnectTimer = null;

function handleTelemetryPayload(payload) {
  const chartData = payload.chart || payload;
  let timestamp = chartData.timestamp;
  if (!timestamp || timestamp === '--:--:--') {
    timestamp = new Date().toTimeString().split(' ')[0];
  }

  engine.ingestPacket(payload);

  const overall = Number(chartData.overall_score || 0);
  const count = Number(chartData.count || 0);
  const attentive = Number(chartData.attention_count || 0);
  const facing = Number(chartData.facing_classroom || 0);
  const sleep = Number(chartData.sleep_detected || 0);
  const yawn = Number(chartData.yawn_detected || 0);
  const students = chartData.students || [];

  students.forEach(s => {
    if (s.id > maxSessionStudents) maxSessionStudents = s.id;
  });

  const frameData = {
    timestamp,
    overall,
    count,
    attentive,
    facing,
    sleep,
    yawn,
    students: students.map(s => ({
      id: s.id,
      score: s.score,
      status: s.status,
      ear: s.ear,
      mar: s.mar,
      yaw: s.yaw,
      pitch: s.pitch
    }))
  };

  // Store in session logs for CSV export
  sessionLogs.push(frameData);

  // Push into Chart.js (with smooth facing curve and frameData attachment)
  const peakMar = students.length > 0 ? Math.max(...students.map(s => Number(s.mar || 0))) : (yawn || 0);
  const fatiguePct = Math.min(100, (peakMar / 0.80) * 100);
  pushChartPoint(timestamp, overall, engine.sessionMean, Math.round(engine.current.facing), fatiguePct, frameData);

  // State Transition Event Logs with 3.5s anti-jitter debounce & rich details
  const nowMs = Date.now();
  students.forEach(s => {
    if (prevStudentStates[s.id] && prevStudentStates[s.id] !== s.status) {
      const lastLogged = lastStateChangeTimes[s.id] || 0;
      if (nowMs - lastLogged > 3500) {
        lastStateChangeTimes[s.id] = nowMs;
        const nodeColor = s.status === 'Attentive' ? 'green' : (s.status === 'Sleeping' ? 'red' : 'amber');
        let detail = `EAR ${Number(s.ear).toFixed(2)} · MAR ${Number(s.mar).toFixed(2)}`;
        if (s.status === 'Looking Down') {
          detail = `Downward pitch (${Number(s.pitch).toFixed(1)}°) · Classified as desk activity`;
        } else if (s.status === 'Yawning') {
          detail = `2.0s hysteresis ring at 70% · MAR ${Number(s.mar).toFixed(2)} threshold crossed`;
        } else if (s.status === 'Attentive') {
          detail = `Subject returned to primary board cone · Stable engagement`;
        }
        logIncident(`Subject 0${s.id} transitioned to: ${s.status}`, nodeColor, detail);
      }
    }
    prevStudentStates[s.id] = s.status;
  });
}

function connectWebSocket() {
  const host = window.location.host || 'localhost:3000';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${host}`;

  const dot = document.getElementById('island-stream-dot');
  const fpsText = document.getElementById('island-stream-fps');

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = function() {
      if (dot) dot.className = 'island-dot green';
      if (fpsText) fpsText.textContent = 'LIVE 30.0 fps';
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      logIncident('Live WebSocket telemetry stream connected', 'blue', 'Sub-millisecond packet stream active');
    };

    socket.onmessage = function(event) {
      try {
        const payload = JSON.parse(event.data);
        handleTelemetryPayload(payload);
      } catch (err) {
        console.error('Error parsing telemetry payload:', err);
      }
    };

    socket.onclose = function() {
      if (dot) dot.className = 'island-dot amber';
      if (fpsText) fpsText.textContent = 'RECONNECTING...';
      scheduleReconnect();
    };

    socket.onerror = function() {
      if (socket) socket.close();
    };
  } catch (err) {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (!reconnectTimer) {
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectWebSocket();
    }, 2000);
  }
}

// REST fallback polling
setInterval(() => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    fetch('/api/data')
      .then(res => res.json())
      .then(data => {
        if (data && (data.chart || data.overall_score !== undefined)) {
          handleTelemetryPayload(data);
        }
      })
      .catch(() => {});
  }
}, 2000);

// ============================================================================
// 12. INITIALIZATION & SCHEDULER START
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  gizmoCanvas = document.getElementById('gizmo-canvas');

  // Trigger cinematic Awakening Eye bootloader sequence
  runBootloaderSequence(false);

  initSessionSetup();
  initMasterChart();
  initActionHandlers();

  // Populate initial empty or detected table
  renderBiometricLedgerTable([]);

  // Start Two-Speed Schedulers
  // 1. Fast 60/120fps rAF Loop
  requestAnimationFrame(runAnimationFrameLoop);

  // 2. Calm 4Hz (250ms) Tabular Throttle
  setInterval(runTabularThrottle, 250);

  // 3. AI Lecture Pulse Debounced Evaluator (every 10s)
  setInterval(updateAIPulseCard, 10000);
  updateAIPulseCard();

  // Connect Telemetry
  connectWebSocket();
});
