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
        
        //=======================================================================================
        //                                          DEPLOY
        //=======================================================================================

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
        console.log('Vault, Arbitrage, and SingleSideLiquidityAdder are Free Participants in the gate.');

        //=======================================================================================
        //                                      RECOVER TOKENS
        //=======================================================================================

        const oldVaultMetadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/ITokensRecoverable.json`));
        const oldVaultFactory = new ethers.ContractFactory(oldVaultMetadata.abi, oldVaultMetadata.data.bytecode.object, signer);  
        const oldVaultContract = await oldVaultFactory.attach(oldVault);        
        const erc20Metadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/IERC20.json`));
        const erc20Factory = new ethers.ContractFactory(erc20Metadata.abi, erc20Metadata.data.bytecode.object, signer);  
        
        // Recovering Base from Vault
        const baseContract = await erc20Factory.attach(baseToken);
        let balanceBefore = await baseContract.balanceOf(deployer);
        await oldVaultContract.recoverTokens(baseToken);
        let balanceAfter = await baseContract.balanceOf(deployer);
        let recovered = balanceAfter.sub(balanceBefore);
        await baseContract.transfer(vaultContract.address, recovered);
        console.log(`${ethers.utils.formatEther(recovered)} Base tokens recovered and sent to the new vault`);

        // Recovering Elite from Vault
        const eliteContract = await erc20Factory.attach(eliteToken);
        await oldVaultContract.recoverTokens(eliteToken);
        recovered = await eliteContract.balanceOf(deployer);
        await eliteContract.transfer(vaultContract.address, recovered);
        console.log(`${ethers.utils.formatEther(recovered)} Elite tokens recovered and sent to the new vault`);

        // Recovering Rooted from Vault
        const rootedContract = await erc20Factory.attach(rootedToken);
        balanceBefore = await rootedContract.balanceOf(deployer);
        await oldVaultContract.recoverTokens(rootedToken);
        balanceAfter = await rootedContract.balanceOf(deployer);
        recovered = balanceAfter.sub(balanceBefore);
        await rootedContract.transfer(vaultContract.address, recovered);
        console.log(`${ethers.utils.formatEther(recovered)} Rooted tokens recovered and sent to the new vault`);

        // Recovering Base Pool LPs from Vault
        const basePoolContract = await erc20Factory.attach(basePool);
        await oldVaultContract.recoverTokens(basePool);
        recovered = await basePoolContract.balanceOf(deployer);
        await basePoolContract.transfer(vaultContract.address, recovered);
        console.log(`${ethers.utils.formatEther(recovered)} Base Pool LPs recovered and sent to the new vault`);

        // Recovering Elite Pool LPs from Vault
        const elitePoolContract = await erc20Factory.attach(elitePool);
        await oldVaultContract.recoverTokens(elitePool);
        recovered = await elitePoolContract.balanceOf(deployer);
        await elitePoolContract.transfer(vaultContract.address, recovered);
        console.log(`${ethers.utils.formatEther(recovered)} Elite Pool LPs recovered and sent to the new vault`);

        console.log('Done!');
    } 
    catch (e) {
        console.log(e)
    }
})()