/* =========================================================
 * login.js —— 登录/注册页逻辑
 * 功能：登录与注册 Tab 切换、前端表单校验、
 *       调用 common.js 的 Auth 完成账户操作、
 *       登录成功后按 redirect 参数回跳（默认首页）
 * ========================================================= */
import { Auth, toast } from './common.js?v=2';

/* ---------------- 1. Tab 切换 ---------------- */
function initTabs() {
  const tabs = document.querySelectorAll('.auth-tab');
  const panels = document.querySelectorAll('.auth-panel');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.target).classList.add('active');
      // 切换时清除所有错误状态
      clearAllErrors();
    });
  });
}

/* ---------------- 2. 登录表单 ---------------- */
function initLoginForm() {
  const form = document.getElementById('loginForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = form['username'].value.trim();
    const password = form['password'].value;
    const errors = {};

    if (username.length < 2) errors.username = '请输入用户名（至少 2 个字符）';
    if (username.length > 20) errors.username = '用户名不能超过 20 个字符';
    if (!password) errors.password = '请输入密码';
    else if (password.length < 6) errors.password = '密码至少 6 位';

    showErrors(form, errors);
    if (Object.keys(errors).length) return;

    const res = Auth.login(username, password);
    if (!res.ok) {
      // 账号或密码错误，显示在密码字段下方
      showErrors(form, { password: res.msg });
      toast(res.msg);
      return;
    }
    toast('登录成功，欢迎回来！');
    setTimeout(redirect, 600);
  });

  bindClearOnInput(form);
}

/* ---------------- 3. 注册表单 ---------------- */
function initRegisterForm() {
  const form = document.getElementById('registerForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = form['username'].value.trim();
    const email = form['email'].value.trim();
    const password = form['password'].value;
    const confirm = form['confirm'].value;
    const errors = {};

    // 用户名：2-20 位，字母/数字/下划线/中文
    if (username.length < 2) errors.username = '用户名至少 2 个字符';
    else if (username.length > 20) errors.username = '用户名不能超过 20 个字符';
    else if (!/^[\w一-龥]+$/.test(username)) errors.username = '只能使用中英文、数字与下划线';

    // 邮箱：合法格式（必填）
    const emailRe = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/;
    if (!email) errors.email = '请输入邮箱';
    else if (!emailRe.test(email)) errors.email = '邮箱格式不正确';

    // 密码：6-20 位，需含字母和数字
    if (password.length < 6) errors.password = '密码至少 6 位';
    else if (password.length > 20) errors.password = '密码不能超过 20 位';
    else if (!/[a-zA-Z]/.test(password) || !/\d/.test(password))
      errors.password = '密码需同时包含字母和数字';

    // 确认密码：一致
    if (confirm !== password) errors.confirm = '两次输入的密码不一致';

    showErrors(form, errors);
    if (Object.keys(errors).length) return;

    const res = Auth.register({ username, password, email });
    if (!res.ok) {
      showErrors(form, { username: res.msg });
      toast(res.msg);
      return;
    }
    toast('注册成功，请登录');
    // 切回登录 Tab，并预填用户名
    setTimeout(() => {
      document.querySelector('.auth-tab[data-target="panel-login"]').click();
      document.querySelector('#loginForm [name=username]').value = username;
      document.querySelector('#loginForm [name=password]').focus();
    }, 600);
  });

  bindClearOnInput(form);
}

/* ---------------- 4. 错误显示工具 ---------------- */
function showErrors(form, errors) {
  form.querySelectorAll('.form-group').forEach((g) => {
    g.classList.remove('has-error');
    const field = g.dataset.field;
    if (field && errors[field]) {
      g.classList.add('has-error');
      g.querySelector('.err-msg').textContent = errors[field];
    }
  });
}

function bindClearOnInput(form) {
  form.querySelectorAll('input').forEach((el) => {
    el.addEventListener('input', () => {
      el.closest('.form-group')?.classList.remove('has-error');
    });
  });
}

function clearAllErrors() {
  document.querySelectorAll('.form-group.has-error').forEach((g) => g.classList.remove('has-error'));
}

/* ---------------- 5. 登录成功后跳转 ---------------- */
function redirect() {
  const target = new URLSearchParams(location.search).get('redirect');
  // 仅允许站内相对路径，防范开放重定向
  if (target && target.startsWith('/') === false && !target.startsWith('http')) {
    location.href = target;
  } else {
    location.href = 'index.html';
  }
}

/* ---------------- 6. 已登录用户访问则直接跳走 ---------------- */
function redirectIfLoggedIn() {
  if (Auth.getUser()) {
    toast('你已登录');
    setTimeout(redirect, 600);
  }
}

/* ---------------- 启动 ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initLoginForm();
  initRegisterForm();
  redirectIfLoggedIn();
});
