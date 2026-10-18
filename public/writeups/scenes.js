// one grey scene per machine, themed on its name. drawn at 640x400, dithered by writeups.js.
// t is seconds since hover started; t = 0 is the still shown on the card
(() => {
  const TAU = Math.PI * 2;
  const h = (a, b) => { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); };
  const glow = (g, x, y, r, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 640, 400); };
  const lit = (g, x0, y0, x1, y1, a = 0.95, b = 0.2) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, `rgba(255,255,255,${b})`); return gr; };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  const white = a => `rgba(255,255,255,${a})`, black = a => `rgba(0,0,0,${a})`;

  window.SCENES = {
    // Pirate: a ship under a moon, rocking on the waves
    ship(g, t = 0) {
      glow(g, 470, 90, 120, 0.5);
      g.fillStyle = white(.9); g.beginPath(); g.arc(470, 90, 34, 0, TAU); g.fill();
      g.save(); g.translate(310, 300 + Math.sin(t * 1.6) * 4); g.rotate(Math.sin(t * 1.3) * 0.03); g.translate(-310, -300);
      g.fillStyle = lit(g, 0, 250, 0, 300, 0.85, 0.35);
      g.beginPath(); g.moveTo(170, 255); g.lineTo(450, 255); g.lineTo(415, 300); g.lineTo(205, 300); g.closePath(); g.fill();
      g.fillStyle = white(.75); g.fillRect(268, 90, 6, 168); g.fillRect(352, 120, 6, 138);
      g.fillStyle = lit(g, 230, 100, 330, 240, 0.95, 0.45);
      g.beginPath(); g.moveTo(276, 100); g.quadraticCurveTo(330, 160, 276, 240); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(266, 108); g.quadraticCurveTo(220, 170, 266, 232); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(360, 128); g.quadraticCurveTo(405, 180, 360, 238); g.closePath(); g.fill();
      g.fillStyle = white(.8); g.beginPath(); g.moveTo(274, 90); g.lineTo(306, 98 + Math.sin(t * 6) * 3); g.lineTo(274, 106); g.fill();
      g.restore();
      for (let k = 0; k < 4; k++) {
        g.strokeStyle = white(0.5 - k * 0.1); g.lineWidth = 5;
        g.beginPath(); for (let x = 0; x <= 640; x += 8) g.lineTo(x, 300 + k * 24 + Math.sin(x / 38 + k + t * (1.2 + k * 0.3)) * 7); g.stroke();
      }
    },

    // DarkZero: a pulsing ring around nothing, stars slowly circling it
    void(g, t = 0) {
      glow(g, 320, 200, 260, 0.25 + Math.sin(t * 2) * 0.05);
      for (let i = 0; i < 6; i++) { g.strokeStyle = white(0.9 - i * 0.14); g.lineWidth = 10 - i; g.beginPath(); g.arc(320, 200, 110 + i * 16 + Math.sin(t * 2.2 - i * 0.7) * 3, 0, TAU); g.stroke(); }
      const hole = g.createRadialGradient(320, 200, 0, 320, 200, 105); hole.addColorStop(0, '#000'); hole.addColorStop(0.92, '#000'); hole.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = hole; g.beginPath(); g.arc(320, 200, 105, 0, TAU); g.fill();
      g.fillStyle = white(.8);
      for (let i = 0; i < 70; i++) { const r = 150 + (i * 37 % 140), a = i * 2.39 + t * 0.25 * (300 / r - 0.6); g.fillRect(320 + Math.cos(a) * r, 200 + Math.sin(a) * r * 0.7, 2.5, 2.5); }
    },

    // Gavel: a judge's gavel tapping its block
    gavel(g, t = 0) {
      glow(g, 360, 300, 300, 0.18);
      const p = (t * 0.75 + 0.35) % 1;
      const lift = p < 0.7 ? 0.45 * Math.sin(p / 0.7 * Math.PI / 2) : p < 0.8 ? 0.45 * (1 - ((p - 0.7) / 0.1) ** 2) : 0;
      if (p >= 0.8 && p < 0.92) glow(g, 395, 305, 140, 0.45 * (1 - (p - 0.8) / 0.12));
      g.fillStyle = white(.5); g.fillRect(290, 305, 220, 26); g.beginPath(); g.ellipse(400, 331, 110, 26, 0, 0, Math.PI); g.fill();
      g.fillStyle = lit(g, 0, 280, 0, 330, 0.8, 0.35); g.beginPath(); g.ellipse(400, 305, 110, 26, 0, 0, TAU); g.fill();
      g.save(); g.translate(150, 245); g.rotate(-lift);
      g.fillStyle = lit(g, 0, 0, 215, 0, 0.55, 0.85); rr(g, 0, -9, 215, 18, 9); g.fill();
      g.fillStyle = lit(g, 205, -60, 285, 60, 0.98, 0.45); rr(g, 205, -60, 80, 120, 16); g.fill();
      g.fillStyle = black(.45); g.fillRect(205, -44, 80, 7); g.fillRect(205, 37, 80, 7);
      g.restore();
    },

    // Kobold: the mine spirit's lantern, flame flickering, pickaxe against the wall
    lantern(g, t = 0) {
      const f = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 7.3 + 1) * 0.05;
      glow(g, 300, 215, 230 * f, 0.5 * f);
      g.save(); g.translate(470, 250); g.rotate(0.35);
      g.fillStyle = white(.5); g.fillRect(-6, -110, 12, 220);
      g.fillStyle = lit(g, -80, -130, 80, -100, 0.85, 0.5); g.beginPath(); g.moveTo(-80, -100); g.quadraticCurveTo(0, -150, 80, -100); g.lineTo(0, -120); g.closePath(); g.fill();
      g.restore();
      g.strokeStyle = white(.7); g.lineWidth = 6; g.beginPath(); g.arc(300, 128, 26, Math.PI, 0); g.stroke();
      g.fillStyle = lit(g, 260, 140, 340, 290, 0.9, 0.5); rr(g, 262, 140, 76, 18, 6); g.fill(); rr(g, 262, 272, 76, 20, 6); g.fill();
      g.fillStyle = white(.45); rr(g, 270, 158, 60, 114, 10); g.fill();
      g.save(); g.translate(300, 236); g.scale(f, f * (1 + Math.sin(t * 9) * 0.06));
      g.fillStyle = white(1); g.beginPath(); g.moveTo(0, -48); g.quadraticCurveTo(24, -6, 0, 20); g.quadraticCurveTo(-24, -6, 0, -48); g.fill();
      g.restore();
      g.fillStyle = white(.18); g.fillRect(0, 330, 640, 70);
    },

    // CCTV: a wall camera panning, its cone of view sweeping the floor
    camera(g, t = 0) {
      g.strokeStyle = white(.12); g.lineWidth = 2;
      for (let y = 300; y < 400; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(640, y); g.stroke(); }
      g.fillStyle = white(.35); g.fillRect(520, 40, 16, 130); g.fillRect(470, 150, 60, 12);
      g.save(); g.translate(470, 160); g.rotate(-0.55 + Math.sin(t * 0.9) * 0.22);
      const cone = g.createLinearGradient(-160, 0, -620, 0); cone.addColorStop(0, white(.4)); cone.addColorStop(1, white(0));
      g.fillStyle = cone; g.beginPath(); g.moveTo(-160, -10); g.lineTo(-640, -230); g.lineTo(-640, 230); g.lineTo(-160, 10); g.closePath(); g.fill();
      g.fillStyle = white(.9); rr(g, -175, -38, 185, 14, 5); g.fill();
      g.fillStyle = lit(g, 0, -24, 0, 26, 0.85, 0.45); rr(g, -160, -24, 160, 50, 10); g.fill();
      g.fillStyle = white(1); g.beginPath(); g.arc(-160, 1, 20, 0, TAU); g.fill();
      g.fillStyle = black(.8); g.beginPath(); g.arc(-160, 1, 10, 0, TAU); g.fill();
      if ((t * 1.5) % 1 < 0.5) { g.fillStyle = white(1); g.beginPath(); g.arc(-30, -8, 5, 0, TAU); g.fill(); }
      g.restore();
    },

    // Shocker: a lightning bolt in the rain, flashing
    bolt(g, t = 0) {
      const p = (t * 0.6) % 1, f = p < 0.06 ? 1 : p < 0.1 ? 0.15 : p < 0.14 ? 0.7 : 0;
      glow(g, 330, 160, 300, 0.2 + f * 0.35);
      g.fillStyle = white(.16 + f * 0.1);
      for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(i * 80 + h(i, 3) * 40, 25 + h(i, 4) * 30, 70, 30, 0, 0, TAU); g.fill(); }
      g.strokeStyle = white(.22); g.lineWidth = 2;
      for (let i = 0; i < 70; i++) { const y = (h(i, 2) * 460 + t * 520) % 460 - 40, x = h(i, 1) * 760 - 120 + y * 0.25; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 5, y + 20); g.stroke(); }
      g.strokeStyle = white(.2 + f * 0.5); g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        let x = 300 + h(i, 5) * 60, y = 60 + h(i, 6) * 200; g.beginPath(); g.moveTo(x, y);
        for (let j = 0; j < 4; j++) { x += (h(i, j + 7) - 0.5) * 70; y += 15 + h(j, i + 9) * 20; g.lineTo(x, y); }
        g.stroke();
      }
      g.fillStyle = white(.7 + f * 0.3);
      g.beginPath(); g.moveTo(340, 20); g.lineTo(280, 180); g.lineTo(330, 180); g.lineTo(270, 380); g.lineTo(380, 160); g.lineTo(330, 160); g.lineTo(380, 20); g.closePath(); g.fill();
    },

    // Return: an office printer feeding out a page
    printer(g, t = 0) {
      glow(g, 320, 220, 260, 0.2);
      // input tray page (behind the top)
      g.fillStyle = white(.65); g.fillRect(245, 80, 150, 50);
      g.fillStyle = black(.3); for (let i = 0; i < 3; i++) g.fillRect(260, 90 + i * 10, i % 2 ? 80 : 110, 3);
      // main body
      g.fillStyle = white(.7); g.beginPath(); g.moveTo(180, 130); g.lineTo(460, 130); g.lineTo(480, 170); g.lineTo(160, 170); g.closePath(); g.fill();
      g.fillStyle = lit(g, 0, 170, 0, 290, 0.5, 0.22); rr(g, 160, 170, 320, 120, 8); g.fill();
      // output slot
      g.fillStyle = '#000'; g.fillRect(200, 218, 240, 8);
      // output page sliding out
      const out = Math.min(90, t > 0 ? 20 + t * 28 : 20);
      g.fillStyle = white(.85); g.fillRect(210, 226, 220, out);
      g.fillStyle = black(.3); for (let i = 0; i < 5; i++) { const py = 232 + i * 12; if (py < 226 + out - 4) g.fillRect(225, py, i % 2 ? 100 : 170, 3); }
      // base/feet
      g.fillStyle = white(.35); g.beginPath(); g.moveTo(185, 290); g.lineTo(455, 290); g.lineTo(475, 310); g.lineTo(165, 310); g.closePath(); g.fill();
      // status LED
      g.fillStyle = white((t * 2) % 1 < 0.5 ? 1 : 0.3); g.beginPath(); g.arc(440, 185, 5, 0, TAU); g.fill();
    },

    // Cicada: a cicada seen from above
    cicada(g, t = 0) {
      glow(g, 320, 200, 200, 0.2);
      const buzz = t > 0 ? Math.sin(t * 40) * 0.015 : 0;
      g.save(); g.translate(320, 200);
      // abdomen (oval, bottom)
      g.fillStyle = white(.5); g.beginPath(); g.ellipse(0, 60, 38, 70, 0, 0, TAU); g.fill();
      g.strokeStyle = white(.3); g.lineWidth = 2;
      for (let i = 1; i <= 5; i++) { g.beginPath(); g.moveTo(-30 + i * 3, 20 + i * 18); g.lineTo(30 - i * 3, 20 + i * 18); g.stroke(); }
      // thorax
      g.fillStyle = white(.6); g.beginPath(); g.ellipse(0, -10, 32, 30, 0, 0, TAU); g.fill();
      // head
      g.fillStyle = white(.7); g.beginPath(); g.ellipse(0, -52, 28, 20, 0, 0, TAU); g.fill();
      // eyes
      g.fillStyle = white(1); g.beginPath(); g.arc(-24, -54, 10, 0, TAU); g.fill(); g.beginPath(); g.arc(24, -54, 10, 0, TAU); g.fill();
      g.fillStyle = black(.6); g.beginPath(); g.arc(-24, -54, 5, 0, TAU); g.fill(); g.beginPath(); g.arc(24, -54, 5, 0, TAU); g.fill();
      // antennae
      g.strokeStyle = white(.6); g.lineWidth = 2;
      g.beginPath(); g.moveTo(-14, -68); g.quadraticCurveTo(-40, -110, -55, -120); g.stroke();
      g.beginPath(); g.moveTo(14, -68); g.quadraticCurveTo(40, -110, 55, -120); g.stroke();
      // wings (left and right, with veins)
      for (const s of [-1, 1]) {
        g.save(); g.scale(s, 1); g.rotate(buzz * s);
        g.fillStyle = white(.25); g.beginPath(); g.moveTo(20, -20); g.quadraticCurveTo(130, -50, 120, 30); g.quadraticCurveTo(100, 100, 30, 90); g.closePath(); g.fill();
        g.strokeStyle = white(.2); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(25, -10); g.lineTo(110, 0); g.stroke();
        g.beginPath(); g.moveTo(28, 10); g.lineTo(105, 40); g.stroke();
        g.beginPath(); g.moveTo(30, 30); g.lineTo(90, 70); g.stroke();
        g.beginPath(); g.moveTo(60, -25); g.lineTo(65, 80); g.stroke();
        g.restore();
      }
      // legs (3 pairs)
      g.strokeStyle = white(.45); g.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const y = -15 + i * 25;
        g.beginPath(); g.moveTo(-28, y); g.lineTo(-60 - i * 8, y + 20 + i * 5); g.lineTo(-75 - i * 6, y + 40 + i * 4); g.stroke();
        g.beginPath(); g.moveTo(28, y); g.lineTo(60 + i * 8, y + 20 + i * 5); g.lineTo(75 + i * 6, y + 40 + i * 4); g.stroke();
      }
      g.restore();
    },

    // Expressway: vanishing-point road rushing toward the viewer
    road(g, t = 0) {
      glow(g, 320, 120, 300, 0.15);
      const vx = 320, vy = 100;
      // sky gradient
      g.fillStyle = lit(g, 0, 0, 0, vy + 20, 0.12, 0.02); g.fillRect(0, 0, 640, vy + 20);
      // horizon line
      g.strokeStyle = white(.3); g.lineWidth = 1; g.beginPath(); g.moveTo(0, vy + 20); g.lineTo(640, vy + 20); g.stroke();
      // road surface
      g.fillStyle = white(.12);
      g.beginPath(); g.moveTo(vx - 6, vy); g.lineTo(0, 400); g.lineTo(640, 400); g.lineTo(vx + 6, vy); g.closePath(); g.fill();
      // road edges
      g.strokeStyle = white(.4); g.lineWidth = 3;
      g.beginPath(); g.moveTo(vx - 6, vy); g.lineTo(40, 400); g.stroke();
      g.beginPath(); g.moveTo(vx + 6, vy); g.lineTo(600, 400); g.stroke();
      // center dashes rushing toward viewer
      for (let i = 0; i < 14; i++) {
        const p = ((i / 14 + t * 0.3) % 1); if (p < 0.02) continue;
        const y0 = vy + p * p * (400 - vy), y1 = vy + Math.min(1, p + 0.04) ** 2 * (400 - vy);
        const w = 1.5 + p * 5;
        g.fillStyle = white(.5 + p * .3); g.fillRect(vx - w / 2, y0, w, y1 - y0);
      }
      // side posts
      for (let i = 0; i < 8; i++) {
        const p = ((i / 8 + t * 0.3) % 1); if (p < 0.04) continue;
        const y = vy + p * p * (400 - vy), scale = 0.3 + p * 2.5;
        const lx = vx - 6 - p * (vx - 40), rx = vx + 6 + p * (600 - vx);
        g.fillStyle = white(.35 + p * .2);
        g.fillRect(lx - scale / 2, y - scale * 6, scale, scale * 6);
        g.fillRect(rx - scale / 2, y - scale * 6, scale, scale * 6);
      }
      // stars in the sky
      for (let i = 0; i < 30; i++) { g.fillStyle = white(.3 + h(i, 0) * .4); g.fillRect(h(i, 1) * 640, h(i, 2) * (vy - 10), 2, 2); }
    },
  };
})();