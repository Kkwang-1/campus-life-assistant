/* =========================================================
 * detail.js —— 详情页逻辑
 * 功能：按 id 加载文章、浏览量统计（LocalStorage）、
 *       评论区（LocalStorage 持久化 + 表单校验）、
 *       相关推荐、校园之声 Web Audio 播放器、
 *       自定义文章的编辑/删除入口
 * ========================================================= */
import {
  loadArticles, Store, uid, escapeHtml, formatDate, timeAgo,
  toast, confirmDialog, initLazyLoad,
} from './common.js?v=2';

let currentArticle = null;

/* ---------------- 1. 启动 ---------------- */
async function init() {
  const id = getQueryParam('id');
  if (!id) return showNotFound();

  const articles = await loadArticles();
  currentArticle = articles.find((a) => String(a.id) === String(id));
  if (!currentArticle) return showNotFound();

  renderDetail();
  incrementViews();
  renderComments();
  renderRelated(articles);
  initChimePlayer();
}

/** 解析 query 参数 */
function getQueryParam(key) {
  return new URLSearchParams(location.search).get(key);
}

/* ---------------- 2. 渲染详情 ---------------- */
function renderDetail() {
  const a = currentArticle;
  document.title = `${a.title} - 校园生活助手`;

  // 封面
  document.getElementById('detailCover').innerHTML =
    `<img data-src="${a.image}" alt="${escapeHtml(a.title)}" loading="lazy">`;
  initLazyLoad();

  // 标签 + 标题
  document.getElementById('detailTag').textContent = a.category;
  document.getElementById('detailTitle').textContent = a.title;

  // 元信息
  document.getElementById('detailMeta').innerHTML = `
    <span>👤 ${escapeHtml(a.author)}</span>
    <span>📅 ${escapeHtml(a.date)}</span>
    <span>👁 ${a.views || 0} 次浏览</span>`;

  // 正文：按换行分段
  const paragraphs = String(a.content)
    .split(/\n{1,}/)
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');
  document.getElementById('detailContent').innerHTML = paragraphs;

  // 自定义文章显示编辑/删除
  const actions = document.getElementById('detailActions');
  if (String(a.id).startsWith('c_')) {
    actions.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="editBtn">编辑</button>
      <button class="btn btn-danger btn-sm" id="delBtn">删除</button>`;
    document.getElementById('editBtn').addEventListener('click', () => {
      // 跳转列表页并带编辑参数（列表页打开即编辑）
      sessionStorage.setItem('editId', a.id);
      location.href = 'list.html';
    });
    document.getElementById('delBtn').addEventListener('click', handleDelete);
  }
}

/* ---------------- 3. 浏览量统计（LocalStorage） ---------------- */
function incrementViews() {
  const a = currentArticle;
  // 浏览量计入 LocalStorage（按 id 记录），避免每次刷新无限增长：每次访问 +1
  const counts = Store.get('viewCounts', {});
  counts[a.id] = (counts[a.id] || a.views || 0) + 1;
  Store.set('viewCounts', counts);
  a.views = counts[a.id];
  // 同步更新页面显示
  const meta = document.getElementById('detailMeta');
  if (meta) {
    meta.querySelector('span:last-child').textContent = `👁 ${a.views} 次浏览`;
  }
}

/* ---------------- 4. 评论区 ---------------- */
function getComments() {
  return Store.get(`comments_${currentArticle.id}`, []);
}

function renderComments() {
  const list = getComments().sort((x, y) => new Date(y.time) - new Date(x.time));
  const box = document.getElementById('commentList');
  const countEl = document.getElementById('commentCount');
  countEl.textContent = list.length;

  if (!list.length) {
    box.innerHTML = `<p class="empty-state" style="padding:20px">还没有评论，来抢沙发吧</p>`;
    return;
  }
  box.innerHTML = list
    .map(
      (c) => `
    <div class="comment-item">
      <div class="ci-head">
        <span class="ci-name">${escapeHtml(c.name)}</span>
        <span class="ci-time">${timeAgo(c.time)}</span>
      </div>
      <div class="ci-body">${escapeHtml(c.body)}</div>
    </div>`
    )
    .join('');
}

function bindCommentForm() {
  const form = document.getElementById('commentForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form['name'].value.trim();
    const body = form['body'].value.trim();
    const errors = {};

    if (name.length < 2) errors.name = '昵称至少 2 个字';
    else if (name.length > 20) errors.name = '昵称不能超过 20 个字';
    if (body.length < 2) errors.body = '评论内容至少 2 个字';
    else if (body.length > 200) errors.body = '评论不能超过 200 个字';

    // 显示错误
    form.querySelectorAll('.form-group').forEach((g) => {
      g.classList.remove('has-error');
      const f = g.dataset.field;
      if (f && errors[f]) {
        g.classList.add('has-error');
        g.querySelector('.err-msg').textContent = errors[f];
      }
    });

    if (Object.keys(errors).length) {
      toast('请检查评论内容');
      return;
    }

    // 保存评论
    const list = getComments();
    list.push({ id: uid('cm_'), name, body, time: new Date().toISOString() });
    Store.set(`comments_${currentArticle.id}`, list);
    form.reset();
    renderComments();
    toast('评论成功');
  });

  // 输入时清除该字段错误状态
  form.querySelectorAll('input, textarea').forEach((el) => {
    el.addEventListener('input', () => {
      el.closest('.form-group')?.classList.remove('has-error');
    });
  });
}

/* ---------------- 5. 相关推荐 ---------------- */
function renderRelated(allArticles) {
  const a = currentArticle;
  const related = allArticles
    .filter((x) => x.id !== a.id && x.category === a.category)
    .slice(0, 4);
  const box = document.getElementById('relatedBox');
  if (!related.length) {
    box.innerHTML = `<p style="color:var(--color-text-light);font-size:0.86rem">暂无相关资讯</p>`;
    return;
  }
  box.innerHTML = related
    .map(
      (r) => `
    <a class="quick-card" href="detail.html?id=${r.id}">
      <div class="qc-icon" style="background:linear-gradient(135deg,#f5a623,#e89712)">📰</div>
      <div class="qc-text">
        <strong>${escapeHtml(r.title)}</strong>
        <span>${escapeHtml(r.author)} · ${escapeHtml(r.date)}</span>
      </div>
    </a>`
    )
    .join('');
}

/* ---------------- 6. 校园之声 Web Audio 播放器 ----------------
 * 说明：使用 Web Audio API 合成旋律，无需外部音频文件，离线可用。
 *       旋律按「文章分类」区分，不同分类拥有不同音符序列与音色，
 *       因此不同资讯的铃声不再相同。点击播放/停止。
 */

// 音符频率表（C4 ~ C6）
const NOTE = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77, C6: 1046.5,
};

/** 根据分类返回专属旋律：name 旋律名 / wave 波形音色 / gain 音量 / notes 音符序列
 * 每个分类在「波形 + 节奏 + 音区 + 织体」四个维度上都做了差异化：
 *   校园活动——锯齿波、快速、高音区（号角感）
 *   学术讲座——正弦波、慢速、低音区（沉思感）
 *   校园公告——方波、叮咚两音一组（门铃感）
 *   校园生活——三角波、三拍子圆舞曲（温馨感）
 *   志愿服务——正弦波双音和弦、长音织体（和其他人声式单音旋律明显不同）
 * 音符格式：[音名数组, 起始秒, 时长秒]，音名数组支持多音同时发声（和弦）
 */
function getMelody(category) {
 const THEMES = {
    '校园活动': {
      name: '活力号角', wave: 'sawtooth', gain: 0.13,
      notes: [[['C5'],0,0.18],[['E5'],0.22,0.18],[['G5'],0.44,0.18],[['C6'],0.66,0.18],[['G5'],0.88,0.18],[['C6'],1.1,0.5]],
    },
    '学术讲座': {
      name: '沉思曲', wave: 'sine', gain: 0.26,
      notes: [[['E4'],0,0.5],[['A4'],0.56,0.5],[['G4'],1.12,0.5],[['C5'],1.68,0.7]],
    },
    '校园公告': {
      name: '叮咚提醒', wave: 'square', gain: 0.09,
      notes: [[['G5'],0,0.13],[['E5'],0.15,0.24],[['G5'],0.52,0.13],[['E5'],0.67,0.24],[['C6'],1.05,0.4]],
    },
    '校园生活': {
      name: '温馨圆舞曲', wave: 'triangle', gain: 0.24,
      notes: [[['E4'],0,0.24],[['G4'],0.27,0.24],[['C5'],0.54,0.42],[['D5'],1.0,0.24],[['B4'],1.27,0.24],[['G4'],1.54,0.55]],
    },
    '志愿服务': {
      name: '温暖和弦', wave: 'sine', gain: 0.2,
      notes: [[['C5','G5'],0,0.5],[['A4','E5'],0.56,0.5],[['F5','C6'],1.12,0.75]],
    },
  };
  return (
    THEMES[category] || {
      name: '校园报时旋律', wave: 'sine', gain: 0.28,
      notes: [[['C5'],0,0.32],[['E5'],0.34,0.32],[['G5'],0.68,0.32],[['C6'],1.02,0.7]],
    }
  );
}

function initChimePlayer() {
  const btn = document.getElementById('chimeBtn');
  const statusEl = document.getElementById('chimeStatus');
  if (!btn) return;

  let ctx = null;
  let playing = false;
  let timers = [];
  let activeOscs = [];

  // 依据当前文章分类取得专属旋律，把音名数组映射为频率数组
  const theme = getMelody(currentArticle.category);
  const melody = theme.notes.map(([names, t, d]) => ({
    freqs: names.map((n) => NOTE[n]), t, d,
  }));

  async function play() {
    stop(true); // 先清理可能未结束的上一次播放
    // 首次播放时在「点击手势」内创建上下文（满足移动端自动播放策略）
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    // 关键：必须等待上下文从 suspended 恢复为 running，再排音符，
    // 否则手机端音符会因起始时间已过而被整体跳过（表现为无声）
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch (e) { /* 忽略，继续尝试 */ }
    }
    playing = true;
    btn.textContent = '⏸ 停止';
    statusEl.textContent = `正在播放：${currentArticle.category} · ${theme.name}`;

    // 在恢复后的真实时间基础上留 0.06 秒缓冲，避免首个音符被吞
    const now = ctx.currentTime + 0.06;
    melody.forEach((n) => {
      // 一个音符可能含多个频率（和弦），逐个创建振荡器
      n.freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = theme.wave;
        osc.frequency.value = freq;
        // 包络：淡入淡出，避免爆音
        gain.gain.setValueAtTime(0, now + n.t);
        gain.gain.linearRampToValueAtTime(theme.gain, now + n.t + 0.03);
        gain.gain.linearRampToValueAtTime(0.0001, now + n.t + n.d);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + n.t);
        osc.stop(now + n.t + n.d + 0.02);
        activeOscs.push(osc);
      });
    });
    // 旋律结束后恢复按钮
    const total = melody[melody.length - 1].t + melody[melody.length - 1].d;
    timers.push(setTimeout(() => stop(false), (total + 0.3) * 1000));
  }

  /** immediate=true 时还会立即中断正在响的振荡器 */
  function stop(immediate = false) {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
    playing = false;
    btn.textContent = '▶ 播放';
    statusEl.textContent = `校园之声 · ${currentArticle.category} · ${theme.name}`;
    if (immediate) {
      activeOscs.forEach((osc) => {
        try { osc.stop(); } catch (e) { /* 已停止 */ }
      });
    }
    activeOscs = [];
  }

  btn.addEventListener('click', () => (playing ? stop(true) : play()));
}

/* ---------------- 7. 删除自定义文章 ---------------- */
async function handleDelete() {
  const ok = await confirmDialog('确定删除这篇资讯吗？相关评论也会一并清除。');
  if (!ok) return;
  const custom = Store.get('customArticles', []).filter((a) => a.id !== currentArticle.id);
  Store.set('customArticles', custom);
  Store.remove(`comments_${currentArticle.id}`);
  toast('已删除');
  setTimeout(() => (location.href = 'list.html'), 600);
}

/* ---------------- 8. 未找到 ---------------- */
function showNotFound() {
  const main = document.querySelector('main');
  main.innerHTML = `
    <div class="container" style="padding:40px 16px;text-align:center">
      <div class="empty-state">
        <span class="emoji">😿</span>
        <p>未找到该资讯</p>
        <p style="font-size:0.84rem;margin-top:8px">它可能已被删除或链接有误</p>
      </div>
      <a class="btn btn-primary" href="list.html" style="margin-top:18px">返回列表</a>
    </div>`;
}

/* ---------------- 启动 ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  init().then(() => {
    if (currentArticle) bindCommentForm();
  });
});
