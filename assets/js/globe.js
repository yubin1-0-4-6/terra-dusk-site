/* ------------------------------------------------------------------
   Terra Dusk — a per-pixel WebGL earth.
   Original component: https://www.originkit.dev/components/terra-dusk
   Rebuilt here with raw WebGL: no geometry, no texture sphere, just a
   full-frame quad that solves the sphere normal from screen position.
   ------------------------------------------------------------------ */
(() => {
  const canvas = document.getElementById('globe');
  if (!canvas) return;

  const gl =
    canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    }) || canvas.getContext('experimental-webgl');

  if (!gl) {
    canvas.classList.add('is-failed');
    return;
  }

  const VERT = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;

    uniform vec2  uRes;
    uniform float uTime;
    uniform float uSize;
    uniform vec2  uCenter;
    uniform float uSpin;
    uniform float uTilt;
    uniform vec3  uSun;
    uniform float uStars;
    uniform float uCloud;
    uniform float uLights;
    uniform sampler2D uDay;
    uniform sampler2D uNight;
    uniform sampler2D uClouds;
    uniform sampler2D uWater;

    const float PI = 3.141592653589793;
    const vec3  BG   = vec3(0.0016, 0.0030, 0.0072);
    const vec3  HAZE = vec3(0.055, 0.240, 0.640);

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    vec3 starField(vec2 frag) {
      vec3 col = vec3(0.0);
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float scale = 46.0 + fi * 110.0;
        vec2 uv = frag / scale + vec2(fi * 13.7, fi * 7.1);
        vec2 id = floor(uv);
        vec2 gv = fract(uv) - 0.5;
        float rnd = hash21(id + fi * 19.3);
        if (rnd > 0.955) {
          vec2 off = (vec2(hash21(id + 3.1), hash21(id + 8.7)) - 0.5) * 0.62;
          float d = length(gv - off);
          float tw = 0.55 + 0.45 * sin(uTime * (0.4 + rnd * 1.7) + rnd * 40.0);
          float b = smoothstep(0.062, 0.0, d) * tw * (0.22 + rnd * 0.55);
          col += vec3(0.72, 0.82, 1.0) * b;
        }
      }
      return col * uStars;
    }

    vec3 aces(vec3 x) {
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }

    void main() {
      vec2 frag = gl_FragCoord.xy;
      vec2 center = uRes * 0.5 + uCenter;
      vec2 p = (frag - center) / (0.5 * uSize);
      float r2 = dot(p, p);
      float r = sqrt(r2);

      vec3 col = BG + starField(frag);

      /* atmosphere outside the disc */
      float d = max(r - 1.0, 0.0);
      float halo = exp(-d * 38.0) * 0.55 + exp(-d * 7.0) * 0.09;
      float side = 0.5 + 0.5 * dot(normalize(p + 1e-6), normalize(uSun.xy + 1e-6));
      col += HAZE * halo * (0.40 + 0.95 * side);

      /* sphere normal from the screen position (unit length outside the disc too) */
      float z = sqrt(max(1.0 - r2, 0.0));
      vec3 n = normalize(vec3(p, z));

      /* tilt then spin, so the maps turn under a fixed camera */
      float ct = cos(uTilt), st = sin(uTilt);
      vec3 t = vec3(n.x, n.y * ct - n.z * st, n.y * st + n.z * ct);
      float cs = cos(uSpin), ss = sin(uSpin);
      vec3 m = vec3(t.x * cs + t.z * ss, t.y, -t.x * ss + t.z * cs);

      float lat = asin(clamp(m.y, -1.0, 1.0));
      float lon = atan(m.x, m.z);
      vec2 uv = vec2(lon / (2.0 * PI) + 0.5, 0.5 - lat / PI);

      vec3 L = normalize(uSun);
      float ndl = dot(n, L);
      float day = smoothstep(-0.03, 0.16, ndl);
      float diffuse = clamp(ndl, 0.0, 1.0);

      vec3 albedo = pow(texture2D(uDay, uv).rgb, vec3(2.2));
      float luma = dot(albedo, vec3(0.299, 0.587, 0.114));
      albedo = mix(vec3(luma), albedo, 1.10);
      vec3 sunCol = mix(vec3(1.0, 0.55, 0.26), vec3(1.0, 0.95, 0.88), smoothstep(0.0, 0.34, ndl));
      vec3 surf = albedo * sunCol * (0.016 + 1.04 * pow(diffuse, 1.05));

      /* ocean glint + a little deep-sea colour so the water reads blue */
      float water = texture2D(uWater, uv).r;
      vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
      surf += sunCol * pow(clamp(dot(n, H), 0.0, 1.0), 340.0) * water * 0.30;
      surf += water * vec3(0.006, 0.036, 0.100) * (0.12 + 0.88 * diffuse) * sunCol;

      /* city lights, night side only */
      vec3 cityTex = texture2D(uNight, uv).rgb;
      float city = smoothstep(0.22, 0.90, max(cityTex.r, max(cityTex.g, cityTex.b)));
      surf += vec3(1.0, 0.58, 0.26) * city * (1.0 - day) * uLights * 2.60;
      surf += albedo * vec3(0.55, 0.72, 1.0) * 0.012 * (1.0 - day);

      /* clouds drift against the ground and cast their own shadow */
      vec2 cuv = vec2(uv.x + uTime * 0.0011, uv.y);
      float cloud = texture2D(uClouds, cuv).a;
      float shadow = texture2D(uClouds, cuv + normalize(uSun.xy + 1e-5) * 0.0065).a;
      surf *= 1.0 - shadow * 0.34 * day;
      vec3 cloudCol = sunCol * (0.04 + 0.94 * pow(diffuse, 0.85));
      surf = mix(surf, cloudCol, cloud * uCloud * 0.94);

      /* atmospheric limb */
      float rim = pow(1.0 - z, 3.2);
      float rimLit = smoothstep(-0.35, 0.7, ndl);
      surf += HAZE * rim * (0.30 + 1.30 * rimLit) * 1.25;

      float edge = smoothstep(1.0015, 0.9970, r2);
      col = mix(col, surf, edge);

      /* bloom on the lit limb */
      col += sunCol * exp(-d * 55.0) * pow(diffuse, 3.0) * 0.30;

      /* fixed exposure for the twilight look: hold the highlights at noon */
      col *= 1.0 - 0.26 * smoothstep(0.55, 0.98, uSun.z);

      col = aces(col);
      col = pow(col, vec3(1.0 / 2.2));

      vec2 vg = (frag - uRes * 0.5) / uRes.y;
      col *= 1.0 - 0.30 * smoothstep(0.35, 1.20, length(vg));

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[TerraDusk] shader error:', gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[TerraDusk] link error:', gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  [
    'uRes', 'uTime', 'uSize', 'uCenter', 'uSpin', 'uTilt', 'uSun',
    'uStars', 'uCloud', 'uLights', 'uDay', 'uNight', 'uClouds', 'uWater',
  ].forEach((name) => (U[name] = gl.getUniformLocation(program, name)));

  gl.uniform1f(U.uStars, 0.85);
  gl.uniform1f(U.uCloud, 0.70);
  gl.uniform1f(U.uLights, 1.0);

  /* Yunnan anchors the camera: the disc keeps the Kunming meridian in the
     middle and the light comes from wherever the sun really is right now. */
  const HOME = { lat: 25.04, lon: 102.71 };
  const TILT_BASE = -0.30;
  const D2R = Math.PI / 180;

  const state = {
    spin: HOME.lon * D2R,
    hover: 0,
    hoverTarget: 0,
    hoverV: 0,
    tilt: 0,
    tiltTarget: 0,
    tiltV: 0,
    fling: 0,
    spinGoal: null,
    dragging: false,
    lastX: 0,
    lastT: 0,
    time: 0,
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pin = document.querySelector('.hero__pin');
  const view = { size: 0, cx: 0, cy: 0, ox: 0, oy: 0 };
  let ready = false;
  let running = false;
  let lastFrame = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(rect.width, 1);
    const h = Math.max(rect.height, 1);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    const mobile = w < 980;
    const size = mobile
      ? Math.min(w * 0.82, h * 0.90)
      : Math.min(w * 0.46, h * 0.78);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uSize, size * dpr);
    gl.uniform2f(
      U.uCenter,
      mobile ? 0 : w * 0.235 * dpr,
      mobile ? 0 : -h * 0.01 * dpr
    );

    /* the same disc, in CSS pixels, so the pin can sit on top of it */
    const box = hero.getBoundingClientRect();
    view.size = size;
    view.cx = w / 2 + (mobile ? 0 : w * 0.235);
    view.cy = h / 2 - (mobile ? 0 : h * 0.01);
    view.ox = rect.left - box.left;
    view.oy = rect.top - box.top;
  }

  /* where the sun stands overhead, in map coordinates (radians) */
  function subsolar(date) {
    const start = Date.UTC(date.getUTCFullYear(), 0, 1);
    const dayOfYear = (date.getTime() - start) / 864e5;
    const declination = -23.44 * Math.cos(((2 * Math.PI) / 365.24) * (dayOfYear + 10.5));
    const utcHours =
      date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const lon = (((180 - utcHours * 15 + 540) % 360) - 180) * D2R;
    return [declination * D2R, lon];
  }

  /* undo the shader's spin + tilt so a map direction lands back in view space */
  function toView(lat, lon, spin, tilt) {
    const m = [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
    const cs = Math.cos(spin);
    const ss = Math.sin(spin);
    const t = [m[0] * cs - m[2] * ss, m[1], m[0] * ss + m[2] * cs];
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    return [t[0], t[1] * ct + t[2] * st, -t[1] * st + t[2] * ct];
  }

  function step(dt) {
    state.time += dt;

    const spinTarget = reducedMotion ? 0 : state.hoverTarget;
    // damped spring (zeta ~= 0.7)
    const stiffness = 30;
    const damping = 2 * Math.sqrt(stiffness) * 0.7;
    state.hoverV += (spinTarget - state.hover) * stiffness * dt - state.hoverV * damping * dt;
    state.hover += state.hoverV * dt;

    state.tiltV += (state.tiltTarget - state.tilt) * 24 * dt - state.tiltV * 5.6 * dt;
    state.tilt += state.tiltV * dt;

    /* a click on the home pin pulls that meridian back to the middle */
    if (state.spinGoal !== null) {
      state.spin += (state.spinGoal - state.spin) * Math.min(1, dt * 6);
      if (Math.abs(state.spinGoal - state.spin) < 0.0015) {
        state.spin = state.spinGoal;
        state.spinGoal = null;
      }
    }

    if (!reducedMotion && state.fling) {
      state.spin += state.fling * dt;
      state.fling *= Math.exp(-dt * 2.4);
      if (Math.abs(state.fling) < 0.0015) state.fling = 0;
    }
  }

  function draw() {
    const spin = state.spin + state.hover;
    const tilt = TILT_BASE + state.tilt;
    const [lat, lon] = subsolar(new Date());
    const [sx, sy, sz] = toView(lat, lon, spin, tilt);

    gl.uniform1f(U.uTime, state.time);
    gl.uniform1f(U.uSpin, spin);
    gl.uniform1f(U.uTilt, tilt);
    gl.uniform3f(U.uSun, sx, sy, sz);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    placePin(spin, tilt);
  }

  /* the home pin rides the same rotation as the surface it marks */
  function placePin(spin, tilt) {
    if (!pin || !view.size) return;
    const [x, y, z] = toView(HOME.lat * D2R, HOME.lon * D2R, spin, tilt);
    const radius = view.size / 2;
    const face = Math.min(1, Math.max(0, (z - 0.02) * 4));
    pin.style.transform = `translate(${(view.ox + view.cx + x * radius).toFixed(1)}px, ${(
      view.oy + view.cy - y * radius
    ).toFixed(1)}px)`;
    pin.style.opacity = face.toFixed(3);
    pin.style.pointerEvents = face > 0.5 ? 'auto' : 'none';
  }

  function frame(now) {
    if (!running) return;
    if (!lastFrame) lastFrame = now;
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    step(dt);
    draw();
    requestAnimationFrame(frame);
  }

  /* ---------------- textures ---------------- */
  const textures = [
    ['uDay', 'assets/textures/earth_atmos_2048.jpg'],
    ['uNight', 'assets/textures/earth_lights_2048.png'],
    ['uClouds', 'assets/textures/earth_clouds_1024.png'],
    ['uWater', 'assets/textures/earth_specular_2048.jpg'],
  ];

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('failed to load ' + url));
      img.src = url;
    });
  }

  async function boot() {
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    const maxAniso = aniso ? gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;

    const images = await Promise.all(textures.map(([, url]) => loadImage(url)));

    images.forEach((img, i) => {
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (aniso) {
        gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(maxAniso, 8));
      }
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.uniform1i(U[textures[i][0]], i);
    });

    ready = true;
    resize();
    if (reducedMotion) {
      draw();
    } else {
      start();
    }
    canvas.classList.add('is-ready');
    const fallback = canvas.parentElement.querySelector('.hero__fallback');
    if (fallback) setTimeout(() => fallback.remove(), 1600);
  }

  /* ---------------- interaction ---------------- */
  const hero = canvas.closest('.hero') || canvas.parentElement;

  function normalizePointer(event) {
    const rect = canvas.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    ];
  }

  hero.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const [px, py] = normalizePointer(event);
    state.hoverTarget = px * 0.34;
    state.tiltTarget = py * 0.10;
    if (state.dragging) {
      const dx = event.clientX - state.lastX;
      state.spin += dx * 0.0042;
      state.fling = Math.max(-2.4, Math.min(2.4, dx * 0.006));
      state.lastX = event.clientX;
    }
  });

  hero.addEventListener('pointerleave', () => {
    state.hoverTarget = 0;
    state.tiltTarget = 0;
  });

  hero.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' || event.button !== 0) return;
    if (event.target.closest('a, button, input, textarea')) return;
    state.dragging = true;
    state.lastX = event.clientX;
    state.fling = 0;
    state.spinGoal = null;
    hero.classList.add('is-dragging');
  });

  if (pin) {
    pin.addEventListener('click', () => {
      const home = HOME.lon * D2R;
      /* aim at where the pointer parallax will have settled, not at its
         current lag, so the meridian really ends up in the middle */
      const settled = state.spin + state.hoverTarget;
      const delta = Math.atan2(Math.sin(home - settled), Math.cos(home - settled));
      state.fling = 0;
      if (reducedMotion) {
        state.spin += delta;
        draw();
      } else {
        state.spinGoal = state.spin + delta;
      }
    });
  }

  window.addEventListener('pointerup', () => {
    if (!state.dragging) return;
    state.dragging = false;
    hero.classList.remove('is-dragging');
  });

  function start() {
    if (running || !ready) return;
    running = true;
    lastFrame = 0;
    requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    lastFrame = 0;
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) start();
        else stop();
      },
      { threshold: 0.01 }
    ).observe(canvas);
  }

  if ('ResizeObserver' in window) {
    let frameId = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        resize();
        if (reducedMotion) draw();
      });
    }).observe(canvas);
  } else {
    window.addEventListener('resize', resize);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  boot().catch((err) => {
    console.error('[TerraDusk]', err);
    canvas.classList.add('is-failed');
  });
})();
