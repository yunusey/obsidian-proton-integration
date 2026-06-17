import {
	APP_VERSION,
	BASE_URL,
	DEFAULT_REQUEST_TIMEOUT_MS,
	SDK_VERSION_STRING,
} from '../constants';
import { Credentials } from '../credentials';
import { isOkResponse, protonRequest, ProtonHttpResponse } from './obsidian-http';

export interface ApiRequestOptions {
	method?: string;
	json?: object;
	body?: BodyInit;
	headers?: Headers;
	timeout?: number;
	signal?: AbortSignal;
	searchParams?: Record<string, string | number>;
}

export class ApiClient {
	private activeRefreshPromise: Promise<boolean> | null = null;
	readonly baseUrlWithProtocol: string;

	constructor(
		private readonly credentials: Credentials,
		baseUrl: string = BASE_URL,
	) {
		this.baseUrlWithProtocol = baseUrl.match(/^https?:\/\//)
			? baseUrl
			: `https://${baseUrl}`;
	}

	async authenticatedRequest(
		url: string,
		options: ApiRequestOptions = {},
	): Promise<ProtonHttpResponse> {
		const response = await this.request(url, options, true);
		if (response.status !== 401 || shouldSkipAuthRefreshForUrl(url)) {
			return response;
		}

		const refreshed = await this.refreshSessionIfPossible();
		if (!refreshed) {
			return response;
		}

		return this.request(url, options, true);
	}

	async unauthenticatedRequest(
		url: string,
		options: ApiRequestOptions = {},
	): Promise<ProtonHttpResponse> {
		return this.request(url, options, false);
	}

	private async request(
		url: string,
		options: ApiRequestOptions,
		authenticated: boolean,
	): Promise<ProtonHttpResponse> {
		const timeoutMs = options.timeout ?? DEFAULT_REQUEST_TIMEOUT_MS;
		const controller = new AbortController();
		const timeoutId = window.setTimeout(
			() => controller.abort(new Error('Request timed out')),
			timeoutMs,
		);

		if (options.signal?.aborted) {
			window.clearTimeout(timeoutId);
			throw options.signal.reason instanceof Error
				? options.signal.reason
				: new Error('Aborted');
		}

		const headers = new Headers(options.headers);
		headers.set('x-pm-appversion', APP_VERSION);
		if (SDK_VERSION_STRING) {
			headers.set('x-pm-drive-sdk-version', SDK_VERSION_STRING);
		}

		if (authenticated) {
			if (this.credentials.uid) {
				headers.set('x-pm-uid', this.credentials.uid);
			}
			if (this.credentials.accessToken) {
				headers.set('Authorization', `Bearer ${this.credentials.accessToken}`);
			}
		}

		let body = options.body;
		if (options.json !== undefined) {
			headers.set('Content-Type', 'application/json');
			body = JSON.stringify(options.json);
		}

		try {
			return await protonRequest(url, {
				method: options.method,
				headers,
				body,
				searchParams: options.searchParams,
			});
		} finally {
			window.clearTimeout(timeoutId);
		}
	}

	async refreshSessionIfPossible(): Promise<boolean> {
		this.activeRefreshPromise ??= this.performTokenRefresh().finally(() => {
			this.activeRefreshPromise = null;
		});
		return this.activeRefreshPromise;
	}

	private async performTokenRefresh(): Promise<boolean> {
		const refreshToken = this.credentials.refreshToken;
		if (!refreshToken) {
			return false;
		}

		const response = await this.unauthenticatedRequest(
			`${this.baseUrlWithProtocol}/auth/v4/refresh`,
			{
				method: 'POST',
				json: {
					ResponseType: 'token',
					GrantType: 'refresh_token',
					RefreshToken: refreshToken,
				},
			},
		);

		if (!isOkResponse(response)) {
			if (
				response.status >= 400 &&
				response.status < 500 &&
				response.status !== 429
			) {
				await this.credentials.signOut();
			}
			return false;
		}

		const data = response.json as {
			UID?: string;
			AccessToken?: string;
			RefreshToken?: string;
		};

		const uid = data.UID ?? this.credentials.uid;
		const accessToken = data.AccessToken;
		if (!uid || !accessToken) {
			return false;
		}

		await this.credentials.setSessionInfo({
			uid,
			accessToken,
			refreshToken: data.RefreshToken ?? refreshToken,
		});
		return true;
	}
}

function shouldSkipAuthRefreshForUrl(url: string): boolean {
	let pathname: string;
	try {
		pathname = new URL(url).pathname.toLowerCase();
	} catch {
		pathname = url.toLowerCase();
	}
	return (
		pathname.includes('/auth/v4/refresh') ||
		pathname.includes('/auth/v4/sessions') ||
		pathname.includes('/core/v4/auth')
	);
}
