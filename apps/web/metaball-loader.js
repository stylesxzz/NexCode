/* Nexo Metaball Loader — vanilla JavaScript adaptation of the supplied React component. */
(function () {
  "use strict";

  const LOOP = 12, LAPS = 2.5, CROWD = 0.12, CROWD_LAPS = 0.5, CROWD_AT = -1.96;
  const TAU = Math.PI * 2;
  const RING = { x: 0.0115, y: -0.0004, a: 0.9542, b: 0.5154, tilt: -0.7719 };
  const RING_RMS = Math.sqrt((RING.a * RING.a + RING.b * RING.b) / 2);
  const VIEW = 1.25, SWELL = 0.57, OVERLAP = 0.04, CUSHION = 0.04;
  const START = [
    -2.8303, -0.0083, 0.2219, 1.0739, -0.3467, 0.14,
    -2.0853,  0.0182, 0.2663, 1.1087,  0.0849, 0.1417,
    -1.3366, -0.0178, 0.2831, 1.0344,  0.3093, 0.2817,
    -0.5366,  0.0082, 0.2022, 1.2797,  0.9439, 0.1433,
     0.3029, -0.001,  0.1912, 1.436,  -0.4578, 0.135,
     1.0609, -0.0002, 0.2401, 1.1389, -0.3306, 0.1183,
     1.7501, -0.002,  0.2661, 1.1877,  0.0899, 0.1317,
     2.5108,  0.0052, 0.242,  1.1876,  0.0444, 0.1383
  ];
  const N = START.length / 6;

  function pathSpeed(th) {
    return Math.hypot(RING.a * Math.sin(th), RING.b * Math.cos(th)) / RING_RMS;
  }
  function wave(at0, mean, amp, k, flip) {
    const c = Math.max(amp, Math.abs(at0 - mean) * 1.05);
    const s = Math.asin(Math.max(-1, Math.min(1, (at0 - mean) / c)));
    return { m: mean, c: c, k: k, p: flip ? Math.PI - s : s };
  }
  function waveAt(w, ph) { return w.m + w.c * Math.sin(w.k * ph + w.p); }
  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const BEADS = (function () {
    const random = rng(7), out = [];
    for (let i = 0; i < N; i++) {
      const offset = i * 6;
      const th = START[offset], rho = START[offset + 1], size = START[offset + 2];
      const aspect = START[offset + 3], turn = START[offset + 4], neck = START[offset + 5];
      const drift = [1, 2, 3].map(function (k) {
        return { a: (0.01 + random() * 0.02) / k, k: k, p: random() * TAU };
      });
      let u = th;
      for (let n = 0; n < 24; n++) {
        u -= (u + CROWD * Math.sin(u - CROWD_AT) - th) /
          (1 + CROWD * Math.cos(u - CROWD_AT));
      }
      out.push({
        th: u,
        base: size / Math.pow(pathSpeed(th), SWELL),
        drift: drift,
        rho: wave(rho, 0, 0.012, 1 + Math.floor(random() * 2), random() < 0.5),
        breath: wave(1, 1, 0.05, 1 + Math.floor(random() * 3), random() < 0.5),
        aspect: wave(aspect, Math.max(1.08, (aspect + 1.02) / 2), 0.06,
          1 + Math.floor(random() * 2), random() < 0.5),
        turn: wave(turn, 0, 0.15, 1, random() < 0.5),
        neck: wave(neck, Math.max(0.15, (neck + 0.12) / 2), 0.035,
          1 + Math.floor(random() * 3), random() < 0.5)
      });
    }
    return out;
  })();

  const ORDER = BEADS.map(function (b, i) { return [b.th, i]; })
    .sort(function (a, b) { return a[0] - b[0]; })
    .map(function (item) { return item[1]; });
  const TH = new Float64Array(N), SIZE = new Float64Array(N);
  const ASP = new Float64Array(N), TURN = new Float64Array(N), RHO = new Float64Array(N);

  function solveBeads(t, pos, rad, neck) {
    const ph = (TAU * (((t % LOOP) + LOOP) % LOOP)) / LOOP;
    const tilt = RING.tilt + ph / 2, ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let i = 0; i < N; i++) {
      const bead = BEADS[i];
      let u = bead.th + LAPS * ph;
      bead.drift.forEach(function (d) {
        u += d.a * (Math.sin(d.k * ph + d.p) - Math.sin(d.p));
      });
      TH[i] = u + CROWD * Math.sin(u - CROWD_AT - CROWD_LAPS * ph);
      SIZE[i] = bead.base * waveAt(bead.breath, ph);
      ASP[i] = Math.max(1, waveAt(bead.aspect, ph));
      TURN[i] = waveAt(bead.turn, ph);
      RHO[i] = waveAt(bead.rho, ph);
    }

    for (let pass = 0; pass < 4; pass++) {
      for (let n = 0; n < N; n++) {
        const i = ORDER[n], j = ORDER[(n + 1) % N];
        const wrap = n === N - 1 ? TAU : 0;
        const tj = TH[j] + wrap + Math.round((TH[i] - TH[j] - wrap) / TAU) * TAU;
        const dx = (RING.a + RHO[j]) * Math.cos(tj) - (RING.a + RHO[i]) * Math.cos(TH[i]);
        const dy = (RING.b + RHO[j]) * Math.sin(tj) - (RING.b + RHO[i]) * Math.sin(TH[i]);
        function reach(k, angle) {
          const s = SIZE[k] * Math.pow(pathSpeed(angle), SWELL);
          const c = Math.cos(TURN[k]), sn = Math.sin(TURN[k]);
          return s / Math.hypot(c / Math.sqrt(ASP[k]), sn * Math.sqrt(ASP[k]));
        }
        const deficit = reach(i, TH[i]) + reach(j, tj) - OVERLAP - Math.hypot(dx, dy);
        if (deficit <= -CUSHION) continue;
        const push = deficit >= CUSHION ? deficit :
          ((deficit + CUSHION) * (deficit + CUSHION)) / (4 * CUSHION);
        const dth = push / (RING_RMS * pathSpeed((TH[i] + tj) / 2)) / 2;
        TH[i] -= dth;
        TH[j] += dth;
      }
    }

    for (let i = 0; i < N; i++) {
      const th = TH[i];
      const lx = (RING.a + RHO[i]) * Math.cos(th);
      const ly = (RING.b + RHO[i]) * Math.sin(th);
      const tx = -RING.a * Math.sin(th), ty = RING.b * Math.cos(th);
      const size = SIZE[i] * Math.pow(pathSpeed(th), SWELL);
      const angle = Math.atan2(st * tx + ct * ty, ct * tx - st * ty) + TURN[i];
      pos[i * 4] = RING.x + ct * lx - st * ly;
      pos[i * 4 + 1] = RING.y + st * lx + ct * ly;
      pos[i * 4 + 2] = Math.cos(angle);
      pos[i * 4 + 3] = Math.sin(angle);
      rad[i * 2] = size * Math.sqrt(ASP[i]);
      rad[i * 2 + 1] = size / Math.sqrt(ASP[i]);
      if (neck) neck[i] = waveAt(BEADS[i].neck, ph);
    }
  }

  const VERTEX_SHADER = [
    "attribute vec2 aPos;",
    "void main() { gl_Position = vec4(aPos, 0.0, 1.0); }"
  ].join("\n");

  function fragmentShader(derivatives) {
    return (derivatives ? "#extension GL_OES_standard_derivatives : enable\n" : "") +
      "precision highp float;\n" +
      "uniform vec2 uRes;\n" +
      "uniform vec4 uBead[" + N + "];\n" +
      "uniform vec2 uAxis[" + N + "];\n" +
      "uniform float uNeck[" + N + "];\n" +
      "uniform vec4 uColor;\n" +
      "float ellipse(vec2 p, vec4 b, vec2 r) {\n" +
      " vec2 d = p - b.xy;\n" +
      " vec2 q = vec2(b.z*d.x + b.w*d.y, -b.w*d.x + b.z*d.y);\n" +
      " float k0 = length(q/r); float k1 = length(q/(r*r));\n" +
      " return k0*(k0-1.0)/max(k1,1e-5);\n" +
      "}\n" +
      "float smin(float a,float b,float k) {\n" +
      " float h=max(k-abs(a-b),0.0)/k; return min(a,b)-h*h*k*0.25;\n" +
      "}\n" +
      "void main() {\n" +
      " float unit = " + VIEW.toFixed(4) + " / (0.5*uRes.y);\n" +
      " vec2 p=(gl_FragCoord.xy-0.5*uRes)*unit; p.y=-p.y;\n" +
      " float d=ellipse(p,uBead[0],uAxis[0]);\n" +
      " for(int i=1;i<" + N + ";i++) d=smin(d,ellipse(p,uBead[i],uAxis[i]),uNeck[i]);\n" +
      (derivatives ?
        " float w=max(length(vec2(dFdx(d),dFdy(d))),1e-6);\n" :
        " float w=unit;\n") +
      " float a=clamp(0.5-d/w,0.0,1.0);\n" +
      " gl_FragColor=vec4(uColor.rgb,1.0)*(uColor.a*a);\n" +
      "}";
  }

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Nexo Metaball shader:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function colorReader() {
    let last = "", rgba = [0, 1, 0, 1], ctx = null;
    return function (css) {
      if (css === last) return rgba;
      last = css;
      const match = css.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
      if (match) {
        const alpha = match[4] === undefined ? 1 :
          (match[4].endsWith("%") ? parseFloat(match[4]) / 100 : Number(match[4]));
        rgba = [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255, alpha];
        return rgba;
      }
      if (!ctx) {
        const helper = document.createElement("canvas");
        helper.width = helper.height = 1;
        ctx = helper.getContext("2d", { willReadFrequently: true });
      }
      if (ctx) {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "#000";
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const data = ctx.getImageData(0, 0, 1, 1).data, alpha = data[3] / 255;
        rgba = alpha > 0 ?
          [data[0] / 255 / alpha, data[1] / 255 / alpha, data[2] / 255 / alpha, alpha] :
          [0, 0, 0, 0];
      }
      return rgba;
    };
  }

  class MetaballLoader extends HTMLElement {
    connectedCallback() {
      if (this._started) return;
      this._started = true;
      this._size = Math.max(48, Number(this.getAttribute("size")) || 180);
      this._speed = Math.max(0, Number(this.getAttribute("speed")) || 1);
      this.style.width = this._size + "px";
      this.style.height = this._size + "px";
      this.style.display = "block";
      this.setAttribute("role", "img");
      this.setAttribute("aria-label", this.getAttribute("label") || "Nexo em movimento");
      this._canvas = document.createElement("canvas");
      this._canvas.setAttribute("aria-hidden", "true");
      this._canvas.style.cssText = "display:block;width:100%;height:100%";
      this.appendChild(this._canvas);
      this._startWebGL();
    }

    disconnectedCallback() {
      this._stop();
      this._started = false;
    }

    _stop() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
      if (this._observer) this._observer.disconnect();
      this._observer = null;
      if (this._gl) {
        if (this._program) this._gl.deleteProgram(this._program);
        if (this._buffer) this._gl.deleteBuffer(this._buffer);
      }
      this._program = this._buffer = this._gl = null;
    }

    _fallback() {
      if (this._canvas) this._canvas.remove();
      const pos = new Float32Array(N * 4), rad = new Float32Array(N * 2);
      solveBeads(0, pos, rad);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", (-VIEW) + " " + (-VIEW) + " " + (VIEW * 2) + " " + (VIEW * 2));
      svg.setAttribute("aria-hidden", "true");
      svg.style.cssText = "width:100%;height:100%;display:block;animation:metaball-fallback-turn 4s linear infinite";
      for (let i = 0; i < N; i++) {
        const ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        ellipse.setAttribute("cx", pos[i * 4]);
        ellipse.setAttribute("cy", pos[i * 4 + 1]);
        ellipse.setAttribute("rx", rad[i * 2]);
        ellipse.setAttribute("ry", rad[i * 2 + 1]);
        ellipse.setAttribute("fill", "currentColor");
        const degrees = Math.atan2(pos[i * 4 + 3], pos[i * 4 + 2]) * 180 / Math.PI;
        ellipse.setAttribute("transform", "rotate(" + degrees + " " + pos[i * 4] + " " + pos[i * 4 + 1] + ")");
        svg.appendChild(ellipse);
      }
      this.appendChild(svg);
      const style = document.createElement("style");
      style.textContent = "@keyframes metaball-fallback-turn{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){metaball-loader svg{animation-duration:16s!important}}";
      this.appendChild(style);
    }

    _startWebGL() {
      const canvas = this._canvas;
      const gl = canvas && canvas.getContext("webgl", {
        premultipliedAlpha: true, alpha: true, antialias: false
      });
      if (!gl) { this._fallback(); return; }

      const derivatives = !!gl.getExtension("OES_standard_derivatives");
      const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
      const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShader(derivatives));
      if (!vertex || !fragment) { this._fallback(); return; }

      const program = gl.createProgram();
      if (!program) { this._fallback(); return; }
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Nexo Metaball program:", gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        this._fallback();
        return;
      }
      gl.useProgram(program);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);

      const uniforms = {
        res: gl.getUniformLocation(program, "uRes"),
        bead: gl.getUniformLocation(program, "uBead"),
        axis: gl.getUniformLocation(program, "uAxis"),
        neck: gl.getUniformLocation(program, "uNeck"),
        color: gl.getUniformLocation(program, "uColor")
      };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixels = Math.round(this._size * dpr);
      canvas.width = pixels;
      canvas.height = pixels;
      gl.viewport(0, 0, pixels, pixels);
      gl.clearColor(0, 0, 0, 0);

      this._gl = gl;
      this._program = program;
      this._buffer = buffer;
      this._pos = new Float32Array(N * 4);
      this._rad = new Float32Array(N * 2);
      this._neck = new Float32Array(N);
      this._readColor = colorReader();
      this._startTime = performance.now();
      this._reduced = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this._visible = true;

      const draw = (now) => {
        this._raf = 0;
        const elapsed = ((now - this._startTime) / 1000) * this._speed *
          (this._reduced ? 0.25 : 1);
        solveBeads(elapsed, this._pos, this._rad, this._neck);
        const rgba = this._readColor(getComputedStyle(this).color);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(uniforms.res, pixels, pixels);
        gl.uniform4fv(uniforms.bead, this._pos);
        gl.uniform2fv(uniforms.axis, this._rad);
        gl.uniform1fv(uniforms.neck, this._neck);
        gl.uniform4f(uniforms.color, rgba[0], rgba[1], rgba[2], rgba[3]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (this._visible) this._raf = requestAnimationFrame(draw);
      };
      const start = () => {
        if (!this._raf && this._visible) this._raf = requestAnimationFrame(draw);
      };
      if ("IntersectionObserver" in window) {
        this._observer = new IntersectionObserver((entries) => {
          this._visible = !!(entries[0] && entries[0].isIntersecting);
          if (this._visible) start();
          else if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
        });
        this._observer.observe(canvas);
      }
      start();
    }
  }

  if (!customElements.get("metaball-loader")) {
    customElements.define("metaball-loader", MetaballLoader);
  }
})();