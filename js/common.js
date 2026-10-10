/* =========================================================
 * common.js —— 全局公共工具与组件
 * 功能：LocalStorage 封装、Toast、确认框、模态框、懒加载、
 *       日期格式化、导航高亮、返回顶部、简单模板渲染
 * 说明：纯原生 ES6+，无第三方依赖
 * ========================================================= */

/* ---------------- 工具函数 ---------------- */

/** 生成唯一 ID（基于时间戳 + 随机数） */
export const uid = (prefix = '') =>
  prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** 日期格式化：yyyy-mm-dd */
export function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return str;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 相对时间：刚刚 / x 分钟前 / x 小时前 / x 天前 */
export function timeAgo(str) {
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return str;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
  return formatDate(str);
}

/** 转义 HTML，防止 XSS */
export function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------------- LocalStorage 封装 ---------------- */
const STORAGE_PREFIX = 'campus_';

export const Store = {
  /** 读取并解析 JSON，失败返回 fallback */
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('Store.get 读取失败：', e);
      return fallback;
    }
  },
  /** 写入 JSON */
  set(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      // 容量超限或隐私模式
      console.warn('Store.set 写入失败：', e);
      return false;
    }
  },
  /** 删除 */
  remove(key) {
    localStorage.removeItem(STORAGE_PREFIX + key);
  },
};

/* ---------------- Toast 轻提示 ---------------- */
let toastTimer = null;
export function toast(msg, duration = 2000) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  // 强制重绘后再加 show，触发动画
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

/* ---------------- 确认对话框（Promise 化） ---------------- */
export function confirmDialog(message = '确定执行此操作吗？') {
  return new Promise((resolve) => {
    let mask = document.querySelector('.confirm-mask');
    if (!mask) {
      mask = document.createElement('div');
      mask.className = 'confirm-mask';
      mask.innerHTML = `
        <div class="confirm-box">
          <p class="cf-msg"></p>
          <div class="form-actions">
            <button class="btn btn-ghost btn-sm cf-cancel">取消</button>
            <button class="btn btn-primary btn-sm cf-ok">确定</button>
          </div>
        </div>`;
      document.body.appendChild(mask);
    }
    mask.querySelector('.cf-msg').textContent = message;
    const ok = mask.querySelector('.cf-ok');
    const cancel = mask.querySelector('.cf-cancel');
    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    const onMask = (e) => { if (e.target === mask) onCancel(); };
    const onEsc = (e) => { if (e.key === 'Escape') onCancel(); };
    function cleanup() {
      mask.classList.remove('show');
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      mask.removeEventListener('click', onMask);
      document.removeEventListener('keydown', onEsc);
    }
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    mask.addEventListener('click', onMask);
    document.addEventListener('keydown', onEsc);
    mask.classList.add('show');
  });
}

/* ---------------- 图片懒加载 ---------------- */
export function initLazyLoad(scope = document) {
  const imgs = scope.querySelectorAll('img[data-src]');
  if (!imgs.length) return;

  // 支持原生 loading="lazy" 则直接赋值 src
  if ('loading' in HTMLImageElement.prototype) {
    imgs.forEach((img) => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
    return;
  }

  // 降级：IntersectionObserver
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          io.unobserve(img);
        }
      });
    },
    { rootMargin: '120px' }
  );
  imgs.forEach((img) => io.observe(img));
}

