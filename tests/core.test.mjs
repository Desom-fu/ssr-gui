import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
	buildRecorderArgs,
	inferOutputPath,
	progressFromOutput,
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
		noteSize: 1,
		resultsDuration: 1.5,
		waitForMusic: true,
		avoidDownloadingFonts: false,
	});
	assert.equal(args[0], "/app/cli.mjs");
	assert.deepEqual(args.slice(args.indexOf("--wait-for-music"), args.indexOf("--wait-for-music") + 2), ["--wait-for-music", "true"]);
	assert.deepEqual(args.slice(args.indexOf("--avoid-downloading-fonts"), args.indexOf("--avoid-downloading-fonts") + 2), ["--avoid-downloading-fonts", "false"]);
	assert.deepEqual(args.slice(-2), ["--chart-select", "master.json"]);
});

test("recorder argument validation rejects unsafe numeric values", () => {
	const settings = {
		cliPath: "cli", ffmpegPath: "ffmpeg", levelPath: "level", outputPath: "out", tempDir: "tmp",
		width: 1920, height: 1080, fps: 60, speed: 2, noteSize: 1, resultsDuration: 1,
	};
	assert.throws(() => buildRecorderArgs({ ...settings, fps: 0 }), /fps must be between/);
	assert.throws(() => buildRecorderArgs({ ...settings, width: Number.NaN }), /width must be between/);
	assert.throws(() => buildRecorderArgs({ ...settings, outputPath: "" }), /outputPath is required/);
});

test("progress is monotonic across recorder stages", () => {
	let value = 0;
	for (const line of ["Loading...", "Loading plugins", "Waiting for FFmpeg to finish eating the video...", "Exporting audio...", "Combining video and audio...", "Done!"]) {
		const next = progressFromOutput(line, value);
		assert.ok(next >= value);
		value = next;
	}
	assert.equal(value, 100);
	assert.equal(progressFromOutput("Loading...", 88), 88);
});

test("ANSI control sequences are removed from logs", () => {
	assert.equal(stripAnsi("\u001b[31merror\u001b[0m"), "error");
});

