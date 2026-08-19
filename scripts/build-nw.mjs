import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nwbuild from "nw-builder";
import sharp from "sharp";
import { builderApplicationOptions, PACKAGED_WINDOW_ICON } from "./nw-build-config.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const buildDirectory = path.join(projectDirectory, "build");
const stageDirectory = path.join(buildDirectory, "stage");
const outputDirectory = path.join(buildDirectory, "nw");
const cacheDirectory = path.join(projectDirectory, "node_modules", ".cache", "ssr-gui");
const TARGET_PLATFORM = process.env.SSR_TARGET_PLATFORM || process.platform;
const TARGET_ARCH = ({ x86: "ia32", amd64: "x64", aarch64: "arm64" })[process.env.SSR_TARGET_ARCH] || process.env.SSR_TARGET_ARCH || process.arch;
const RUNTIME_ARCH = ({ x86: "ia32", amd64: "x64", aarch64: "arm64" })[process.env.SSR_RUNTIME_ARCH] || process.env.SSR_RUNTIME_ARCH || TARGET_ARCH;
const NW_PLATFORM = ({ win32: "win", darwin: "osx", linux: "linux" })[TARGET_PLATFORM] || TARGET_PLATFORM;
const BUNDLE_FONTS = process.env.SSR_BUNDLE_FONTS === "1" || process.argv.includes("--fonts");
if (!["win32", "darwin", "linux"].includes(TARGET_PLATFORM)) throw new Error(`Unsupported target platform: ${TARGET_PLATFORM}`);
if (!["ia32", "x64", "arm64"].includes(TARGET_ARCH)) throw new Error(`Unsupported target architecture: ${TARGET_ARCH}`);
if (!["ia32", "x64", "arm64"].includes(RUNTIME_ARCH)) throw new Error(`Unsupported runtime architecture: ${RUNTIME_ARCH}`);
const RECORDER_COMMIT = "b1a67fa6bbc7e8541583628d3d532300824d0c65";
const MIN_NODE_VERSION = "22.23.2";
const FONT_ASSETS = Object.freeze([
	{
		name: "NotoSansMath-Regular.ttf",
		family: "Noto Sans Math",
		url: "https://fastly.jsdelivr.net/gh/notofonts/math@53eb8eb200ed8fc73fa13d97d26a2c9c56428c17/fonts/NotoSansMath/full/ttf/NotoSansMath-Regular.ttf",
		rawUrl: "https://raw.githubusercontent.com/notofonts/math/53eb8eb200ed8fc73fa13d97d26a2c9c56428c17/fonts/NotoSansMath/full/ttf/NotoSansMath-Regular.ttf",
		sha256: "92CEA8BC749CE778118FC6D3B52DCCEAE3F59B6CFE00D241849BE09FECC006C2",
		license: "NotoSansMath-OFL.txt",
		licenseUrl: "https://raw.githubusercontent.com/notofonts/math/fbb2a1334f1d693c3c863b3b694ffadf75094b36/OFL.txt",
		licenseSha256: "403A95275B469061B7D4371C328E0ADA3BC7D63328ABE2E88AAD5CD243B2FE21",
		sourceUrl: "https://github.com/notofonts/math",
		localUrl: "/game/fonts/NotoSansMath-Regular.ttf",
	},
	{
		name: "NotoSansCJKtc-Regular.otf",
		family: "Noto Sans CJK TC",
		url: "https://fastly.jsdelivr.net/gh/notofonts/noto-cjk@f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/OTF/TraditionalChinese/NotoSansCJKtc-Regular.otf",
		rawUrl: "https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/OTF/TraditionalChinese/NotoSansCJKtc-Regular.otf",
		sha256: "DCE08BD4FD91AA8AA76ED8FEA4B694C2DFB8550F67871E326843212DDBEB88B4",
		license: "NotoSansCJK-LICENSE.txt",
		licenseUrl: "https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/LICENSE",
		licenseSha256: "6A73F9541C2DE74158C0E7CF6B0A58EF774F5A780BF191F2D7EC9CC53EFE2BF2",
		sourceUrl: "https://github.com/notofonts/noto-cjk",
		localUrl: "/game/fonts/NotoSansCJKtc-Regular.otf",
	},
	{
		name: "HanWangShinSuMedium.ttf",
		family: "HanWangShinSuMedium",
		url: "https://fastly.jsdelivr.net/gh/kaio/wangfonts@268666d80f8029bb8c61b9668352c7a375873301/TrueType/wt071.ttf",
		rawUrl: "https://raw.githubusercontent.com/kaio/wangfonts/268666d80f8029bb8c61b9668352c7a375873301/TrueType/wt071.ttf",
		sha256: "50A8C5F2C8CFE6D218EC2041DEB1902ADD56882348A86C518EAEAB685678C0FE",
		license: "HanWang-GPL-2.0.txt",
		licenseUrl: "https://raw.githubusercontent.com/kaio/wangfonts/268666d80f8029bb8c61b9668352c7a375873301/license.txt",
		licenseSha256: "DB511383A96A22DB478AE02390B8AB8EA8C7DA44020C8A4FB59B1B2D7BBA538E",
		sourceUrl: "https://github.com/kaio/wangfonts",
		localUrl: "/game/fonts/HanWangShinSuMedium.ttf",
	},
	{
		name: "YujiBoku-Regular.ttf",
		family: "YujiBoku",
		url: "https://fastly.jsdelivr.net/gh/Kinutafontfactory/Yuji@efec977b14b57c19eb85d468edcfbbad13139e67/fonts/ttf/YujiBoku-Regular.ttf",
		rawUrl: "https://raw.githubusercontent.com/Kinutafontfactory/Yuji/efec977b14b57c19eb85d468edcfbbad13139e67/fonts/ttf/YujiBoku-Regular.ttf",
		sha256: "94FDA16384F3BDAC24376A000C57E99ABFA314961BD89EF27BADFB7410322003",
		license: "YujiBoku-OFL.txt",
		licenseUrl: "https://raw.githubusercontent.com/Kinutafontfactory/Yuji/efec977b14b57c19eb85d468edcfbbad13139e67/OFL.txt",
		licenseSha256: "EF7C85C72AE94381C8BC4832AE4E6FBABDEAFA2BB8A31313CD75DCE95A690256",
		sourceUrl: "https://github.com/Kinutafontfactory/Yuji",
		localUrl: "/game/fonts/YujiBoku-Regular.ttf",
	},
	{
		name: "LXGWWenKai-Regular.ttf",
		family: "LXGW WenKai",
		url: "https://fastly.jsdelivr.net/gh/lxgw/LxgwWenKai@1.245.1/fonts/TTF/LXGWWenKai-Regular.ttf",
		rawUrl: "https://raw.githubusercontent.com/lxgw/LxgwWenKai/1.245.1/fonts/TTF/LXGWWenKai-Regular.ttf",
		sha256: "9D5FB31B282E4AC16B6B9AAA0D40C21E947AC6BD2A7F32C814D43F7F5F396BF9",
		license: "LXGWWenKai-OFL.txt",
		licenseUrl: "https://raw.githubusercontent.com/lxgw/LxgwWenKai/1.245.1/OFL.txt",
		licenseSha256: "C7BAA4A26B1723314991E3FF7925DCCBAA62A49DA13AEC4785EF73089301B218",
		sourceUrl: "https://github.com/lxgw/LxgwWenKai",
		localUrl: "/game/fonts/LXGWWenKai-Regular.ttf",
	},
]);

