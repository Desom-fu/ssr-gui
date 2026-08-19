import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { builderApplicationOptions, platformArtifactName } from "../scripts/nw-build-config.mjs";

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
	assert.match(workflow, /Compress-Archive/);
	assert.match(workflow, /zip -qry/);
	assert.match(workflow, /tar -czf/);
	assert.match(workflow, /softprops\/action-gh-release/);
});
