# 安财美食地图

校园餐饮点评平台，采用 GitHub Pages + Supabase 架构。

## 技术架构

| 层级 | 技术选型 |
|------|----------|
| 前端托管 | GitHub Pages |
| 前端框架 | 原生 JavaScript |
| 后端服务 | Supabase |
| 数据库 | Supabase Postgres |
| 认证系统 | Supabase Auth |
| 文件存储 | Supabase Storage |
| 权限控制 | Row Level Security (RLS) |
| 敏感操作 | Supabase Edge Functions |

## 项目结构

```
├── index.html                          # 主页面
├── styles.css                          # 全局样式
├── app.js                              # 前端业务逻辑
└── supabase/
    ├── schema.sql                      # 数据库架构
    └── edge-functions/
        ├── manage-admin/index.ts       # 管理员权限管理
        └── reset-password/index.ts     # 密码重置
```

## 功能模块

### 权限矩阵

| 功能 | 游客 | 用户 | 管理员 | 超级管理员 |
|------|:----:|:----:|:------:|:----------:|
| 浏览/搜索商家 | ✓ | ✓ | ✓ | ✓ |
| 查看评价 | ✓ | ✓ | ✓ | ✓ |
| 注册/登录 | - | ✓ | ✓ | ✓ |
| 上传商家 | - | ✓ | ✓ | ✓ |
| 发布/编辑评价 | - | ✓ | ✓ | ✓ |
| 举报评价 | - | ✓ | ✓ | ✓ |
| 审核商家 | - | - | ✓ | ✓ |
| 处理举报 | - | - | ✓ | ✓ |
| 管理管理员 | - | - | - | ✓ |

### 商家模块

- 按位置筛选、关键词搜索、评分排序
- 展示封面图、描述、用户评价、商家照片
- 用户提交新商家需管理员审核
- 管理员可修改商家名称、位置、封面、照片，删除商家
- 审核时支持同名同位置商家合并

### 评价模块

- 每位用户对每个商家仅可发布一条评价，支持编辑
- 1-5 星评分，评价内容最多 500 字符
- 使用贝叶斯平均算法加权排序

### 管理员工作台

- 待审商家审核（支持合并同名商家）
- 举报队列处理（≥20 次举报进入队列）
- 商家列表管理（搜索、修改名称/位置/封面/照片、删除）

## 核心逻辑

### 贝叶斯评分

```
贝叶斯评分 = (v / (v + m)) × R + (m / (v + m)) × C
```

- `v` 商家评价数，`R` 商家平均评分
- `m` 最小评价数阈值（默认 5），`C` 全平台平均评分

### 位置选项

青春集市、汤和路（东门向北）、大学城、南苑一楼、南苑二楼、南苑三楼、北苑一楼、毓秀餐厅、北苑二楼、北苑三楼、北苑侧楼

## 数据库设计

### 核心表

| 表名 | 说明 |
|------|------|
| users | 用户（id, student_id, nickname, avatar_url, role, account_status） |
| merchants | 商家（id, name, location, cover_image_url, description, status, created_by） |
| merchant_images | 商家照片（merchant_id, image_url, sort_order） |
| reviews | 评价（user_id, merchant_id, rating, content, report_count, status） |
| review_reports | 举报记录（review_id, reporter_user_id, reason_type, status） |
| dishes | 菜品（merchant_id, dish_name） |
| dish_images | 菜品图片（dish_id, image_url） |
| user_penalty_logs | 用户处罚记录 |
| feedbacks | 用户反馈 |
| audit_logs | 审计日志 |
| system_settings | 系统配置（如贝叶斯参数） |

### 商家状态

`pending` → `approved`（前台可见）/ `rejected`

### 举报处理

举报计数 ≥ 20 → 进入举报队列 → 管理员隐藏评价或忽略举报

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

## 更新日志

### v1.1.0
- 新增位置：汤和路（东门向北）、大学城、毓秀餐厅
- 商家上传位置选择移除"全部"选项
- 管理员可修改商家名称和位置
- 审核支持同名同位置商家合并
- 评价支持编辑已发布内容
- 评价内容上限调整为 500 字符
- 登录失败自动引导注册，注册后自动登录

### v1.0.0
- 初始版本：浏览、搜索、评价、举报、管理员审核、贝叶斯评分排序