function assertInsideProject(target) {
	const resolved = path.resolve(target);
	if (!resolved.startsWith(`${projectDirectory}${path.sep}`)) {
		throw new Error(`Refusing to modify a path outside the project: ${resolved}`);
	}
	return resolved;
}

function compareVersions(left, right) {
	const parse = value => String(value).replace(/^v/, "").split(".").map(part => Number.parseInt(part, 10) || 0);
	const a = parse(left);
	const b = parse(right);
	for (let index = 0; index < 3; index += 1) {
		if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
	}
	return 0;
}

function runtimeVersion() {
	const version = process.versions.node;
	if (compareVersions(version, MIN_NODE_VERSION) < 0) {
		throw new Error(`Node.js ${MIN_NODE_VERSION} or newer is required; found ${version}.`);
	}
	return version;
}

function run(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
			cwd: options.cwd || projectDirectory,
			windowsHide: true,
			env: { ...process.env, ...options.env },
		});
		let stdout = "";
		let stderr = "";
		if (options.capture) {
			child.stdout.on("data", chunk => { stdout += chunk; });
			child.stderr.on("data", chunk => { stderr += chunk; });
		}
		child.once("error", reject);
		child.once("exit", code => code === 0
			? resolve(stdout.trim())
			: reject(new Error(stderr.trim() || `${command} exited with code ${code}`)));
	});
}

