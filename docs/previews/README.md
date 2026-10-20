# 历史预览图

本目录保存从项目根目录迁入的 85 张 `preview*.png`，迁移时逐文件核对 SHA-256，内容未改动。它们记录不同阶段的界面探索，不能代表当前版本已通过视觉验收，也不是插件运行资源。

- 论坛、消息、设置、世界模块：对应 `preview-forum-*`、`preview-messages-*`、`preview-settings-*` 等文件。
- 旅伴、机身、场景、动作与形象：对应 `preview-companion-*` 文件。
- 早期整体预览：`preview.png`、`preview-mobile.png` 等文件。

新输出位置：

| 命令 | 输出 |
| --- | --- |
| `npm run test:visual` | `test-output/visual-preview/` |
| `node design/render-cat-candidates.mjs` | `test-output/design/` |
| 其他浏览器专项 | 由脚本打印自己的临时产物目录 |

`test-output/` 已被 Git 忽略。需要保留新的设计参考时，再有选择地归档；不要把测试截图复制进安装目录。
