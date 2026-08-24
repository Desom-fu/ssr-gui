# ssr-gui

[English](README.md)

`ssr-gui` 是 [sunniesnow-record](https://github.com/sunniesnow/sunniesnow-record) 的桌面图形界面。发行包已经包含 Node.js、FFmpeg、recorder、Sunniesnow 和全部运行依赖，最终用户不需要安装或配置开发环境。

0.2.1 版精确固定到 `sunniesnow-record` 最终发布的 v0.5.1。构建与成品包校验都会检查内置 recorder 的版本；使用 Git 源码构建时还会核对最终 release commit。

主界面直接提供谱面、难度、画质、昵称、头像、输出文件名、格式与位置。可选格式包括 MKV、MP4、WebM、MOV、AVI 和 MPEG-TS。其余每个 `sunniesnow-record` 参数只在更多设置中出现一次，包括 Tap、Drag、Flick、Hold、Drag-Flick、仅头 Hold 与背景音符的独立大小。

## 发行包

GitHub Actions 会原生构建以下版本：

- Windows x86、x64 与 ARM64：解压 ZIP 后运行 `ssr-gui.exe`，不要拆分发行目录中的文件。x86 版本的界面启动器为 32 位，录制引擎使用随包附带的 x64 Node 运行时，因此 x86 启动器需要运行在 64 位 Windows 上。
- Linux x64 与 ARM64：解压对应的 tar.gz 后运行目录中的 `ssr-gui`。
- macOS x64 与 Apple Silicon：解压 ZIP 后打开 `ssr-gui.app`。

每个平台都提供两个版本：标准版体积较小，在谱面需要字体时沿用 Sunniesnow 的按需下载行为；文件名以 `-fonts` 结尾的字体版内置 Sunniesnow 使用的全部 5 个字体及其许可证，录制时不需要再下载这些字体。

每次 push 触发的 CI 都会保存两种构建产物；Windows/macOS 使用 ZIP，Linux 使用 tar.gz。推送以 `v` 开头的 Git tag 时，还会创建包含全部平台、两种版本压缩包的 GitHub Release。把 commit message 写成 `v0.0.1` 并不等于创建 tag，也不会发布。需要明确创建并推送 tag：

```shell
git tag v0.0.1
git push origin v0.0.1
```

macOS 包会进行 ad-hoc 签名，但由于项目没有 Apple Developer 证书，因此不会公证。

## 本地构建

在目标操作系统上使用 Node.js 22.23.2 或更高版本。构建会把当前执行构建的 Node 一同打包，确保原生依赖与发行包内运行时使用相同的 Node ABI：

```shell
npm ci
npm test
npm run build
npm run verify:package
```

以上命令构建当前操作系统对应的标准版。构建内置字体版使用：

```shell
npm run build:fonts
```

如果相邻目录的 `../sunniesnow-record` 与固定的 recorder commit 一致，构建会读取它但不会修改它；否则会把该固定版本和对应的 game 子模块检出到 `node_modules/.cache/ssr-gui`。也可以通过 `SSR_RECORD_SOURCE` 指定其他只读源码目录。

原生依赖的构建前置条件记录在 [CI 配置](.github/workflows/build.yml) 中。recorder 包含平台相关的图形和音频模块，因此发行包必须在对应操作系统上构建；已经构建好的发行包不需要这些构建工具。

运行本机构建：

```shell
npm start
```

## 许可证

使用 AGPL-3.0-or-later。详见 [LICENSE](LICENSE) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