async function gitOutput(cwd, args) {
	return run("git", args, { cwd, capture: true });
}

async function relaunchWithNpmNode() {
	const requested = process.env.npm_node_execpath;
	if (!requested || process.env.SSR_BUILD_REEXEC === "1") return false;
	const current = path.resolve(process.execPath).toLowerCase();
	const target = path.resolve(requested).toLowerCase();
	if (current === target) return false;
	console.warn(`Re-launching the build with npm's Node.js runtime: ${requested}`);
	await run(requested, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
		env: { SSR_BUILD_REEXEC: "1" },
	});
	return true;
}

async function isRecorderSource(directory) {
	return existsSync(path.join(directory, "cli.mjs"))
		&& existsSync(path.join(directory, "record.mjs"))
		&& existsSync(path.join(directory, "sunniesnow.mjs"));
}

async function checkoutRecorder() {
	const configured = process.env.SSR_RECORD_SOURCE ? path.resolve(process.env.SSR_RECORD_SOURCE) : "";
	const sibling = path.resolve(projectDirectory, "..", "sunniesnow-record");
	for (const candidate of [configured, sibling].filter(Boolean)) {
		if (!await isRecorderSource(candidate)) continue;
		try {
			if (await gitOutput(candidate, ["rev-parse", "HEAD"]) === RECORDER_COMMIT) return candidate;
		} catch {
			if (configured) return candidate;
		}
	}
	const destination = path.join(cacheDirectory, `sunniesnow-record-${RECORDER_COMMIT}`);
	if (await isRecorderSource(destination)) return destination;
	await rm(assertInsideProject(destination), { recursive: true, force: true });
	await mkdir(path.dirname(destination), { recursive: true });
	await run("git", ["init", destination]);
	await run("git", ["remote", "add", "origin", "https://github.com/sunniesnow/sunniesnow-record.git"], { cwd: destination });
	await run("git", ["fetch", "--depth", "1", "origin", RECORDER_COMMIT], { cwd: destination });
	await run("git", ["checkout", "--detach", "FETCH_HEAD"], { cwd: destination });
	return destination;
}

async function gameCommit(recorderSource) {
	try {
		const line = await gitOutput(recorderSource, ["ls-tree", "HEAD", "game"]);
		return line.trim().split(/\s+/)[2] || "";
	} catch {
		return "";
	}
}

async function resolveGameSource(recorderSource) {
	const localGame = path.join(recorderSource, "game");
	if (existsSync(path.join(localGame, "js", "Game.js"))) return localGame;
	const commit = await gameCommit(recorderSource);
	if (!commit) throw new Error("The recorder game submodule is unavailable and its commit cannot be determined.");
	const destination = path.join(cacheDirectory, `sunniesnow-game-${commit}`);
	if (existsSync(path.join(destination, "js", "Game.js"))) return destination;
	await rm(assertInsideProject(destination), { recursive: true, force: true });
	await mkdir(path.dirname(destination), { recursive: true });
	await run("git", ["init", destination]);
	await run("git", ["remote", "add", "origin", "https://github.com/sunniesnow/sunniesnow.git"], { cwd: destination });
	await run("git", ["fetch", "--depth", "1", "origin", commit], { cwd: destination });
	await run("git", ["checkout", "--detach", "FETCH_HEAD"], { cwd: destination });
	return destination;
}

