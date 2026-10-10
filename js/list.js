/* =========================================================
 * list.js —— 资讯列表页逻辑
 * 功能：动态渲染列表、搜索、分类筛选、排序、
 *       新增/编辑/删除文章（CRUD，LocalStorage 持久化），
 *       表单前端校验（必填、长度、邮箱/手机格式）
 * ========================================================= */
import {
  loadArticles, loadMeta, Store, uid,
  escapeHtml, toast, confirmDialog, initLazyLoad,
} from './common.js?v=2';

/* 状态：当前筛选/搜索/排序条件 */
const state = {
  keyword: '',
  category: '全部',
  sort: 'date', // date | views
  articles: [],
  categories: ['全部'],
};

/* 默认封面图（用于用户新建且未填图片时） */
const DEFAULT_COVERS = [
  'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=university%20campus%20students%20activity%20bright%20modern&image_size=landscape_16_9',
  'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=college%20students%20studying%20together%20library%20warm&image_size=landscape_16_9',
  'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=university%20campus%20green%20trees%20spring%20sunny&image_size=landscape_16_9',
];

/* ---------------- 1. 初始化 ---------------- */
async function init() {
  const [articles, meta] = await Promise.all([loadArticles(), loadMeta()]);
  state.articles = articles;
  state.categories = meta.categories.length ? meta.categories : ['全部'];

  // 读取 URL 中的分类参数，预设筛选
  const cat = new URLSearchParams(location.search).get('category');
  if (cat && state.categories.includes(cat)) state.category = cat;

  renderCategories();
  render();
  bindEvents();

  // 若来自详情页「编辑」跳转，自动打开编辑表单
  const editId = sessionStorage.getItem('editId');
  if (editId) {
    sessionStorage.removeItem('editId');
    const target = articles.find((a) => a.id === editId);
    if (target) openForm(target);
  }
}

/* ---------------- 2. 渲染分类筛选 ---------------- */
function renderCategories() {
  const box = document.getElementById('categoryBox');
  if (!box) return;
  box.innerHTML = state.categories
    .map(
      (c) =>
        `<button class="chip ${c === state.category ? 'active' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`
    )
    .join('');
  box.querySelectorAll('.chip').forEach((btn) =>
    btn.addEventListener('click', () => {
      state.category = btn.dataset.cat;
      renderCategories();
      render();
    })
  );
}

/* ---------------- 3. 过滤 + 排序 + 渲染列表 ---------------- */
function getFiltered() {
  const kw = state.keyword.trim().toLowerCase();
  let list = state.articles.filter((a) => {
    const matchCat = state.category === '全部' || a.category === state.category;
    const matchKw =
      !kw ||
      a.title.toLowerCase().includes(kw) ||
      (a.summary || '').toLowerCase().includes(kw) ||
      (a.author || '').toLowerCase().includes(kw);
    return matchCat && matchKw;
  });
  // 排序
  list.sort((a, b) => {
    if (state.sort === 'views') return (b.views || 0) - (a.views || 0);
    return new Date(b.date) - new Date(a.date);
  });
  return list;
}

function render() {
  const box = document.getElementById('articleBox');
  const countEl = document.getElementById('resultCount');
  const list = getFiltered();
  if (countEl) countEl.textContent = `共 ${list.length} 条`;

  if (!list.length) {
    box.innerHTML = `
      <div class="empty-state">
        <span class="emoji">🔍</span>
        <p>没有找到匹配的资讯</p>
        <p style="font-size:0.82rem;margin-top:6px">试试换个关键词或分类</p>
      </div>`;
    return;
  }

  box.innerHTML = list.map((a) => renderCard(a)).join('');
  initLazyLoad(box);
}

