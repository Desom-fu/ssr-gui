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
const RECORDER_COMMIT = "b1a67fa6bbc7e8541583628d3d532300824d0c65";
const NODE_LICENSE = Object.freeze({
	version: "22.23.2",
	sha256: "C738AE413CF561F174E34F6961F8CA458AAE2369A73640DDA6234C629B98BCC4",
	url: "https://raw.githubusercontent.com/nodejs/node/v22.23.2/LICENSE",
});

function assertInsideProject(target) {
	const resolved = path.resolve(target);
	if (!resolved.startsWith(`${projectDirectory}${path.sep}`)) {
		throw new Error(`Refusing to modify a path outside the project: ${resolved}`);
	}
	return resolved;
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
	const filename = process.platform === "win32" ? "node.exe" : "node";
	const source = path.join(projectDirectory, "node_modules", "node", "bin", filename);
	if (!existsSync(source)) throw new Error(`Bundled Node executable is missing: ${source}`);
	const destination = path.join(stageDirectory, "runtime", filename);
	await mkdir(path.dirname(destination), { recursive: true });
	await cp(source, destination);
	if (process.platform !== "win32") await chmod(destination, 0o755);
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

async function verifiedDownload(asset, destination) {
	const verify = async filename => (await fileSha256(filename)).toUpperCase() === asset.sha256;
	if (existsSync(destination) && await verify(destination)) return;
	const response = await fetch(asset.url, {
		headers: { "User-Agent": "ssr-gui-builder/0.1" },
		signal: AbortSignal.timeout(120_000),
	});
	if (!response.ok) throw new Error(`Unable to download ${asset.url}: HTTP ${response.status}`);
	await mkdir(path.dirname(destination), { recursive: true });
	await writeFile(destination, new Uint8Array(await response.arrayBuffer()));
	if (!await verify(destination)) {
		await rm(destination, { force: true });
		throw new Error(`SHA-256 mismatch for ${asset.url}`);
	}
}

async function copyThirdPartyLicenses() {
	const licenses = path.join(stageDirectory, "licenses");
	const cachedNodeLicense = path.join(cacheDirectory, "licenses", `Node.js-${NODE_LICENSE.version}-LICENSE.txt`);
	await verifiedDownload(NODE_LICENSE, cachedNodeLicense);
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
	if (process.platform === "darwin") {
		await generateMacosIcon(source, path.join(stageDirectory, "icon.icns"));
	}
}

async function fileSha256(filename) {
	return createHash("sha256").update(await readFile(filename)).digest("hex");
}

async function writeBuildInformation(recorder) {
	const information = {
		builtAt: new Date().toISOString(),
		platform: process.platform,
		architecture: process.arch,
		recorderCommit: recorder.commit || null,
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
	await Promise.all([copyProductionDependencies(), copyRuntime(), copyLucideIcons(), copyThirdPartyLicenses()]);
	await generateIcons();
	await writeBuildInformation(recorder);
	return sourcePackage;
}

async function signMacApplication() {
	if (process.platform !== "darwin") return;
	const app = (await readdir(outputDirectory)).find(name => name.endsWith(".app"));
	if (!app) throw new Error("The macOS application bundle was not produced.");
	await run("codesign", ["--force", "--deep", "--sign", "-", path.join(outputDirectory, app)]);
}

async function main() {
	if (!existsSync(path.join(projectDirectory, "node_modules"))) {
		throw new Error("Run npm ci before building ssr-gui.");
	}
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
			app: builderApplicationOptions(process.platform, sourcePackage),
		});
	} finally {
		process.chdir(previousDirectory);
	}
	await signMacApplication();
	console.log(`ssr-gui ${process.platform}/${process.arch} written to ${outputDirectory}`);
}

await main();
