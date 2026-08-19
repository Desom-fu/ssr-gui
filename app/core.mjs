export const QUALITY_PRESETS = Object.freeze({
	compact: Object.freeze({ width: 1280, height: 720, fps: 30 }),
	standard: Object.freeze({ width: 1920, height: 1080, fps: 60 }),
	high: Object.freeze({ width: 2560, height: 1440, fps: 60 }),
});

const field = (key, type, defaultValue, extra = {}) => Object.freeze({ key, type, defaultValue, ...extra });

// Keep this list in lockstep with sunniesnow-record/record.mjs DEFAULT_SETTINGS.
export const RECORDER_FIELDS = Object.freeze([
	field("levelFile", "select", "upload", { options: ["upload", "online"] }), field("levelFileOnline", "text", ""), field("levelFileUpload", "file", null, { accept: ".ssc,application/zip" }), field("musicSelect", "text", null), field("chartSelect", "text", null), field("lyrica5", "boolean", true),
	field("speed", "number", 2, { min: 0, max: 20, step: 0.1 }), field("tipPointSpeed", "number", 1, { min: 0, max: 20, step: 0.1 }), field("tipPointDistance", "number", 1, { min: 0, max: 20, step: 0.1 }), field("noteSize", "number", 1, { min: 0.1, max: 5, step: 0.1 }),
	field("background", "select", "from-level", { options: ["from-level", "online", "upload"] }), field("backgroundOnline", "text", "default.svg"), field("backgroundFromLevel", "text", null), field("backgroundUpload", "file", null, { accept: "image/*" }), field("backgroundBlur", "number", 20, { min: 0, max: 100, step: 1 }), field("backgroundBrightness", "number", 0.5, { min: 0, max: 1, step: 0.05 }),
	field("skin", "select", "default", { options: ["default", "online", "upload"] }), field("skinOnline", "text", ""), field("skinUpload", "file", null, { accept: ".ssp,application/zip" }), field("fx", "select", "default", { options: ["default", "online", "upload"] }), field("fxOnline", "text", ""), field("fxUpload", "file", null, { accept: ".ssp,application/zip" }), field("hudTopCenter", "text", "combo"), field("hudTopLeft", "text", "title"), field("hudTopRight", "text", "score"),
	field("doubleLineTap", "boolean", true), field("doubleLineHold", "boolean", false), field("doubleLineDrag", "boolean", false), field("doubleLineFlick", "boolean", false), field("doubleLineDragFlick", "boolean", false), field("forceDoubleLine", "boolean", false), field("opacityFake", "number", 1, { min: 0, max: 1, step: 0.05 }), field("hideFxInFront", "boolean", false), field("hideFxPerfect", "boolean", false), field("hideFxHoldStart", "boolean", false),
	field("scrollJudgementLine", "number", 0.8, { min: 0, max: 1, step: 0.05 }), field("scrollDistance", "number", 1, { min: 0, max: 10, step: 0.1 }), field("hideTipPoints", "boolean", false), field("hideNotes", "boolean", false), field("hideCircles", "boolean", false), field("hideBgNotes", "boolean", false), field("hideFx", "boolean", false), field("hideBgPattern", "boolean", false), field("fadingStart", "number", 1, { min: 0, max: 10, step: 0.05 }), field("fadingDuration", "number", 0.2, { min: 0, max: 10, step: 0.05 }), field("reverseNoteOrder", "boolean", false), field("circleMovesWithNote", "boolean", false), field("disableOrnament", "boolean", false),
	field("se", "select", "default", { options: ["default", "online", "upload"] }), field("seOnline", "text", ""), field("seUpload", "file", null, { accept: ".ssp,application/zip" }), field("volumeSe", "number", 1, { min: 0, max: 2, step: 0.05 }), field("volumeMusic", "number", 1, { min: 0, max: 2, step: 0.05 }), field("delay", "number", 0, { min: -60, max: 60, step: 0.01 }), field("scroll", "boolean", false), field("chartOffset", "number", 0, { min: -60, max: 60, step: 0.01 }), field("gameSpeed", "number", 1, { min: 0.05, max: 10, step: 0.05 }), field("horizontalFlip", "boolean", false), field("verticalFlip", "boolean", false), field("start", "number", 0, { min: 0, max: 1, step: 0.01 }), field("end", "number", 1, { min: 0, max: 1, step: 0.01 }), field("beginningPreparationTime", "number", 1, { min: 0, max: 60, step: 0.1 }),
	field("nickname", "text", "New Poet"), field("avatar", "select", "online", { options: ["online", "upload", "gravatar"] }), field("avatarOnline", "text", "default.svg"), field("avatarUpload", "file", null, { accept: "image/*" }), field("avatarGravatar", "text", ""), field("width", "number", 1920, { min: 320, max: 7680, step: 1 }), field("height", "number", 1080, { min: 180, max: 4320, step: 1 }), field("avoidDownloadingFonts", "boolean", false), field("plugin", "array", []), field("pluginOnline", "array", []), field("pluginUpload", "file-array", [], { accept: ".ssp,application/zip" }),
	field("help", "boolean", false), field("fps", "number", 60, { min: 1, max: 240, step: 1 }), field("quiet", "boolean", false), field("suppressWarnings", "boolean", false), field("tempDir", "path", null), field("output", "path", "output.mkv"), field("resultsDuration", "number", 1, { min: 0, max: 60, step: 0.1 }), field("waitForMusic", "boolean", false), field("clean", "boolean", false), field("ffmpeg", "path", ""), field("ffmpegOptions", "text", ""), field("ffmpegOutputOptions", "text", ""),
]);

