/* ── BOOT SEQUENCE ────────────────────────────────────────────────── */
(function initBoot() {
  const overlay  = document.getElementById('boot-overlay');
  const bar      = document.getElementById('bootBar');
  const status   = document.getElementById('bootStatus');
  const skipBtn  = document.getElementById('bootSkip');
  if (!overlay) return;

  const stages = [
    { pct: 18,  msg: 'Opening workbook...',       delay: 300 },
    { pct: 42,  msg: 'Loading sheet data...',     delay: 500 },
    { pct: 65,  msg: 'Calculating formulas...',   delay: 450 },
    { pct: 84,  msg: 'Rendering cells...',        delay: 400 },
    { pct: 100, msg: 'Ready.',                    delay: 350 },
  ];

  let _embedsLoaded  = false;
  let _autoplayFired = false;

  function dismiss() {
    overlay.classList.add('hidden');
    document.body.classList.remove('boot-active');
    if (typeof window.runHeroOpening === 'function') window.runHeroOpening();
    // Always hydrate remaining embeds on dismiss (autoplay guarded separately)
    lazyLoadRemainingEmbeds();
    setTimeout(() => {
      const npw = document.getElementById('now-playing-widget');
      if (npw) npw.classList.remove('hidden');
    }, 3200);
  }

  // Load all embeds without autoplay — idempotent
  function lazyLoadRemainingEmbeds() {
    if (_embedsLoaded) return;
    _embedsLoaded = true;
    setTimeout(() => {
      document.querySelectorAll('.card-embed-iframe[data-src]').forEach(iframe => {
        iframe.src = iframe.dataset.src;
        iframe.removeAttribute('data-src');
      });
    }, 800);
  }

  // Trigger autoplay on first user gesture — idempotent.
  // Must be called synchronously inside a pointer/click handler so Chrome
  // sees a user-activated iframe navigation and allows audio.
  function triggerAutoplay() {
    if (_autoplayFired) return;
    _autoplayFired = true;
    const lazySrcs = document.querySelectorAll('.card-embed-iframe[data-src]');
    if (!lazySrcs.length) return;
    const pick = lazySrcs[Math.floor(Math.random() * lazySrcs.length)];
    const url  = pick.dataset.src;
    pick.removeAttribute('data-src');
    pick.src = url + '&autoplay=1';
  }

  // Skip button — user clicks it mid-stages or when it shows "skip"
  skipBtn.addEventListener('click', () => {
    triggerAutoplay();
    dismiss();
  });

  // Catch the FIRST pointer interaction anywhere on the page after auto-dismiss.
  // This fires on scroll-click, card hover-click, anything — giving us a real
  // user gesture for autoplay without requiring a dedicated "Enter" button.
  document.addEventListener('pointerdown', triggerAutoplay, { once: true, capture: true });

  let i = 0;
  function runStage() {
    if (i >= stages.length) { setTimeout(dismiss, 400); return; }
    const s = stages[i++];
    bar.style.width = s.pct + '%';
    status.textContent = s.msg;
    setTimeout(runStage, s.delay);
  }

  setTimeout(runStage, 300);
})();


