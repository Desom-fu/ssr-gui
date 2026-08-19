import { buildRecorderArgs, stripAnsi } from "./core.mjs";

const fs = nw.require("node:fs");
const path = nw.require("node:path");
const os = nw.require("node:os");
const { spawn } = nw.require("node:child_process");
const JSZip = nw.require("jszip");

function findPackageDirectory() {
	const executableDirectory = path.dirname(process.execPath);
	const candidates = [
		path.join(executableDirectory, "package.nw"),
		path.resolve(executableDirectory, "..", "Resources", "app.nw"),
		path.resolve(nw.App.startPath),
	];
	const result = candidates.find(candidate => fs.existsSync(path.join(candidate, "package.json")));
	if (!result) throw new Error(`Cannot locate packaged application files from ${process.execPath}.`);
	return result;
}

const packageDirectory = findPackageDirectory();

function executableName(name) {
	return process.platform === "win32" ? `${name}.exe` : name;
}

function splitLines(callback) {
	let pending = "";
	return {
		write(chunk) {
			pending += stripAnsi(chunk.toString());
			const lines = pending.split(/\r\n|\n|\r/);
			pending = lines.pop() || "";
			for (const line of lines) if (line.trim()) callback(line.trim());
		},
		end() {
			if (pending.trim()) callback(pending.trim());
			pending = "";
		},
	};
}

export class DesktopPlatform {
	constructor() {
		this.path = path;
		this.child = null;
		this.cancelled = false;
	}

	get paths() {
		return {
			node: path.join(packageDirectory, "runtime", executableName("node")),
			cli: path.join(packageDirectory, "recorder", "cli.mjs"),
			ffmpeg: nw.require("ffmpeg-static"),
			temp: path.join(nw.App.dataPath, "render-cache"),
		};
	}

	async verifyRuntime() {
		const runtime = this.paths;
		for (const [name, filename] of Object.entries(runtime)) {
			if (name === "temp") continue;
			await fs.promises.access(filename, fs.constants.R_OK);
		}
		await fs.promises.mkdir(runtime.temp, { recursive: true });
		return runtime;
	}

	async inspectLevel(filename) {
		const archive = await JSZip.loadAsync(await fs.promises.readFile(filename));
		const entries = Object.values(archive.files)
			.filter(entry => !entry.dir && entry.name.toLowerCase().endsWith(".json"));
		if (!entries.length) throw new Error("The level contains no chart JSON files.");
		return Promise.all(entries.map(async entry => {
			let label = entry.name;
			try {
				const document = JSON.parse(await entry.async("string"));
				const difficulty = document.difficultyName || document.difficulty || "";
				if (difficulty) label = `${difficulty}  ·  ${entry.name}`;
			} catch {
				// sunniesnow-record will report malformed chart details during rendering.
			}
			return { value: entry.name, label };
		}));
	}

	chooseFile({ accept = "", saveAs = "" } = {}) {
		return new Promise(resolve => {
			const input = document.createElement("input");
			input.type = "file";
			input.accept = accept;
			input.hidden = true;
			if (saveAs) input.setAttribute("nwsaveas", saveAs);
			let settled = false;
			const finish = value => {
				if (settled) return;
				settled = true;
				window.removeEventListener("focus", onFocus);
				input.remove();
				resolve(value || "");
			};
			const selected = () => input.files?.[0]?.path || input.value || "";
			const onFocus = () => setTimeout(() => finish(selected()), 250);
			input.addEventListener("change", () => finish(selected()), { once: true });
			input.addEventListener("cancel", () => finish(""), { once: true });
			window.addEventListener("focus", onFocus, { once: true });
			document.body.append(input);
			input.click();
		});
	}

	async record(settings, handlers = {}) {
		if (this.child) throw new Error("A recording is already running.");
		const runtime = await this.verifyRuntime();
		await fs.promises.mkdir(path.dirname(settings.outputPath), { recursive: true });
		const args = buildRecorderArgs({
			...settings,
			cliPath: runtime.cli,
			ffmpegPath: runtime.ffmpeg,
			tempDir: runtime.temp,
		});
		this.cancelled = false;
		const child = spawn(runtime.node, args, {
			cwd: path.dirname(runtime.cli),
			detached: process.platform !== "win32",
			env: { ...process.env, NO_COLOR: "1" },
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
		});
		this.child = child;
		const stdout = splitLines(line => handlers.onOutput?.(line, "stdout"));
		const stderr = splitLines(line => handlers.onOutput?.(line, "stderr"));
		child.stdout.on("data", chunk => stdout.write(chunk));
		child.stderr.on("data", chunk => stderr.write(chunk));

		return new Promise((resolve, reject) => {
			child.once("error", error => {
				this.child = null;
				reject(error);
			});
			child.once("exit", (code, signal) => {
				stdout.end();
				stderr.end();
				this.child = null;
				if (this.cancelled) return resolve({ cancelled: true, code, signal });
				if (code === 0) return resolve({ cancelled: false, code, signal });
				reject(new Error(`sunniesnow-record exited with code ${code ?? signal ?? "unknown"}.`));
			});
		});
	}

	async cancel() {
		const child = this.child;
		if (!child) return;
		this.cancelled = true;
		if (process.platform === "win32") {
			await new Promise(resolve => {
				const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
					stdio: "ignore", windowsHide: true,
				});
				killer.once("error", resolve);
				killer.once("exit", resolve);
			});
		} else {
			try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
		}
	}

	reveal(filename) {
		nw.Shell.showItemInFolder(filename);
	}
}