/* ---------------- 返回顶部 ---------------- */
export function initBackToTop() {
  const btn = document.querySelector('.back-top');
  if (!btn) return;
  const onScroll = () => {
    btn.classList.toggle('show', window.scrollY > 400);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  btn.addEventListener('click', () =>
    window.scrollTo({ top: 0, behavior: 'smooth' })
  );
  onScroll();
}

/* ---------------- 导航高亮 ----------------
 * 两轮匹配策略，且全程保证「最多一个链接」高亮：
 *   1) 精确匹配（含解码后的查询串），如 list.html?category=校园活动
 *   2) 若没有精确命中，则按文件路径匹配，如 list.html
 * 注意：浏览器地址栏中的中文会被百分号编码，必须先 decodeURIComponent，
 * 否则精确匹配永远失败并退化为「所有指向 list.html 的分类链接同时高亮」。
 */
export function initNavActive() {
  const path = location.pathname.split('/').pop() || 'index.html';
  // 解码查询串，使其与 HTML 中书写的中文 href 口径一致
  let search = '';
  try {
    search = decodeURIComponent(location.search);
  } catch (e) {
    search = location.search;
  }
  const full = path + search;
  const links = document.querySelectorAll('.main-nav a, .tabbar a');

  // 第一轮：精确匹配，命中即标记并结束
  let matched = null;
  links.forEach((a) => {
    if (!matched && a.getAttribute('href') === full) matched = a;
  });

  // 第二轮：忽略查询串，仅比较文件路径（只取第一个匹配）
  if (!matched) {
    links.forEach((a) => {
      if (!matched && (a.getAttribute('href') || '').split('?')[0] === path) matched = a;
    });
  }

  if (matched) matched.classList.add('active');
}

/* ---------------- 数据加载（Fetch + 本地缓存降级） ----------------
 * 优先 Fetch 本地 data.json；失败时回退到 LocalStorage 缓存或内置数据。
 * 同时把用户自定义文章（Store.get('customArticles')）合并进来。
 */
export async function loadArticles() {
  let articles = [];
  try {
    const res = await fetch('data/data.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    articles = data.articles || [];
    // 写入缓存，便于离线降级
    Store.set('articlesCache', articles);
  } catch (e) {
    console.warn('Fetch data.json 失败，使用本地缓存：', e);
    articles = Store.get('articlesCache', []);
  }
  // 合并用户自定义文章（按 id 区分，自定义优先在前）
  const custom = Store.get('customArticles', []);
  const customIds = new Set(custom.map((a) => a.id));
  articles = articles.filter((a) => !customIds.has(a.id));
  return [...custom, ...articles];
}

/** 统计 + 分类数据（首页图表用） */
export async function loadMeta() {
  try {
    const res = await fetch('data/data.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return { categories: data.categories || [], stats: data.stats || null };
  } catch (e) {
    return { categories: ['全部', '校园活动', '学术讲座', '校园公告', '校园生活', '志愿服务'], stats: null };
  }
}

/* =========================================================
 * 简易账户体系（纯前端，LocalStorage 持久化）
 * 数据模型：
 *   accounts    —— 账户库数组 [{ username, password, email, regTime }]
 *   currentUser —— 当前登录用户 { username, loginTime } 或 null
 * 注意：密码仅 Base64 编码，属教学演示级，非安全方案。
 * ========================================================= */

// 首次使用时预置一个演示账号，便于直接体验
function seedDemoAccount() {
  const accounts = Store.get('accounts', null);
  if (accounts === null) {
    Store.set('accounts', [
      { username: 'student', password: btoa('123456'), email: 'student@campus.edu', regTime: Date.now() },
    ]);
  }
}

export const Auth = {
  /** 获取当前登录用户，未登录返回 null */
  getUser() {
    return Store.get('currentUser', null);
  },

  /** 注册：成功返回 { ok:true }，失败返回 { ok:false, msg } */
  register({ username, password, email }) {
    seedDemoAccount();
    const accounts = Store.get('accounts', []);
    if (accounts.some((a) => a.username === username)) {
      return { ok: false, msg: '该用户名已被注册' };
    }
    accounts.push({
      username,
      password: btoa(password),
      email: email || '',
      regTime: Date.now(),
    });
    Store.set('accounts', accounts);
    return { ok: true };
  },

  /** 登录：校验用户名与密码 */
  login(username, password) {
    seedDemoAccount();
    const accounts = Store.get('accounts', []);
    const found = accounts.find((a) => a.username === username);
    if (!found || found.password !== btoa(password)) {
      return { ok: false, msg: '用户名或密码错误' };
    }
    const user = { username, loginTime: Date.now() };
    Store.set('currentUser', user);
    return { ok: true, user };
  },

  /** 退出登录 */
  logout() {
    Store.remove('currentUser');
  },
};

/* ---------------- 头部登录态 UI ----------------
 * 在页面 header 的 #authArea 中渲染：
 *   未登录 → “登录”按钮
 *   已登录 → 头像 + 用户名 + 退出按钮
 */
export function initAuthUI() {
  seedDemoAccount();
  const box = document.getElementById('authArea');
  if (!box) return;
  const user = Auth.getUser();

  if (!user) {
    box.innerHTML = `<a class="auth-login" href="login.html">登录</a>`;
    return;
  }

  box.innerHTML = `
    <div class="user-menu">
      <span class="user-avatar">${escapeHtml(user.username.slice(0, 1).toUpperCase())}</span>
      <span class="user-name">${escapeHtml(user.username)}</span>
      <button class="logout-btn" type="button" title="退出登录">退出</button>
    </div>`;

  box.querySelector('.logout-btn').addEventListener('click', async () => {
    const ok = await confirmDialog(`确定退出账号「${user.username}」吗？`);
    if (!ok) return;
    Auth.logout();
    toast('已退出登录');
    initAuthUI();
  });
}

/* ---------------- DOM 就绪后初始化公共部分 ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  initNavActive();
  initBackToTop();
  initLazyLoad();
  initAuthUI();
});
