# 安财美食地图

校园餐饮点评平台，采用 GitHub Pages + Supabase 架构。

## 技术架构

| 层级   | 技术选型                      |
| ---- | ------------------------- |
| 前端托管 | GitHub Pages              |
| 前端框架 | 原生 JavaScript（ES Modules） |
| 后端服务 | Supabase                  |
| 数据库  | Supabase Postgres         |
| 认证系统 | Supabase Auth             |
| 文件存储 | Supabase Storage          |
| 权限控制 | Row Level Security (RLS)  |
| 敏感操作 | Supabase Edge Functions   |
| 图片处理 | Canvas API → WebP 压缩      |

## 项目结构

```
├── index.html                              # 主页面
├── styles.css                              # 全局样式
├── app.js                                  # 入口文件，初始化各模块
├── js/
│   ├── constants.js                        # 常量定义（位置、评分选项、SVG 图标）
│   ├── state.js                            # 全局状态 & DOM 元素引用
│   ├── supabase.js                         # Supabase 客户端初始化 & 认证辅助
│   ├── auth.js                             # 登录/注册/个人资料编辑/头像上传
│   ├── merchant.js                         # 商家加载/选择/上传
│   ├── review.js                           # 评价发布/编辑/举报/反馈
│   ├── admin.js                            # 管理员工作台（审核/举报/商家管理）
│   ├── render.js                           # UI 渲染函数
│   ├── events.js                           # 事件委托 & 绑定
│   ├── image.js                            # 图片压缩 & Storage 上传
│   ├── scoring.js                          # 贝叶斯评分算法
│   └── utils.js                            # 工具函数（XSS 转义/Toast/Loading/API 包装）
└── supabase/
    ├── schema.sql                          # 数据库架构
    └── edge-functions/
        ├── manage-admin/index.ts           # 超级管理员权限管理（授予/移除管理员）
        └── reset-password/index.ts         # 管理员密码重置（重置为学号）
```

## 模块架构

前端采用 ES Modules 模块化设计，`app.js` 作为入口导入并初始化各模块：

```
app.js
 ├── js/state.js          ← 全局状态（currentLocation, search, merchants, currentUser 等）
 ├── js/constants.js      ← 位置列表、评分排序选项、SVG 图标、默认封面
 ├── js/supabase.js       ← 客户端懒加载、认证校验（requireAuth/isAdmin/studentIdToEmail）
 ├── js/auth.js           ← loadCurrentUser / logout / handleConfirmLogin / handleConfirmRegister / handleConfirmEditProfile / handleAvatarUpload
 ├── js/merchant.js       ← loadMerchants / selectMerchant / backToFood / openMerchantUpload / handleMerchantUpload / handleMerchantCoverChange
 ├── js/review.js         ← writeReview / handleConfirmReview / reportReview / submitFeedback / updateStarDisplay
 ├── js/admin.js          ← renderAdmin / loadAdminData / approveMerchant / rejectMerchant / hideReview / dismissReports / 商家 CRUD / 商家合并
 ├── js/render.js         ← setActiveView / renderMerchants / renderDetail / renderProfile / renderReviewList / renderPhotoStrip
 ├── js/events.js         ← setupEventDelegation（data-action 事件委托 + 表单/导航/搜索监听 + 青春市集捏合缩放/拖拽/滚轮缩放/SVG 编号）
 ├── js/image.js          ← compressImage（Canvas → WebP）/ uploadImageToStorage
 ├── js/scoring.js        ← bayesianScore / merchantSummary / getFilteredMerchants / getPlatformAverage
 └── js/utils.js          ← escapeHtml / showError / showLoading / hideLoading / safeApiCall
```

## 功能模块

### 权限矩阵

| 功能                |  游客 |  用户 | 管理员 | 超级管理员 |
| ----------------- | :-: | :-: | :-: | :---: |
| 浏览/搜索商家           |  ✓  |  ✓  |  ✓  |   ✓   |
| 查看评价              |  ✓  |  ✓  |  ✓  |   ✓   |
| 注册/登录             |  -  |  ✓  |  ✓  |   ✓   |
| 上传商家              |  -  |  ✓  |  ✓  |   ✓   |
| 发布/编辑评价           |  -  |  ✓  |  ✓  |   ✓   |
| 举报评价              |  -  |  ✓  |  ✓  |   ✓   |
| 编辑个人资料            |  -  |  ✓  |  ✓  |   ✓   |
| 上传头像              |  -  |  ✓  |  ✓  |   ✓   |
| 提交反馈              |  -  |  ✓  |  ✓  |   ✓   |
| 审核商家              |  -  |  -  |  ✓  |   ✓   |
| 处理举报              |  -  |  -  |  ✓  |   ✓   |
| 管理商家（名称/位置/封面/照片） |  -  |  -  |  ✓  |   ✓   |
| 重置用户密码            |  -  |  -  |  ✓  |   ✓   |
| 管理管理员             |  -  |  -  |  -  |   ✓   |

### 商家模块

- 按位置筛选、关键词搜索（300ms 防抖）、评分排序
- 展示封面图、描述、用户评价、商家照片
- 用户提交新商家需管理员审核（前端会拦截同名同位置已审核商家）
- 管理员可修改商家名称、位置、封面、照片，删除商家
- 审核时支持同名同位置商家合并（评价迁移 + 封面图片迁移至 dish_images）
- 审核通过时，若商家有描述且创建者存在，自动为该创建者添加一条 5 星初始评价

### 评价模块

- 每位用户对每个商家仅可发布一条评价，支持编辑
- 1-5 星评分，评价内容最多 300 字符（数据库限制）
- 使用贝叶斯平均算法加权排序
- 举报功能：每条评价每位用户仅可举报一次
- 举报计数 ≥ 20 的评价进入管理员举报审核队列

