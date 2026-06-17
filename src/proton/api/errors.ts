import { RequestUrlResponse } from 'obsidian';

const ADDRESS_MISSING_CODE = 33_102;
const DOMAIN_EXTERNAL_CODE = 33_103;

type ApiErrorDetails = {
	Code?: unknown;
} & object;

export class AccountApiError extends Error {
	public readonly httpCode?: number;
	public readonly code?: number;
	public readonly debug?: object;

	constructor(
		message: string,
		options: {
			httpCode?: number;
			code?: number;
			debug?: object;
			cause?: unknown;
		} = {},
	) {
		super(message);
		this.name = 'AccountApiError';
		this.httpCode = options.httpCode;
		this.code = options.code;
		this.debug = options.debug;
	}

	static async fromResponse(
		response: RequestUrlResponse,
	): Promise<AccountApiError> {
		const details = parseErrorDetails(response.json);
		const code = typeof details?.Code === 'number' ? details.Code : 0;
		if (code === ADDRESS_MISSING_CODE || code === DOMAIN_EXTERNAL_CODE) {
			return new AddressNotFoundError(response.status.toString(), {
				httpCode: response.status,
				code,
				debug: details,
			});
		}
		return new AccountApiError(`Request failed (${response.status})`, {
			httpCode: response.status,
			code,
			debug: details,
		});
	}
}

export class AddressNotFoundError extends AccountApiError {}

export async function makeAccountApiError(
	error: unknown,
): Promise<AccountApiError> {
	if (error instanceof AccountApiError) {
		return error;
	}

	if (isRequestUrlResponse(error)) {
		return AccountApiError.fromResponse(error);
	}

	const message = error instanceof Error ? error.message : String(error);
	return new AccountApiError(message, { cause: error });
}

function parseErrorDetails(json: unknown): ApiErrorDetails | undefined {
	if (json !== null && typeof json === 'object') {
		return json;
	}
	return undefined;
}

function isRequestUrlResponse(value: unknown): value is RequestUrlResponse {
	return (
		typeof value === 'object' &&
		value !== null &&
		'status' in value &&
		typeof value.status === 'number'
	);
}