/* ── HERO OPENING ANIMATION — "The Workbook Opens" ───────────────── */
(function initHeroOpening() {
  const canvas = document.getElementById('openingCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const heroContent = document.getElementById('heroContent');

  const isMobile = () => window.matchMedia('(hover: none)').matches;

  // Palette matching the site
  const C = {
    bg:       '#F2EDE4',
    bgCard:   '#E8E2D6',
    text:     '#1C1A17',
    muted:    '#7A7060',
    accent:   '#217346',
    border:   '#C8BFB0',
  };
  const MONO = '"Space Mono", monospace';

  // Spreadsheet data
  const COLS  = ['A', 'B', 'C'];
  const ROWS  = [
    ['terry cloth',       '2024', 'single'],
    ['nori',              '2022', 'album' ],
    ['salt on the rim',   '2021', 'single'],
    ['kale chips',        '2020', 'ep'    ],
    ['just saying',       '2020', 'single'],
    ['=COUNT(A1:A5)',      '5',   '=READY'],
  ];
  const FORMULA = '=RELEASE("terry cloth", 2024, "single")';

  const TITLE_H   = 32;
  const FMLA_H    = 28;
  const COLHDR_H  = 26;
  const ROW_H     = 34;
  const RNUM_W    = 36;

  function revealHero() {
    if (heroContent) heroContent.classList.add('revealed');
    // Reveal the formula feed a beat after the hero title appears
    setTimeout(() => {
      const feed = document.getElementById('heroFeed');
      if (feed) feed.classList.add('visible');
    }, 500);
  }

  function run() {
    // On mobile or reduced motion: skip straight to hero
    if (isMobile() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      canvas.style.opacity = '0';
      canvas.style.pointerEvents = 'none';
      revealHero();
      return;
    }

    canvas.width  = canvas.offsetWidth  || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;

    const W = canvas.width, H = canvas.height;

    // Spreadsheet frame size
    const SW = Math.min(W * 0.82, 560);
    const numRows = ROWS.length;
    const SH = TITLE_H + FMLA_H + COLHDR_H + numRows * ROW_H;
    const SX = (W - SW) / 2;
    const SY = (H - SH) / 2 - 20;

    // Column widths
    const avail = SW - RNUM_W;
    const colW  = [Math.floor(avail * 0.50), Math.floor(avail * 0.16), Math.floor(avail * 0.34)];

    // Animation timing (ms)
    const T_APPEAR  = 0;
    const T_APPEAR_DUR = 380;
    const T_CELLS   = T_APPEAR + T_APPEAR_DUR;
    const CELL_STEP = 75;          // ms per cell
    const CELL_TYPE = 180;         // ms to type each cell
    const TOTAL_CELLS = ROWS.length * COLS.length;
    const T_CELLS_END = T_CELLS + TOTAL_CELLS * CELL_STEP + CELL_TYPE;
    const T_SELECT  = T_CELLS_END + 60;
    const SELECT_STEP = 140;
    const T_SELECT_END = T_SELECT + TOTAL_CELLS * SELECT_STEP;
    const T_FADE    = T_SELECT_END + 100;
    const T_FADE_DUR = 550;
    const T_TOTAL   = T_FADE + T_FADE_DUR + 200;

    let selRow = -1, selCol = -1;
    let startTs = null;

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
    function easeInCubic(t)  { return t * t * t; }
    function clamp01(x)      { return Math.max(0, Math.min(1, x)); }

    function drawSpreadsheet(elapsed) {
      ctx.clearRect(0, 0, W, H);

      // BG
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, W, H);

      // Grid dots in bg
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.25;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      ctx.globalAlpha = 1;

      // Frame scale-in
      const appearT  = clamp01((elapsed - T_APPEAR) / T_APPEAR_DUR);
      const scale    = 0.88 + easeOutCubic(appearT) * 0.12;
      const alpha    = easeOutCubic(appearT);
      ctx.globalAlpha = alpha;

      ctx.save();
      ctx.translate(SX + SW / 2, SY + SH / 2);
      ctx.scale(scale, scale);
      ctx.translate(-SW / 2, -SH / 2);

      // Drop shadow
      ctx.shadowColor   = 'rgba(28,26,23,0.18)';
      ctx.shadowBlur    = 28;
      ctx.shadowOffsetY = 10;

      // Sheet body
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, SW, SH);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur  = 0;
      ctx.shadowOffsetY = 0;

      // Outer border
      ctx.strokeStyle = C.text;
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(0.75, 0.75, SW - 1.5, SH - 1.5);

      // ── Title bar ──
      ctx.fillStyle = C.text;
      ctx.fillRect(0, 0, SW, TITLE_H);

      ctx.font          = `bold 9px ${MONO}`;
      ctx.fillStyle     = C.bg;
      ctx.textBaseline  = 'middle';
      ctx.textAlign     = 'left';
      ctx.fillText('SPREADSHEETS.xls', 10, TITLE_H / 2);

      // Win buttons
      ['×', '□', '−'].forEach((btn, i) => {
        const bx = SW - 14 - i * 22;
        ctx.fillStyle = 'rgba(242,237,228,0.18)';
        ctx.fillRect(bx - 7, TITLE_H / 2 - 7, 14, 13);
        ctx.fillStyle = 'rgba(242,237,228,0.55)';
        ctx.font = `9px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText(btn, bx, TITLE_H / 2 + 1);
      });
      ctx.textAlign = 'left';

      // ── Formula bar ──
      const FY = TITLE_H;
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, FY, SW, FMLA_H);
      ctx.strokeStyle = C.border;
      ctx.lineWidth   = 1;
      ctx.strokeRect(0, FY, SW, FMLA_H);

      // Cell ref
      ctx.font      = `9px ${MONO}`;
      ctx.fillStyle = C.text;
      ctx.textBaseline = 'middle';
      ctx.fillText('A1', 9, FY + FMLA_H / 2);

      ctx.strokeStyle = C.border;
      ctx.beginPath(); ctx.moveTo(46, FY); ctx.lineTo(46, FY + FMLA_H); ctx.stroke();

      // fx
      ctx.font      = `italic 9px ${MONO}`;
      ctx.fillStyle = C.accent;
      ctx.fillText('fx', 54, FY + FMLA_H / 2);

      ctx.beginPath(); ctx.moveTo(72, FY); ctx.lineTo(72, FY + FMLA_H); ctx.stroke();

      // Formula typing
      const ftProgress = clamp01((elapsed - T_APPEAR * 0.5 - 120) / 700);
      const ftChars    = Math.floor(FORMULA.length * ftProgress);
      ctx.font      = `9px ${MONO}`;
      ctx.fillStyle = C.text;
      ctx.fillText(FORMULA.substring(0, ftChars), 80, FY + FMLA_H / 2);

      // ── Column headers ──
      const CHY = FY + FMLA_H;
      ctx.fillStyle = C.bgCard;
      ctx.fillRect(0, CHY, SW, COLHDR_H);
      ctx.strokeStyle = C.border;
      ctx.lineWidth   = 1;
      ctx.strokeRect(0, CHY, SW, COLHDR_H);

      // Row-num header corner
      ctx.fillStyle = C.bgCard;
      ctx.fillRect(0, CHY, RNUM_W, COLHDR_H);
      ctx.strokeStyle = C.border;
      ctx.beginPath(); ctx.moveTo(RNUM_W, CHY); ctx.lineTo(RNUM_W, SH); ctx.stroke();

      let cx = RNUM_W;
      COLS.forEach((col, ci) => {
        ctx.strokeStyle = C.border;
        ctx.beginPath(); ctx.moveTo(cx, CHY); ctx.lineTo(cx, SH); ctx.stroke();

        ctx.font         = `bold 9px ${MONO}`;
        ctx.fillStyle    = C.muted;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(col, cx + colW[ci] / 2, CHY + COLHDR_H / 2);
        ctx.textAlign = 'left';
        cx += colW[ci];
      });

      // ── Data rows ──
      const DY = CHY + COLHDR_H;
      ROWS.forEach((rowData, ri) => {
        const ry = DY + ri * ROW_H;

        // Row bg
        ctx.fillStyle = ri % 2 === 0 ? C.bg : 'rgba(200,191,176,0.13)';
        ctx.fillRect(0, ry, SW, ROW_H);

        // Row separator
        ctx.strokeStyle = C.border;
        ctx.lineWidth   = 0.5;
        ctx.beginPath(); ctx.moveTo(0, ry + ROW_H); ctx.lineTo(SW, ry + ROW_H); ctx.stroke();

        // Row number
        ctx.font         = `9px ${MONO}`;
        ctx.fillStyle    = C.muted;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(ri + 1), RNUM_W / 2, ry + ROW_H / 2);
        ctx.textAlign = 'left';

        // Cell selection highlight
        if (selRow === ri) {
          let scx = RNUM_W;
          COLS.forEach((_, ci) => {
            if (selCol === ci || selCol === -1) {
              ctx.fillStyle = 'rgba(33,115,70,0.09)';
              ctx.fillRect(scx, ry, colW[ci], ROW_H);
              if (selCol === ci) {
                ctx.strokeStyle = C.accent;
                ctx.lineWidth   = 1.5;
                ctx.strokeRect(scx + 0.75, ry + 0.75, colW[ci] - 1.5, ROW_H - 1.5);
              }
            }
            scx += colW[ci];
          });
        }

        // Cell values
        let vcx = RNUM_W;
        rowData.forEach((val, ci) => {
          const cellIdx  = ri * COLS.length + ci;
          const cellStart = T_CELLS + cellIdx * CELL_STEP;
          const p        = clamp01((elapsed - cellStart) / CELL_TYPE);
          const chars    = Math.floor(val.length * p);

          ctx.font      = `9px ${MONO}`;
          ctx.fillStyle = val.startsWith('=') ? C.accent : C.text;
          ctx.textBaseline = 'middle';

          // Clip to cell width
          ctx.save();
          ctx.rect(vcx + 1, ry, colW[ci] - 2, ROW_H);
          ctx.clip();
          ctx.fillText(val.substring(0, chars), vcx + 7, ry + ROW_H / 2);
          ctx.restore();

          vcx += colW[ci];
        });
      });

      ctx.restore();
      ctx.globalAlpha = 1;
    }

    function animate(ts) {
      if (!startTs) startTs = ts;
      const elapsed = ts - startTs;

      // Update selection state
      if (elapsed >= T_SELECT && elapsed < T_FADE) {
        const si = Math.floor((elapsed - T_SELECT) / SELECT_STEP);
        selRow = Math.floor(si / COLS.length) % ROWS.length;
        selCol = si % COLS.length;
      }

      drawSpreadsheet(elapsed);

      // Fade out to ghost opacity (not zero)
      if (elapsed >= T_FADE) {
        const fp = clamp01((elapsed - T_FADE) / T_FADE_DUR);
        canvas.style.opacity = String(1 - easeInCubic(fp) * 0.95);
        if (fp > 0.35) revealHero();
      }

      if (elapsed < T_TOTAL) {
        requestAnimationFrame(animate);
      } else {
        // Leave a ghost-faint trace of the spreadsheet as a background texture
        canvas.style.transition = 'opacity 1.2s ease';
        canvas.style.opacity = '0.05';
        canvas.style.pointerEvents = 'none';
        revealHero();
        // Auto-trigger the recalculate glitch animation after hero reveals
        setTimeout(() => {
          const title = document.getElementById('heroTitle');
          if (title) title.click();
        }, 800);
      }
    }

    requestAnimationFrame(animate);
  }

  // Expose for boot to call
  window.runHeroOpening = run;
})();


/* ── CUSTOM CURSOR ────────────────────────────────────────────────── */
const cursor = document.getElementById('cursor');
let mouseX = 0, mouseY = 0, curX = 0, curY = 0;

document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

(function animateCursor() {
  curX += (mouseX - curX) * 0.18;
  curY += (mouseY - curY) * 0.18;
  cursor.style.left = curX + 'px';
  cursor.style.top  = curY + 'px';
  requestAnimationFrame(animateCursor);
})();

document.querySelectorAll('a, button').forEach(el => {
  el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
  el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
});


/* ── NAV SCROLL STATE ─────────────────────────────────────────────── */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });


/* ── SCROLL PROGRESS BAR ──────────────────────────────────────────── */
const scrollProgressBar = document.getElementById('scroll-progress');
if (scrollProgressBar) {
  window.addEventListener('scroll', () => {
    const docH    = document.documentElement.scrollHeight - window.innerHeight;
    const pct     = docH > 0 ? (window.scrollY / docH) * 100 : 0;
    scrollProgressBar.style.width = pct + '%';
  }, { passive: true });
}


/* ── SCROLL REVEAL ────────────────────────────────────────────────── */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// FAQ open/close toggle label
document.querySelectorAll('.faq-item').forEach(item => {
  item.addEventListener('toggle', () => {
    const toggle = item.querySelector('.faq-toggle');
    if (toggle) toggle.textContent = item.open ? '−' : '+';
  });
});


/* ── SCROLL VELOCITY → MARQUEE SPEED ─────────────────────────────── */
(function initMarqueeVelocity() {
  const track = document.querySelector('.marquee-track');
  if (!track) return;
  let lastY = 0, vel = 0, raf;
  const BASE_DUR = 28; // seconds

  function update() {
    const dy  = window.scrollY - lastY;
    lastY     = window.scrollY;
    vel       = Math.abs(dy);
    const dur = Math.max(6, BASE_DUR - vel * 0.4);
    track.style.animationDuration = dur + 's';
    raf = requestAnimationFrame(update);
  }
  raf = requestAnimationFrame(update);
})();


/* ── HERO GRID PARALLAX ON SCROLL ────────────────────────────────── */
(function initHeroParallax() {
  const gridBg = document.querySelector('.hero-grid-bg');
  if (!gridBg) return;
  window.addEventListener('scroll', () => {
    const shift = window.scrollY * 0.25;
    gridBg.style.transform = `translateY(${shift}px)`;
  }, { passive: true });
})();


/* ── FORMULA BAR ──────────────────────────────────────────────────── */
const formulaBar     = document.getElementById('formula-bar');
const formulaCell    = document.getElementById('formulaCellRef');
const formulaContent = document.getElementById('formulaContent');

const releaseCards = document.querySelectorAll('.release-card');

releaseCards.forEach(card => {
  card.addEventListener('mouseenter', () => {
    const cell   = card.dataset.cell   || 'A1';
    const title  = card.dataset.title  || '';
    const year   = card.dataset.year   || '';
    const format = card.dataset.format || '';

    formulaCell.textContent    = cell;
    formulaContent.textContent = `=RELEASE("${title}", ${year}, "${format}", Spotify!A1)`;
    formulaBar.classList.remove('hidden');
    updateStatus(cell, title);
  });

  card.addEventListener('mouseleave', () => {
    formulaBar.classList.add('hidden');
    resetStatus();
  });
});


/* ── STATUS BAR ───────────────────────────────────────────────────── */
const sbReady     = document.getElementById('sbReady');
const sbCell      = document.getElementById('sbCell');
const sbNowPlay   = document.getElementById('sbNowPlaying');
let   currentTrack = '—';

function updateStatus(cell, title) {
  sbCell.textContent     = cell;
  sbReady.textContent    = 'SELECTED';
  sbNowPlay.textContent  = `♪ ${title.toLowerCase()}`;
  currentTrack = title;
  updateNPWidget(title);
}

function resetStatus() {
  sbCell.textContent  = 'A1';
  sbReady.textContent = 'READY';
  sbNowPlay.textContent = currentTrack !== '—' ? `♪ ${currentTrack.toLowerCase()}` : '♪ —';
}

function updateNPWidget(title) {
  const npTrack = document.getElementById('npTrack');
  if (npTrack) npTrack.textContent = title;
}


/* ── 3D CARD TILT ─────────────────────────────────────────────────── */
const isTouchDevice = () => window.matchMedia('(hover: none)').matches;

releaseCards.forEach(card => {
  if (isTouchDevice()) return;

  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x  = e.clientX - rect.left;
    const y  = e.clientY - rect.top;
    const rotY =  ((x - rect.width  / 2) / (rect.width  / 2)) * 6;
    const rotX = -((y - rect.height / 2) / (rect.height / 2)) * 6;
    card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(4px)`;
  });

  card.addEventListener('mouseleave', () => {
    card.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 0.3s ease';
    card.style.transform  = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0)';
  });

  card.addEventListener('mouseenter', () => {
    card.style.transition = 'none';
  });
});


