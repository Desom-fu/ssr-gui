export const PACKAGED_WINDOW_ICON = "app/assets/icon.png";

const BUILDER_ICONS = Object.freeze({
	win32: "icon.ico",
	darwin: "icon.icns",
	linux: "icon.png",
});

export function builderApplicationOptions(platform, packageJson) {
	const name = String(packageJson.name || "ssr-gui");
	const version = String(packageJson.version || "0.0.0");
	const application = {
		name,
		icon: BUILDER_ICONS[platform] || BUILDER_ICONS.linux,
	};
	if (platform !== "darwin") return application;
	return {
		...application,
		LSApplicationCategoryType: "public.app-category.video",
		CFBundleIdentifier: "io.github.desom-fu.ssr-gui",
		CFBundleName: "Sunniesnow Recorder",
		CFBundleDisplayName: "Sunniesnow Recorder",
		CFBundleSpokenName: "Sunniesnow Recorder",
		CFBundleVersion: version,
		CFBundleShortVersionString: version,
		NSHumanReadableCopyright: "Copyright (c) ssr-gui contributors",
	};
}

export function platformArtifactName(platform = process.platform, architecture = process.arch) {
	const names = { win32: "windows", darwin: "macos", linux: "linux" };
	return `ssr-gui-${names[platform] || platform}-${architecture}`;
}

