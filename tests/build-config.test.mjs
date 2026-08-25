import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { builderApplicationOptions, platformArtifactName } from "../scripts/nw-build-config.mjs";
import { RECORDER_COMMIT, RECORDER_VERSION } from "../scripts/recorder-version.mjs";

test("builder configuration identifies every desktop platform", () => {
	const source = { name: "ssr-gui", version: "1.2.3" };
	assert.equal(builderApplicationOptions("win32", source).icon, "icon.ico");
	assert.equal(builderApplicationOptions("linux", source).icon, "icon.png");
	const mac = builderApplicationOptions("darwin", source);
	assert.equal(mac.icon, "icon.icns");
	assert.equal(mac.CFBundleIdentifier, "io.github.desom-fu.ssr-gui");
	assert.equal(mac.CFBundleShortVersionString, "1.2.3");
});

test("artifact names are stable", () => {
	assert.equal(platformArtifactName("win32", "x64"), "ssr-gui-windows-x64");
	assert.equal(platformArtifactName("linux", "x64"), "ssr-gui-linux-x64");
	assert.equal(platformArtifactName("darwin", "arm64"), "ssr-gui-macos-arm64");
});

test("CI contains native Windows, Linux, and macOS package jobs", async () => {
	const workflow = await readFile(new URL("../.github/workflows/build.yml", import.meta.url), "utf8");
	for (const runner of ["windows-latest", "ubuntu-latest", "macos-15-intel", "macos-15"]) {
		assert.match(workflow, new RegExp(runner));
	}
	for (const artifact of ["ssr-gui-windows-x86", "ssr-gui-windows-x64", "ssr-gui-windows-arm64", "ssr-gui-linux-x64", "ssr-gui-linux-arm64", "ssr-gui-macos-x64", "ssr-gui-macos-arm64"]) {
		assert.match(workflow, new RegExp(artifact));
	}
	assert.match(workflow, /SSR_BUNDLE_FONTS/);
	assert.match(workflow, /\$\{\{ matrix\.artifact \}\}-fonts/);
	assert.match(workflow, /name: \$\{\{ matrix\.artifact \}\}-fonts/);
	assert.match(workflow, /files: release\/\*/);
	assert.match(workflow, /Compress-Archive/);
	assert.match(workflow, /zip -qry/);
	assert.match(workflow, /tar -czf/);
	assert.match(workflow, /softprops\/action-gh-release/);
	assert.match(workflow, /node node_modules\/node-gyp\/bin\/node-gyp\.js rebuild --directory node_modules\/gl/);
	assert.match(workflow, /CXXFLAGS=-std=c\+\+20/);
	assert.match(workflow, /azure\.archive\.ubuntu\.com\/ubuntu\|https:\/\/archive\.ubuntu\.com\/ubuntu/);
	assert.match(workflow, /Acquire::Retries=3/);
	assert.match(workflow, /cancel-in-progress: \$\{\{ !startsWith\(github\.ref, 'refs\/tags\/v'\) \}\}/);
	assert.doesNotMatch(workflow, /npm rebuild gl/);
});

test("Node is a minimum requirement, not a pinned runtime", async () => {
	const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
	assert.equal(packageJson.engines.node, ">=22.23.2");
	assert.equal(Object.hasOwn(packageJson.devDependencies, "node"), false);
	assert.equal(packageJson.devDependencies["node-gyp"], "12.4.0");
	assert.equal(packageJson.overrides.gl, "9.0.0-rc.10");
	assert.equal(packageJson.overrides["node-gyp"], "12.4.0");
	const workflow = await readFile(new URL("../.github/workflows/build.yml", import.meta.url), "utf8");
	assert.match(workflow, /node-version: ['"]lts\/\*['"]/);
});

test("release version and pinned recorder are synchronized", async () => {
	const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
	const lockfile = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
	assert.equal(packageJson.version, "0.3.2");
	assert.equal(lockfile.version, packageJson.version);
	assert.equal(lockfile.packages[""].version, packageJson.version);
	assert.equal(RECORDER_VERSION, "0.5.1");
	assert.equal(RECORDER_COMMIT, "f9202d15c14805a0f23783b9f5d1e2945387cd72");
});

test("bundled LXGW WenKai assets use the real pinned Git tag", async () => {
	const buildScript = await readFile(new URL("../scripts/build-nw.mjs", import.meta.url), "utf8");
	assert.match(buildScript, /LxgwWenKai@v1\.245\.1\/fonts\/TTF\/LXGWWenKai-Regular\.ttf/);
	assert.match(buildScript, /LxgwWenKai\/v1\.245\.1\/fonts\/TTF\/LXGWWenKai-Regular\.ttf/);
	assert.match(buildScript, /LxgwWenKai\/v1\.245\.1\/OFL\.txt/);
	assert.doesNotMatch(buildScript, /LxgwWenKai(?:@|\/)1\.245\.1\//);
});

test("packaged recorder falls back when @pixi/node WebGL setup fails", async () => {
	const buildScript = await readFile(new URL("../scripts/build-nw.mjs", import.meta.url), "utf8");
	assert.match(buildScript, /continuing without WebGL support/);
	assert.match(buildScript, /reading 'getUniformLocation'/);
	assert.match(buildScript, /reading 'getExtension'/);
	assert.match(buildScript, /if \(!this\.app\?\.renderer\)/);
});

test("packaged recorder keeps node-side asset URLs alive and has ffmpeg fallbacks", async () => {
	const buildScript = await readFile(new URL("../scripts/build-nw.mjs", import.meta.url), "utf8");
	assert.match(buildScript, /persistentObjectUrl/);
	assert.match(buildScript, /FFmpeg image conversion/);
	assert.match(buildScript, /FFmpeg audio conversion/);
	assert.match(buildScript, /ObjectUrl\.create = function persistentObjectUrl/);
	assert.match(buildScript, /fromUrlWithFallback/);
});
