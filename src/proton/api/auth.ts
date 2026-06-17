import { Credentials } from '../credentials';
import { AccountApi } from './account-api';
import { AccountApiError } from './errors';
import {
	FORK_INITIAL_DELAY_MS,
	FORK_MAX_POLL_TIME_MS,
	FORK_POLL_INTERVAL_MS,
	generateSignInUrl,
	parseUserKeyPassword,
} from './auth-web';
import { sleepMs } from './sleep';
import { Srp } from './srp';

export class Auth {
	private readonly srpModule: Srp;

	constructor(
		private readonly accountApi: AccountApi,
		private readonly credentials: Credentials,
	) {
		this.srpModule = new Srp(accountApi);
	}

	isLoggedIn(): boolean {
		return this.credentials.isLoggedIn();
	}

	async loadSession(): Promise<void> {
		await this.credentials.load();
	}

	async logout(): Promise<void> {
		await this.credentials.signOut();
	}

	async authViaWeb(
		onSignInUrl: (signInUrl: string) => void | Promise<void>,
		signal?: AbortSignal,
	): Promise<{ uid: string; accessToken: string; refreshToken?: string }> {
		const forkResponse = await this.accountApi.sessionForksInit();
		const { encryptionKey, signInUrl } = generateSignInUrl(
			forkResponse.UserCode,
		);

		await onSignInUrl(signInUrl);
		await sleepMs(FORK_INITIAL_DELAY_MS, signal);

		const startTime = Date.now();
		while (true) {
			if (Date.now() - startTime > FORK_MAX_POLL_TIME_MS) {
				throw new Error('Authentication timed out');
			}

			let response;
			try {
				response = await this.accountApi.sessionForksStatus(
					forkResponse.Selector,
				);
			} catch (error: unknown) {
				if (
					error instanceof AccountApiError &&
					error.httpCode === 422
				) {
					await sleepMs(FORK_POLL_INTERVAL_MS, signal);
					continue;
				}
				throw error;
			}

			const userKeyPassword = await parseUserKeyPassword(
				encryptionKey,
				response.Payload,
			);

			await this.credentials.setUserKeyPassword(userKeyPassword);
			await this.credentials.setSessionInfo({
				uid: response.UID,
				accessToken: response.AccessToken,
				refreshToken: response.RefreshToken,
			});

			return {
				uid: response.UID,
				accessToken: response.AccessToken,
				refreshToken: response.RefreshToken,
			};
		}
	}
}
