# 饭店点餐 App（安卓 · 本地测试版）

真安卓 App + 本机后端 + Cloudflare 临时公网域名。店主维护分区和菜品，顾客用手机号密码登录、点餐、下单、结账（当前为模拟支付）。仅用于跑通流程，不做真实收款。

## 目录

```
app/          React Native 安卓工程（Android-only）
server/       Node + Express + SQLite 后端
scripts/      env / start / stop / 构建辅助脚本
.toolchain/   便携 JDK 17、Android SDK、cloudflared（不进版本库）
data/         二维码等输出
docs/         计划、决策记录
```

## 第一次跑起来

```powershell
# 1. 起后端 + 隧道，屏幕上会打印公网地址并弹出二维码
.\scripts\start.ps1

# 2. 手机装 app\android\app\build\outputs\apk\release\app-release.apk
#    （APK 每改一次代码要重新打包，见下）

# 3. 打开 App，把二维码里的地址填进「服务器地址」，点「测试连接并拉取菜单」
```

停掉服务：`.\scripts\stop.ps1`

> 临时域名每次重启都会变。变了就在 App 里改一下地址，或者重新扫二维码。

## 重新打包 APK

```powershell
.\scripts\build-apk.ps1
```

产物：`app\android\app\build\outputs\apk\release\app-release.apk`

## 现在能做什么（v1.0）

顾客端
- 首屏选身份 → 顾客：手机号 + 密码登录（首次自动注册）
- 点餐页：左侧分区、右侧菜品，滑动联动、加减数量、购物车明细
- 去结算 → 服务端生成 4 位订单号（如 `4207`，避开已有未结算单号）→ 订单页
- 订单页：「继续加菜」「立刻结账」→ 结账页选微信 / 支付宝 → 模拟支付 → **结账成功页**（金额 + 订单号 + 支付方式）
- 已有未结算订单时，点餐页底部出现橙色条，按钮变成「加入订单」，加菜**不换订单号**
- 退出 App 换手机用同一手机号登录，未结算订单自动出现在点餐页
- **右上角「账号」→ 退出登录 / 切换账号**（只用另一个手机号重新登录即可，原账号订单仍在）

店主端（选「我是店主」）
- **任意 11 位手机号 + 4 位以上密码都能登录**；没见过的手机号会自动创建成店主账号；内置账号 13800000000 / admin123 仍然可用
- 同一个手机号如果先注册成了顾客，用正确密码从店主入口登录会自动获得店主权限
- 首页顶部：**累计营业额**（可「清零」重新计）、今日营收、今日订单、未结算，以及最近 5 笔订单收款状态
- 分区：新增、长按改名、隐藏 / 显示、删除（有菜时拒绝删）
- **右上角「退出登录」可切换店主账号**
- 菜品：新增 / 编辑 / 删除、改名、改价、写描述
- 图片：从手机相册选图，自动上传到后端 `server/data/uploads`
- 上下架、售罄开关；改动即时反映到顾客菜单

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/menu` | 顾客菜单（只含可见分区） |
| POST | `/api/auth/login` | 店主登录，返回 token |
| POST | `/api/auth/customer-login` | 顾客登录 / 首次自动注册 |
| GET | `/api/orders/open` | 我的未结算订单（没有则 null） |
| POST | `/api/orders` | 下单；已有未结算订单则为加菜 |
| GET | `/api/orders/:id` | 订单详情（只能看自己的） |
| POST | `/api/orders/:id/items` | 给订单加菜 |
| POST | `/api/payments` | 发起支付（mock / wechat / alipay） |
| GET | `/api/payments/:id` | 查支付状态 |
| POST | `/api/payments/:id/confirm` | 模拟支付平台回调（幂等） |
| GET | `/api/admin/summary` | 累计营业额、今日营收、单量、未结算数 |
| POST | `/api/admin/revenue/reset` | 清零累计营业额（历史流水保留） |
| GET | `/api/admin/orders` | 订单 / 收款流水 |
| GET/POST | `/api/admin/categories` | 分区列表 / 新增 |
| PATCH/DELETE | `/api/admin/categories/:id` | 改名、显隐 / 删除 |
| GET/POST | `/api/admin/dishes` | 菜品列表 / 新增 |
| PATCH/DELETE | `/api/admin/dishes/:id` | 编辑 / 删除 |
| POST | `/api/admin/upload` | 传图，返回 `/uploads/xxx` |
| GET | `/uploads/*` | 图片 |

管理接口都要 `Authorization: Bearer <token>`。

## 自测

```powershell
node scripts\test-admin.mjs                                  # 测本机后端
$env:BASE='https://xxx.trycloudflare.com'; node scripts\test-admin.mjs   # 测公网链路
```

## 测试账号

| 角色 | 手机号 | 密码 |
|---|---|---|
| 店主 | 13800000000 | admin123 |

顾客账号还没有做（M3），首次登录的手机号会自动注册。

## 接口（M0 已实现）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查，返回菜品数量 |
| GET | `/api/menu` | 按分区分组的菜单 |
| GET | `/uploads/*` | 菜品图片（M2 会用到） |

## 环境说明

- 本机没有系统级 JDK / Android SDK，全部用 `.toolchain` 下的便携版；所有脚本通过 `scripts/env.ps1` 注入环境变量。
- 依赖下载走国内镜像（npm → npmmirror、Gradle → 腾讯云、Maven → 阿里云、JDK → 华为云、cloudflared → gh-proxy）。
- 后端只监听 `127.0.0.1:8080`，外部通过 Cloudflare Tunnel 进来。

## 已知限制

- 临时域名无 SLA，重启即换。
- 支付是模拟的（`mock` 通道），真实接入需要营业执照 + 商户号。
- 图片存在本机 `server/data/uploads`。
- 数据库是单文件 `server/data/app.db`，删掉即重置。
