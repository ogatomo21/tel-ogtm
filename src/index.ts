const MAX_RAW_PHONE_LENGTH = 64;
const PROJECT_URL = 'https://github.com/ogatomo21/tel-ogtm';
const LOCAL_PHONE_PATTERN = /^\d{3,15}$/;
const INTERNATIONAL_PHONE_PATTERN = /^\+[1-9]\d{2,14}$/;
const ALLOWED_INPUT_PATTERN = /^\+?[0-9().\s-]+$/;
const SEPARATORS_PATTERN = /[().\s-]/g;

const COMMON_HEADERS: HeadersInit = {
	'cache-control': 'no-store, max-age=0',
	'content-language': 'ja',
	'permissions-policy': 'camera=(), geolocation=(), microphone=()',
	'referrer-policy': 'no-referrer',
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'DENY',
};

function responseFor(request: Request, body: BodyInit | null, init: ResponseInit): Response {
	return new Response(request.method === 'HEAD' ? null : body, init);
}

function textResponse(request: Request, text: string, status: number, extraHeaders?: HeadersInit): Response {
	const headers = new Headers(COMMON_HEADERS);
	headers.set('content-type', 'text/plain; charset=UTF-8');
	new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
	return responseFor(request, text, { headers, status });
}

function htmlResponse(request: Request, title: string, body: string, status = 200): Response {
	const headers = new Headers(COMMON_HEADERS);
	headers.set('content-type', 'text/html; charset=UTF-8');
	headers.set(
		'content-security-policy',
		"default-src 'none'; base-uri 'none'; font-src 'self' data:; form-action 'none'; frame-ancestors 'none'; style-src 'self'",
	);

	const html = `<!doctype html>
<html lang="ja">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${title}</title>
	<link rel="stylesheet" href="/app.css">
</head>
<body class="min-h-dvh bg-slate-50 px-6 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
	<main class="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4">${body}</main>
</body>
</html>`;

	return responseFor(request, html, { headers, status });
}

function invalidPhonePage(request: Request): Response {
	return htmlResponse(
		request,
		'電話番号が正しくありません',
		`<p class="text-center text-base text-red-700 dark:text-red-400">電話番号が正しくありません。</p>`,
		400,
	);
}

function normalizePhoneNumber(input: string): string | null {
	const value = input.trim();
	if (!value || value.length > MAX_RAW_PHONE_LENGTH || !ALLOWED_INPUT_PATTERN.test(value)) {
		return null;
	}

	const normalized = value.replace(SEPARATORS_PATTERN, '');
	return LOCAL_PHONE_PATTERN.test(normalized) || INTERNATIONAL_PHONE_PATTERN.test(normalized) ? normalized : null;
}

function formatJapaneseNationalNumber(number: string): string {
	const groups =
		number.match(/^(0120|0800|0570|0990)(\d{3})(\d{3})$/) ??
		number.match(/^(0[36])(\d{4})(\d{4})$/) ??
		number.match(/^(\d{3})(\d{4})(\d{4})$/) ??
		number.match(/^(\d{3})(\d{3})(\d{4})$/);

	return groups ? groups.slice(1).join('-') : number;
}

function formatPhoneNumber(number: string): string {
	if (number.startsWith('+81') && number.length > 3) {
		const nationalNumber = formatJapaneseNationalNumber(`0${number.slice(3)}`);
		return `+81-${nationalNumber.slice(1)}`;
	}

	return number.startsWith('+') ? number : formatJapaneseNationalNumber(number);
}

function phoneInputFromUrl(url: URL): string | null {
	if (url.pathname === '/') {
		return null;
	}

	try {
		return decodeURIComponent(url.pathname.slice(1));
	} catch {
		return null;
	}
}

export default {
	fetch(request, env): Response | Promise<Response> {
		if (request.method !== 'GET' && request.method !== 'HEAD') {
			return textResponse(request, 'Method Not Allowed', 405, { allow: 'GET, HEAD' });
		}

		const url = new URL(request.url);
		if (url.pathname === '/app.css' || url.pathname === '/app.js') {
			return env.ASSETS.fetch(request);
		}

		if (url.pathname === '/') {
			return textResponse(request, '', 302, { location: PROJECT_URL });
		}

		const input = phoneInputFromUrl(url);
		const number = input === null ? null : normalizePhoneNumber(input);
		if (!number) {
			return invalidPhonePage(request);
		}

		const displayNumber = formatPhoneNumber(number);
		return htmlResponse(
			request,
			displayNumber,
			`<p class="break-words text-center text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">${displayNumber}</p>
			<a class="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" href="tel:${number}" aria-label="${displayNumber} に電話をかける"><i class="fa-solid fa-phone" aria-hidden="true"></i><span>電話をかける</span></a>
			<footer class="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400"><span>tel-ogtm</span><span aria-hidden="true">|</span><a class="underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-400" href="${PROJECT_URL}" target="_blank" rel="noopener noreferrer">View on GitHub</a></footer>`,
		);
	},
} satisfies ExportedHandler<Env>;
