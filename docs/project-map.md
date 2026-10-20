# 项目地图

更新于 2026-10-21。本文件说明当前文件职责和场景链路，交付约定见 [AGENTS.md](../AGENTS.md)，本轮进度见 [working-state.md](working-state.md)。

## 目录与入口

```text
项目根目录/
├─ AGENTS.md              本地安装、校验及不可变版本备份规则
├─ README.md              面向使用者的功能和安装说明
├─ 待修改.md              当前维护交接入口
├─ manifest.json          SillyTavern 扩展清单
├─ index.js               正式启动入口和启用/禁用/清理钩子
├─ style.css              插件样式，目前仍为单文件
├─ src/                   插件运行模块
├─ assets/                插件实际使用的图片与素材说明
├─ preview.html           模拟酒馆上下文的开发预览
├─ test/                  单元测试与浏览器专项
├─ design/                形象设计实验页与渲染脚本
├─ docs/                  项目地图、工作状态与历史记录
│  └─ previews/           历史预览 PNG，非运行素材
└─ test-output/           新预览产物，Git 忽略
```

正式链路：`manifest.json → index.js → src/ui-v3.js.initializeForumUi()`。开发预览也加载 `ui-v3.js`。

`src/ui.js` 是保留的旧界面，当前两个入口均不加载它。`ui-v3.js` 中部分带 `Legacy` 名称的函数仍被现有界面调用，不能按名字一并删除。本次整理保留全部运行文件位置，避免破坏浏览器模块路径和测试注入点。

## 论坛与数据

| 模块 | 主要职责 |
| --- | --- |
| `constants.js` | 默认设置、数据键、内置提示词与模块定义 |
| `store.js` | 酒馆上下文、当前聊天持久化、来源选择、API 档案、正文注入 |
| `forum.js` | 角色、作者关联、会话、匿名身份与数据迁移 |
| `prompt.js` | 请求组装、模型响应解析、帖子/楼层/人设/私信数据规范化 |
| `api.js` | 酒馆连接、自定义文本/生图接口、取消与模型列表 |
| `workflows.js` | 生成模式、联动模块准入和旧帖更新筛选 |
| `world.js` | 世界模块领域逻辑；目前同时含任务、背包、治理及旅行结算 |
| `task-delivery.js` | 交付预览、库存复核、扣除、奖励及收据 |
| `events.js` | 事件进度与帖子、任务、私信的关联 |
| `memory.js` | 角色公开/私密记忆、摘要、关系及请求可读副本 |
| `backup.js` | 备份导入导出、媒体打包、数据合并和资源键重映射 |
| `image-assets.js` | 本轮新增的共享图片存储、唯一键与异步取消保护 |
| `ui-v3.js` | 当前界面、操作处理和流程调度中心 |

设置保存在 `context.extensionSettings.tavern_forum`；论坛内容保存在当前聊天的 `context.chatMetadata.tavern_forum_data`。图片字节在浏览器 LocalForage 中，聊天数据只保存资源键。整理文件不能替代数据迁移，也不能清空这些存储。

## 旅伴模块

| 分层 | 主要文件 |
| --- | --- |
| 养成、旅行、背包结算 | `companion-life.js`、`world.js` |
| 小世界、种植、采集、厨房和钓鱼数据 | `companion-homestead.js` |
| 形象、成长、骨架、光栅和食物 | `companion-art.js`、`companion-growth-art.js`、`companion-sprite-rig*.js`、`companion-raster-*.js`、`companion-frog-sprite.js`、`companion-food-art.js` |
| 主屏与掌机菜单 | `ui-v3.js`、`companion-device-ui.js`、`companion-life-ui.js`、`companion-icons.js` |
| 独立场景、统一显示决策与小世界布景 | `companion-scenes.js`、`companion-homestead-ui.js`、`companion-homestead-scenery.js` |
| 装修与家具互动 | `companion-room.js`、`companion-room-ui.js`、`companion-room-live-ui.js`、`companion-room-path.js`、`companion-room-pose.js` |
| 移动、待机、触摸和水生范围 | `companion-roam.js`、`companion-idle.js`、`companion-touch.js`、`companion-aquatic.js` |
| 生活动作与工作姿势 | `companion-homestead-motion.js`、`companion-homestead-motion-ui.js`、`companion-work-pose.js`、`companion-kitchen-fishing-ui.js` |
| 照顾仪式与小游戏 | `companion-ritual-ui.js`、`companion-games.js`、`companion-game-player.js` |

