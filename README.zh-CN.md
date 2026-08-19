# ssr-gui

[English](README.md)

`ssr-gui` 是 [sunniesnow-record](https://github.com/sunniesnow/sunniesnow-record) 的桌面图形界面。发行包已经包含 Node.js、FFmpeg、recorder、Sunniesnow 和全部运行依赖，最终用户不需要安装或配置开发环境。

界面只保留最常用的流程：选择 `.ssc`、选择难度、选择画质与输出位置，然后开始录制。输出使用 recorder 的跨平台默认 Matroska 格式（`.mkv`）。

## 发行包

GitHub Actions 会原生构建以下版本：

- Windows x64：运行 `ssr-gui.exe`，不要拆分发行目录中的文件。
- Linux x64：运行解压目录中的 `ssr-gui`。
- macOS x64 与 Apple Silicon：打开 `ssr-gui.app`。

每次 push 触发的 CI 都会保存构建产物；推送以 `v` 开头的 Git tag 时，还会创建包含全部平台压缩包的 GitHub Release。把 commit message 写成 `v0.0.1` 并不等于创建 tag，也不会发布。需要明确创建并推送 tag：

```shell
git tag v0.0.1
git push origin v0.0.1
```

macOS 包会进行 ad-hoc 签名，但由于项目没有 Apple Developer 证书，因此不会公证。

## 本地构建

在目标操作系统上使用 Node.js 22：

```shell
npm ci
npm test
npm run build
npm run verify:package
```

如果相邻目录的 `../sunniesnow-record` 与固定的 recorder commit 一致，构建会读取它但不会修改它；否则会把该固定版本和对应的 game 子模块检出到 `node_modules/.cache/ssr-gui`。也可以通过 `SSR_RECORD_SOURCE` 指定其他只读源码目录。

原生依赖的构建前置条件记录在 [CI 配置](.github/workflows/build.yml) 中。recorder 包含平台相关的图形和音频模块，因此发行包必须在对应操作系统上构建；已经构建好的发行包不需要这些构建工具。

运行本机构建：

```shell
npm start
```

## 许可证

使用 AGPL-3.0-or-later。详见 [LICENSE](LICENSE) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
