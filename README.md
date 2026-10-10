# 校园生活助手（Campus Life Assistant）

一个移动端优先的响应式 Web 应用，为高校师生聚合校园资讯、活动公告与生活服务。
基于**原生 HTML5 + CSS3 + JavaScript（ES6+）**实现，数据本地持久化，无需后端即可运行。

## 🌐 在线访问

<https://kkwang-1.github.io/campus-life-assistant/>（GitHub Pages，手机 / 电脑均可，永久有效）

## ✨ 功能清单

### 基础功能

- **多页面结构**：首页、资讯列表页、资讯详情页、登录页，共用头部导航与底部栏
- **语义化 HTML5**：`header / nav / main / section / article / aside / footer`
- **响应式布局**：移动优先，Flex / Grid + 媒体查询，适配手机（<768px）与桌面（≥768px）
- **动态列表**：模板字符串渲染资讯卡片，支持骨架屏与空状态
- **搜索 / 筛选 / 排序**：关键词搜索（防抖）、分类芯片筛选、按日期 / 浏览量排序
- **资讯管理（CRUD）**：发布、编辑、删除资讯，模态框表单，删除前确认
- **表单前端校验**：必填、长度、邮箱 / 手机号格式、密码强度等

### 提高功能

- **LocalStorage 持久化**：自建资讯、评论、浏览量、账户均本地保存，刷新不丢失
- **Canvas 可视化**：首页粒子动画背景 + 带入场动画的活动统计柱状图
- **Fetch 数据请求**：请求本地 `data/data.json`，失败自动降级到本地缓存
- **多媒体**：Web Audio API 合成校园报时铃声；图片懒加载（IntersectionObserver）
- **简易登录 / 注册**：双 Tab 表单、用户名查重、登录态全站联动、退出确认
- **首页内容看板**：焦点头条、数字看板（滚动动画）、热门排行榜、近期动态时间线、每日一句轮播、平台特色

> 演示账号：**student** / **123456**（首次访问自动预置）。
> 注意：密码仅做 Base64 编码，属教学演示级，非安全存储方案。

## 🚀 运行方式

项目使用 ES6 模块，**必须通过 HTTP 访问**，不能直接双击用 `file://` 打开。

### 方式一：双击启动（最简单，Windows）

双击项目根目录下的 **`启动服务器.bat`**，浏览器会自动打开 <http://localhost:8080>。
使用完毕后关闭黑窗口即停止服务器。（需已安装 Python 3）

### 方式二：命令行启动

```bash
# 进入项目目录后执行（server_nocache.py 同时禁用浏览器缓存，便于查看最新页面）
python server_nocache.py
```

浏览器访问：<http://localhost:8080>

### 方式三：其他静态服务器

```bash
# Node.js
npx serve .

# 或 VS Code 的 Live Server 插件
```

## 📁 目录结构

```
.
├── 启动服务器.bat              一键启动脚本（双击自动打开浏览器）
├── server_nocache.py           本地服务器（响应附带禁用缓存头）
├── index.html                 首页：Hero 粒子背景、焦点头条、数字看板、
│                              快捷入口、热门排行榜、Canvas 柱状图、
│                              精选资讯、近期动态时间线、每日一句、平台特色
├── list.html                  资讯列表页：搜索 / 筛选 / 排序、发布 / 编辑 / 删除
├── detail.html                详情页：正文、浏览量、评论、校园铃声、相关推荐
├── login.html                 登录 / 注册页
├── css/
│   └── style.css              全局样式：CSS 变量、移动优先、组件、桌面媒体查询
├── js/
│   ├── common.js              公共模块：Store / Toast / 确认框 / 懒加载 /
│   │                          Fetch 封装、导航高亮、Auth 账户体系
│   ├── home.js                首页逻辑：粒子动画、头条、数字看板、排行榜、
│   │                          时间线、每日一句、柱状图、精选资讯
│   ├── list.js                列表逻辑：渲染 / 搜索 / 筛选 / CRUD / 校验
│   ├── detail.js              详情逻辑：详情、评论、相关推荐、分类铃声
│   └── login.js               登录逻辑：Tab 切换、登录 / 注册校验
├── data/
│   └── data.json              数据源：16 篇资讯 + 分类 + 活动统计
└── README.md                  本说明文件
```

## 🔧 技术说明

| 技术点         | 用途                                   |
| -------------- | -------------------------------------- |
| HTML5 语义标签 | 页面结构与可访问性                     |
| CSS3 Flex/Grid | 弹性与网格布局                         |
| CSS 媒体查询   | 响应式断点：768px / 1024px             |
| ES6 Modules    | `import / export` 模块化组织代码       |
| LocalStorage   | 资讯、评论、浏览量、账户持久化         |
| Canvas 2D      | 粒子动画、柱状图（含高分屏适配）       |
| Fetch API      | 加载本地 JSON，含失败缓存降级          |
| Web Audio API  | 振荡器合成报时铃声，无需音频文件       |
| IntersectionObserver | 图片懒加载、图表进入视口触发动画 |

### 数据流

```
data/data.json ──Fetch──▶ 列表/首页渲染
                                ▲
LocalStorage ◀──读写── 用户资讯 / 评论 / 浏览量 / 账户
（Fetch 失败时，页面自动降级读取 LocalStorage 缓存）
```

## 🌏 兼容性

- Chrome 最新版（推荐）
- 移动端效果以 Chrome DevTools 设备模拟为准
- 支持 `prefers-reduced-motion`，开启系统“减弱动态效果”时动画自动停用

## 📄 许可证

仅供课程教学演示使用。