## 场景与室内外语义

`home` 不能直接解释为“画面在室内”。它目前出现在几组独立状态中：

| 状态 | 实际含义 | 能否单独证明室内 |
| --- | --- | --- |
| `companion.status === 'home'` | 未在远行；仍可走到庭院或林间 | 不能 |
| `viewState.companionPanel === 'home'` | 宠物机主屏页面 | 不能 |
| `companion.homestead.location` | 小世界地点：home / yard / forest / river / kitchen；home 是兼容旧存档的场景入口 | 还需结合独立场景与装修 |
| `companion.habitat` | 用户选中的独立场景，如 meadow、bedroom、forest | 场景目录有 `indoor` 标记 |
| `companion.room.enabled` | 是否显示自定义装修房间 | 会改变实际背景与家具 |
| 临时互动场景 | 喂食、清洁、睡眠、游戏等短期显示 | 由互动和地点共同决定 |

统一决策与渲染顺序：

1. `companion-scenes.js/resolveCompanionDisplayScene()` 统一解析实际场景，返回 `id`、`label`、`indoor`、`habitat`、`customized`、`homestead`、`homeStations` 和 `aquaticLocation` 等描述。`ui-v3.js/getCompanionDisplayedScene()` 只负责传入当前互动状态。
2. `ui-v3.js/renderCompanionAppV3()` 绘制所选独立场景或房间，以及旅伴本体；`renderCompanionDevice()` 使用同一描述绘制小世界布景和入口。
3. `homeStations` 只在自定义装修小窝中显示。14 个原生场景已有完整布景，不额外叠加门柜；底栏仍提供行囊、收纳、厨房与庭院入口。
4. 绘图、游动出生点与漫游控制器都读取同一 `aquaticLocation`。室内自由移动，室外使用对应自然水域；荷塘与海滩直接使用原画水面。远景水带使用对应显示尺度，44px 触摸区域独立保留。

场景 ID 明确区分 `habitat:meadow`、`homestead:yard` 与 `custom-room`。选择独立场景时会退出当前生活地点和装修显示，但保留家具布局、农田、库存与旅行数据；保存装修后会真正进入装修小窝。菜单“返回场景”只返回当前场景主屏，不冒充回家动作。

此前“home 地点 + meadow 室外场景 + 小窝门柜 + 自由游动范围”的混搭已修复，并由 `test:scene-context` 在桌面、390 与320宽度精确复现验证。原生卧室也不再出现门浮在床头或额外柜子叠在原画柜子上的问题。

现有行为约束：室内鱼和蝌蚪只显示本体、不加鱼缸，并可点击移动；室外庭院小池、林间浅溪与河水保留。不能用强制改成卧室或增加鱼缸来绕过上述语义问题。

## 测试导航

| 目标 | 命令 |
| --- | --- |
| 单元、逻辑、版本一致性 | `npm test` |
| 运行模块语法 | `npm run check` |
| 论坛、任务、导入、私信与切聊天 | `npm run test:workflows` |
| 图片共享与异步切聊天 | `npm run test:image-assets-ui` |
| 整体界面预览 | `npm run test:visual` |
| 室内外水生移动与照顾 | `npm run test:aquatic` |
| 实际可见体型与喂食落点 | `npm run test:companion-scale` |
| 独立场景切换、入口和存档保留 | `npm run test:scene-context` |
| 点击/触屏移动 | `npm run test:move` |
| 家具到达与休息姿势 | `npm run test:room-posture` |
| 小世界生活循环 | `npm run test:homestead` |
| 厨房与钓鱼 | `npm run test:kitchen-fishing` |

其余专项以 `package.json/scripts` 和对应测试文件为准。测试通过证明具体断言满足；场景是否合理、是否精确复现用户截图，需要另行核对。

## 后续整理边界

- 统一场景描述已接入；后续拆分 UI 或样式时应继续共用该描述，避免重新各自判断室内外。
- `ui-v3.js`、`world.js`、`style.css` 是当前耦合较多的文件；拆分应按稳定职责逐步进行。
- 历史参考图放 `docs/previews/`，运行素材继续放 `assets/`，新测试产物放 `test-output/` 或脚本临时目录。
- 完成具体修复与验收后，再按 `AGENTS.md` 安装及备份。目录整理本身不构成新版本交付。
