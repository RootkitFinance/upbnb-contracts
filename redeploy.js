// 1. In the REMIX compile 
//      RootedTransferGate, 
//      Vault,
//      Arbitrage
//      SingleSideLiquidityAdder
//      ITokensRecoverable
//      IERC20
// 2. Right click on the script name and hit "Run" to execute
(async () => {
    try {
        console.log('Running deploy script...')

        const deployer = "0x804CC8D469483d202c69752ce0304F71ae14ABdf";
        const router = "0x10ed43c718714eb63d5aa57b78b54704e256024e";
        const baseToken = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
        const eliteToken = "0xb7db0850096aeaec1b615463202db441012c564f";
        const rootedToken = "0x1759254EB142bcF0175347D5A0f3c19235538a9A";
        const basePool = "0x27d078b13C2239606783679895Ec3b164da24D90";
        const elitePool = "0x0C51ec4743C1ae6be3c193926BA04458A56e4437";
        const transferGate = "0xF0282B35AA35885AB99c42dbc3Cd76097Be308aB";
        const calculator = "0x2Cf93f951C44980Fb1790524d4f1a32A5dC7dadC";
        const oldVault = "0xd22F3E99F7e16566A104A47c9c15e97C6B4Ad122";

        const signer = (new ethers.providers.Web3Provider(web3Provider)).getSigner();      

        // Vault
        const vaultMetadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/Vault.json`));    
        const vaultFactory = new ethers.ContractFactory(vaultMetadata.abi, vaultMetadata.data.bytecode.object, signer);
        const vaultContract = await vaultFactory.deploy(baseToken, eliteToken, rootedToken, calculator, transferGate, router);

        console.log(`Vault: ${vaultContract.address}`);
        await vaultContract.deployed();
        console.log('Vault deployed.');

        // Arbitrage
        const arbitrageMetadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/Arbitrage.json`));    
        const arbitrageFactory = new ethers.ContractFactory(arbitrageMetadata.abi, arbitrageMetadata.data.bytecode.object, signer);
        const arbitrageContract = await arbitrageFactory.deploy(baseToken, eliteToken, rootedToken, router);

        console.log(`Arbitrage: ${arbitrageContract.address}`);
        await arbitrageContract.deployed();
        console.log('Arbitrage deployed.');

        // SingleSideLiquidityAdder
        const singleSideLiquidityAdderMetadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/SingleSideLiquidityAdder.json`));    
        const singleSideLiquidityAdderFactory = new ethers.ContractFactory(singleSideLiquidityAdderMetadata.abi, singleSideLiquidityAdderMetadata.data.bytecode.object, signer);
        const singleSideLiquidityAdderContract = await singleSideLiquidityAdderFactory.deploy(baseToken, rootedToken, basePool, transferGate, router);

        console.log(`SingleSideLiquidityAdder: ${singleSideLiquidityAdderContract.address}`);
        await singleSideLiquidityAdderContract.deployed();
        console.log('SingleSideLiquidityAdder deployed.');

        //=======================================================================================
        //                                          CONFIG
        //=======================================================================================

        let txResponse = await vaultContract.setupPools();
        await txResponse.wait();
        console.log('setupPools is called in the Vault');

        const transferGateMetadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/RootedTransferGate.json`));
        const transferGateFactory = new ethers.ContractFactory(transferGateMetadata.abi, transferGateMetadata.data.bytecode.object, signer);  
        const transferGateContract = await transferGateFactory.attach(transferGate);
      
        txResponse = await transferGateContract.setUnrestrictedController(vaultContract.address, true);
        await txResponse.wait();
        console.log('Vault is UnrestrictedController in the gate.');

        txResponse = await transferGateContract.setUnrestrictedController(singleSideLiquidityAdderContract.address, true);
        await txResponse.wait();
        console.log('singleSideLiquidityAdder is UnrestrictedController in the gate.');

        txResponse = await gateContract.setFreeParticipant(vaultContract.address, true);
        await txResponse.wait();
        txResponse = await gateContract.setFreeParticipant(arbitrageContract.address, true);
        await txResponse.wait();
        txResponse = await gateContract.setFreeParticipant(singleSideLiquidityAdderContract.address, true);
        await txResponse.wait();
        console.log('Vault, arbitrage, and SingleSideLiquidityAdder are Free Participants in the gate.');


        //Recover tokens
        const oldVaultMetadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/ITokensRecoverable.json`));
        const oldVaultFactory = new ethers.ContractFactory(oldVaultMetadata.abi, oldVaultMetadata.data.bytecode.object, signer);  
        const oldVaultContract = await oldVaultFactory.attach(oldVault);

        // Recovering Base from Vault
        const erc20Metadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/IERC20.json`));
        const erc20Factory = new ethers.ContractFactory(erc20Metadata.abi, erc20Metadata.data.bytecode.object, signer);  
        const baseContract = await erc20Factory.attach(baseToken);

        let balanceBefore = await baseContract.balanceOf(deployer);
        await oldVaultContract.recoverTokens(baseToken);
        let balanceAfter = await baseContract.balanceOf(deployer);
        let recovered = balanceAfter.sub(balanceBefore);
        await baseContract.transfer(vaultContract.address, recovered);
        console.log(`${ethers.utils.formatEther(recovered)} of Base recovered and sent to new vault`);

        // Recovering Elite from Vault
        const eliteContract = await erc20Factory.attach(eliteToken);

        let balanceBefore = await eliteContract.balanceOf(deployer);
        await oldVaultContract.recoverTokens(eliteToken);
        let balanceAfter = await eliteContract.balanceOf(deployer);
        let recovered = balanceAfter.sub(balanceBefore);
        await eliteContract.transfer(vaultContract.address, recovered);
        console.log(`${ethers.utils.formatEther(recovered)} of Elite recovered and sent to new vault`);




        await vaultContract.recoverTokens(eliteToken);
        await vaultContract.recoverTokens(rootedToken);
        await vaultContract.recoverTokens(basePool);
        await vaultContract.recoverTokens(elitePool);



        console.log('Done!');

    } catch (e) {
        console.log(e)
    }
})()