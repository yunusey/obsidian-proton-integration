import { requestUrl, RequestUrlResponse } from 'obsidian';

export type ProtonHttpResponse = RequestUrlResponse;

export async function protonRequest(
	url: string,
	options: {
		method?: string;
		headers?: Headers;
		body?: BodyInit;
		searchParams?: Record<string, string | number>;
	},
): Promise<ProtonHttpResponse> {
	const requestUrlString = new URL(url);
	if (options.searchParams) {
		for (const [key, value] of Object.entries(options.searchParams)) {
			requestUrlString.searchParams.set(key, String(value));
		}
	}

	const headers: Record<string, string> = {};
	options.headers?.forEach((value, key) => {
		headers[key] = value;
	});

	let body = options.body;
	if (typeof body !== 'string' && body !== undefined) {
		body = await new Response(body).text();
	}

	return requestUrl({
		url: requestUrlString.toString(),
		method: options.method ?? 'GET',
		headers,
		body,
		throw: false,
	});
}

export function isOkResponse(response: ProtonHttpResponse): boolean {
	return response.status >= 200 && response.status < 300;
}