/* ── DRAG TO SCROLL (release cards) ──────────────────────────────── */
const trackWrapper = document.querySelector('.cards-track-wrapper');
if (trackWrapper) {
  let isDown = false, startX, scrollLeft;

  trackWrapper.addEventListener('mousedown', e => {
    isDown = true;
    startX = e.pageX - trackWrapper.offsetLeft;
    scrollLeft = trackWrapper.scrollLeft;
    trackWrapper.style.userSelect = 'none';
  });
  trackWrapper.addEventListener('mouseleave', () => isDown = false);
  trackWrapper.addEventListener('mouseup',    () => isDown = false);
  trackWrapper.addEventListener('mousemove', e => {
    if (!isDown) return;
    e.preventDefault();
    const x    = e.pageX - trackWrapper.offsetLeft;
    const walk = (x - startX) * 1.5;
    trackWrapper.scrollLeft = scrollLeft - walk;
  });
}


/* ── NOW PLAYING WIDGET (DRAGGABLE) ──────────────────────────────── */
(function initWidget() {
  const widget    = document.getElementById('now-playing-widget');
  const handle    = document.getElementById('npHandle');
  const closeBtn  = document.getElementById('npClose');
  const reopenBtn = document.getElementById('sbReopenNP');
  if (!widget || !handle) return;

  let dragging = false, ox = 0, oy = 0;

  handle.addEventListener('mousedown', e => {
    dragging = true;
    const rect = widget.getBoundingClientRect();
    ox = e.clientX - rect.left;
    oy = e.clientY - rect.top;
    widget.style.transition = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const x = Math.max(0, Math.min(window.innerWidth  - widget.offsetWidth,  e.clientX - ox));
    const y = Math.max(0, Math.min(window.innerHeight - widget.offsetHeight - 28, e.clientY - oy));
    widget.style.left   = x + 'px';
    widget.style.top    = y + 'px';
    widget.style.right  = 'auto';
    widget.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => dragging = false);

  if (closeBtn) closeBtn.addEventListener('click', () => widget.classList.add('hidden'));

  if (reopenBtn) reopenBtn.addEventListener('click', () => {
    widget.classList.remove('hidden');
    widget.style.left = widget.style.top = '';
    widget.style.right  = '24px';
    widget.style.bottom = 'calc(var(--status-bar-h, 28px) + 16px)';
  });
})();


/* ── RECALCULATE EASTER EGG ───────────────────────────────────────── */
(function initRecalculate() {
  const heroTitle  = document.getElementById('heroTitle');
  const canvas     = document.getElementById('recalcCanvas');
  if (!heroTitle || !canvas) return;
  const ctx        = canvas.getContext('2d');
  const GLITCH_CHARS = '0123456789#REF!#N/A#VALUE!ABCDEFGHIJкзш∑∂∆'.split('');
  const original   = 'spreadsheets';

  let animFrame, isRecalculating = false;

  function resizeCanvas() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  function drawCells() {
    const W = canvas.width, H = canvas.height;
    const cols = Math.ceil(W / 40) + 1;
    const rows = Math.ceil(H / 40) + 1;
    ctx.clearRect(0, 0, W, H);
    ctx.font = '9px "Space Mono", monospace';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() > 0.35) continue;
        const char  = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
        const alpha = Math.random() * 0.6 + 0.1;
        ctx.fillStyle = Math.random() > 0.7
          ? `rgba(33, 115, 70, ${alpha})`
          : `rgba(28, 26, 23, ${alpha})`;
        ctx.fillText(char, c * 40 + Math.random() * 8, r * 40 + Math.random() * 8 + 10);
      }
    }
  }

  function scrambleTitle(progress) {
    if (progress >= 1) { heroTitle.textContent = original; return; }
    heroTitle.textContent = original
      .split('')
      .map(ch => Math.random() > progress ? GLITCH_CHARS[Math.floor(Math.random() * 12)] : ch)
      .join('');
  }

  heroTitle.addEventListener('click', () => {
    if (isRecalculating) return;
    isRecalculating = true;
    resizeCanvas();
    canvas.classList.add('active');
    heroTitle.classList.add('recalculating');
    heroTitle.textContent = '#CALCULATING...';

    let start = null;
    const duration = 1600;
    function frame(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      drawCells();
      scrambleTitle(progress);
      if (progress < 1) {
        animFrame = requestAnimationFrame(frame);
      } else {
        canvas.classList.remove('active');
        heroTitle.classList.remove('recalculating');
        heroTitle.textContent = original;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        isRecalculating = false;
      }
    }
    animFrame = requestAnimationFrame(frame);
  });

  window.addEventListener('resize', () => { if (isRecalculating) resizeCanvas(); });
})();


