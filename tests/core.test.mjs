import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
	ADVANCED_RECORDER_FIELDS,
	COVER_DEFAULTS,
	COVER_EXTRA_FIELDS,
	COVER_FIELDS,
	buildCoverArgs,
	buildRecorderArgs,
	inferOutputPath,
	MAIN_FIELD_KEYS,
	outputFormat,
	replaceOutputExtension,
	replaceOutputFilename,
	RECORDER_FIELDS,
	RECORDER_DEFAULTS,
	progressFromOutput,
	recordingPhaseFromOutput,
	resolveRecorderOutputPath,
	settingsForPreset,
	stripAnsi,
} from "../app/core.mjs";

test("quality presets return independent settings", () => {
	assert.deepEqual(settingsForPreset("standard"), { width: 1920, height: 1080, fps: 60 });
	const first = settingsForPreset("compact");
	first.width = 1;
	assert.equal(settingsForPreset("compact").width, 1280);
	assert.throws(() => settingsForPreset("cinema"), /Unknown quality preset/);
});

test("output path follows the selected level", () => {
	assert.equal(inferOutputPath(path.join("D:", "charts", "song.ssc"), path), path.join("D:", "charts", "song.mkv"));
	assert.equal(inferOutputPath("", path), "");
});

test("output formats provide extensions and FFmpeg options", () => {
	assert.equal(outputFormat("mkv").extension, ".mkv");
	assert.match(outputFormat("mp4").ffmpegOutputOptions, /aac/);
	assert.match(outputFormat("webm").ffmpegOutputOptions, /libvpx-vp9/);
	assert.equal(replaceOutputExtension("D:/videos/song.mkv", path.win32, "mp4"), "D:\\videos\\song.mp4");
	assert.equal(replaceOutputExtension("song.unknown", path.posix, "ts"), "song.ts");
	assert.equal(replaceOutputFilename("D:\\videos\\song.mkv", "final take", path.win32, "mp4"), "D:\\videos\\final take.mp4");
	assert.equal(replaceOutputFilename("/videos/song.mkv", "../unsafe.webm", path.posix, "webm"), "/videos/unsafe.webm");
	assert.equal(replaceOutputFilename("", "", path.posix, "mkv"), "");
});

test("desktop recording accepts recorder and legacy output field names", () => {
	assert.equal(resolveRecorderOutputPath({ output: "video.mkv" }), "video.mkv");
	assert.equal(resolveRecorderOutputPath({ outputPath: "legacy.mkv", output: "video.mkv" }), "legacy.mkv");
	assert.throws(() => resolveRecorderOutputPath({}), /output path is required/);
});

test("recorder arguments use explicit values accepted by minimist adapter", () => {
	const args = buildRecorderArgs({
		cliPath: "/app/cli.mjs",
		ffmpegPath: "/app/ffmpeg",
		levelPath: "/charts/song.ssc",
		outputPath: "/videos/song.mkv",
		tempDir: "/tmp/ssr-gui",
		chartSelect: "master.json",
		width: 1920,
		height: 1080,
		fps: 60,
		speed: 2,
		noteSizeTap: 0.95,
		noteSizeDrag: 0.65,
		resultsDuration: 1.5,
		waitForMusic: true,
		avoidDownloadingFonts: false,
	});
	assert.equal(args[0], "/app/cli.mjs");
	assert.deepEqual(args.slice(args.indexOf("--wait-for-music"), args.indexOf("--wait-for-music") + 2), ["--wait-for-music", "true"]);
	assert.deepEqual(args.slice(args.indexOf("--avoid-downloading-fonts"), args.indexOf("--avoid-downloading-fonts") + 2), ["--avoid-downloading-fonts", "false"]);
	const chartIndex = args.indexOf("--chart-select");
	assert.deepEqual(args.slice(chartIndex, chartIndex + 2), ["--chart-select", "master.json"]);
	const lyricaIndex = args.indexOf("--lyrica-5");
	assert.deepEqual(args.slice(lyricaIndex, lyricaIndex + 2), ["--lyrica-5", "true"]);
	assert.equal(args.includes("--lyrica5"), false);
	const outputIndex = args.indexOf("--output");
	assert.deepEqual(args.slice(outputIndex, outputIndex + 2), ["--output", "/videos/song.mkv"]);
	const dragSizeIndex = args.indexOf("--note-size-drag");
	assert.deepEqual(args.slice(dragSizeIndex, dragSizeIndex + 2), ["--note-size-drag", "0.65"]);
	assert.equal(args.includes("--note-size"), false);
	const qualityIndex = args.indexOf("--quality-big-text");
	assert.deepEqual(args.slice(qualityIndex, qualityIndex + 2), ["--quality-big-text", "1"]);
});

test("FFmpeg option values beginning with a dash stay values", () => {
	const args = buildRecorderArgs({ cliPath: "cli", levelFile: "online", levelFileOnline: "sample", ffmpegOutputOptions: "-c:a aac -b:a 192k" });
	const index = args.findIndex(value => value.startsWith("--ffmpeg-output-options"));
	assert.equal(args[index], "--ffmpeg-output-options=-c:a aac -b:a 192k");
});

