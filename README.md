# Meishi 校园餐饮点评 MVP

这是一个面向校园餐饮场景的 **GitHub Pages + Supabase** 静态站点初始化版本，围绕以下 MVP 目标进行设计：

- 游客浏览商家、搜索、查看评价。
- 学号注册/登录后上传商家、发布评价、举报评价、提交反馈。
- 管理员审核商家、处理举报、限评用户、重置密码。
- 使用贝叶斯平均对商家排序。

## 当前仓库内容

- `index.html`：移动端优先的静态前端原型。
- `styles.css`：站点样式。
- `app.js`：前端交互逻辑、示例数据、贝叶斯评分排序。
- `supabase/schema.sql`：数据库表、约束、触发器、RLS 策略与辅助函数草案。
- `supabase/edge-functions/reset-password/index.ts`：管理员重置密码函数示例。
- `supabase/edge-functions/manage-admin/index.ts`：超级管理员授予/移除管理员权限函数示例。

## 技术决策

- **前端托管**：GitHub Pages
- **前端形态**：纯静态 Web 站点
- **后端能力**：Supabase
- **数据库**：Supabase Postgres
- **认证**：Supabase Auth + `public.users` 扩展表
- **存储**：Supabase Storage（`avatars`、`merchant-images`、`dish-images`）
- **权限控制**：Supabase RLS
- **敏感操作**：Supabase Edge Functions

## 本版本定位

这是一个适合作为 MVP 起点的仓库初始化版本，重点完成：

1. 产品信息架构梳理。
2. 静态站点首页与核心页面骨架。
3. 贝叶斯平均排序前端实现示例。
4. Supabase 数据模型与权限设计草案。
5. 管理员敏感操作的 Edge Functions 安全边界示例。

## GitHub Pages 部署

该项目当前为纯静态结构，可直接部署到 GitHub Pages：

1. 将仓库推送到 GitHub。
2. 在仓库 `Settings -> Pages` 中选择从默认分支部署。
3. 根目录作为发布目录。
4. 配置 Supabase URL 与匿名公钥后，可把 `app.js` 的示例数据替换成真实 API 调用。

## 下一步建议

- 接入真实 Supabase 项目与环境变量注入方案。
- 将静态原型拆分为组件化前端（例如 React/Vite 静态导出）。
- 完成真实登录、商家上传、评价、举报、反馈的数据库读写。
- 增加后台管理页与审核流。
- 配置自动化部署与基础测试。
