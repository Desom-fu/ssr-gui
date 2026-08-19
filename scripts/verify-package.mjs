import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stageDirectory = path.join(projectDirectory, "build", "stage");
const executable = name => process.platform === "win32" ? `${name}.exe` : name;
const node = path.join(stageDirectory, "runtime", executable("node"));
const ffmpeg = path.join(stageDirectory, "runtime", executable("ffmpeg"));
const cli = path.join(stageDirectory, "recorder", "cli.mjs");

function run(command, args, timeout = 30_000) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: stageDirectory,
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
		});
		let output = "";
		child.stdout.on("data", chunk => { output += chunk; });
		child.stderr.on("data", chunk => { output += chunk; });
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			reject(new Error(`${command} timed out.`));
		}, timeout);
		child.once("error", error => { clearTimeout(timer); reject(error); });
		child.once("exit", code => {
			clearTimeout(timer);
			code === 0 ? resolve(output.trim()) : reject(new Error(output.trim() || `${command} exited with ${code}`));
		});
	});
}

for (const filename of [
	node,
	ffmpeg,
	cli,
	path.join(stageDirectory, "app", "index.html"),
	path.join(stageDirectory, "app", "fonts.conf"),
	path.join(stageDirectory, "licenses", "Node.js-LICENSE.txt"),
	path.join(stageDirectory, "licenses", "NW.js-LICENSE.txt"),
	path.join(stageDirectory, "licenses", "Lucide-LICENSE.txt"),
	path.join(stageDirectory, "licenses", "FFmpeg-LICENSE.txt"),
]) await access(filename);
const buildInformation = JSON.parse(await readFile(path.join(stageDirectory, "build-info.json"), "utf8"));
if (process.env.SSR_EXPECT_BUNDLED_FONTS === "1") {
	if (buildInformation.bundledFonts !== true) throw new Error("Package is not marked as the bundled-font edition.");
	for (const filename of [
		"NotoSansMath-Regular.ttf", "NotoSansCJKtc-Regular.otf", "wt071.ttf",
		"YujiBoku-Regular.ttf", "LXGWWenKai-Regular.ttf", "SOURCES.json",
	]) await access(path.join(stageDirectory, "recorder", "game", "fonts", filename));
	for (const filename of [
		"NotoSansMath-OFL.txt", "NotoSansCJK-LICENSE.txt", "HanWang-GPL-2.0.txt",
		"YujiBoku-OFL.txt", "LXGWWenKai-OFL.txt",
	]) await access(path.join(stageDirectory, "licenses", "fonts", filename));
	const gameSources = await Promise.all([
		"js/ui/gameplay/TopCenterHud.js",
		"js/ui/event/bg-pattern/UiBigText.js",
		"js/ui/event/note/UiBgNote.js",
	].map(filename => readFile(path.join(stageDirectory, "recorder", "game", filename), "utf8")));
	for (const filename of [
		"NotoSansMath-Regular.ttf", "NotoSansCJKtc-Regular.otf", "wt071.ttf",
		"YujiBoku-Regular.ttf", "LXGWWenKai-Regular.ttf",
	]) {
		if (!gameSources.some(source => source.includes(`/game/fonts/${filename}`))) {
			throw new Error(`Bundled font URL was not patched: ${filename}`);
		}
	}
}
console.log(await run(node, ["--version"]));
await run(node, ["-e", "require('./node_modules/gl')"]);
console.log("headless-gl ABI verified.");
console.log((await run(ffmpeg, ["-version"])).split(/\r?\n/)[0]);
if (process.env.SSR_VERIFY_RECORDER === "1") {
	const help = await run(node, [cli, "--help", "true"], 90_000);
	if (!help.includes("Usage: sunniesnow-record")) throw new Error("Recorder help output is invalid.");
	console.log("sunniesnow-record startup verified.");
}
console.log("Packaged runtime verified.");
