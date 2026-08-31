import { ADVANCED_RECORDER_FIELDS, FIELD_GROUPS, FIELD_LABELS, RECORDER_DEFAULTS, fieldGroup, outputFormat, progressFromOutput, recordingPhaseFromOutput, replaceOutputExtension, replaceOutputFilename, settingsForPreset } from "./core.mjs";
import { DesktopPlatform } from "./platform.mjs";

const platform = new DesktopPlatform();
const elements = Object.fromEntries([
	"record-form", "runtime-badge", "choose-level", "level-name", "level-path", "chart-select",
	"choose-output", "output-path", "output-format", "output-filename", "video-width", "video-height", "video-fps", "speed", "wait-music", "system-fonts",
	"nickname", "avatar-source", "avatar-online", "avatar-upload", "avatar-upload-name", "avatar-gravatar", "avatar-online-field", "avatar-upload-field", "avatar-gravatar-field",
	"results-duration", "advanced-groups", "start-record", "cancel-record", "state-mark", "state-eyebrow",
	"state-title", "state-detail", "progress-bar", "reveal-output", "log-output", "clear-log", "save-config", "import-config", "auto-save-config", "config-status",
].map(id => [id, document.getElementById(id)]));

const state = {
	levelPath: "",
	levelReady: false,
	outputPath: "",
	outputManuallyChosen: false,
	running: false,
	runtimeReady: false,
	progress: 0,
	phase: "",
	startedAt: 0,
	timer: 0,
	logLines: [],
	autoSave: true,
	configReady: false,
	configTimer: 0,
};

const customValues = { ...RECORDER_DEFAULTS };
const advancedControls = new Map();

function displayLabel(field) {
	return FIELD_LABELS[field.key] || field.key.replace(/([A-Z])/g, " $1").replace(/^./, value => value.toUpperCase());
}

function selectedFilePath(input) {
	return input?.files?.[0]?.path || input?.value || "";
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
	advancedControls.set(definition.key, control);
	return wrapper;
}

function updateCustomValue(definition, control) {
	if (definition.type === "boolean") customValues[definition.key] = control.checked;
	else if (definition.type === "file" || definition.type === "path") customValues[definition.key] = control.files?.[0]?.path || control.value;
	else if (definition.type === "file-array") customValues[definition.key] = [...(control.files || [])].map(file => file.path || file.name);
	else if (definition.type === "array") customValues[definition.key] = control.value.split(",").map(item => item.trim()).filter(Boolean);
	else customValues[definition.key] = control.value;
	updateActions();
	scheduleAutoSave();
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
	for (const definition of ADVANCED_RECORDER_FIELDS) groups.get(fieldGroup(definition.key)).append(makeFieldControl(definition));
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
	values.nickname = elements.nickname.value;
	values.avatar = elements["avatar-source"].value;
	values.avatarOnline = elements["avatar-online"].value;
	values.avatarUpload = selectedFilePath(elements["avatar-upload"]) || customValues.avatarUpload || "";
	values.avatarGravatar = elements["avatar-gravatar"].value;
	values.resultsDuration = elements["results-duration"].value;
	values.output = state.outputPath || customValues.output;
	values.outputPath = values.output;
	const format = outputFormat(elements["output-format"].value);
	if (!String(customValues.ffmpegOutputOptions || "").trim()) values.ffmpegOutputOptions = format.ffmpegOutputOptions;
	values.waitForMusic = elements["wait-music"].checked;
	values.avoidDownloadingFonts = elements["system-fonts"].checked;
	return values;
}

function captureConfig() {
	const settings = collectRecorderSettings();
	return {
		type: "ssr-gui-config",
		version: 1,
		savedAt: new Date().toISOString(),
		autoSave: state.autoSave,
		state: {
			levelPath: state.levelPath,
			outputPath: state.outputPath,
			outputManuallyChosen: state.outputManuallyChosen,
		},
		ui: {
			outputFormat: elements["output-format"].value,
			quality: document.querySelector('input[name="quality"]:checked')?.value || "custom",
		},
		settings,
	};
}

function setConfigStatus(message, error = false) {
	elements["config-status"].textContent = message;
	elements["config-status"].classList.toggle("error", error);
}

