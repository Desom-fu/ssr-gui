// End-to-end check: drive the embedded cover generator exactly the way the GUI does.
// Usage: node tests/cover-e2e.mjs <stage-dir> <level.ssc> [chartSelect] [out.png]
import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { buildCoverArgs } from "../app/core.mjs";

const [stageDirectory, levelPath, chartSelect = "", output = ""] = process.argv.slice(2);
if (!stageDirectory || !levelPath) {
	console.error("usage: node tests/cover-e2e.mjs <stage-dir> <level.ssc> [chartSelect] [out.png]");
	process.exit(2);
}
const executable = name => process.platform === "win32" ? `${name}.exe` : name;
const runtime = {
	node: path.join(stageDirectory, "runtime", executable("node")),
	coverCli: path.join(stageDirectory, "recorder", "cli-cover-gen.mjs"),
	// The recorder caches downloaded assets (fonts, etc.) inside its temp
	// directory. Reuse a persistent cache like the GUI does; a fresh empty
	// directory forces online downloads that can stall on slow networks.
	temp: process.env.SSR_E2E_TEMP || process.env.TEMP || process.env.TMPDIR || path.join(stageDirectory, "e2e-temp"),
};
const outputPath = output || path.join(path.dirname(levelPath), `${path.basename(levelPath, path.extname(levelPath))}-cover-e2e.png`);
const args = buildCoverArgs({
	cliPath: runtime.coverCli,
	levelPath,
	outputPath,
	output: outputPath,
	tempDir: runtime.temp,
	chartSelect: chartSelect || null,
	nickname: "E2E Cover Test",
});
console.log("spawn:", runtime.node, args.join(" "));
const child = spawn(runtime.node, args, {
	cwd: path.dirname(runtime.coverCli),
	stdio: ["ignore", "pipe", "pipe"],
	windowsHide: true,
	env: {
		...process.env,
		NO_COLOR: "1",
		PATH: `${path.dirname(path.join(stageDirectory, "runtime", executable("ffmpeg")))}${path.delimiter}${process.env.PATH || ""}`,
		PANGOCAIRO_BACKEND: "fontconfig",
		FONTCONFIG_FILE: path.join(stageDirectory, "app", "fonts.conf"),
	},
});
let code = null;
child.stdout.on("data", chunk => process.stdout.write(chunk));
child.stderr.on("data", chunk => process.stderr.write(chunk));
child.once("exit", exitCode => { code = exitCode; });
await new Promise((resolve, reject) => {
	const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("cover generation timed out")); }, 300_000);
	child.once("error", error => { clearTimeout(timer); reject(error); });
	child.once("exit", () => { clearTimeout(timer); resolve(); });
});
if (code !== 0) throw new Error(`cover generator exited with ${code}`);
const info = await stat(outputPath);
const header = await readFile(outputPath).then(buffer => buffer.subarray(0, 8));
const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
if (!isPng) throw new Error(`output is not a PNG: ${outputPath}`);
console.log(`E2E OK: ${outputPath} (${info.size} bytes, valid PNG header)`);
