/* =========================================================
 * home.js —— 首页逻辑
 * 包含：Canvas 粒子背景动画、Canvas 柱状图（带动画）、
 *       Fetch 渲染精选资讯、图片懒加载
 * ========================================================= */
import { loadArticles, loadMeta, initLazyLoad, escapeHtml } from './common.js?v=2';

/* ---------------- 1. Canvas 粒子背景（Hero 区） ----------------
 * 说明：使用 requestAnimationFrame 实现轻量粒子动效，
 *       遵守 prefers-reduced-motion 时静止绘制。
 */
function initHeroParticles() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let particles = [];
  let raf = null;
  let w = 0, h = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    // 处理高 DPI 屏幕
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initParticles();
  }

  function initParticles() {
    const count = Math.max(18, Math.floor(w * h / 14000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 2.4 + 0.6,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      a: Math.random() * 0.5 + 0.2,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    // 绘制粒子
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${p.a})`;
      ctx.fill();
      // 移动
      p.x += p.vx;
      p.y += p.vy;
      // 边界反弹
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
    }
    // 连线（距离近的粒子）
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist < 90) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(255,255,255,${0.12 * (1 - dist / 90)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
  }

  function loop() {
    draw();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    resize();
    if (reduceMotion) { draw(); return; }
    if (!raf) loop();
  }

  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  // 页面不可见时暂停，节省性能
  document.addEventListener('visibilitychange', () => {
    document.hidden ? stop() : start();
  });

  start();
  window.addEventListener('resize', () => {
    clearTimeout(start._t);
    start._t = setTimeout(start, 200);
  });
}

/* ---------------- 2. Canvas 柱状图（带动画） ----------------
 * 说明：手写 Canvas 柱状图，含坐标轴、数值标签、
 *       入场动画（高度逐次升起）。
 */
function initStatsChart() {
  const canvas = document.getElementById('statsCanvas');
  if (!canvas) return;
  const wrap = canvas.parentElement;
  const ctx = canvas.getContext('2d');

  const draw = (labels, values, progress) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const padL = 32, padR = 12, padT = 16, padB = 28;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const max = Math.max(...values, 1);
    const n = values.length;
    const gap = 10;
    const barW = (chartW - gap * (n - 1)) / n;

    // Y 轴参考线
    ctx.strokeStyle = '#e2e8e4';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#5c6b63';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const y = padT + (chartH / 4) * i;
      const val = Math.round(max - (max / 4) * i);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillText(String(val), padL - 6, y);
    }

    // 柱子
    const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    grad.addColorStop(0, '#2f7a4e');
    grad.addColorStop(1, '#4ca06a');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i < n; i++) {
      const fullH = (values[i] / max) * chartH;
      const curH = fullH * progress;
      const x = padL + i * (barW + gap);
      const y = padT + chartH - curH;
      // 圆角矩形
      const r = Math.min(6, barW / 2);
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, barW, curH, r);
      ctx.fill();
      // 顶部数值
      if (progress > 0.85) {
        ctx.fillStyle = '#1f5e3a';
        ctx.fillText(String(values[i]), x + barW / 2, y - 16);
      }
      // X 轴标签
      ctx.fillStyle = '#5c6b63';
      ctx.fillText(labels[i], x + barW / 2, padT + chartH + 8);
    }
  };

  // 圆角矩形辅助
  function roundRect(c, x, y, w, h, r) {
    if (h < r) r = h / 2;
    if (w < r * 2) r = w / 2;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, 0);
    c.arcTo(x, y + h, x, y, 0);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  const start = async () => {
    const { stats } = await loadMeta();
    if (!stats) return;
    // 先绘制终态骨架（progress=0），等动画
    const labels = stats.labels, values = stats.values;
    let progress = 0;
    const animate = () => {
      progress += 0.04;
      if (progress >= 1) { progress = 1; draw(labels, values, 1); return; }
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      draw(labels, values, eased);
      requestAnimationFrame(animate);
    };
    animate();
  };

  // 进入视口再开始动画
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { start(); io.disconnect(); }
      });
    },
    { threshold: 0.3 }
  );
  io.observe(canvas);

  // 响应式重绘
  window.addEventListener('resize', () => {
    clearTimeout(draw._t);
    draw._t = setTimeout(start, 200);
  });
}

/* ---------------- 3. 焦点头条 ----------------
 * 取浏览量最高的一篇，渲染为大图横幅。
 */
function initFocus(articles) {
  const box = document.getElementById('focusBox');
  if (!box) return;
  const top = [...articles].sort((a, b) => (b.views || 0) - (a.views || 0))[0];
  if (!top) {
    box.querySelector('h3').textContent = '暂无头条';
    return;
  }
  box.href = `detail.html?id=${top.id}`;
  box.innerHTML = `
    <div class="fb-media">
      <img src="${top.image}" alt="${escapeHtml(top.title)}">
    </div>
    <div class="fb-body">
      <span class="fb-tag">${escapeHtml(top.category)}</span>
      <h3>${escapeHtml(top.title)}</h3>
      <p>${escapeHtml(top.summary)}</p>
      <span class="fb-more">阅读全文 →</span>
    </div>`;
}

/* ---------------- 4. 数字看板（滚动动画） ----------------
 * 进入视口后数字从 0 递增到目标值。
 */
function initStatCounters(articles, meta) {
  const targets = {
    statArticles: articles.length,
    statViews: articles.reduce((s, a) => s + (a.views || 0), 0),
    statCats: (meta.categories || []).filter((c) => c !== '全部').length,
    statWeek: (meta.stats?.values || []).reduce((s, v) => s + v, 0),
  };
  const strip = document.querySelector('.stats-strip');
  if (!strip) return;

  let played = false;
  const play = () => {
    if (played) return;
    played = true;
    Object.entries(targets).forEach(([id, target], idx) => {
      const el = document.getElementById(id);
      if (!el) return;
      const duration = 1100 + idx * 120;
      const startTs = performance.now();
      const tick = (now) => {
        const p = Math.min((now - startTs) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString();
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };

  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && play()),
    { threshold: 0.4 }
  );
  io.observe(strip);
}

/* ---------------- 5. 热门排行榜 Top5 ----------------
 * 前三名使用金、银、铜色排名徽标。
 */
function initRank(articles) {
  const box = document.getElementById('rankBox');
  if (!box) return;
  const top5 = [...articles].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
  box.innerHTML = top5
    .map((a, i) => `
      <a class="rank-item" href="detail.html?id=${a.id}">
        <span class="rank-no ${i < 3 ? 'top' + (i + 1) : ''}">${i + 1}</span>
        <span class="rank-title">${escapeHtml(a.title)}</span>
        <span class="rank-cat">${escapeHtml(a.category)}</span>
        <span class="rank-views">👁 ${formatViews(a.views)}</span>
      </a>`)
    .join('');
}

/* ---------------- 6. 近期动态时间线 ----------------
 * 按日期取最新 5 条，以竖向时间轴呈现。
 */
function initTimeline(articles) {
  const box = document.getElementById('timelineBox');
  if (!box) return;
  const latest = [...articles]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
  box.innerHTML = latest
    .map(
      (a) => `
      <a class="tl-item" href="detail.html?id=${a.id}">
        <span class="tl-dot"></span>
        <span class="tl-content">
          <span class="tl-title">${escapeHtml(a.title)}</span>
          <span class="tl-meta">${escapeHtml(a.category)} · ${a.date}</span>
        </span>
      </a>`
    )
    .join('');
}

/* ---------------- 7. 每日一句（轮播） ----------------
 * 每 6 秒淡入淡出切换一条励志语录。
 */
function initQuote() {
  const quotes = [
    { text: '星光不问赶路人，时光不负有心人。', author: '校园寄语' },
    { text: '所谓成长，就是把哭声调成静音的过程。', author: '网络' },
    { text: '不要因为走得太远，而忘记为什么出发。', author: '纪伯伦' },
    { text: '今天的努力，是幸运的伏笔。', author: '校园寄语' },
    { text: '愿你走出半生，归来仍是少年。', author: '苏轼 词意' },
    { text: '所有的光芒，都需要时间才能被看到。', author: '梵高' },
  ];
  const card = document.getElementById('quoteCard');
  const textEl = document.getElementById('quoteText');
  const authorEl = document.getElementById('quoteAuthor');
  if (!card) return;

  let i = Math.floor(Math.random() * quotes.length);
  const show = () => {
    card.classList.remove('show');
    setTimeout(() => {
      textEl.textContent = quotes[i].text;
      authorEl.textContent = '—— ' + quotes[i].author;
      card.classList.add('show');
    }, 450);
  };
  card.classList.add('show');
  textEl.textContent = quotes[i].text;
  authorEl.textContent = '—— ' + quotes[i].author;
  setInterval(() => {
    i = (i + 1) % quotes.length;
    show();
  }, 6000);
}

/* ---------------- 8. 精选资讯渲染 ----------------
 * 说明：取浏览量最高的若干条作为精选，懒加载图片，
 *       点击跳转 detail.html?id=xxx
 */
function initFeatured(articles) {
  const box = document.getElementById('featuredBox');
  if (!box) return;

  // 骨架屏占位
  const skeleton = Array.from({ length: 4 }, () => `
    <div class="article-card">
      <div class="ac-media skeleton"></div>
      <div class="ac-body">
        <div class="skeleton" style="height:18px;width:80%;margin-bottom:8px"></div>
        <div class="skeleton" style="height:14px;width:100%;margin-bottom:6px"></div>
        <div class="skeleton" style="height:14px;width:60%"></div>
      </div>
    </div>`).join('');
  box.innerHTML = skeleton;

  const featured = [...articles].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 6);
  if (!featured.length) {
    box.innerHTML = `<p class="empty-state">暂无精选内容</p>`;
    return;
  }
  box.innerHTML = featured.map(renderCard).join('');
  initLazyLoad(box);
}

function renderCard(a) {
  return `
  <article class="article-card" data-id="${a.id}">
    <div class="ac-media">
      <span class="ac-tag">${escapeHtml(a.category)}</span>
      <img data-src="${a.image}" alt="${escapeHtml(a.title)}" loading="lazy">
    </div>
    <div class="ac-body">
      <h3>${escapeHtml(a.title)}</h3>
      <p class="ac-summary">${escapeHtml(a.summary)}</p>
      <div class="ac-meta">
        <span>${escapeHtml(a.author)}</span>
        <span class="views">👁 ${formatViews(a.views)}</span>
      </div>
    </div>
  </article>`;
}

/** 浏览量格式化：>1000 显示 1.2k */
function formatViews(n = 0) {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

/* ---------------- 4. 卡片点击跳转 ---------------- */
function bindCardClick() {
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.article-card[data-id]');
    if (!card) return;
    location.href = `detail.html?id=${card.dataset.id}`;
  });
}

/* ---------------- 启动 ---------------- */
document.addEventListener('DOMContentLoaded', async () => {
  initHeroParticles();
  initStatsChart();
  initQuote();
  bindCardClick();

  // 数据只加载一次，供各内容板块复用
  let articles = [];
  let meta = { categories: [], stats: null };
  try {
    [articles, meta] = await Promise.all([loadArticles(), loadMeta()]);
  } catch (e) {
    console.error('首页数据加载失败：', e);
  }

  if (articles.length) {
    initFocus(articles);
    initStatCounters(articles, meta);
    initRank(articles);
    initTimeline(articles);
  }
  initFeatured(articles);
});