async function copyRecorder() {
	const source = await checkoutRecorder();
	const game = await resolveGameSource(source);
	const destination = path.join(stageDirectory, "recorder");
	await mkdir(destination, { recursive: true });
	for (const filename of ["cli.mjs", "record.mjs", "sunniesnow.mjs", "package.json", "LICENSE"]) {
		const sourceFile = path.join(source, filename);
		if (!existsSync(sourceFile)) throw new Error(`Missing recorder file: ${sourceFile}`);
		await cp(sourceFile, path.join(destination, filename));
	}
	await cp(game, path.join(destination, "game"), {
		recursive: true,
		filter(entry) {
			const name = path.basename(entry);
			return name !== ".git" && name !== ".github" && name !== "node_modules";
		},
	});
	let commit = "";
	try { commit = await gitOutput(source, ["rev-parse", "HEAD"]); } catch { /* source archive */ }
	return { source, commit };
}

async function copyProductionDependencies() {
	const lockfile = JSON.parse(await readFile(path.join(projectDirectory, "package-lock.json"), "utf8"));
	if (!lockfile.packages || typeof lockfile.packages !== "object") {
		throw new Error("package-lock.json must use lockfileVersion 2 or newer.");
	}
	const prefix = "node_modules/";
	const packages = Object.entries(lockfile.packages)
		.filter(([name, metadata]) => name.startsWith(prefix) && metadata.dev !== true)
		.map(([name, metadata]) => ({ name: name.slice(prefix.length), metadata }))
		.sort((left, right) => left.name.split("/").length - right.name.split("/").length
			|| left.name.localeCompare(right.name));
	const sourceDirectory = path.join(projectDirectory, "node_modules");
	const destinationDirectory = path.join(stageDirectory, "node_modules");
	await mkdir(destinationDirectory, { recursive: true });
	for (const { name: packageName, metadata } of packages) {
		if (metadata.link) throw new Error(`Linked production dependencies are unsupported: ${packageName}`);
		const source = path.join(sourceDirectory, ...packageName.split("/"));
		if (!existsSync(source)) {
			if (metadata.optional) continue;
			throw new Error(`Production dependency is missing: ${packageName}`);
		}
		const destination = path.join(destinationDirectory, ...packageName.split("/"));
		await mkdir(path.dirname(destination), { recursive: true });
		await cp(source, destination, {
			recursive: true,
			filter(entry) {
				const relative = path.relative(source, entry);
				return relative !== "node_modules" && !relative.startsWith(`node_modules${path.sep}`);
			},
		});
	}
}

async function copyRuntime() {
	const filename = TARGET_PLATFORM === "win32" ? "node.exe" : "node";
	if (TARGET_PLATFORM !== process.platform || RUNTIME_ARCH !== process.arch) {
		throw new Error(`Cross-target runtime packaging is unsupported: build on ${TARGET_PLATFORM}/${RUNTIME_ARCH} to package the current Node runtime.`);
	}
	const source = process.execPath;
	if (!existsSync(source)) throw new Error(`The current Node executable is missing: ${source}`);
	const destination = path.join(stageDirectory, "runtime", filename);
	await mkdir(path.dirname(destination), { recursive: true });
	await cp(source, destination);
	if (TARGET_PLATFORM !== "win32") await chmod(destination, 0o755);
}

async function copyFfmpeg() {
	const filename = TARGET_PLATFORM === "win32" ? "ffmpeg.exe" : "ffmpeg";
	const source = path.join(projectDirectory, "node_modules", "ffmpeg-static", filename);
	if (!existsSync(source)) throw new Error(`FFmpeg executable is missing: ${source}`);
	const destination = path.join(stageDirectory, "runtime", filename);
	await mkdir(path.dirname(destination), { recursive: true });
	await cp(source, destination);
	const licenseSource = `${source}.LICENSE`;
	if (existsSync(licenseSource)) {
		await mkdir(path.join(stageDirectory, "licenses"), { recursive: true });
		await cp(licenseSource, path.join(stageDirectory, "licenses", "FFmpeg-LICENSE.txt"));
	}
	if (TARGET_PLATFORM !== "win32") await chmod(destination, 0o755);
}

async function copyLucideIcons() {
	const destination = path.join(stageDirectory, "app", "icons");
	await mkdir(destination, { recursive: true });
	for (const name of ["file-up", "folder-output", "square", "folder-open", "trash-2"]) {
		const source = path.join(projectDirectory, "node_modules", "lucide-static", "icons", `${name}.svg`);
		if (!existsSync(source)) throw new Error(`Missing Lucide icon: ${name}`);
		await cp(source, path.join(destination, `${name}.svg`));
	}
}

