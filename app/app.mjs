import { FIELD_GROUPS, FIELD_LABELS, RECORDER_DEFAULTS, RECORDER_FIELDS, fieldGroup, outputFormat, progressFromOutput, recordingPhaseFromOutput, replaceOutputExtension, settingsForPreset } from "./core.mjs";
import { DesktopPlatform } from "./platform.mjs";

const platform = new DesktopPlatform();
const elements = Object.fromEntries([
	"record-form", "runtime-badge", "choose-level", "level-name", "level-path", "chart-select",
	"choose-output", "output-path", "output-format", "video-width", "video-height", "video-fps", "speed", "note-size", "wait-music", "system-fonts",
	"results-duration", "advanced-groups", "start-record", "cancel-record", "state-mark", "state-eyebrow",
	"state-title", "state-detail", "progress-bar", "reveal-output", "log-output", "clear-log",
].map(id => [id, document.getElementById(id)]));

const state = {
	levelPath: "",
	outputPath: "",
	outputManuallyChosen: false,
	running: false,
	runtimeReady: false,
	progress: 0,
	startedAt: 0,
	timer: 0,
	logLines: [],
};

const customValues = { ...RECORDER_DEFAULTS };

function displayLabel(field) {
	return FIELD_LABELS[field.key] || field.key.replace(/([A-Z])/g, " $1").replace(/^./, value => value.toUpperCase());
}

function makeFieldControl(definition) {
	const wrapper = document.createElement("label");
	wrapper.className = "advanced-field";
	const label = document.createElement("span");
	label.textContent = displayLabel(definition);
	wrapper.append(label);
	let control;
	if (definition.type === "boolean") {
		control = document.createElement("input");
		control.type = "checkbox";
		control.checked = Boolean(definition.defaultValue);
		wrapper.classList.add("advanced-toggle");
		wrapper.append(control, document.createTextNode("启用"));
	} else if (definition.type === "select") {
		control = document.createElement("select");
		for (const value of definition.options || []) {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = value;
			control.append(option);
		}
		control.value = definition.defaultValue ?? "";
		wrapper.append(control);
	} else {
		control = document.createElement("input");
		control.type = definition.type === "number" ? "number" : definition.type === "file" || definition.type === "file-array" ? "file" : "text";
		if (definition.type === "file-array") control.multiple = true;
		if (definition.accept) control.accept = definition.accept;
		if (definition.type === "number") {
			if (definition.min != null) control.min = String(definition.min);
			if (definition.max != null) control.max = String(definition.max);
			if (definition.step != null) control.step = String(definition.step);
		}
		if (definition.type !== "file" && definition.type !== "file-array") control.value = definition.defaultValue == null ? "" : Array.isArray(definition.defaultValue) ? definition.defaultValue.join(", ") : String(definition.defaultValue);
		wrapper.append(control);
	}
	control.id = `setting-${definition.key}`;
	control.dataset.setting = definition.key;
	control.addEventListener("change", () => updateCustomValue(definition, control));
	control.addEventListener("input", () => updateCustomValue(definition, control));
	return wrapper;
}

function updateCustomValue(definition, control) {
	if (definition.type === "boolean") customValues[definition.key] = control.checked;
	else if (definition.type === "file" || definition.type === "path") customValues[definition.key] = control.files?.[0]?.path || control.value;
	else if (definition.type === "file-array") customValues[definition.key] = [...(control.files || [])].map(file => file.path || file.name);
	else if (definition.type === "array") customValues[definition.key] = control.value.split(",").map(item => item.trim()).filter(Boolean);
	else customValues[definition.key] = control.value;
	if (["width", "height", "fps", "speed", "noteSize", "resultsDuration"].includes(definition.key)) syncShortcut(definition.key, customValues[definition.key]);
	updateActions();
}

function syncShortcut(key, value) {
	const shortcutIds = { width: "video-width", height: "video-height", fps: "video-fps", speed: "speed", noteSize: "note-size", resultsDuration: "results-duration" };
	const element = elements[shortcutIds[key]];
	if (element && document.activeElement !== element) element.value = value;
}

function renderAdvancedSettings() {
	const groups = new Map(FIELD_GROUPS.map(group => {
		const details = document.createElement("details");
		details.className = "advanced-group";
		const summary = document.createElement("summary");
		summary.textContent = group.label;
		details.append(summary);
		elements["advanced-groups"].append(details);
		return [group.id, details];
	}));
	for (const definition of RECORDER_FIELDS) groups.get(fieldGroup(definition.key)).append(makeFieldControl(definition));
}

