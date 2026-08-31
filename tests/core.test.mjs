import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
	ADVANCED_RECORDER_FIELDS,
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
});

test("FFmpeg option values beginning with a dash stay values", () => {
	const args = buildRecorderArgs({ cliPath: "cli", levelFile: "online", levelFileOnline: "sample", ffmpegOutputOptions: "-c:a aac -b:a 192k" });
	const index = args.findIndex(value => value.startsWith("--ffmpeg-output-options"));
	assert.equal(args[index], "--ffmpeg-output-options=-c:a aac -b:a 192k");
});

test("the GUI schema covers all 91 recorder defaults exactly once", async () => {
	const fs = await import("node:fs/promises");
	const path = await import("node:path");
	const sourcePath = process.env.SSR_RECORD_SOURCE
		? path.join(process.env.SSR_RECORD_SOURCE, "record.mjs")
		: path.resolve("../sunniesnow-record/record.mjs");
	let source = "";
	try { source = await fs.readFile(sourcePath, "utf8"); } catch { /* CI may not checkout the sibling source. */ }
	if (!source) {
		assert.equal(RECORDER_FIELDS.length, 91);
		assert.equal(new Set(RECORDER_FIELDS.map(field => field.key)).size, 91);
		return;
	}
	const block = source.match(/static DEFAULT_SETTINGS = \{([\s\S]*?)\n\t\}/)?.[1] || "";
	const upstreamKeys = [...block.matchAll(/^\t\t([A-Za-z0-9]+):/gm)].map(match => match[1]);
	assert.equal(upstreamKeys.length, 91);
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
		assert.match(html, new RegExp(`<select[^>]+id=["']${id}["']`));
		assert.doesNotMatch(html, new RegExp(`<input[^>]+id=["']${id}["']`));
	}
	for (const id of ["nickname", "avatar-source", "avatar-online", "avatar-upload", "avatar-upload-name", "avatar-gravatar", "output-filename"]) {
		assert.match(html, new RegExp(`id=["']${id}["']`));
	}
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