function scheduleAutoSave() {
	if (!state.configReady || !state.autoSave || state.running) return;
	clearTimeout(state.configTimer);
	state.configTimer = setTimeout(() => {
		platform.saveAutoConfig(captureConfig())
			.then(() => setConfigStatus("已自动保存"))
			.catch(error => setConfigStatus(`自动保存失败：${error.message}`, true));
	}, 500);
}

function basename(filename) {
	return filename ? platform.path.basename(filename) : "";
}

function setAvatarUploadDisplay(filename = "") {
	const path = String(filename || "").trim();
	const display = elements["avatar-upload-name"];
	if (!display) return;
	display.textContent = path ? basename(path) : "未选择";
	display.title = path;
}

function updateAvatarFields() {
	const selected = elements["avatar-source"].value;
	elements["avatar-online-field"].hidden = selected !== "online";
	elements["avatar-upload-field"].hidden = selected !== "upload";
	elements["avatar-gravatar-field"].hidden = selected !== "gravatar";
}

function setOutputDisplay() {
	elements["output-path"].textContent = state.outputPath || "选择谱面后自动生成";
	if (state.outputPath) elements["output-filename"].value = basename(state.outputPath);
}

function updateOutputFilename(normalizeControl = false) {
	const raw = elements["output-filename"].value.trim();
	if (!raw) {
		updateActions();
		return;
	}
	const format = outputFormat(elements["output-format"].value);
	state.outputPath = replaceOutputFilename(state.outputPath || customValues.output, raw, platform.path, format.id);
	state.outputManuallyChosen = true;
	if (normalizeControl) elements["output-filename"].value = basename(state.outputPath);
	elements["output-path"].textContent = state.outputPath;
	updateActions();
	scheduleAutoSave();
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
	const phaseOrder = { preparing: 1, rendering: 2, audio: 3, muxing: 4 };
	if (phase && (phaseOrder[phase] || 0) >= (phaseOrder[state.phase] || 0)) {
		state.phase = phase;
		if (phase === "preparing") setStatus("recording", "PREPARING", "正在载入资源", elapsed());
		if (phase === "rendering") setStatus("recording", "RENDERING", "正在生成画面", elapsed());
		if (phase === "audio") setStatus("recording", "AUDIO", "正在生成音频", elapsed());
		if (phase === "muxing") setStatus("recording", "MUXING", "正在封装视频", elapsed());
	}
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
	const outputReady = Boolean(elements["output-filename"].value.trim() && (state.outputPath || customValues.output));
	const ready = state.runtimeReady && Boolean(((state.levelPath && state.levelReady) || onlineReady) && outputReady);
	elements["start-record"].disabled = !ready || state.running;
	elements["cancel-record"].disabled = !state.running;
	elements["choose-level"].disabled = state.running;
	elements["choose-output"].disabled = !((state.levelPath && state.levelReady) || onlineReady) || state.running;
	elements["chart-select"].disabled = !state.levelPath || state.running || elements["chart-select"].options.length < 2;
	elements["save-config"].disabled = state.running;
	elements["import-config"].disabled = state.running;
	document.querySelectorAll("input, select").forEach(element => {
		if (element.id !== "chart-select") element.disabled = state.running;
	});
}

async function useLevel(filename) {
	if (!filename || !filename.toLowerCase().endsWith(".ssc")) {
		throw new Error("请选择 .ssc 谱面文件。");
	}
	state.levelPath = platform.path.resolve(filename);
	state.levelReady = false;
	state.outputManuallyChosen = false;
	state.outputPath = replaceOutputExtension(state.levelPath, platform.path, elements["output-format"].value);
	elements["level-name"].textContent = basename(filename);
	elements["level-path"].textContent = state.levelPath;
	setOutputDisplay();
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
	state.levelReady = true;
	setStatus("", "READY", "可以开始录制", `${charts.length} 个难度`);
	elements["reveal-output"].hidden = true;
	state.progress = 0;
	setProgress(0);
	updateActions();
	scheduleAutoSave();
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
	setOutputDisplay();
	updateActions();
	scheduleAutoSave();
}

function changeOutputFormat() {
	if (state.outputPath) {
		state.outputPath = replaceOutputExtension(state.outputPath, platform.path, elements["output-format"].value);
		setOutputDisplay();
	} else {
		updateOutputFilename(true);
	}
	scheduleAutoSave();
}

