# ssr-gui

[简体中文](README.zh-CN.md)

`ssr-gui` is a desktop GUI for [sunniesnow-record](https://github.com/sunniesnow/sunniesnow-record). A release package contains Node.js, FFmpeg, the recorder, Sunniesnow, and all runtime dependencies. End users do not need to install or configure a development environment.

Version 0.3.6 pins the final `sunniesnow-record` v0.5.1 release. The build and package verification both check the embedded recorder version, and Git-based builds also verify its exact release commit. This release uses dropdown controls for waiting for music, system fonts, and automatic configuration saving while keeping the other controls unchanged.

The main workflow exposes chart and difficulty selection, quality, nickname and avatar, output filename, format, and location. Available formats are MKV, MP4, WebM, MOV, AVI, and MPEG-TS. Every remaining `sunniesnow-record` option is available once in the advanced settings, including the independent Tap, Drag, Flick, Hold, Drag-Flick, head-only Hold, and background-note sizes.

The configuration toolbar saves and imports JSON files. The last configuration is restored from `ssr-gui-config.json` beside the application executable, and automatic saving is enabled by default; it can be disabled beside the save/import buttons.

## Release packages

GitHub Actions builds native packages for:

- Windows x86, x64, and ARM64: extract the ZIP and run `ssr-gui.exe`; keep the complete extracted folder together. The x86 build uses a 32-bit launcher with the bundled x64 Node recording engine, so it requires 64-bit Windows.
- Linux x64 and ARM64: extract the matching tar.gz and run `ssr-gui` from the extracted folder.
- macOS x64 and Apple Silicon: extract the ZIP and open `ssr-gui.app`.

Each platform has two editions. The standard archive is smaller and lets Sunniesnow download a font only when a chart needs it. The archive ending in `-fonts` includes all five Sunniesnow fonts and their licenses, and never needs to download those fonts while recording.

Build artifacts are attached to every CI run triggered by a push. Windows and macOS artifacts are ZIP files; Linux is tar.gz. Git tags beginning with `v` also create a GitHub Release containing both editions for all platforms. A commit message such as `v0.0.1` is not a tag and does not create a release. Create and push a release tag explicitly:

```shell
git tag v0.0.1
git push origin v0.0.1
```

macOS packages are ad-hoc signed but not notarized because the project has no Apple Developer certificate.

## Local build

Use Node.js 22.23.2 or newer on the target operating system. The build packages the Node executable that runs the build, so native dependencies and the bundled runtime always use the same Node ABI:

```shell
npm ci
npm test
npm run build
npm run verify:package
```

The commands above build the smaller standard edition for the current operating system. To build the bundled-font edition instead:

```shell
npm run build:fonts
```

The build uses a neighboring `../sunniesnow-record` checkout when it matches the pinned recorder commit. Otherwise it checks out that exact upstream revision and its game submodule into `node_modules/.cache/ssr-gui`. Set `SSR_RECORD_SOURCE` to use another recorder checkout without modifying it.

Native dependency prerequisites are documented in [the CI workflow](.github/workflows/build.yml). Building once on each target OS is required because the recorder contains native graphics and audio modules. The completed package does not require those build tools.

Run the completed local build with:

```shell
npm start
```

## License

AGPL-3.0-or-later, matching sunniesnow-record. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
