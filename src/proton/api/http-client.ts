import {
	ProtonDriveHTTPClientBlobRequest,
	ProtonDriveHTTPClientJsonRequest,
} from '@protontech/drive-sdk';

import { ApiClient } from './api-client';
import { ProtonHttpResponse } from './obsidian-http';

function toFetchResponse(response: ProtonHttpResponse): Response {
	const headers = new Headers();
	for (const [key, value] of Object.entries(response.headers)) {
		if (typeof value === 'string') {
			headers.set(key, value);
		}
	}

	const body =
		response.arrayBuffer instanceof ArrayBuffer
			? response.arrayBuffer
			: undefined;

	return new Response(body, {
		status: response.status,
		headers,
	});
}

export class HTTPClient {
	constructor(private readonly apiClient: ApiClient) {}

	async fetchJson(
		options: ProtonDriveHTTPClientJsonRequest,
	): Promise<Response> {
		const response = await this.apiClient.authenticatedRequest(
			options.url,
			{
				method: options.method,
				...(options.json !== undefined ? { json: options.json } : {}),
				...(options.body !== undefined && options.json === undefined
					? { body: options.body }
					: {}),
				headers: options.headers,
				timeout: options.timeoutMs,
				signal: options.signal,
			},
		);
		return toFetchResponse(response);
	}

	async fetchBlob(
		options: ProtonDriveHTTPClientBlobRequest,
	): Promise<Response> {
		const response = await this.apiClient.authenticatedRequest(
			options.url,
			{
				method: options.method,
				body: options.body,
				headers: options.headers,
				timeout: options.timeoutMs,
				signal: options.signal,
			},
		);
		return toFetchResponse(response);
	}
}
