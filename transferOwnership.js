// 1. Double check addresses
// 2. In the REMIX compile IOwned
// 3. Right click on the script name and hit "Run" to execute

(async () => {
	try {
		const newOwner = "0x231499d78B8162e8C747B506075a5fbCDfF67432";
		const arbitrage = "0xfB84e9F38Ac5dB78155c26196b5eCC75040282a9";
		const blackListRegistry = "0xC0a87916081dBb1fC08D1B654c2361501c321D4A";
		const calculator = "0x2Cf93f951C44980Fb1790524d4f1a32A5dC7dadC";
		const elite = "0xb7db0850096aeaec1b615463202db441012c564f";
		const rooted = "0x1759254EB142bcF0175347D5A0f3c19235538a9A"
		const feeSplitter = "0x1824EBb907dEef8bb3776E0B1eCEE31aFa2076a2"
		const freeParticipantRegistry = "0x3850eAB01C24E3F46aF2E3c8c635D01Ae37F8550"
		const singleSideLiquidityAdder = "0x33C8A1B3275c2B2D5bf7fe7C536F3B6B34677566"
		const stakingToken = "0x49Ba5c83F151F8f786CF2623243b66dC42492d41"
		const transferGate = "0xF0282B35AA35885AB99c42dbc3Cd76097Be308aB";
		const vault = "0xe6Fc0Bef42a263dcC375a82Fa36Ee520Fce2F6c4";
		const marketingVault = "0x2f562f85e6e0f3ba7ada10b5820f350df79f6c32"
		const arbVault = "0x6247166e55099Dc4ED5199cc2B5B76D55676344F"

		const signer = (new ethers.providers.Web3Provider(web3Provider)).getSigner();

		const ownedMetadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/IOwned.json`));
		const ownedFactory = new ethers.ContractFactory(ownedMetadata.abi, ownedMetadata.data.bytecode.object, signer);
		const owned = [
			arbitrage,
			blackListRegistry,
			calculator,
			elite,
			rooted,
			feeSplitter,
			freeParticipantRegistry,
			singleSideLiquidityAdder,
			stakingToken,
			transferGate,
			vault,
			marketingVault,
			arbVault
		];

		const arbitrageContract = await ownedFactory.attach(arbitrage);
		const gas = await arbitrageContract.estimateGas.transferOwnership(newOwner);
		const increasedGas = gas.toNumber() * 1.5;

		for (var i = 0; i < owned.length; i++) {
			const contract = await ownedFactory.attach(owned[i]);
			contract.transferOwnership(newOwner, { gasLimit: increasedGas });
		}

		console.log('Done!');
	}
	catch (e) {
		console.log(e)
	}
})()