function applyQualityPreset(name) {
	if (name === "custom") return;
	const preset = settingsForPreset(name);
	elements["video-width"].value = String(preset.width);
	elements["video-height"].value = String(preset.height);
	elements["video-fps"].value = String(preset.fps);
}

function configSettings(config) {
	const settings = config?.settings && typeof config.settings === "object" ? config.settings : config;
	if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error("配置文件缺少有效的 settings 对象。");
	return settings;
}

function booleanValue(value) {
	if (typeof value === "string") return !["", "0", "false", "no", "off"].includes(value.trim().toLowerCase());
	return Boolean(value);
}

function setAdvancedValues(settings) {
	for (const [key, control] of advancedControls) {
		if (!Object.hasOwn(settings, key)) continue;
		const value = settings[key];
		if (control.type === "checkbox") {
			customValues[key] = booleanValue(value);
			control.checked = customValues[key];
		} else if (control.type === "file") {
			customValues[key] = Array.isArray(value) ? value.filter(Boolean).map(String) : value == null ? "" : String(value);
		} else if (control.multiple) {
			customValues[key] = Array.isArray(value) ? value.filter(Boolean).map(String) : [];
		} else if (Array.isArray(value)) {
			customValues[key] = value.filter(Boolean).map(String);
			control.value = customValues[key].join(", ");
		} else {
			customValues[key] = value == null ? "" : value;
			control.value = value == null ? "" : String(value);
		}
	}
}

function setMainValues(settings) {
	const setValue = (id, value) => {
		if (value != null) elements[id].value = String(value);
	};
	setValue("video-width", settings.width);
	setValue("video-height", settings.height);
	setValue("video-fps", settings.fps);
	setValue("speed", settings.speed);
	setValue("nickname", settings.nickname);
	setValue("avatar-source", settings.avatar);
	setValue("avatar-online", settings.avatarOnline);
	setValue("avatar-gravatar", settings.avatarGravatar);
	if (settings.avatarUpload != null) customValues.avatarUpload = String(settings.avatarUpload);
	setAvatarUploadDisplay(customValues.avatarUpload);
	setValue("results-duration", settings.resultsDuration);
	elements["wait-music"].checked = booleanValue(settings.waitForMusic);
	elements["system-fonts"].checked = booleanValue(settings.avoidDownloadingFonts);
	updateAvatarFields();
}

async function restoreLevel(filename, preferredChart = "") {
	if (!filename) return;
	state.levelPath = platform.path.resolve(filename);
	state.levelReady = false;
	elements["level-name"].textContent = basename(state.levelPath);
	elements["level-path"].textContent = state.levelPath;
	elements["chart-select"].innerHTML = '<option value="">自动选择</option>';
	try {
		const charts = await platform.inspectLevel(state.levelPath);
		for (const chart of charts) {
			const option = document.createElement("option");
			option.value = chart.value;
			option.textContent = chart.label;
			elements["chart-select"].append(option);
		}
		if (preferredChart && charts.some(chart => chart.value === preferredChart)) elements["chart-select"].value = preferredChart;
		else if (charts.length === 1) elements["chart-select"].value = charts[0].value;
		state.levelReady = true;
		setStatus("", "READY", "可以开始录制", `${charts.length} 个难度`);
	} catch (error) {
		appendLog(`最近配置中的谱面不可用：${error.message}`, "stderr");
		setStatus("", "READY", "请选择谱面", "上次路径不可用");
	}
	updateActions();
}

async function applyConfig(config) {
	const settings = configSettings(config);
	setAdvancedValues(settings);
	setMainValues(settings);
	const ui = config?.ui && typeof config.ui === "object" ? config.ui : {};
	const savedFormat = String(ui.outputFormat || "");
	if (["mkv", "mp4", "webm", "mov", "avi", "ts"].includes(savedFormat)) elements["output-format"].value = savedFormat;
	const quality = String(ui.quality || "custom");
	const qualityInput = document.querySelector(`input[name="quality"][value="${CSS.escape(quality)}"]`);
	if (qualityInput) {
		qualityInput.checked = true;
		if (quality !== "custom") applyQualityPreset(quality);
	}
	const savedState = config?.state && typeof config.state === "object" ? config.state : {};
	const levelPath = savedState.levelPath || settings.levelFileUpload || "";
	state.outputPath = savedState.outputPath || settings.outputPath || settings.output || "";
	state.outputManuallyChosen = booleanValue(savedState.outputManuallyChosen);
	customValues.output = state.outputPath || customValues.output;
	customValues.levelFileUpload = levelPath;
	if (config && Object.hasOwn(config, "autoSave")) state.autoSave = booleanValue(config.autoSave);
	elements["auto-save-config"].checked = state.autoSave;
	if (state.outputPath) setOutputDisplay();
	else elements["output-filename"].value = basename(settings.output || "output.mkv");
	if (levelPath) await restoreLevel(levelPath, settings.chartSelect || "");
	updateActions();
}