/* ── AMBIENT SOUND (Web Audio API) ───────────────────────────────── */
(function initAmbient() {
  const btn = document.getElementById('ambientBtn');
  if (!btn) return;
  let audioCtx = null, master = null, nodes = [], active = false;

  function createSound() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    master = audioCtx.createGain();
    master.gain.setValueAtTime(0, audioCtx.currentTime);
    master.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 1.5);
    master.connect(audioCtx.destination);

    [[55, 0.55], [56.8, 0.3]].forEach(([freq, gain]) => {
      const osc = audioCtx.createOscillator();
      const g   = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq; g.gain.value = gain;
      osc.connect(g); g.connect(master); osc.start(); nodes.push(osc);
    });

    const bufLen = audioCtx.sampleRate * 4;
    const buf    = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const noise = audioCtx.createBufferSource();
    noise.buffer = buf; noise.loop = true;

    const lpf = audioCtx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = 320; lpf.Q.value = 0.4;

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0.18;
    noise.connect(lpf); lpf.connect(noiseGain); noiseGain.connect(master);
    noise.start(); nodes.push(noise);

    const shimmer = audioCtx.createOscillator();
    shimmer.type = 'sine'; shimmer.frequency.value = 880;
    const shimG  = audioCtx.createGain();
    shimG.gain.value = 0.015;
    shimmer.connect(shimG); shimG.connect(master); shimmer.start(); nodes.push(shimmer);
  }

  function stopSound() {
    if (!master) return;
    master.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1);
    setTimeout(() => {
      nodes.forEach(n => { try { n.stop(); } catch(e) {} });
      nodes = []; audioCtx.close(); audioCtx = null; master = null;
    }, 1100);
  }

  btn.addEventListener('click', () => {
    active = !active;
    btn.classList.toggle('active', active);
    if (active) createSound(); else stopSound();
  });
})();


