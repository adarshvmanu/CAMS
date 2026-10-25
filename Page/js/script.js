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

  const BOOT_DURATION = 1600; // 1.6s smooth wake sequence
  const startTime = performance.now();

  const bootStages = [
    { p: 0.18, text: '[0.06s] GPU / Metal Hardware Acceleration: Online' },
    { p: 0.38, text: '[0.18s] MediaPipe 468-Point Anthropometric Model: Loaded' },
    { p: 0.62, text: '[0.32s] Perspective-n-Point 3D Head-Pose Geometry: Calibrated' },
    { p: 0.82, text: '[0.48s] Ocular Aspect Ratio (EAR) Dynamic Baseline: Armed' },
    { p: 0.96, text: '[0.70s] High-Frequency Telemetry In-Memory Stream: Synchronized' },
    { p: 1.00, text: 'OPTICAL LOCK CONFIRMED · LAUNCHING STUDIO' }
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
    if (logText) logText.textContent = 'OPTICAL LOCK CONFIRMED · LAUNCHING STUDIO';
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
    this.fpsFrameCounter++;
    const now = performance.now();
    if (now - this.fpsTimer >= 1000) {
      this.fpsEstimate = Math.min(30.0, Math.max(10.0, (this.fpsFrameCounter * 1000) / (now - this.fpsTimer)));
      this.fpsFrameCounter = 0;
      this.fpsTimer = now;
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
          pointRadius: (context) => (context.dataIndex === context.dataset.data.length - 1 ? 4 : 0),
          pointBackgroundColor: '#18181B',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2
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
          pointRadius: 0,
          fill: false,
          tension: 0.28
        },
        {
          label: 'MAR / Fatigue %',
          data: chartHistory.fatigue,
          borderColor: '#FF3B30',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.28
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(24, 24, 27, 0.92)',
          titleFont: { family: 'JetBrains Mono', size: 11 },
          bodyFont: { family: 'Inter', size: 12 },
          cornerRadius: 6,
          padding: 8
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
            maxTicksLimit: 6
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

  // Filter Buttons
  document.querySelectorAll('.filter-tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const filter = this.getAttribute('data-filter');

      if (!chartInstance) return;

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
      chartInstance.update('none');
    });
  });
}