async function ensureNativeAbi() {
	const probe = "require('./node_modules/gl')";
	try {
		await run(process.execPath, ["-e", probe], { capture: true });
		return;
	} catch {
		console.warn("Rebuilding gl for the current Node.js ABI...");
	}
	const nodeGyp = path.join(projectDirectory, "node_modules", "node-gyp", "bin", "node-gyp.js");
	if (!existsSync(nodeGyp)) throw new Error(`node-gyp is missing: ${nodeGyp}`);
	await run(process.execPath, [
		nodeGyp,
		"rebuild",
		"--directory",
		path.join(projectDirectory, "node_modules", "gl"),
		"--verbose",
	], {
		env: { npm_config_build_from_source: "true" },
	});
	await run(process.execPath, ["-e", probe], { capture: true });
}

async function verifiedDownload(asset, destination) {
	const verify = async filename => (await fileSha256(filename)).toUpperCase() === asset.sha256;
	if (existsSync(destination) && await verify(destination)) return;
	await rm(destination, { force: true });
	await mkdir(path.dirname(destination), { recursive: true });
	const temporary = `${destination}.download`;
	const urls = asset.urls || [asset.url];
	const errors = [];
	for (const url of urls) {
		for (let attempt = 1; attempt <= 3; attempt += 1) {
			try {
				const response = await fetch(url, {
					headers: { "User-Agent": "ssr-gui-builder/0.1" },
					signal: AbortSignal.timeout(60_000),
				});
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				await writeFile(temporary, new Uint8Array(await response.arrayBuffer()));
				if (!await verify(temporary)) throw new Error("SHA-256 mismatch");
				await rename(temporary, destination);
				return;
			} catch (error) {
				errors.push(`${url} (attempt ${attempt}): ${error.cause?.code || error.message}`);
				await rm(temporary, { force: true });
				if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 1_000));
			}
	}
	}
	throw new Error(`Unable to download verified third-party file:\n${errors.join("\n")}`);
}

function githubRawUrls(rawUrl) {
	const parsed = new URL(rawUrl);
	const [owner, repository, commit, ...filename] = parsed.pathname.split("/").filter(Boolean);
	return [rawUrl, `https://github.com/${owner}/${repository}/raw/${commit}/${filename.join("/")}`];
}