/* ── HERO FEED — LIVE CLOCK ───────────────────────────────────────── */
(function initHeroFeedClock() {
  const el = document.getElementById('hfTime');
  if (!el) return;
  function tick() {
    const now  = new Date();
    const h    = now.getHours();
    const m    = String(now.getMinutes()).padStart(2, '0');
    const s    = String(now.getSeconds()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12  = ((h % 12) || 12);
    el.textContent = `${h12}:${m}:${s} ${ampm}`;
  }
  tick();
  setInterval(tick, 1000);
})();


/* ── DATA SECTION — COUNTING ANIMATION ───────────────────────────── */
(function initDataCounters() {
  const cells = document.querySelectorAll('.data-cell-value[data-count]');
  if (!cells.length) return;

  function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

  function animateCount(el) {
    const target = parseInt(el.dataset.count, 10);
    const duration = 1800;
    let start = null;
    function frame(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      el.textContent = Math.round(easeOutQuart(p) * target);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { animateCount(e.target); obs.unobserve(e.target); }
    });
  }, { threshold: 0.4 });

  cells.forEach(cell => obs.observe(cell));
})();


/* ── HARDWARE IMAGE PARALLAX ──────────────────────────────────────── */
const hwImage = document.querySelector('.hardware-image');
if (hwImage && !isTouchDevice()) {
  window.addEventListener('scroll', () => {
    const rect   = hwImage.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (!inView) return;
    const progress = 1 - (rect.top + rect.height) / (window.innerHeight + rect.height);
    const shift    = (progress - 0.5) * 40;
    const img = hwImage.querySelector('.hardware-img-placeholder');
    if (img) img.style.transform = `translateY(${shift}px)`;
  }, { passive: true });
}
