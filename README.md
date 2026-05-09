# AI Tetris

AI 无限落子的俄罗斯方块小游戏（Node.js + TypeScript + Canvas）。

🎮 **在线试玩**：https://jwk000.github.io/ai-tetris/

## 特性

- **AI 自动落子**：内置启发式 AI，可关闭后改为手动键盘控制
- **手动模式键位**：← / → 移动，↑ 旋转，↓ 加速下落，Space 硬降
- **画布缩放**：鼠标滚轮 / 按钮缩放
- **彩色方块** + **3D 高光**
- **消除粒子破碎特效**
- **暂停 / 继续 / 加速 / 减速**

## 运行

```bash
npm install
npm run audio      # 下载音频资源（约 1.6 MB）
npm run dev        # 等价于 build + start，浏览器打开 http://localhost:8080
```

> ⚠️ **必须通过 `http://localhost:8080` 访问**，不能直接双击 `index.html`。
> 浏览器在 `file://` 协议下会拒绝 `fetch()` 加载本地音频文件，
> 导致所有音效无法播放（页面顶部会显示红色警告横幅）。
>
> 浏览器自动播放策略要求**首次任意点击/按键后**音频才会启动。
> 音频归属见 [public/audio/CREDITS.md](./public/audio/CREDITS.md)。

开发态自动重建：

```bash
npm run watch     # 终端 1
npm start         # 终端 2
```

类型检查：`npm run typecheck`

## 详细设计

见 [DESIGN.md](./DESIGN.md)
