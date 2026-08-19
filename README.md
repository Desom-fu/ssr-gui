# ssr-gui

[简体中文](README.zh-CN.md)

`ssr-gui` is a desktop GUI for [sunniesnow-record](https://github.com/sunniesnow/sunniesnow-record). A release package contains Node.js, FFmpeg, the recorder, Sunniesnow, and all runtime dependencies. End users do not need to install or configure a development environment.

The interface intentionally exposes only the common workflow: choose an `.ssc`, select its difficulty, pick a quality preset and output path, then record. The generated file is Matroska (`.mkv`), matching the recorder's portable default.

## Release packages

GitHub Actions builds native packages for:

- Windows x64: run `ssr-gui.exe` and keep the complete extracted folder together.
- Linux x64: run `ssr-gui` from the extracted folder.
- macOS x64 and Apple Silicon: open `ssr-gui.app`.

Build artifacts are attached to every CI run triggered by a push. Git tags beginning with `v` also create a GitHub Release containing all platform archives. A commit message such as `v0.0.1` is not a tag and does not create a release. Create and push a release tag explicitly:

```shell
git tag v0.0.1
git push origin v0.0.1
```

macOS packages are ad-hoc signed but not notarized because the project has no Apple Developer certificate.

## Local build

Use Node.js 22 on the target operating system:

```shell
npm ci
npm test
npm run build
npm run verify:package
```

The build uses a neighboring `../sunniesnow-record` checkout when it matches the pinned recorder commit. Otherwise it checks out that exact upstream revision and its game submodule into `node_modules/.cache/ssr-gui`. Set `SSR_RECORD_SOURCE` to use another recorder checkout without modifying it.

Native dependency prerequisites are documented in [the CI workflow](.github/workflows/build.yml). Building once on each target OS is required because the recorder contains native graphics and audio modules. The completed package does not require those build tools.

Run the completed local build with:

```shell
npm start
```

## License

AGPL-3.0-or-later, matching sunniesnow-record. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