### 个人中心

- 学号登录/注册（学号格式：`202XXXXXX`）
- 登录失败自动引导注册，首次登录（密码=学号）自动注册
- 自动注册时，学号 `20233897` 会被设为 `super_admin`，其余为 `user`
- 修改昵称、修改密码（需验证当前密码）
- 上传头像（自动压缩为 WebP，200px 宽度）
- 忘记密码：可联系管理员 QQ，或由管理员通过 Edge Function 重置密码为学号

### 青春市集

- SVG 地图展示
- 支持双指捏合缩放（0.5x ~ 5.0x）、单指拖拽平移、鼠标滚轮缩放
- 支持按钮缩放（+ / -）
- SVG 区块硬编码编号（`data-block-number`），坐标映射见 `docs/MARKET_BLOCKS.md`
- 禁止浏览器默认双指缩放行为

### 管理员工作台

- 待审商家审核（支持合并同名同位置商家）
- 举报队列处理（≥20 次举报进入队列）
- 商家列表管理（搜索、修改名称/位置/封面/照片、删除）
- 商家详情页内联编辑名称和位置
- 缓存机制：管理员数据缓存 30 秒

## 核心逻辑

### 贝叶斯评分

```
贝叶斯评分 = (v / (v + m)) × R + (m / (v + m)) × C
```

- `v` 商家评价数，`R` 商家平均评分
- `m` 最小评价数阈值（默认 5），`C` 全平台平均评分
- 全五星评价直接返回 5，避免被全局均值拉低
- 默认排序：按 `评分 × 评价数` 降序
- 评分排序选项：无排序 / 由高到低 / 由低到高

### 图片处理

- 上传图片自动压缩为 WebP 格式（质量 0.8）
- 封面图/商家照片最大宽度 1200px
- 头像最大宽度 200px
- 存储 Bucket：`avatars`、`merchant-images`

### 事件系统

- 采用 `data-action` 属性的事件委托模式，统一在 `document` 上监听
- 支持 click / input / change 三种事件类型
- 搜索输入 300ms 防抖

### 位置选项

青春集市、汤和路（东门向北）、大学城、南苑一楼、南苑二楼、南苑三楼、北苑一楼、毓秀餐厅、北苑二楼、北苑三楼、北苑侧楼

## 数据库设计

### 核心表

| 表名                  | 说明                                                                                |
| ------------------- | --------------------------------------------------------------------------------- |
| users               | 用户（id, student_id, nickname, avatar_url, role, account_status, warning_count, nickname_updated_at） |
| merchants           | 商家（id, name, location, cover_image_url, description, status, created_by）       |
| merchant_images     | 商家照片（merchant_id, image_url, sort_order）                                       |
| reviews             | 评价（user_id, merchant_id, rating, content, report_count, status, updated_at）    |
| review_reports      | 举报记录（review_id, reporter_user_id, reason_type, reason_detail, status, handled_by, handled_at） |
| dishes              | 菜品（merchant_id, dish_name）— 当前前端未使用                                        |
| dish_images         | 菜品图片（dish_id, image_url, sort_order）— 当前仅用于审核合并时迁移封面图               |
| user_penalty_logs   | 用户处罚记录                                                                            |
| feedbacks           | 用户反馈（content, status, handled_by, handled_at）                                   |
| audit_logs          | 审计日志（target_type, target_id, action, operator_id, reason）                       |
| system_settings     | 系统配置（如贝叶斯参数 `bayesian_config`）                                               |

### 视图

| 视图名            | 说明                                         |
| -------------- | ------------------------------------------ |
| user_profiles  | 用户公开信息（id, nickname, avatar_url），用于评价列表关联 |

### 商家状态

`pending` → `approved`（前台可见）/ `rejected` / `offline`

### 举报处理

举报计数 ≥ 20 → 进入举报队列 → 管理员隐藏评价（status='hidden'）或忽略举报（report_count 重置为 0）

### 数据库函数

| 函数名                             | 说明                      |
| ------------------------------- | ----------------------- |
| handle_updated_at()             | 自动更新 updated_at 字段     |
| handle_review_report_count()    | 举报增删时自动更新 report_count |
| current_app_role()              | 获取当前用户角色                |
| is_admin()                      | 判断是否管理员                 |
| is_super_admin()                | 判断是否超级管理员               |
| get_bayesian_score(uuid)        | 计算商家贝叶斯评分（从数据库视图计算）   |

## Edge Functions

### manage-admin

- **权限**：仅 super_admin 可调用
- **功能**：授予或移除用户管理员权限（`grant_admin` / `remove_admin`）
- **请求参数**：`student_id`, `action`
- **审计**：操作记录写入 audit_logs

### reset-password

- **权限**：admin 或 super_admin 可调用
- **功能**：将指定学号用户的密码重置为其学号
- **请求参数**：`student_id`
- **审计**：操作记录写入 audit_logs

## 开发配置

1. 创建 Supabase 项目，记录 URL 和 anon key
2. 在 SQL Editor 中执行 `supabase/schema.sql`
3. 创建 Storage Buckets：`avatars`、`merchant-images`
4. 修改 `index.html` 中的 `window.__SUPABASE_CONFIG__`
5. 部署 Edge Functions：
   ```bash
   supabase functions deploy manage-admin
   supabase functions deploy reset-password
   ```
6. 本地开发：`npx serve .` 或 `python -m http.server 8000`

## 注意事项

- 当前反馈功能为占位实现（提示联系 QQ），未接入数据库存储
- `dishes` 与 `dish_images` 表当前前端未使用，预留用于 future 菜品功能
- 商家审核合并时，封面图会被迁移到 `dish_images` 表（按现有逻辑）
