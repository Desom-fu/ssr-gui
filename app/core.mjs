export const QUALITY_PRESETS = Object.freeze({
	compact: Object.freeze({ width: 1280, height: 720, fps: 30 }),
	standard: Object.freeze({ width: 1920, height: 1080, fps: 60 }),
	high: Object.freeze({ width: 2560, height: 1440, fps: 60 }),
});

function finiteNumber(value, name, { min = -Infinity, max = Infinity } = {}) {
	const number = Number(value);
	if (!Number.isFinite(number) || number < min || number > max) {
		throw new TypeError(`${name} must be between ${min} and ${max}.`);
	}
	return number;
}

export function settingsForPreset(name) {
	const preset = QUALITY_PRESETS[name];
	if (!preset) throw new TypeError(`Unknown quality preset: ${name}`);
	return { ...preset };
}

export function inferOutputPath(levelPath, pathApi, extension = ".mkv") {
	if (!levelPath) return "";
	const parsed = pathApi.parse(levelPath);
	return pathApi.join(parsed.dir, `${parsed.name}${extension}`);
}

export function buildRecorderArgs(settings) {
	const required = ["cliPath", "ffmpegPath", "levelPath", "outputPath", "tempDir"];
	for (const key of required) {
		if (!String(settings[key] || "").trim()) throw new TypeError(`${key} is required.`);
	}
	const width = finiteNumber(settings.width, "width", { min: 320, max: 7680 });
	const height = finiteNumber(settings.height, "height", { min: 180, max: 4320 });
	const fps = finiteNumber(settings.fps, "fps", { min: 1, max: 240 });
	const speed = finiteNumber(settings.speed, "speed", { min: 0, max: 20 });
	const noteSize = finiteNumber(settings.noteSize, "noteSize", { min: 0.1, max: 5 });
	const resultsDuration = finiteNumber(settings.resultsDuration, "resultsDuration", { min: 0, max: 60 });

	const args = [
		settings.cliPath,
		"--level-file", "upload",
		"--level-file-upload", settings.levelPath,
		"--output", settings.outputPath,
		"--ffmpeg", settings.ffmpegPath,
		"--temp-dir", settings.tempDir,
		"--width", String(width),
		"--height", String(height),
		"--fps", String(fps),
		"--speed", String(speed),
		"--note-size", String(noteSize),
		"--results-duration", String(resultsDuration),
		"--wait-for-music", String(Boolean(settings.waitForMusic)),
		"--avoid-downloading-fonts", String(Boolean(settings.avoidDownloadingFonts)),
	];
	if (settings.chartSelect) args.push("--chart-select", settings.chartSelect);
	return args;
}

export function progressFromOutput(line, previous = 0) {
	const text = String(line || "").toLowerCase();
	if (text.includes("done!")) return 100;
	if (text.includes("combining video and audio")) return Math.max(previous, 88);
	if (text.includes("exporting audio")) return Math.max(previous, 78);
	if (text.includes("waiting for ffmpeg")) return Math.max(previous, 70);
	if (text.includes("loading modules")) return Math.max(previous, 24);
	if (text.includes("loading plugins")) return Math.max(previous, 14);
	if (text.includes("loading")) return Math.max(previous, 7);
	return previous;
}

export function stripAnsi(value) {
	return String(value || "").replace(/[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, "");
}
