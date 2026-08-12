import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from '../src/index';

function request(path: string, init?: RequestInit): Promise<Response> {
	return exports.default.fetch(new Request(`https://example.com${path}`, init));
}

describe('telephone launcher worker', () => {
	it('redirects the root path to the project repository', async () => {
		const response = await worker.fetch(new Request('https://example.com/'), {} as Env);

		expect(response.status).toBe(302);
		expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
		expect(response.headers.get('location')).toBe('https://github.com/ogatomo21/tel-ogtm');
		expect(await response.text()).toBe('');
	});

	it.each([
		['/090-1234-5678', '09012345678', '090-1234-5678'],
		['/03-1234-5678', '0312345678', '03-1234-5678'],
		['/0120-123-456', '0120123456', '0120-123-456'],
		['/%2B81%2090%201234%205678', '+819012345678', '+81-90-1234-5678'],
	])('normalizes and formats valid input from %s', async (path, expected, displayNumber) => {
		const response = await request(path);
		const html = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get('content-security-policy')).toBe(
			"default-src 'none'; base-uri 'none'; font-src 'self' data:; form-action 'none'; frame-ancestors 'none'; style-src 'self'",
		);
		expect(html).toContain('<link rel="stylesheet" href="/app.css">');
		expect(html).toContain(`href="tel:${expected}"`);
		expect(html).toContain(
			`<p class="break-words text-center text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">${displayNumber}</p>`,
		);
		expect(html).toContain('<i class="fa-solid fa-phone" aria-hidden="true"></i>');
		expect(html).toContain('<span>電話をかける</span>');
		expect(html).toContain(
			'<footer class="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400"><span>tel.ogtm</span><span aria-hidden="true">|</span><a class="underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-400" href="https://github.com/ogatomo21/tel-ogtm"',
		);
		expect(html).not.toContain('<script');
	});

	it.each(['/abc123', '/%2B', '/12%2B34', '/12/34', '/1234567890123456', '/%E0%A4%A'])('rejects invalid input from %s', async (path) => {
		const response = await request(path);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain('電話番号が正しくありません');
	});

	it('rejects unsupported methods', async () => {
		const response = await request('/09012345678', { method: 'POST' });

		expect(response.status).toBe(405);
		expect(response.headers.get('allow')).toBe('GET, HEAD');
	});

	it('returns GET-equivalent headers without a body for HEAD', async () => {
		const response = await request('/09012345678', { method: 'HEAD' });

		expect(response.status).toBe(200);
		expect(response.headers.get('content-security-policy')).toContain('frame-ancestors');
		expect(await response.text()).toBe('');
	});
});