export const RECORDER_DEFAULTS = Object.freeze(Object.fromEntries(RECORDER_FIELDS.map(item => [item.key, item.defaultValue])));
export const FIELD_LABELS = Object.assign(Object.fromEntries(RECORDER_FIELDS.map(item => [item.key, item.key])), {
	levelFile: "谱面来源", levelFileOnline: "在线谱面名", levelFileUpload: "谱面文件", musicSelect: "音乐文件", chartSelect: "难度文件", lyrica5: "Lyrica 5 判定", speed: "音符速度", tipPointSpeed: "引导点速度", tipPointDistance: "引导点距离", noteSize: "音符大小", background: "背景来源", backgroundOnline: "在线背景", backgroundFromLevel: "谱面背景", backgroundUpload: "背景文件", backgroundBlur: "背景模糊", backgroundBrightness: "背景亮度", skin: "皮肤来源", skinOnline: "在线皮肤", skinUpload: "皮肤插件", fx: "特效来源", fxOnline: "在线特效", fxUpload: "特效插件", hudTopCenter: "顶部中间 HUD", hudTopLeft: "顶部左侧 HUD", hudTopRight: "顶部右侧 HUD", doubleLineTap: "点按双线", doubleLineHold: "长押双线", doubleLineDrag: "拖键双线", doubleLineFlick: "划键双线", doubleLineDragFlick: "拖划双线", forceDoubleLine: "强制双线", opacityFake: "Fake 透明度", hideFxInFront: "隐藏前景特效", hideFxPerfect: "隐藏 Perfect 特效", hideFxHoldStart: "隐藏长押起始特效", scrollJudgementLine: "滚动判定线", scrollDistance: "滚动距离", hideTipPoints: "隐藏引导点", hideNotes: "隐藏音符", hideCircles: "隐藏圆环", hideBgNotes: "隐藏背景音符", hideFx: "隐藏特效", hideBgPattern: "隐藏背景图案", fadingStart: "淡出开始", fadingDuration: "淡出时长", reverseNoteOrder: "反转音符顺序", circleMovesWithNote: "圆环跟随音符", disableOrnament: "禁用装饰", se: "音效来源", seOnline: "在线音效", seUpload: "音效插件", volumeSe: "音效音量", volumeMusic: "音乐音量", delay: "音频延迟", scroll: "滚动模式", chartOffset: "谱面偏移", gameSpeed: "游戏速度", horizontalFlip: "水平翻转", verticalFlip: "垂直翻转", start: "开始比例", end: "结束比例", beginningPreparationTime: "开头准备时间", nickname: "昵称", avatar: "头像来源", avatarOnline: "在线头像", avatarUpload: "头像文件", avatarGravatar: "Gravatar 邮箱", width: "视频宽度", height: "视频高度", avoidDownloadingFonts: "使用系统字体", plugin: "插件来源", pluginOnline: "在线插件", pluginUpload: "插件文件", help: "打印帮助后退出", fps: "帧率", quiet: "静默输出", suppressWarnings: "抑制警告", tempDir: "临时目录", output: "输出文件", resultsDuration: "结算画面时长", waitForMusic: "等待音乐结束", clean: "清理缓存", ffmpeg: "FFmpeg 路径", ffmpegOptions: "FFmpeg 输入参数", ffmpegOutputOptions: "FFmpeg 输出参数",
});