async function bundleFonts() {
	if (!BUNDLE_FONTS) return;
	const fontDirectory = path.join(stageDirectory, "recorder", "game", "fonts");
	const licenseDirectory = path.join(stageDirectory, "licenses", "fonts");
	for (const font of FONT_ASSETS) {
		const cachedFont = path.join(cacheDirectory, "fonts", font.name);
		const cachedLicense = path.join(cacheDirectory, "licenses", "fonts", font.license);
		await verifiedDownload({ sha256: font.sha256, urls: [font.url, ...githubRawUrls(font.rawUrl)] }, cachedFont);
		await verifiedDownload({ sha256: font.licenseSha256, urls: githubRawUrls(font.licenseUrl) }, cachedLicense);
	}
	await Promise.all(FONT_ASSETS.flatMap(font => [
		mkdir(fontDirectory, { recursive: true }).then(() => cp(path.join(cacheDirectory, "fonts", font.name), path.join(fontDirectory, font.name))),
		mkdir(licenseDirectory, { recursive: true }).then(() => cp(path.join(cacheDirectory, "licenses", "fonts", font.license), path.join(licenseDirectory, font.license))),
	]));

	const gameDirectory = path.join(stageDirectory, "recorder", "game");
	const javascriptFiles = (await readdir(path.join(gameDirectory, "js"), { recursive: true }))
		.filter(filename => filename.endsWith(".js"));
	const replacements = new Map(FONT_ASSETS.map(font => [font.family, font.localUrl]));
	const replaced = new Set();
	for (const relative of javascriptFiles) {
		const filename = path.join(gameDirectory, "js", relative);
		let source = await readFile(filename, "utf8");
		const original = source;
		for (const [family, localUrl] of replacements) {
			const pattern = new RegExp(`(['\"])(https?:\\/\\/[^'\"]+)\\1(\\s*,\\s*['\"]${family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['\"])`, "g");
			source = source.replace(pattern, (match, quote, remoteUrl, suffix) => {
				replaced.add(family);
				return `${quote}${localUrl}${quote}${suffix}`;
			});
		}
		if (source !== original) await writeFile(filename, source);
	}
	const missing = FONT_ASSETS.filter(font => !replaced.has(font.family));
	if (missing.length) throw new Error(`Unable to patch bundled font URLs for: ${missing.map(font => font.family).join(", ")}`);
	const primaryFamilies = new Map([
		["Noto Sans Math,Noto Sans CJK TC", "Noto Sans Math"],
		["LXGW WenKai,Noto Sans Math", "LXGW WenKai"],
		["HanWangShinSuMedium,YujiBoku,Noto Sans Math,Noto Sans CJK TC", "HanWangShinSuMedium"],
	]);
	for (const relative of javascriptFiles) {
		const filename = path.join(gameDirectory, "js", relative);
		let source = await readFile(filename, "utf8");
		const original = source;
		for (const [fallbackList, primaryFamily] of primaryFamilies) {
			source = source.replaceAll(`'${fallbackList}'`, `'${primaryFamily}'`);
		}
		if (source !== original) await writeFile(filename, source);
	}
	const assetsFilename = path.join(gameDirectory, "js", "utils", "Assets.js");
	let assetsSource = await readFile(assetsFilename, "utf8");
	const originalAssetsSource = assetsSource;
	assetsSource = assetsSource.replace(
		/\t\t\t\t\t\/\/ data: \{family\}, \/\/ https:\/\/github\.com\/Automattic\/node-canvas\/issues\/2369/,
		"\t\t\t\t\tdata: {family},"
	);
	if (assetsSource === originalAssetsSource) {
		throw new Error("Unable to enable explicit aliases for bundled Node fonts.");
	}
	await writeFile(assetsFilename, assetsSource);
	await writeFile(path.join(fontDirectory, "SOURCES.json"), `${JSON.stringify(FONT_ASSETS.map(font => ({
		file: font.name,
		family: font.family,
		sha256: font.sha256,
		source: font.sourceUrl,
		license: `licenses/fonts/${font.license}`,
	})), null, "\t")}\n`);
}

async function patchRecorderOutputOptions() {
	const filename = path.join(stageDirectory, "recorder", "record.mjs");
	let source = await readFile(filename, "utf8");
	const original = source;
	const makeFunction = `\tmakeFfmpegOptions(inputOptions, outputOptions, customAfterOutput = false) {
	\tconst custom = this.ffmpegOutputOptions?.split(' ') ?? [];
	\tconst output = [...outputOptions];
	\tconst filename = customAfterOutput ? output.pop() : null;
	\treturn [
	\t\t...this.ffmpegOptions?.split(' ') ?? [],
	\t\t...inputOptions,
	\t\t...(customAfterOutput ? [] : custom),
	\t\t...output,
	\t\t...(customAfterOutput ? custom : []),
	\t\t...(filename ? [filename] : []),
	\t].filter(Boolean);
	}`;
	const makePattern = /\tmakeFfmpegOptions\(inputOptions, outputOptions\) \{[\s\S]*?\r?\n\t\}\r?\n\r?\n\tasync createVideoGeneratingFfmpeg/;
	if (!makePattern.test(source)) throw new Error("Unable to locate recorder FFmpeg option helper.");
	source = source.replace(makePattern, `${makeFunction}\n\n\tasync createVideoGeneratingFfmpeg`);
	const runPattern = /(\tasync runFfmpeg\(\) \{[\s\S]*?\r?\n\t\t)\]\), (\{stdio: 'inherit'\}\);)/;
	if (!runPattern.test(source)) throw new Error("Unable to locate recorder final FFmpeg invocation.");
	source = source.replace(runPattern, "$1], true), $2");
	if (source === original || !source.includes("customAfterOutput = false") || !source.includes("], true), {stdio: 'inherit'}")) {
		throw new Error("Unable to patch recorder FFmpeg output option ordering.");
	}
	await writeFile(filename, source);
}

