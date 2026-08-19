import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectDirectory, "build", "nw");

function run(command, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { cwd: projectDirectory, stdio: "inherit", windowsHide: false });
		child.once("error", reject);
		child.once("exit", code => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)));
	});
}

if (!existsSync(outputDirectory)) {
	await run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"]);
}

let executable;
if (process.platform === "win32") executable = path.join(outputDirectory, "ssr-gui.exe");
else if (process.platform === "darwin") executable = path.join(outputDirectory, "ssr-gui.app", "Contents", "MacOS", "ssr-gui");
else executable = path.join(outputDirectory, "ssr-gui");
await run(executable, []);