async function saveConfigFile() {
	if (state.running) return;
	const filename = await platform.chooseFile({ accept: ".json,application/json", saveAs: "ssr-gui-config.json" });
	if (!filename) return;
	const saved = await platform.writeConfig(filename, captureConfig());
	setConfigStatus(`已保存：${basename(saved)}`);
	appendLog(`配置已保存：${saved}`);
}

async function importConfigFile() {
	if (state.running) return;
	const filename = await platform.chooseFile({ accept: ".json,application/json" });
	if (!filename) return;
	const config = await platform.readConfig(filename);
	await applyConfig(config);
	setConfigStatus(`已导入：${basename(filename)}`);
	appendLog(`配置已导入：${filename}`);
	scheduleAutoSave();
}

document.querySelectorAll('input[name="quality"]').forEach(input => {
	input.addEventListener("change", () => {
		if (input.checked) applyQualityPreset(input.value);
		scheduleAutoSave();
	});
});
elements["output-format"].addEventListener("change", changeOutputFormat);
elements["output-filename"].addEventListener("input", () => updateOutputFilename(false));
elements["output-filename"].addEventListener("change", () => updateOutputFilename(true));
elements["avatar-source"].addEventListener("change", () => {
		updateAvatarFields();
		scheduleAutoSave();
});
elements["avatar-upload"].addEventListener("change", () => {
	customValues.avatarUpload = selectedFilePath(elements["avatar-upload"]);
	setAvatarUploadDisplay(customValues.avatarUpload);
	scheduleAutoSave();
});
for (const id of ["video-width", "video-height", "video-fps"]) {
	elements[id].addEventListener("input", () => {
		const custom = document.querySelector('input[name="quality"][value="custom"]');
		if (custom) custom.checked = true;
		scheduleAutoSave();
	});
}
elements["auto-save-config"].addEventListener("change", () => {
	state.autoSave = elements["auto-save-config"].checked;
	setConfigStatus(state.autoSave ? "自动保存已启用" : "自动保存已停用");
	if (state.autoSave) scheduleAutoSave();
});
elements["record-form"].addEventListener("input", event => {
	if (event.target?.id !== "auto-save-config") scheduleAutoSave();
});
elements["record-form"].addEventListener("change", event => {
	if (event.target?.id !== "auto-save-config") scheduleAutoSave();
});

async function beginRecording(event) {
	event.preventDefault();
	if (state.running || !state.runtimeReady) return;
	state.running = true;
	state.startedAt = Date.now();
	state.progress = 2;
	state.phase = "";
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
		const config = await platform.loadAutoConfig();
		if (config) {
			await applyConfig(config);
			setConfigStatus("已恢复最近配置");
		}
	} catch (error) {
		setConfigStatus("最近配置读取失败", true);
		appendLog(error.stack || error.message || String(error), "stderr");
	}
	state.configReady = true;
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
elements["save-config"].addEventListener("click", () => saveConfigFile().catch(error => {
		setConfigStatus(`保存失败：${error.message}`, true);
		appendLog(error.message, "stderr");
}));
elements["import-config"].addEventListener("click", () => importConfigFile().catch(error => {
		setConfigStatus(`导入失败：${error.message}`, true);
		appendLog(error.message, "stderr");
}));
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
updateAvatarFields();

nw.Window.get().on("close", function onClose() {
	if (state.running) return platform.cancel().finally(() => this.close(true));
	if (!state.configReady || !state.autoSave) return this.close(true);
	clearTimeout(state.configTimer);
	platform.saveAutoConfig(captureConfig()).catch(error => appendLog(`关闭前自动保存失败：${error.message}`, "stderr")).finally(() => this.close(true));
});

initialize();
