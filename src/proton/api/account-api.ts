import { AccountApiError, makeAccountApiError } from './errors';
import { ApiClient } from './api-client';
import { isOkResponse } from './obsidian-http';

type SessionForkInitResponse = {
	Code: number;
	Selector: string;
	UserCode: string;
};

type SessionForkStatusResponse = {
	Code: number;
	Payload: string;
	UID: string;
	AccessToken: string;
	RefreshToken?: string;
};

type AuthInfoResponse = {
	Version?: number;
	Modulus?: string;
	SRPSession?: string;
	ServerEphemeral?: string;
	Salt?: string;
};

type AuthResponse = {
	ServerProof?: string;
	UID?: string;
	AccessToken?: string;
	RefreshToken?: string;
};

export class AccountApi {
	constructor(private readonly apiClient: ApiClient) {}

	async sessionForksInit(): Promise<SessionForkInitResponse> {
		try {
			const response = await this.apiClient.unauthenticatedRequest(
				`${this.apiClient.baseUrlWithProtocol}/auth/v4/sessions/forks`,
			);
			if (!isOkResponse(response)) {
				throw await makeAccountApiError(response);
			}
			return response.json as SessionForkInitResponse;
		} catch (error: unknown) {
			throw await makeAccountApiError(error);
		}
	}

	async sessionForksStatus(
		selector: string,
	): Promise<SessionForkStatusResponse> {
		try {
			const response = await this.apiClient.unauthenticatedRequest(
				`${this.apiClient.baseUrlWithProtocol}/auth/v4/sessions/forks/${encodeURIComponent(selector)}`,
			);
			if (!isOkResponse(response)) {
				throw await makeAccountApiError(response);
			}
			return response.json as SessionForkStatusResponse;
		} catch (error: unknown) {
			throw await makeAccountApiError(error);
		}
	}

	async auth(data: {
		ClientEphemeral: string;
		ClientProof: string;
		Payload: Record<string, string>;
		PersistentCookies: number;
		SRPSession: string;
		Username: string;
	}): Promise<AuthResponse> {
		try {
			const response = await this.apiClient.unauthenticatedRequest(
				`${this.apiClient.baseUrlWithProtocol}/core/v4/auth`,
				{
					method: 'POST',
					json: data,
				},
			);
			if (!isOkResponse(response)) {
				throw await makeAccountApiError(response);
			}
			return response.json as AuthResponse;
		} catch (error: unknown) {
			throw await makeAccountApiError(error);
		}
	}

	async info(username: string): Promise<AuthInfoResponse> {
		try {
			const response = await this.apiClient.unauthenticatedRequest(
				`${this.apiClient.baseUrlWithProtocol}/core/v4/auth/info`,
				{
					method: 'POST',
					json: {
						Intent: 'Proton',
						Username: username,
					},
				},
			);
			if (!isOkResponse(response)) {
				throw await makeAccountApiError(response);
			}
			const body = response.json as AuthInfoResponse;
			if (!body.Modulus) {
				throw new AccountApiError('Invalid auth response', { debug: body });
			}
			return body;
		} catch (error: unknown) {
			throw await makeAccountApiError(error);
		}
	}

	async users(): Promise<{ User?: { Keys?: Array<{ PrivateKey?: string }> } }> {
		try {
			const response = await this.apiClient.authenticatedRequest(
				`${this.apiClient.baseUrlWithProtocol}/core/v4/users`,
			);
			if (!isOkResponse(response)) {
				throw await makeAccountApiError(response);
			}
			return response.json as {
				User?: { Keys?: Array<{ PrivateKey?: string }> };
			};
		} catch (error: unknown) {
			throw await makeAccountApiError(error);
		}
	}

	async addresses(): Promise<{
		Addresses?: AddressUser[];
	}> {
		try {
			const response = await this.apiClient.authenticatedRequest(
				`${this.apiClient.baseUrlWithProtocol}/core/v4/addresses`,
				{
					searchParams: { Page: 0, PageSize: 50 },
				},
			);
			if (!isOkResponse(response)) {
				throw await makeAccountApiError(response);
			}
			return response.json as { Addresses?: AddressUser[] };
		} catch (error: unknown) {
			throw await makeAccountApiError(error);
		}
	}

	async salts(): Promise<{ KeySalts?: Array<{ KeySalt?: string }> }> {
		try {
			const response = await this.apiClient.authenticatedRequest(
				`${this.apiClient.baseUrlWithProtocol}/core/v4/keys/salts`,
			);
			if (!isOkResponse(response)) {
				throw await makeAccountApiError(response);
			}
			return response.json as {
				KeySalts?: Array<{ KeySalt?: string }>;
			};
		} catch (error: unknown) {
			throw await makeAccountApiError(error);
		}
	}

	async keys(email: string): Promise<{
		Address?: { Keys?: Array<{ PublicKey?: string }> };
	}> {
		try {
			const response = await this.apiClient.authenticatedRequest(
				`${this.apiClient.baseUrlWithProtocol}/core/v4/keys/all`,
				{
					searchParams: { Email: email, InternalOnly: 1 },
				},
			);
			if (!isOkResponse(response)) {
				throw await makeAccountApiError(response);
			}
			return response.json as {
				Address?: { Keys?: Array<{ PublicKey?: string }> };
			};
		} catch (error: unknown) {
			throw await makeAccountApiError(error);
		}
	}

	async modulus(): Promise<{ Modulus?: string; ModulusID?: string }> {
		try {
			const response = await this.apiClient.authenticatedRequest(
				`${this.apiClient.baseUrlWithProtocol}/core/v4/auth/modulus`,
			);
			if (!isOkResponse(response)) {
				throw await makeAccountApiError(response);
			}
			return response.json as {
				Modulus?: string;
				ModulusID?: string;
			};
		} catch (error: unknown) {
			throw await makeAccountApiError(error);
		}
	}
}

export type AddressKey = {
	ID?: string;
	PrivateKey?: string;
	Token?: string;
	Signature?: string;
};

export type AddressUser = {
	ID?: string;
	Email?: string;
	Keys?: AddressKey[];
};