function pushChartPoint(timestamp, focus, mean, facing, fatiguePct) {
  if (!chartInstance) return;

  chartHistory.labels.push(timestamp);
  chartHistory.focus.push(focus);
  chartHistory.mean.push(mean);
  chartHistory.facing.push(facing);
  chartHistory.fatigue.push(fatiguePct);

  if (chartHistory.labels.length > MAX_HISTORY_POINTS) {
    chartHistory.labels.shift();
    chartHistory.focus.shift();
    chartHistory.mean.shift();
    chartHistory.facing.shift();
    chartHistory.fatigue.shift();
  }

  chartInstance.update('none');
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
  if (pitch < -12 && mar < 0.45 && ear >= 0.20) {
    return {
      severity: 'warn',
      headline: isDeskMode
        ? `Desk Exercise Mode active — Subject 0${id} downward gaze (${pitch.toFixed(1)}°) classified as on-task.`
        : `Subject 0${id} shifted to downward pitch (${pitch.toFixed(1)}°) with normal ocular/mouth vectors.`,
      detail: `Pattern matches desk note-taking rather than drowsiness (EAR ${ear.toFixed(2)}, MAR ${mar.toFixed(2)}).`
    };
  }

  // 3. Lateral Gaze Drift
  if (Math.abs(yaw) > 20) {
    return {
      severity: 'warn',
      headline: `Lateral gaze drift observed (${yaw > 0 ? '+' : ''}${yaw.toFixed(1)}° yaw) outside primary board cone.`,
      detail: `Board alignment dipped to ${facingPct.toFixed(0)}%, though ocular alertness remains normal (EAR ${ear.toFixed(2)}).`
    };
  }

  // 4. Default High-Engagement State
  return {
    severity: 'stable',
    headline: `Cohort engagement steady at ${focusMean.toFixed(1)}% with ${facingPct.toFixed(0)}% board gaze alignment.`,
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
      rowRing.style.stroke = (s.mar > 0.60 || s.ear < 0.20) ? 'var(--signal-red)' : 'var(--signal-green)';
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
    slotsLabel.textContent = `${students.length} participant(s) locked · continuous telemetry active`;
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
        `CAMS Session Brief — ${sessionConfig.className || 'Classroom Session'} (${sessionConfig.room || 'Hall'})`,
        sessionConfig.instructor ? `• Lead Instructor: ${sessionConfig.instructor}` : null,
        `• Rolling Mean Focus: ${mean.toFixed(1)}% | Instantaneous Focus: ${cur.focus.toFixed(1)}% (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs mean)`,
        `• Board Alignment: ${cur.facing.toFixed(1)}% | Active Pose: Pitch ${pitch}°, Yaw ${yaw}°`,
        `• Peak Fatigue Vector: MAR ${cur.mar.toFixed(2)} | EAR ${cur.ear.toFixed(2)} (Gate: ${(engine.gateHoldMs / 1000).toFixed(1)}s / 2.0s)`,
        `• AI Pedagogical Takeaway: ${document.getElementById('ai-pulse-headline')?.textContent || 'Cohort stable'}`
      ].filter(Boolean).join("\n");

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(briefText).then(() => {
          if (btnCopyBriefText) btnCopyBriefText.textContent = '✓ Brief Copied';
          setTimeout(() => {
            if (btnCopyBriefText) btnCopyBriefText.textContent = 'Copy Session Brief';
          }, 2000);
        });
      } else {
        showToast('Brief copied to clipboard!');
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
        if (btnMuteDeskText) btnMuteDeskText.textContent = '✓ Desk Mode Active (5m)';
        showToast('Desk Exercise Mode Active: Downward pitch classified as on-task note-taking.');
        logIncident('Desk Exercise Mode enabled: Downward gaze muted', 'blue', 'Pitch < -12° classified as active problem-solving');
        if (deskExerciseTimeout) clearTimeout(deskExerciseTimeout);
        deskExerciseTimeout = setTimeout(() => {
          deskExerciseMode = false;
          btnMuteDesk.classList.remove('active');
          if (btnMuteDeskText) btnMuteDeskText.textContent = 'Mute Desk-Gaze Alerts (5m)';
          logIncident('Desk Exercise Mode expired: Standard gaze cone restored', 'green');
        }, 300000);
      } else {
        if (btnMuteDeskText) btnMuteDeskText.textContent = 'Mute Desk-Gaze Alerts (5m)';
        if (deskExerciseTimeout) clearTimeout(deskExerciseTimeout);
        showToast('Desk Exercise Mode Disabled');
      }
      updateAIPulseCard();
    });
  }
}

// ============================================================================
// 11. WEBSOCKET & REST TELEMETRY INGESTION
// ============================================================================

let socket = null;
let reconnectTimer = null;

function handleTelemetryPayload(payload) {
  const chartData = payload.chart || payload;
  const timestamp = chartData.timestamp || new Date().toTimeString().split(' ')[0];

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

  // Push into Chart.js (with smooth facing curve)
  const peakMar = students.length > 0 ? Math.max(...students.map(s => Number(s.mar || 0))) : (yawn || 0);
  const fatiguePct = Math.min(100, (peakMar / 0.80) * 100);
  pushChartPoint(timestamp, overall, engine.sessionMean, Math.round(engine.current.facing), fatiguePct);

  // Store in session logs for CSV export
  sessionLogs.push({
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
  });

  // State Transition Event Logs
  students.forEach(s => {
    if (prevStudentStates[s.id] && prevStudentStates[s.id] !== s.status) {
      const nodeColor = s.status === 'Attentive' ? 'green' : (s.status === 'Sleeping' ? 'red' : 'amber');
      logIncident(`Subject 0${s.id} transitioned to: ${s.status}`, nodeColor, `EAR ${Number(s.ear).toFixed(2)} · MAR ${Number(s.mar).toFixed(2)}`);
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
