# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

微信小程序小游戏《手速点点大挑战》— 三局递进难度的限时点击挑战，使用微信云开发实现全网分局排行榜。

## Tech Stack

- **框架**: 微信小程序原生语法（无第三方框架、无外部资源）
- **后端**: 微信云开发（云函数 + 云数据库），无自建服务器
- **数据库**: 云数据库集合 `ranking`，字段：openid, score, nickname, avatarUrl, round, updateTime

## Project Structure

```
miniprogram/
  app.js              # 云开发初始化，全局状态（playCount, adFreed, nickname）
  pages/
    home/             # 首页：昵称弹窗（type=nickname）、开始、排行榜入口
    game/             # 游戏页：三局连续（指尖热身→速点之王→紫禁之巅），局间过渡动画
    result/           # 结算页：三局分数展示、广告/分享逻辑、Tab 切换三局排行榜
cloudfunctions/
  updateScore/        # 云函数：按 openid+round 提交成绩，服务端校验
```

## Run & Deploy

1. 微信开发者工具打开本目录
2. 替换三个占位符：`YOUR_CLOUD_ENV_ID`（app.js）、`YOUR_AD_UNIT_ID`（result.js）、AppID 已在 project.config.json 中设置
3. 云开发控制台创建集合 `ranking`，权限"所有用户可读，仅创建者可读写"
4. 右键 `cloudfunctions/updateScore` → 上传并部署（云端安装依赖）

## Key Design Decisions

- **三局制**: ROUNDS 配置在 game.js 顶部，每局独立计分，圆点大小统一 90rpx
  - 第一局「指尖热身」：圆点不消失
  - 第二局「速点之王」：圆点不消失
  - 第三局「紫禁之巅」：圆点 0.7 秒自动消失（autoHide: 700）
- **排行榜**: ranking 集合按 round 字段（1/2/3）区分三局排行，结算页 Tab 切换，默认显示紫禁之巅决战榜
- **防作弊**: 单局分数上限 150（MAX_SCORE），仅 normal=1（正常结束）时提交，云函数服务端校验 openid
- **广告**: 每轮三局结束后需看激励视频广告，分享可免广告一次（adFreed 标记）
- **得分**: 按反应时间分 5 档（<200ms=5分, <400ms=4分, <600ms=3分, <900ms=2分, 其余=1分）
- **连击**: 两次点击间隔 <1.2s 且反应 <600ms 视为连击，纯视觉反馈不影响计分