async function copyThirdPartyLicenses() {
	const licenses = path.join(stageDirectory, "licenses");
	const nodeVersion = runtimeVersion();
	const nodeLicense = {
		version: nodeVersion,
		urls: [
			`https://raw.githubusercontent.com/nodejs/node/v${nodeVersion}/LICENSE`,
			`https://github.com/nodejs/node/raw/refs/tags/v${nodeVersion}/LICENSE`,
		],
	};
	const cachedNodeLicense = path.join(cacheDirectory, "licenses", `Node.js-${nodeVersion}-LICENSE.txt`);
	if (!existsSync(cachedNodeLicense)) {
		const temporary = `${cachedNodeLicense}.download`;
		await mkdir(path.dirname(cachedNodeLicense), { recursive: true });
		const errors = [];
		for (const url of nodeLicense.urls) {
			try {
				const response = await fetch(url, { headers: { "User-Agent": "ssr-gui-builder/0.1" }, signal: AbortSignal.timeout(60_000) });
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				await writeFile(temporary, new Uint8Array(await response.arrayBuffer()));
				await rename(temporary, cachedNodeLicense);
				break;
			} catch (error) {
				errors.push(`${url}: ${error.cause?.code || error.message}`);
				await rm(temporary, { force: true });
			}
		}
		if (!existsSync(cachedNodeLicense)) throw new Error(`Unable to download Node.js ${nodeVersion} license:\n${errors.join("\n")}`);
	}
	await mkdir(licenses, { recursive: true });
	await Promise.all([
		cp(cachedNodeLicense, path.join(licenses, "Node.js-LICENSE.txt")),
		cp(path.join(projectDirectory, "node_modules", "nw", "LICENSE"), path.join(licenses, "NW.js-LICENSE.txt")),
		cp(path.join(projectDirectory, "node_modules", "lucide-static", "LICENSE"), path.join(licenses, "Lucide-LICENSE.txt")),
	]);
}

async function generateWindowsIcon(source, destination) {
	const sizes = [16, 32, 48, 64, 128, 256];
	const images = await Promise.all(sizes.map(size => sharp(source)
		.resize(size, size, { fit: "contain" }).png().toBuffer()));
	const headerSize = 6 + images.length * 16;
	const header = Buffer.alloc(headerSize);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(images.length, 4);
	let offset = headerSize;
	images.forEach((image, index) => {
		const size = sizes[index];
		const entry = 6 + index * 16;
		header.writeUInt8(size === 256 ? 0 : size, entry);
		header.writeUInt8(size === 256 ? 0 : size, entry + 1);
		header.writeUInt16LE(1, entry + 4);
		header.writeUInt16LE(32, entry + 6);
		header.writeUInt32LE(image.length, entry + 8);
		header.writeUInt32LE(offset, entry + 12);
		offset += image.length;
	});
	await writeFile(destination, Buffer.concat([header, ...images]));
}

async function generateMacosIcon(source, destination) {
	const iconset = path.join(path.dirname(destination), "ssr-gui.iconset");
	const images = [
		["icon_16x16.png", 16], ["icon_16x16@2x.png", 32],
		["icon_32x32.png", 32], ["icon_32x32@2x.png", 64],
		["icon_128x128.png", 128], ["icon_128x128@2x.png", 256],
		["icon_256x256.png", 256], ["icon_256x256@2x.png", 512],
		["icon_512x512.png", 512], ["icon_512x512@2x.png", 1024],
	];
	await rm(assertInsideProject(iconset), { recursive: true, force: true });
	await mkdir(iconset, { recursive: true });
	try {
		await Promise.all(images.map(([filename, size]) => sharp(source)
			.resize(size, size, { fit: "contain" }).png().toFile(path.join(iconset, filename))));
		await run("iconutil", ["--convert", "icns", "--output", destination, iconset]);
	} finally {
		await rm(assertInsideProject(iconset), { recursive: true, force: true });
	}
}

async function generateIcons() {
	const source = path.join(stageDirectory, "app", "assets", "icon.svg");
	const png = path.join(stageDirectory, "icon.png");
	await Promise.all([
		sharp(source).resize(512, 512, { fit: "contain" }).png().toFile(png),
		sharp(source).resize(512, 512, { fit: "contain" }).png()
			.toFile(path.join(stageDirectory, "app", "assets", "icon.png")),
		generateWindowsIcon(source, path.join(stageDirectory, "icon.ico")),
	]);
	if (TARGET_PLATFORM === "darwin") {
		await generateMacosIcon(source, path.join(stageDirectory, "icon.icns"));
	}
}