function renderCard(a) {
  // 自定义文章可编辑/删除；内置文章只读
  const isCustom = String(a.id).startsWith('c_');
  const actions = isCustom
    ? `<div class="ac-actions">
         <button class="btn btn-ghost btn-sm js-edit" data-id="${a.id}">编辑</button>
         <button class="btn btn-danger btn-sm js-del" data-id="${a.id}">删除</button>
       </div>`
    : '';
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
        <span>${escapeHtml(a.author)} · ${escapeHtml(a.date)}</span>
        <span class="views">👁 ${a.views || 0}</span>
      </div>
      ${actions}
    </div>
  </article>`;
}

/* ---------------- 4. 事件绑定 ---------------- */
function bindEvents() {
  // 搜索（防抖）
  const searchInput = document.getElementById('searchInput');
  let t = null;
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.keyword = e.target.value;
      render();
    }, 200);
  });

  // 排序
  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    state.sort = e.target.value;
    render();
  });

  // 新增按钮
  document.getElementById('addBtn')?.addEventListener('click', () => openForm());

  // 编辑/删除（事件委托）
  const box = document.getElementById('articleBox');
  box.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.js-edit');
    const delBtn = e.target.closest('.js-del');
    if (editBtn) {
      const a = state.articles.find((x) => x.id === editBtn.dataset.id);
      if (a) openForm(a);
      return;
    }
    if (delBtn) {
      handleDelete(delBtn.dataset.id);
      return;
    }
    // 点击卡片其他区域跳转详情
    const card = e.target.closest('.article-card[data-id]');
    if (card && !editBtn && !delBtn) {
      location.href = `detail.html?id=${card.dataset.id}`;
    }
  });

  // 模态框关闭
  document.getElementById('modalClose')?.addEventListener('click', closeForm);
  document.getElementById('formMask')?.addEventListener('click', (e) => {
    if (e.target.id === 'formMask') closeForm();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeForm();
  });

  // 表单提交
  document.getElementById('articleForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleFormSubmit();
  });
}

/* ---------------- 5. 表单：新增/编辑 ---------------- */
function openForm(article = null) {
  const mask = document.getElementById('formMask');
  const title = document.getElementById('formTitle');
  const form = document.getElementById('articleForm');
  if (!mask || !form) return;

  // 重置校验状态
  form.querySelectorAll('.form-group').forEach((g) => g.classList.remove('has-error'));

  if (article) {
    title.textContent = '编辑资讯';
    form['id'].value = article.id;
    form['title'].value = article.title || '';
    form['category'].value = article.category || '';
    form['author'].value = article.author || '';
    form['contact'].value = article.contact || '';
    form['summary'].value = article.summary || '';
    form['content'].value = article.content || '';
    form['image'].value = article.image || '';
  } else {
    title.textContent = '发布新资讯';
    form.reset();
    form['id'].value = '';
    form['category'].value = state.categories[1] || '';
  }
  mask.classList.add('show');
  // 自动聚焦标题
  setTimeout(() => form['title'].focus(), 50);
}

function closeForm() {
  const mask = document.getElementById('formMask');
  if (mask) mask.classList.remove('show');
}

/* ---------------- 6. 表单校验 ----------------
 * 规则：
 *   - 标题：必填，2-30 字
 *   - 分类：必选
 *   - 作者：必填，2-20 字
 *   - 联系方式：选填，但若填写需符合 邮箱 或 手机 格式
 *   - 摘要：必填，10-100 字
 *   - 正文：必填，20-500 字
 */
function validateForm(data) {
  const errors = {};
  if (!data.title || data.title.trim().length < 2)
    errors.title = '请填写标题（至少 2 个字）';
  else if (data.title.trim().length > 30)
    errors.title = '标题不能超过 30 个字';

  if (!data.category) errors.category = '请选择分类';

  if (!data.author || data.author.trim().length < 2)
    errors.author = '请填写作者（至少 2 个字）';
  else if (data.author.trim().length > 20)
    errors.author = '作者名不能超过 20 个字';

  // 联系方式：选填，但需合法
  if (data.contact.trim()) {
    const emailRe = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/;
    const phoneRe = /^1[3-9]\d{9}$/;
    if (!emailRe.test(data.contact) && !phoneRe.test(data.contact))
      errors.contact = '请输入合法的邮箱或手机号';
  }

  if (!data.summary || data.summary.trim().length < 10)
    errors.summary = '摘要至少 10 个字';
  else if (data.summary.trim().length > 100)
    errors.summary = '摘要不能超过 100 个字';

  if (!data.content || data.content.trim().length < 20)
    errors.content = '正文至少 20 个字';
  else if (data.content.trim().length > 500)
    errors.content = '正文不能超过 500 个字';

  return errors;
}

/** 显示字段错误 */
function showErrors(errors) {
  const form = document.getElementById('articleForm');
  form.querySelectorAll('.form-group').forEach((g) => {
    g.classList.remove('has-error');
    const field = g.dataset.field;
    const msgEl = g.querySelector('.err-msg');
    if (field && errors[field]) {
      g.classList.add('has-error');
      if (msgEl) msgEl.textContent = errors[field];
    }
  });
}

/* ---------------- 7. 表单提交处理 ---------------- */
function handleFormSubmit() {
  const form = document.getElementById('articleForm');
  const fd = new FormData(form);
  const data = {
    id: fd.get('id'),
    title: fd.get('title')?.trim() || '',
    category: fd.get('category') || '',
    author: fd.get('author')?.trim() || '',
    contact: fd.get('contact')?.trim() || '',
    summary: fd.get('summary')?.trim() || '',
    content: fd.get('content')?.trim() || '',
    image: fd.get('image')?.trim() || '',
  };

  const errors = validateForm(data);
  showErrors(errors);
  if (Object.keys(errors).length) {
    toast('请修正表单中的错误');
    return;
  }

  // 补全默认封面
  if (!data.image) {
    data.image = DEFAULT_COVERS[Math.floor(Math.random() * DEFAULT_COVERS.length)];
  }

  // 读取已有自定义文章
  const custom = Store.get('customArticles', []);

  if (data.id) {
    // 编辑
    const idx = custom.findIndex((a) => a.id === data.id);
    if (idx > -1) {
      custom[idx] = { ...custom[idx], ...data };
      Store.set('customArticles', custom);
      // 更新内存
      const i2 = state.articles.findIndex((a) => a.id === data.id);
      if (i2 > -1) state.articles[i2] = custom[idx];
      toast('修改成功');
    }
  } else {
    // 新增
    data.id = uid('c_');
    data.date = new Date().toISOString().slice(0, 10);
    data.views = 0;
    custom.unshift(data);
    Store.set('customArticles', custom);
    state.articles.unshift(data);
    toast('发布成功');
  }

  closeForm();
  render();
}

/* ---------------- 8. 删除处理 ---------------- */
async function handleDelete(id) {
  const ok = await confirmDialog('确定删除这篇资讯吗？此操作不可撤销。');
  if (!ok) return;

  const custom = Store.get('customArticles', []);
  const next = custom.filter((a) => a.id !== id);
  Store.set('customArticles', next);
  // 更新内存
  state.articles = state.articles.filter((a) => a.id !== id);
  toast('已删除');
  render();
}

/* ---------------- 启动 ---------------- */
document.addEventListener('DOMContentLoaded', init);