function collectRecorderSettings() {
	const values = { ...customValues };
	if (state.levelPath) {
		values.levelFile = "upload";
		values.levelFileUpload = state.levelPath;
	}
	values.chartSelect = elements["chart-select"].value || values.chartSelect;
	values.width = elements["video-width"].value;
	values.height = elements["video-height"].value;
	values.fps = elements["video-fps"].value;
	values.speed = elements.speed.value;
	values.noteSize = elements["note-size"].value;
	values.resultsDuration = elements["results-duration"].value;
	values.output = state.outputPath || customValues.output;
	values.outputPath = values.output;
	const format = outputFormat(elements["output-format"].value);
	if (!String(customValues.ffmpegOutputOptions || "").trim()) values.ffmpegOutputOptions = format.ffmpegOutputOptions;
	values.waitForMusic = elements["wait-music"].checked;
	values.avoidDownloadingFonts = elements["system-fonts"].checked;
	return values;
}

function basename(filename) {
	return filename ? platform.path.basename(filename) : "";
}

function setStatus(kind, eyebrow, title, detail = "00:00") {
	elements["state-mark"].className = `state-mark ${kind || ""}`.trim();
	elements["state-eyebrow"].textContent = eyebrow;
	elements["state-title"].textContent = title;
	elements["state-detail"].textContent = detail;
}

function setProgress(value, indeterminate = false) {
	state.progress = Math.max(state.progress, Math.min(100, Number(value) || 0));
	elements["progress-bar"].style.width = `${state.progress}%`;
	elements["progress-bar"].parentElement.classList.toggle("indeterminate", indeterminate);
}

function appendLog(line, source = "stdout") {
	const value = String(line || "").trim();
	if (!value) return;
	state.logLines.push(source === "stderr" ? `[recorder] ${value}` : source === "error" ? `[error] ${value}` : value);
	if (state.logLines.length > 350) state.logLines.splice(0, state.logLines.length - 350);
	elements["log-output"].textContent = state.logLines.join("\n");
	elements["log-output"].scrollTop = elements["log-output"].scrollHeight;

	state.progress = progressFromOutput(value, state.progress);
	const phase = recordingPhaseFromOutput(value);
	if (phase === "preparing") setStatus("recording", "PREPARING", "正在载入资源", elapsed());
	if (phase === "rendering") setStatus("recording", "RENDERING", "正在生成画面", elapsed());
	if (phase === "audio") setStatus("recording", "AUDIO", "正在生成音频", elapsed());
	if (phase === "muxing") setStatus("recording", "MUXING", "正在封装视频", elapsed());
	setProgress(state.progress, state.running && state.progress >= 7 && state.progress < 70);
}

function elapsed() {
	if (!state.startedAt) return "00:00";
	const seconds = Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));
	return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function startTimer() {
	clearInterval(state.timer);
	state.timer = setInterval(() => {
		if (state.running) elements["state-detail"].textContent = elapsed();
	}, 500);
}

function updateActions() {
	const onlineReady = customValues.levelFile === "online" && Boolean(String(customValues.levelFileOnline || "").trim());
	const ready = state.runtimeReady && Boolean((state.levelPath || onlineReady) && (state.outputPath || customValues.output));
	elements["start-record"].disabled = !ready || state.running;
	elements["cancel-record"].disabled = !state.running;
	elements["choose-level"].disabled = state.running;
	elements["choose-output"].disabled = !(state.levelPath || onlineReady) || state.running;
	elements["chart-select"].disabled = !state.levelPath || state.running || elements["chart-select"].options.length < 2;
	document.querySelectorAll("input, select").forEach(element => {
		if (element.id !== "chart-select") element.disabled = state.running;
	});
}

async function useLevel(filename) {
	if (!filename || !filename.toLowerCase().endsWith(".ssc")) {
		throw new Error("请选择 .ssc 谱面文件。");
	}
	state.levelPath = platform.path.resolve(filename);
	state.outputManuallyChosen = false;
	state.outputPath = replaceOutputExtension(state.levelPath, platform.path, elements["output-format"].value);
	elements["level-name"].textContent = basename(filename);
	elements["level-path"].textContent = state.levelPath;
	elements["output-path"].textContent = state.outputPath;
	elements["chart-select"].innerHTML = '<option value="">自动选择</option>';
	setStatus("", "READING", "正在读取谱面", "00:00");
	const charts = await platform.inspectLevel(state.levelPath);
	for (const chart of charts) {
		const option = document.createElement("option");
		option.value = chart.value;
		option.textContent = chart.label;
		elements["chart-select"].append(option);
	}
	if (charts.length === 1) elements["chart-select"].value = charts[0].value;
	setStatus("", "READY", "可以开始录制", `${charts.length} 个难度`);
	elements["reveal-output"].hidden = true;
	state.progress = 0;
	setProgress(0);
	updateActions();
}

async function chooseLevel() {
	const filename = await platform.chooseFile({ accept: ".ssc,application/zip" });
	if (filename) await useLevel(filename);
}

