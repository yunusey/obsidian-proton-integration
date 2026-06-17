import { CryptoProxy } from '@protontech/crypto';
import { Api as CryptoApi } from '@protontech/crypto/proxy/endpoint/api.ts';
import { OpenPGPCryptoWithCryptoProxy } from '@protontech/drive-sdk';

let initialized = false;

export function initProtonCrypto(): OpenPGPCryptoWithCryptoProxy {
	if (!initialized) {
		CryptoApi.init({});
		CryptoProxy.setEndpoint(
			new CryptoApi(),
			(endpoint: { clearKeyStore: () => void }) => endpoint.clearKeyStore(),
		);
		initialized = true;
	}

	return new OpenPGPCryptoWithCryptoProxy(CryptoProxy);
}
