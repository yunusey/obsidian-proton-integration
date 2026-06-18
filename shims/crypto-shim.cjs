function randomBytes() {
	throw new Error(
		'Node crypto shim: randomBytes should not be called; use Web Crypto instead',
	);
}

module.exports = { randomBytes };
module.exports.default = module.exports;
