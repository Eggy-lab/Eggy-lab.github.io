// ===== Shared config =====
const GOOSE_COUNT = 1;
const ROOT = (window.GOOSE_ROOT || '/') + 'images/goose/';
const ANIMS = {
  idle: { src: ROOT + 'idle.png', frames: 4, fps: 6 },
  walk: { src: ROOT + 'walk.png', frames: 8, fps: 12 },
  honk: { src: ROOT + 'honk.png', frames: 4, fps: 10 },
};
const FRAME_W = 64;
const FRAME_H = 64;

// hop config
const HOP_DURATION = 450;
const HOP_REST = 120;
const HOP_DISTANCE = 38;
const HOP_HEIGHT = 22;

// shared sprite-loaded probe
const loaded = {};
Object.entries(ANIMS).forEach(([name, cfg]) => {
  const img = new Image();
  img.onload = () => { loaded[name] = true; };
  img.src = cfg.src;
});

// shared egg position (set by spawnEgg)
const nest = { x: null, y: null };

// shared mouse tracking
let mouseX = -9999, mouseY = -9999, mouseLastMove = 0;
window.addEventListener('pointermove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  mouseLastMove = performance.now();
}, true);

function spawnGoose(index) {
  const goose = document.createElement('div');
  goose.className = 'desktop-goose';
  Object.assign(goose.style, {
    position: 'fixed',
    left: '100px',
    top: '100px',
    width: FRAME_W + 'px',
    height: FRAME_H + 'px',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'auto ' + FRAME_H + 'px',
    fontSize: FRAME_H + 'px',
    lineHeight: FRAME_H + 'px',
    textAlign: 'center',
    cursor: 'pointer',
    userSelect: 'none',
    zIndex: 99999,
    transformOrigin: 'center',
    imageRendering: 'pixelated',
    touchAction: 'none',
  });
  document.body.appendChild(goose);

  const honk = document.createElement('div');
  Object.assign(honk.style, {
    position: 'fixed',
    padding: '4px 10px',
    background: '#fff',
    color: '#111',
    opacity: '1',
    border: '2px solid #222',
    borderRadius: '12px',
    fontFamily: 'sans-serif',
    fontSize: '16px',
    fontWeight: 'bold',
    pointerEvents: 'none',
    zIndex: 100000,
    display: 'none',
  });
  honk.textContent = 'HONK!';
  document.body.appendChild(honk);

  let x = 100 + index * 80, y = 100 + index * 40;
  let tx = x, ty = y;
  let facing = 1;
  let state = 'walk';
  let frame = 0;
  let lastFrameTime = 0;
  let hopStart = 0;
  let hopFromX = x, hopFromY = y;
  let hopToX = x, hopToY = y;
  let hopAirborne = false;
  let hopOffsetY = 0;
  let chasing = false;
  let chaseSide = -1;
  let nesting = false;
  let seenMouseMove = mouseLastMove;
  let chasePauseUntil = 0;
  let honkSeqId = 0;
  let honkLock = false;
  let returnToNestNext = false;
  let urgent = false;
  let nextNestVisit = performance.now() + 15000 + Math.random() * 10000;

  function pickTarget() {
    const m = FRAME_W;
    tx = m + Math.random() * (window.innerWidth - m * 2);
    ty = m + Math.random() * (window.innerHeight - m * 2);
  }
  pickTarget();

  function setState(s) {
    if (state === s) return;
    state = s;
    frame = 0;
  }

  function startHop(now) {
    const dx = tx - x, dy = ty - y;
    const dist = Math.hypot(dx, dy);
    const step = Math.min(urgent ? HOP_DISTANCE * 1.6 : HOP_DISTANCE, dist);
    hopFromX = x; hopFromY = y;
    hopToX = x + (dx / dist) * step;
    hopToY = y + (dy / dist) * step;
    if (Math.abs(dx) > 0.5) facing = dx > 0 ? -1 : 1;
    hopStart = now;
    hopAirborne = true;
  }

  function render(now) {
    hopOffsetY = 0;
    // any new mouse movement interrupts everything to go chase
    if (state !== 'drag' && !honkLock && mouseLastMove > seenMouseMove) {
      seenMouseMove = mouseLastMove;
      chasing = true;
      chaseSide = x < mouseX ? -1 : 1; // -1 = stop on mouse's left
      nesting = false;
      chasePauseUntil = 0;
      honkSeqId++;
      honk.style.display = 'none';
      setState('walk');
    }

    if (state === 'drag') {
      // pointermove drives position
    } else if (state === 'walk') {
      if (chasing) {
        const STOP_OFFSET = FRAME_W * 0.55;
        tx = mouseX + chaseSide * STOP_OFFSET;
        ty = mouseY;
      } else {
        if (!nesting && now > nextNestVisit && nest.x !== null) {
          nesting = true;
        }
        if (nesting) {
          tx = nest.x;
          ty = nest.y;
        }
      }
      const dx = tx - x, dy = ty - y;
      const dist = Math.hypot(dx, dy);
      const arriveDist = nesting ? 8 : (chasing ? 6 : 2);
      if (dist < arriveDist && !hopAirborne) {
        if (chasing) {
          chasing = false;
          tripleHonk(mouseX, returnToNestNext ? () => {
            returnToNestNext = false;
            nesting = true;
            nextNestVisit = performance.now();
            setState('walk');
          } : null);
        } else if (nesting) {
          nesting = false;
          urgent = false;
          nextNestVisit = now + 15000 + Math.random() * 10000;
          setState('idle');
          setTimeout(() => { pickTarget(); setState('walk'); }, 9000);
        } else {
          setState('idle');
          setTimeout(() => { pickTarget(); setState('walk'); }, 600 + Math.random() * 1500);
        }
      } else if (!hopAirborne) {
        if (now - hopStart > (urgent ? HOP_REST * 0.4 : HOP_REST)) startHop(now);
      } else {
        const t = (now - hopStart) / (urgent ? HOP_DURATION * 0.6 : HOP_DURATION);
        if (t >= 1) {
          x = hopToX; y = hopToY;
          hopAirborne = false;
          hopStart = now;
        } else {
          x = hopFromX + (hopToX - hopFromX) * t;
          y = hopFromY + (hopToY - hopFromY) * t;
          hopOffsetY = -Math.sin(t * Math.PI) * HOP_HEIGHT;
        }
      }
    }

    const cfg = ANIMS[state] || ANIMS.idle;
    if (now - lastFrameTime > 1000 / cfg.fps) {
      frame = (frame + 1) % cfg.frames;
      lastFrameTime = now;
    }

    if (loaded[state]) {
      goose.textContent = '';
      goose.style.backgroundImage = `url(${cfg.src})`;
      goose.style.backgroundPosition = `-${frame * FRAME_W}px 0`;
    } else {
      goose.style.backgroundImage = '';
      goose.textContent = state === 'honk' ? '🪿❗' : '🪿';
    }

    if (honkLock && nest.x !== null) facing = nest.x > x ? -1 : 1;
    let tilt = state === 'drag' ? facing * 15 : (hopAirborne ? -facing * 10 : 0);
    if (state === 'honk') tilt += Math.sin(now / 35) * 12;
    const scale = pressed ? 1.15 : 1;
    goose.style.left = x + 'px';
    goose.style.top = (y + hopOffsetY) + 'px';
    goose.style.transform = `scaleX(${facing * scale}) scaleY(${scale}) rotate(${tilt}deg)`;

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  function tripleHonk(faceTowardX, then) {
    const id = ++honkSeqId;
    const HONK_ON = 450, HONK_OFF = 180;
    if (typeof faceTowardX === 'number') {
      facing = faceTowardX > x ? -1 : 1;
    }
    let i = 0;
    function step() {
      if (id !== honkSeqId) return;
      if (i >= 3) {
        honk.style.display = 'none';
        if (then) then();
        else setState('walk');
        return;
      }
      setState('honk');
      honk.style.left = (x + FRAME_W) + 'px';
      honk.style.top = (y - 10) + 'px';
      honk.style.display = 'block';
      setTimeout(() => {
        if (id !== honkSeqId) return;
        honk.style.display = 'none';
        setState('idle');
        i++;
        setTimeout(step, HONK_OFF);
      }, HONK_ON);
    }
    step();
  }

  function honkOnce() {
    setState('honk');
    honk.style.left = (x + FRAME_W) + 'px';
    honk.style.top = (y - 10) + 'px';
    honk.style.display = 'block';
    setTimeout(() => {
      honk.style.display = 'none';
      pickTarget();
      hopAirborne = false;
      setState('walk');
    }, 800);
  }

  let dragging = false;
  let dragMoved = false;
  let pressed = false;
  let grabDX = 0, grabDY = 0;
  let lastPX = 0;

  goose.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    dragMoved = false;
    pressed = true;
    grabDX = e.clientX - x;
    grabDY = e.clientY - y;
    lastPX = e.clientX;
    setState('drag');
    hopAirborne = false;
    goose.style.cursor = 'grabbing';
  }, true);

  function onMove(e) {
    if (!dragging) return;
    e.preventDefault();
    const dx = e.clientX - lastPX;
    if (Math.abs(dx) + Math.abs(e.clientY - (grabDY + y)) > 1) dragMoved = true;
    x = e.clientX - grabDX;
    y = e.clientY - grabDY;
    if (Math.abs(dx) > 0.5) facing = dx > 0 ? -1 : 1;
    lastPX = e.clientX;
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    pressed = false;
    goose.style.cursor = 'pointer';
    if (dragMoved) {
      pickTarget();
      hopStart = performance.now();
      hopAirborne = false;
      setState('walk');
    } else {
      honkOnce();
    }
  }

  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', endDrag, true);
  window.addEventListener('pointercancel', endDrag, true);
  window.addEventListener('resize', pickTarget);

  window.addEventListener('goose-egg-touched', () => {
    if (dragging) return;
    chasing = false;
    nesting = false;
    chasePauseUntil = 0;
    hopAirborne = false;
    honk.style.display = 'none';
    honkLock = true;
    returnToNestNext = true;
    urgent = true;
    tripleHonk(mouseX, () => {
      honkLock = false;
      seenMouseMove = mouseLastMove;
      chasing = true;
      chaseSide = x < mouseX ? -1 : 1;
      setState('walk');
    });
  });
}

