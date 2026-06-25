import { VERSION as SDK_VERSION } from '@protontech/drive-sdk';

export const PLUGIN_VERSION = '0.1.1';

/** Required x-pm-appversion format for third-party Drive clients. */
export const APP_VERSION = `external-drive-obsidian_integration@${PLUGIN_VERSION}-stable`;

export const AUTH_CLIENT_ID = 'external-drive';

export const BASE_URL = 'https://drive-api.proton.me';

export const PROTON_ACCOUNT_URL = 'https://account.proton.me';

export const SDK_VERSION_STRING = SDK_VERSION;

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
