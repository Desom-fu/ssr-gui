import { access } from "node:fs/promises";
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
	path.join(stageDirectory, "licenses", "Node.js-LICENSE.txt"),
	path.join(stageDirectory, "licenses", "NW.js-LICENSE.txt"),
	path.join(stageDirectory, "licenses", "Lucide-LICENSE.txt"),
	path.join(stageDirectory, "licenses", "FFmpeg-LICENSE.txt"),
]) await access(filename);
console.log(await run(node, ["--version"]));
console.log((await run(ffmpeg, ["-version"])).split(/\r?\n/)[0]);
if (process.env.SSR_VERIFY_RECORDER === "1") {
	const help = await run(node, [cli, "--help", "true"], 90_000);
	if (!help.includes("Usage: sunniesnow-record")) throw new Error("Recorder help output is invalid.");
	console.log("sunniesnow-record startup verified.");
}
console.log("Packaged runtime verified.");