async function chooseOutput() {
	const format = outputFormat(elements["output-format"].value);
	const suggested = basename(state.outputPath) || `output${format.extension}`;
	const filename = await platform.chooseFile({ accept: format.accept, saveAs: suggested });
	if (!filename) return;
	state.outputManuallyChosen = true;
	state.outputPath = replaceOutputExtension(filename, platform.path, format.id);
	elements["output-path"].textContent = state.outputPath;
	updateActions();
}

function changeOutputFormat() {
	if (!state.outputPath) return;
	state.outputPath = replaceOutputExtension(state.outputPath, platform.path, elements["output-format"].value);
	elements["output-path"].textContent = state.outputPath;
}

function applyQualityPreset(name) {
	if (name === "custom") return;
	const preset = settingsForPreset(name);
	elements["video-width"].value = String(preset.width);
	elements["video-height"].value = String(preset.height);
	elements["video-fps"].value = String(preset.fps);
}

document.querySelectorAll('input[name="quality"]').forEach(input => {
	input.addEventListener("change", () => {
		if (input.checked) applyQualityPreset(input.value);
	});
});
elements["output-format"].addEventListener("change", changeOutputFormat);
for (const id of ["video-width", "video-height", "video-fps"]) {
	elements[id].addEventListener("input", () => {
		const custom = document.querySelector('input[name="quality"][value="custom"]');
		if (custom) custom.checked = true;
	});
}

async function beginRecording(event) {
	event.preventDefault();
	if (state.running || !state.runtimeReady) return;
	state.running = true;
	state.startedAt = Date.now();
	state.progress = 2;
	state.logLines = [];
	elements["log-output"].textContent = "";
	elements["reveal-output"].hidden = true;
	setStatus("recording", "STARTING", "正在启动录制", "00:00");
	setProgress(2, true);
	startTimer();
	updateActions();
	try {
		const result = await platform.record(collectRecorderSettings(), { onOutput: appendLog });
		if (result.cancelled) {
			setStatus("", "CANCELLED", "录制已取消", elapsed());
			appendLog("Recording cancelled.");
			state.progress = 0;
			setProgress(0);
		} else {
			state.progress = 100;
			setProgress(100);
			setStatus("done", "COMPLETE", "视频已生成", elapsed());
			elements["reveal-output"].hidden = false;
		}
	} catch (error) {
		appendLog(error.stack || error.message || String(error), "error");
		setStatus("failed", "FAILED", "录制失败", elapsed());
		setProgress(state.progress);
	} finally {
		state.running = false;
		clearInterval(state.timer);
		updateActions();
	}
}

async function initialize() {
	updateActions();
	try {
		await platform.verifyRuntime();
		state.runtimeReady = true;
		elements["runtime-badge"].textContent = `${process.platform} · Node + FFmpeg`;
		elements["runtime-badge"].classList.add("ready");
		appendLog("Bundled Node and FFmpeg are ready.");
	} catch (error) {
		elements["runtime-badge"].textContent = "运行组件缺失";
		elements["runtime-badge"].classList.add("error");
		appendLog(error.stack || error.message || String(error), "stderr");
		setStatus("failed", "RUNTIME ERROR", "运行组件不可用", "请重新安装完整发行包");
	}
	updateActions();
}

elements["choose-level"].addEventListener("click", () => chooseLevel().catch(error => {
	appendLog(error.message, "stderr");
	setStatus("failed", "INVALID LEVEL", "无法读取谱面", "请检查文件");
}));
elements["choose-output"].addEventListener("click", () => chooseOutput().catch(error => appendLog(error.message, "stderr")));
elements["record-form"].addEventListener("submit", beginRecording);
elements["cancel-record"].addEventListener("click", () => platform.cancel().catch(error => appendLog(error.message, "stderr")));
elements["reveal-output"].addEventListener("click", () => platform.reveal(state.outputPath));
elements["clear-log"].addEventListener("click", () => {
	state.logLines = [];
	elements["log-output"].textContent = "";
});

for (const type of ["dragenter", "dragover"]) {
	elements["choose-level"].addEventListener(type, event => {
		event.preventDefault();
		if (!state.running) elements["choose-level"].classList.add("dragging");
	});
}
for (const type of ["dragleave", "drop"]) {
	elements["choose-level"].addEventListener(type, event => {
		event.preventDefault();
		elements["choose-level"].classList.remove("dragging");
	});
}
elements["choose-level"].addEventListener("drop", event => {
	if (state.running) return;
	const filename = event.dataTransfer?.files?.[0]?.path;
	if (filename) useLevel(filename).catch(error => appendLog(error.message, "stderr"));
});

renderAdvancedSettings();

nw.Window.get().on("close", function onClose() {
	if (!state.running) return this.close(true);
	platform.cancel().finally(() => this.close(true));
});

initialize();