export const FIELD_GROUPS = Object.freeze([
	{ id: "source", label: "资源与谱面" }, { id: "visual", label: "画面与音频" }, { id: "game", label: "播放与用户" }, { id: "runtime", label: "渲染与 FFmpeg" },
]);
export function fieldGroup(key) {
	if (["levelFile", "levelFileOnline", "levelFileUpload", "musicSelect", "chartSelect"].includes(key)) return "source";
	if (["width", "height", "fps", "tempDir", "output", "resultsDuration", "waitForMusic", "clean", "ffmpeg", "ffmpegOptions", "ffmpegOutputOptions", "help", "quiet", "suppressWarnings", "avoidDownloadingFonts"].includes(key)) return "runtime";
	if (["scroll", "chartOffset", "gameSpeed", "horizontalFlip", "verticalFlip", "start", "end", "beginningPreparationTime", "nickname", "avatar", "avatarOnline", "avatarUpload", "avatarGravatar"].includes(key)) return "game";
	return "visual";
}

function finiteNumber(value, name, definition = {}) {
	const number = Number(value);
	if (!Number.isFinite(number) || (definition.min != null && number < definition.min) || (definition.max != null && number > definition.max)) throw new TypeError(`${name} must be between ${definition.min ?? "-Infinity"} and ${definition.max ?? "Infinity"}.`);
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
export function resolveRecorderOutputPath(settings = {}) {
	const outputPath = settings.outputPath || settings.output;
	if (!String(outputPath || "").trim()) throw new TypeError("output path is required.");
	return String(outputPath);
}
function slug(key) { return key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`); }
function valueFor(definition, value) {
	if (definition.type === "boolean") return String(Boolean(value));
	if (definition.type === "array" || definition.type === "file-array") return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
	if (definition.type === "file" || definition.type === "path") return value == null ? "" : String(value);
	return value == null ? "" : String(value);
}
export function buildRecorderArgs(settings) {
	if (!String(settings.cliPath || "").trim()) throw new TypeError("cliPath is required.");
	if (Object.hasOwn(settings, "outputPath") && !String(settings.outputPath || "").trim()) throw new TypeError("outputPath is required.");
	const values = { ...RECORDER_DEFAULTS, ...settings };
	values.levelFileUpload ||= settings.levelPath;
	if (!Object.hasOwn(settings, "output") && settings.outputPath) values.output = settings.outputPath;
	values.ffmpeg ||= settings.ffmpegPath;
	values.tempDir ||= settings.tempDir;
	if (values.levelFile === "upload" && !String(values.levelFileUpload || "").trim()) throw new TypeError("levelFileUpload is required for upload mode.");
	if (values.levelFile === "online" && !String(values.levelFileOnline || "").trim()) throw new TypeError("levelFileOnline is required for online mode.");
	for (const definition of RECORDER_FIELDS) if (definition.type === "number") values[definition.key] = finiteNumber(values[definition.key], definition.key, definition);
	const args = [settings.cliPath];
	for (const definition of RECORDER_FIELDS) {
		const converted = valueFor(definition, values[definition.key]);
		for (const item of (Array.isArray(converted) ? converted : [converted])) if (item !== "") args.push(`--${slug(definition.key)}`, item);
	}
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
