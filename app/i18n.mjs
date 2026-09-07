import { COVER_I18N, COVER_I18N_LOCALES } from "./core.mjs";

const FALLBACK_LOCALE = "zh-CN";

export function detectLocale() {
	const candidates = [navigator.language, ...(navigator.languages || [])].filter(Boolean);
	for (const candidate of candidates) {
		const normalized = String(candidate).toLowerCase();
		for (const locale of COVER_I18N_LOCALES) {
			if (normalized === locale.toLowerCase()) return locale;
			if (normalized.startsWith(locale.split("-")[0].toLowerCase() + "-") || normalized === locale.split("-")[0].toLowerCase()) return locale;
		}
	}
	return FALLBACK_LOCALE;
}

export function coverStrings(locale = detectLocale()) {
	return COVER_I18N[locale] || COVER_I18N[FALLBACK_LOCALE];
}

export function applyCoverI18n(locale = detectLocale()) {
	const strings = coverStrings(locale);
	for (const element of document.querySelectorAll("[data-cover-i18n]")) {
		const text = strings[element.getAttribute("data-cover-i18n")];
		if (text != null) element.textContent = text;
	}
	document.documentElement.setAttribute("lang", locale);
	return strings;
}