async function fileSha256(filename) {
	return createHash("sha256").update(await readFile(filename)).digest("hex");
}

async function writeBuildInformation(recorder) {
	const information = {
		builtAt: new Date().toISOString(),
		nodeVersion: runtimeVersion(),
		nodeModuleAbi: process.versions.modules,
		nodeMinimumVersion: MIN_NODE_VERSION,
		platform: TARGET_PLATFORM,
		architecture: TARGET_ARCH,
		runtimeArchitecture: RUNTIME_ARCH,
		recorderCommit: recorder.commit || null,
		bundledFonts: BUNDLE_FONTS,
	};
	try { information.commit = await gitOutput(projectDirectory, ["rev-parse", "HEAD"]); } catch { /* source archive */ }
	information.recorderSourceHash = await fileSha256(path.join(stageDirectory, "recorder", "record.mjs"));
	await writeFile(path.join(stageDirectory, "build-info.json"), `${JSON.stringify(information, null, "\t")}\n`);
}

async function prepareStage() {
	await rm(assertInsideProject(buildDirectory), { recursive: true, force: true });
	await mkdir(stageDirectory, { recursive: true });
	await cp(path.join(projectDirectory, "app"), path.join(stageDirectory, "app"), { recursive: true });
	const sourcePackage = JSON.parse(await readFile(path.join(projectDirectory, "package.json"), "utf8"));
	const packaged = {
		name: sourcePackage.name,
		version: sourcePackage.version,
		description: sourcePackage.description,
		license: sourcePackage.license,
		repository: sourcePackage.repository,
		bugs: sourcePackage.bugs,
		main: "app/index.html",
		window: { ...sourcePackage.window, icon: PACKAGED_WINDOW_ICON },
		"chromium-args": "--disable-features=TranslateUI",
	};
	await writeFile(path.join(stageDirectory, "package.json"), `${JSON.stringify(packaged, null, "\t")}\n`);
	for (const filename of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) {
		const source = path.join(projectDirectory, filename);
		if (!existsSync(source)) throw new Error(`Missing release document: ${source}`);
		await cp(source, path.join(stageDirectory, filename));
	}
	const recorder = await copyRecorder();
	await patchRecorderOutputOptions();
	await Promise.all([copyProductionDependencies(), copyRuntime(), copyFfmpeg(), copyLucideIcons(), copyThirdPartyLicenses(), bundleFonts()]);
	await generateIcons();
	await writeBuildInformation(recorder);
	return sourcePackage;
}

async function signMacApplication() {
	if (TARGET_PLATFORM !== "darwin") return;
	const app = (await readdir(outputDirectory)).find(name => name.endsWith(".app"));
	if (!app) throw new Error("The macOS application bundle was not produced.");
	await run("codesign", ["--force", "--deep", "--sign", "-", path.join(outputDirectory, app)]);
}

async function main() {
	if (await relaunchWithNpmNode()) return;
	runtimeVersion();
	if (!existsSync(path.join(projectDirectory, "node_modules"))) {
		throw new Error("Run npm ci before building ssr-gui.");
	}
	await ensureNativeAbi();
	const sourcePackage = await prepareStage();
	const nwPackage = JSON.parse(await readFile(path.join(projectDirectory, "node_modules", "nw", "package.json"), "utf8"));
	const previousDirectory = process.cwd();
	process.chdir(stageDirectory);
	try {
		await nwbuild({
			mode: "build",
			version: nwPackage.version,
			flavor: "normal",
			glob: false,
			srcDir: stageDirectory,
			outDir: outputDirectory,
			cacheDir: path.join(projectDirectory, "node_modules", "nw"),
			logLevel: "info",
			platform: NW_PLATFORM,
			arch: TARGET_ARCH,
			app: builderApplicationOptions(TARGET_PLATFORM, sourcePackage),
		});
	} finally {
		process.chdir(previousDirectory);
	}
	await signMacApplication();
	console.log(`ssr-gui ${TARGET_PLATFORM}/${TARGET_ARCH} written to ${outputDirectory}`);
}

await main();