function spawnEgg() {
  const egg = document.createElement('div');
  egg.textContent = '🥚';
  const nestEl = document.querySelector('.mini-player .mp-emoji');
  let startX, startY;
  if (nestEl) {
    const r = nestEl.getBoundingClientRect();
    startX = r.left + r.width / 2 - 24;
    startY = r.top + r.height * 0.28 - 24;
  } else {
    startX = window.innerWidth - 120;
    startY = window.innerHeight - 100;
  }
  nest.x = startX + 24;
  nest.y = startY + 24;
  Object.assign(egg.style, {
    position: 'fixed',
    left: startX + 'px',
    top: startY + 'px',
    width: '48px',
    height: '48px',
    fontSize: '40px',
    lineHeight: '48px',
    textAlign: 'center',
    cursor: 'grab',
    userSelect: 'none',
    zIndex: 99998,
    touchAction: 'none',
    transition: 'transform 0.2s',
  });
  document.body.appendChild(egg);

  let dragging = false, gx = 0, gy = 0;
  egg.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dragging = true;
    gx = e.clientX - parseFloat(egg.style.left);
    gy = e.clientY - parseFloat(egg.style.top);
    egg.style.cursor = 'grabbing';
    egg.style.transform = 'scale(1.15) rotate(-8deg)';
    egg.textContent = '🐣';
    window.dispatchEvent(new CustomEvent('goose-egg-touched'));
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const nx = e.clientX - gx, ny = e.clientY - gy;
    egg.style.left = nx + 'px';
    egg.style.top = ny + 'px';
    nest.x = nx + 24;
    nest.y = ny + 24;
  });
  window.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    egg.style.cursor = 'grab';
    egg.style.transform = '';
    egg.textContent = '🥚';
  });
}

function startGooseFlock() {
  for (let i = 0; i < GOOSE_COUNT; i++) spawnGoose(i);
  spawnEgg();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startGooseFlock);
} else {
  startGooseFlock();
}