test("the GUI schema covers all 92 recorder defaults exactly once", async () => {
	const fs = await import("node:fs/promises");
	const path = await import("node:path");
	const sourcePath = process.env.SSR_RECORD_SOURCE
		? path.join(process.env.SSR_RECORD_SOURCE, "record.mjs")
		: path.resolve("../sunniesnow-record/record.mjs");
	let source = "";
	try { source = await fs.readFile(sourcePath, "utf8"); } catch { /* CI may not checkout the sibling source. */ }
	if (!source) {
		assert.equal(RECORDER_FIELDS.length, 92);
		assert.equal(new Set(RECORDER_FIELDS.map(field => field.key)).size, 92);
		return;
	}
	const block = source.match(/static DEFAULT_SETTINGS = \{([\s\S]*?)\n\t\}/)?.[1] || "";
	const upstreamKeys = [...block.matchAll(/^\t\t([A-Za-z0-9]+):/gm)].map(match => match[1]);
	assert.equal(upstreamKeys.length, 92);
	assert.deepEqual(RECORDER_FIELDS.map(field => field.key), upstreamKeys);
	assert.deepEqual(Object.keys(RECORDER_DEFAULTS), upstreamKeys);
});

test("main workflow fields are excluded from advanced settings", async () => {
	const mainKeys = new Set(MAIN_FIELD_KEYS);
	const advancedKeys = new Set(ADVANCED_RECORDER_FIELDS.map(field => field.key));
	assert.equal(mainKeys.size, MAIN_FIELD_KEYS.length);
	for (const key of mainKeys) {
		assert.ok(RECORDER_FIELDS.some(field => field.key === key), `${key} must be a recorder field`);
		assert.equal(advancedKeys.has(key), false, `${key} must not be duplicated in advanced settings`);
	}
	assert.equal(mainKeys.size + advancedKeys.size, RECORDER_FIELDS.length);
	const html = await (await import("node:fs/promises")).readFile(new URL("../app/index.html", import.meta.url), "utf8");
	assert.doesNotMatch(html, /<button\b/);
	assert.doesNotMatch(html, /<form\b/);
	assert.match(html, /role=["']button["']/);
	for (const id of ["wait-music", "system-fonts", "auto-save-config"]) {
		assert.match(html, new RegExp(`<input[^>]+id=["']${id}["'][^>]+type=["']checkbox["']`));
		assert.doesNotMatch(html, new RegExp(`<select[^>]+id=["']${id}["']`));
	}
	assert.match(html, /class=["']checkbox-toggle["']/);
	for (const id of ["nickname", "avatar-source", "avatar-online", "avatar-upload", "avatar-upload-name", "avatar-gravatar", "output-filename"]) {
		assert.match(html, new RegExp(`id=["']${id}["']`));
	}
});

test("cover arguments match the upstream cover generator schema", () => {
	const args = buildCoverArgs({
		cliPath: "/app/cli-cover-gen.mjs",
		levelPath: "/charts/song.ssc",
		output: "/covers/song.png",
		chartSelect: "master.json",
		width: 1920,
		height: 1080,
		backgroundBlur: 20,
		coverThemeImageX: "",
		coverThemeImageY: 100,
	});
	assert.equal(args[0], "/app/cli-cover-gen.mjs");
	const levelIndex = args.indexOf("--level-file-upload");
	assert.deepEqual(args.slice(levelIndex, levelIndex + 2), ["--level-file-upload", "/charts/song.ssc"]);
	const chartIndex = args.indexOf("--chart-select");
	assert.deepEqual(args.slice(chartIndex, chartIndex + 2), ["--chart-select", "master.json"]);
	const outputIndex = args.indexOf("--output");
	assert.deepEqual(args.slice(outputIndex, outputIndex + 2), ["--output", "/covers/song.png"]);
	const themeYIndex = args.indexOf("--cover-theme-image-y");
	assert.deepEqual(args.slice(themeYIndex, themeYIndex + 2), ["--cover-theme-image-y", "100"]);
	assert.equal(args.includes("--cover-theme-image-x"), false);
	assert.equal(args.includes("--cover-theme-image-width"), false);
	assert.equal(args.includes("--fps"), false);
	assert.equal(args.includes("--results-duration"), false);
});

test("cover argument validation rejects missing or unsafe values", () => {
	assert.throws(() => buildCoverArgs({ cliPath: "", output: "o.png" }), /cliPath is required/);
	assert.throws(() => buildCoverArgs({ cliPath: "c", output: "" }), /output is required/);
	assert.throws(() => buildCoverArgs({ cliPath: "c", output: "o.png" }), /levelFileUpload is required/);
	assert.throws(() => buildCoverArgs({ cliPath: "c", output: "o.png", levelFile: "online" }), /levelFileOnline is required/);
	assert.throws(() => buildCoverArgs({ cliPath: "c", output: "o.png", levelPath: "l", backgroundBlur: -1 }), /backgroundBlur must be between/);
	assert.throws(() => buildCoverArgs({ cliPath: "c", output: "o.png", levelPath: "l", width: Number.NaN }), /width must be between/);
});

test("the GUI cover schema covers all upstream cover defaults exactly once", async () => {
	const fs = await import("node:fs/promises");
	const path = await import("node:path");
	const sourcePath = process.env.SSR_RECORD_SOURCE
		? path.join(process.env.SSR_RECORD_SOURCE, "cover-gen.mjs")
		: path.resolve("../sunniesnow-record/cover-gen.mjs");
	let source = "";
	try { source = await fs.readFile(sourcePath, "utf8"); } catch { /* CI may not checkout the sibling source. */ }
	if (!source) {
		assert.equal(COVER_FIELDS.length, 33);
		assert.equal(new Set(COVER_FIELDS.map(field => field.key)).size, 33);
		return;
	}
	const block = source.match(/static DEFAULT_SETTINGS = \{([\s\S]*?)\n\t\}/)?.[1] || "";
	const upstreamKeys = [...block.matchAll(/^\t\t([A-Za-z0-9]+):/gm)].map(match => match[1]);
	assert.equal(upstreamKeys.length, 33);
	assert.deepEqual(COVER_FIELDS.map(field => field.key), upstreamKeys);
	assert.deepEqual(Object.keys(COVER_DEFAULTS), upstreamKeys);
	assert.deepEqual(COVER_EXTRA_FIELDS.map(field => field.key), ["coverThemeImageX", "coverThemeImageY", "coverThemeImageWidth"]);
});

test("cover i18n locales share one key set and the HTML section is wired", async () => {
	const { COVER_I18N, COVER_I18N_LOCALES } = await import("../app/core.mjs");
	assert.ok(COVER_I18N_LOCALES.length >= 2);
	const expected = Object.keys(COVER_I18N[COVER_I18N_LOCALES[0]]).sort();
	for (const locale of COVER_I18N_LOCALES) {
		assert.deepEqual(Object.keys(COVER_I18N[locale]).sort(), expected, `${locale} must define the same keys`);
	}
	const html = await (await import("node:fs/promises")).readFile(new URL("../app/index.html", import.meta.url), "utf8");
	assert.match(html, /id=["']cover-section["']/);
	assert.match(html, /data-cover-i18n=["']coverGenerate["']/);
	for (const key of COVER_EXTRA_FIELDS.map(field => field.key)) {
		assert.match(html, new RegExp(`data-setting=["']${key}["']`));
	}
	const appSource = await (await import("node:fs/promises")).readFile(new URL("../app/app.mjs", import.meta.url), "utf8");
	assert.doesNotMatch(appSource, /for \(const definition of COVER_EXTRA_FIELDS\) groups\.get/);
	assert.match(appSource, /registerCoverMainControls/);
});

test("recorder argument validation rejects unsafe numeric values", () => {
	const settings = {
		cliPath: "cli", ffmpegPath: "ffmpeg", levelPath: "level", outputPath: "out", tempDir: "tmp",
		width: 1920, height: 1080, fps: 60, speed: 2, noteSizeTap: 0.95, resultsDuration: 1,
	};
	assert.throws(() => buildRecorderArgs({ ...settings, fps: 0 }), /fps must be between/);
	assert.throws(() => buildRecorderArgs({ ...settings, width: Number.NaN }), /width must be between/);
	assert.throws(() => buildRecorderArgs({ ...settings, outputPath: "" }), /outputPath is required/);
});

test("progress is monotonic across recorder stages", () => {
	let value = 0;
	for (const line of ["Loading...", "Loading plugins", "Input #0, rawvideo, from 'pipe:0':", "frame= 153 fps=152", "Waiting for FFmpeg to finish eating the video...", "Exporting audio...", "Combining video and audio...", "Done!"]) {
		const next = progressFromOutput(line, value);
		assert.ok(next >= value);
		value = next;
	}
	assert.equal(value, 100);
	assert.equal(progressFromOutput("Loading...", 88), 88);
});

test("recorder output switches the GUI from preparation to rendering", () => {
	assert.equal(recordingPhaseFromOutput("Loading modules: 66/67"), "preparing");
	assert.equal(recordingPhaseFromOutput("Input #0, rawvideo, from 'pipe:0':"), "rendering");
	assert.equal(recordingPhaseFromOutput("frame= 153 fps=152 q=29.0"), "rendering");
	assert.equal(recordingPhaseFromOutput("Exporting audio..."), "audio");
	assert.equal(recordingPhaseFromOutput("Combining video and audio..."), "muxing");
});

test("recorder phases are ordered so late loading output cannot regress the GUI", () => {
	const order = { preparing: 1, rendering: 2, audio: 3, muxing: 4 };
	let current = "";
	for (const line of ["Loading...", "frame= 153 fps=152", "Loading a cached asset..."]) {
		const next = recordingPhaseFromOutput(line);
		if (next && order[next] >= (order[current] || 0)) current = next;
	}
	assert.equal(current, "rendering");
});

test("ANSI control sequences are removed from logs", () => {
	assert.equal(stripAnsi("\u001b[31merror\u001b[0m"), "error");
});
