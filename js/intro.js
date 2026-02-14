// 深海引导层：波纹动画 + 音频自动播放 + 进入按钮
(function(){
  const overlay = document.getElementById('intro-overlay');
  if (!overlay) return;
  const search = new URLSearchParams(window.location.search);
  const skipByParam = search.get('skipIntro') === '1';
  let skipByReferrer = false;
  if (document.referrer) {
    try {
      skipByReferrer = new URL(document.referrer).origin === window.location.origin;
    } catch (e) {
      skipByReferrer = false;
    }
  }
  if (skipByParam || skipByReferrer) {
    overlay.remove();
    if (skipByParam && window.history && window.history.replaceState) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }
    return;
  }
  const canvas = document.getElementById('intro-canvas');
  const ctx = canvas.getContext('2d');
  const ecgCanvas = document.getElementById('intro-ecg');
  const ecg = ecgCanvas.getContext('2d');
  const enterBtn = document.getElementById('intro-enter-btn');
  const playBtn = document.getElementById('intro-play-btn');
  const pauseBtn = document.getElementById('intro-pause-btn');
  const vinyl = document.getElementById('intro-vinyl');

  // ===== 可调配置：尖峰数量/高度/宽度/方向/噪声/边缘衰减 =====
  const SPIKE_COUNT = 20;                       // 尖峰数量
  const SPIKE_HEIGHT = { min: 10, max: 100 };    // 像素高度范围
  const SPIKE_WIDTH  = { min: 0.012, max: 0.04 }; // 相对宽度（0..1）
  const SPIKE_UPWARD_PROB = 0.6;                // 向上尖峰概率（其余向下）
  const NOISE_INTENSITY = 1.2;                  // 噪声振幅（像素）
  const EDGE_TAPER_EXP = 1.25;                  // 边缘衰减锐度（越大越中间集中）
  const WAVE_Y_SCALE = 1.0;                     // 垂直整体缩放（>1 更高，<1 更低）

  // 固定音乐波形：预生成“尖峰”布局（位置/宽度/高度/方向），不随时间移动
  const ecgSpikes = Array.from({length: SPIKE_COUNT}, () => ({
    u: 0.06 + 0.88*Math.random(),                          // 峰位置（相对 0..1）
    w: SPIKE_WIDTH.min + (SPIKE_WIDTH.max-SPIKE_WIDTH.min)*Math.random(),
    h: SPIKE_HEIGHT.min + (SPIKE_HEIGHT.max-SPIKE_HEIGHT.min)*Math.random(),
    dir: Math.random() < SPIKE_UPWARD_PROB ? -1 : 1,       // -1 向上（屏幕坐标减小），1 向下
    phase: Math.random()*Math.PI*2
  }));

  // 主题音频
  const audio = new Audio('audio/shenhai.mp3');
  audio.loop = true;
  audio.volume = 0.7;

  // 自适应尺寸
  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ecgCanvas.width = Math.floor(ecgCanvas.clientWidth * dpr);
    ecgCanvas.height = Math.floor(ecgCanvas.clientHeight * dpr);
    ecg.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // 简洁的“深海波纹网状”动画：多层正弦波 + 泛光粒子
  const waves = [
    { amp: 18, len: 160, spd: 0.6, color: 'rgba(93,178,255,0.25)' },
    { amp: 28, len: 240, spd: 0.45, color: 'rgba(255,255,255,0.08)' },
    { amp: 14, len: 120, spd: 0.75, color: 'rgba(255,255,255,0.05)' }
  ];
  const particles = Array.from({length: 60}, _ => ({
    x: Math.random(), y: Math.random(), r: 1 + Math.random()*2, v: 0.05 + Math.random()*0.1
  }));

  let t0 = performance.now();
  function draw(now){
    const dt = (now - t0) / 1000; t0 = now;
    const w = canvas.clientWidth, h = canvas.clientHeight;

    // 背景渐变暗涌
    const grd = ctx.createLinearGradient(0,0,0,h);
    grd.addColorStop(0, '#0B3471');
    grd.addColorStop(1, '#072447');
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,w,h);

    // 波纹
    waves.forEach((wv, idx) => {
      ctx.beginPath();
      for (let x=0; x<=w; x+=12){
        const y = h*0.55 + Math.sin((x/w)*Math.PI*2 + now*0.001*wv.spd) * wv.amp
                 + Math.cos((x/w)*Math.PI*4 + now*0.0012*wv.spd) * (wv.amp*0.4);
        if (x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.strokeStyle = wv.color;
      ctx.lineWidth = idx===1 ? 1.2 : 0.8;
      ctx.stroke();
    });

    // 细网格（淡）
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const grid = 60;
    for (let x=0;x<w;x+=grid){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    for (let y=0;y<h;y+=grid){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }

    // 粒子浮动
    particles.forEach(p=>{
      p.y -= p.v*dt*8e-2; // 缓慢上浮
      if (p.y < -0.05) { p.x = Math.random(); p.y = 1.05; }
      const px = p.x * w, py = p.y * h;
      const r = p.r;
      const g = ctx.createRadialGradient(px,py,0, px,py,r*3);
      g.addColorStop(0,'rgba(255,255,255,0.25)');
      g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.fill();
    });

    // ECG: 居中短段 + 两端连接 + 扩散环，位于黑胶之下
    const ew = ecgCanvas.clientWidth, eh = ecgCanvas.clientHeight;
    ecg.clearRect(0,0,ew,eh);

    // 估算黑胶在屏中心，定位其水平中线；如有位移，可通过 getBoundingClientRect 动态拿位置
    const vinylEl = vinyl;
    let midY = eh * 0.5;
    let centerX = ew * 0.5;
    let vinylR = Math.min(vinylEl?.clientWidth || 220, vinylEl?.clientHeight || 220)/2;
    if (vinylEl){
      const rect = vinylEl.getBoundingClientRect();
      const orect = overlay.getBoundingClientRect();
      centerX = rect.left - orect.left + rect.width/2;
      midY = rect.top - orect.top + rect.height/2;
      vinylR = rect.width/2;
    }

    const tsec = now/1000;
    const segmentW = Math.max(vinylR*3, 800); // 中心段宽度（固定）
    const leftX = centerX - segmentW/2;
    const rightX = centerX + segmentW/2;

    // 呼吸/亮度随时间变化，但波形不水平移动
    const drift = Math.sin(tsec*0.53)*1.6 + Math.cos(tsec*0.23)*1.2; // 轻微上下漂移
    const breath = (Math.sin(tsec*0.5)*0.5 + 0.5); // 0~1

    // 固定音乐波形：基线轻正弦 + 多个尖峰（幂函数尖化）叠加；不水平移动
    function waveY(x){
      const u = (x - leftX) / segmentW; // 0..1
      const k = Math.PI * 2;
      // 轻柔底纹（保持音乐感，不显得生硬）
      const baseA = WAVE_Y_SCALE * 4 * (0.7 + 0.3*breath);
      const baseB = WAVE_Y_SCALE * 2 * (0.6 + 0.4*Math.sin(tsec*0.8));
      // 边缘衰减：两端趋于平（0 at edges, 1 at center）
      const edgeTaper = Math.pow(Math.sin(Math.PI * Math.min(Math.max(u,0),1)), EDGE_TAPER_EXP);
      let y = midY + drift
            + edgeTaper * (baseA * Math.sin(u * k * 2.5)
            +              baseB * Math.sin(u * k * 4.5 + 0.7));

      // 尖峰叠加（越接近峰中心越尖，峰高随时间呼吸变化；峰可向上或向下）
      for (const s of ecgSpikes){
        const d = Math.abs(u - s.u);
        if (d < s.w){
          const sharp = 1 - (d / s.w);        // 0..1 线性
          const peakProfile = Math.pow(sharp, 2.2); // 幂次提高尖锐度
          const hEff = WAVE_Y_SCALE * s.h * (0.6 + 0.4*breath) * (0.85 + 0.3*Math.sin(tsec*0.6 + s.phase));
          y += s.dir * hEff * peakProfile * edgeTaper; // dir: -1 上、1 下
        }
      }

      // 细粒噪声（非闪烁）：以空间频率为主的“静态+微呼吸”噪声
      const n = (Math.sin(u*117.0 + 1.7) + Math.sin(u*263.0 + 0.8))*0.5;
      y += edgeTaper * WAVE_Y_SCALE * NOISE_INTENSITY * (0.6 + 0.4*breath) * n;
      return y;
    }

  // 去掉左右连接段：只显示电波中心段

    // 计算两端绘制范围（避开黑胶水平投影范围）；不再绘制发光层，避免“呼吸”遮挡电波
    const leftDrawEnd = Math.min(rightX, centerX - vinylR);
    const rightDrawStart = Math.max(leftX, centerX + vinylR);

    // 两端核心细线层
    ecg.strokeStyle = 'rgba(255,255,255,0.92)';
    ecg.lineWidth = 1.6;
    // 左段
    if (leftDrawEnd > leftX){
      ecg.beginPath();
      let first3 = true;
      for(let x= leftX; x<=leftDrawEnd; x+=2){
        const y = waveY(x);
        if (first3) { ecg.moveTo(x,y); first3=false; } else { ecg.lineTo(x,y); }
      }
      ecg.stroke();
    }
    // 右段
    if (rightDrawStart < rightX){
      ecg.beginPath();
      let first4 = true;
      for(let x= rightDrawStart; x<=rightX; x+=2){
        const y = waveY(x);
        if (first4) { ecg.moveTo(x,y); first4=false; } else { ecg.lineTo(x,y); }
      }
      ecg.stroke();
    }

  // 去掉两端扩散光圈（按需求）

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  // 尝试自动播放（可能被浏览器策略拦截）
  audio.play().then(()=>{
    // 自动播放成功：显示暂停，显示进入按钮，开始旋转
    pauseBtn && (pauseBtn.disabled = false);
    playBtn && (playBtn.disabled = true);
  enterBtn && (enterBtn.hidden = false);
    if (vinyl) vinyl.style.animation = 'vinyl-spin 5s linear infinite';
    overlay.classList.add('corners-visible');
  }).catch(()=>{
    // 自动播放失败：等待用户点击播放
  });

  // 进入按钮
  enterBtn?.addEventListener('click', async ()=>{
    try {
      await audio.play(); // 如果此前被拦截，点击后可播放
    } catch {}
    // 平滑淡出音量
    const start = audio.volume;
    const tStart = performance.now();
    function fade(){
      const k = Math.min(1, (performance.now()-tStart)/800);
      audio.volume = start * (1-k);
      if (k < 1) requestAnimationFrame(fade); else audio.pause();
    }
    fade();

    // 淡出遮罩
    overlay.classList.add('fade-out');
    setTimeout(()=>{
      overlay.remove();
    }, 750);
  });

  // 播放/暂停控制
  playBtn?.addEventListener('click', async ()=>{
    try {
      await audio.play();
      playBtn.disabled = true;
      pauseBtn.disabled = false;
  enterBtn.hidden = false; // 播放后显示进入
      if (vinyl) vinyl.style.animation = 'vinyl-spin 5s linear infinite';
      overlay.classList.add('corners-visible');
    } catch {}
  });

  pauseBtn?.addEventListener('click', ()=>{
    audio.pause();
    pauseBtn.disabled = true;
    playBtn.disabled = false;
    if (vinyl) vinyl.style.animation = 'vinyl-spin 0s linear infinite';
  });
})();
