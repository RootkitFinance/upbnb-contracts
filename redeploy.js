// 1. In the REMIX compile 
//      RootedTransferGate, 
//      Vault,
//      Arbitrage
//      ITokensRecoverable
//      IERC20
//      EliteToken
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
        const oldVault = "0x0071137160bAbDcA08EdAB9947d6754cd9a00E75";
        const oldArbitrage = "0xCc2462719568599Db058e8597008B64BAe3a36dF";
        const bot = "0x439Fd1FDfF5D1c46F67220c7C38d04F366372332";

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

        //=======================================================================================
        //                                          CONFIG
        //=======================================================================================

        let txResponse = await vaultContract.setupPools();
        await txResponse.wait();
        console.log('setupPools is called in the Vault');
        txResponse = await vaultContract.setSeniorVaultManager(deployer, true);
        await txResponse.wait();
        console.log('deployer is SeniorVaultManager');

        const transferGateMetadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/RootedTransferGate.json`));
        const transferGateFactory = new ethers.ContractFactory(transferGateMetadata.abi, transferGateMetadata.data.bytecode.object, signer);  
        const transferGateContract = await transferGateFactory.attach(transferGate);
      
        txResponse = await transferGateContract.setUnrestrictedController(vaultContract.address, true);
        await txResponse.wait();
        console.log('Vault is UnrestrictedController in the gate.');

        txResponse = await transferGateContract.setUnrestrictedController(arbitrageContract.address, true);
        await txResponse.wait();
        console.log('Arbitrage is UnrestrictedController in the gate.');

        txResponse = await transferGateContract.setFeeControllers(vaultContract.address, true);
        await txResponse.wait();
        console.log('Vault is fee controller in the gate.');

        txResponse = await transferGateContract.setFreeParticipant(vaultContract.address, true);
        await txResponse.wait();
        txResponse = await transferGateContract.setFreeParticipant(arbitrageContract.address, true);
        await txResponse.wait();
        console.log('Vault and Arbitrage are Free Participants in the gate.');

        txResponse = await arbitrageContract.setArbitrageur(bot, true);
        await txResponse.wait();
        console.log('Bot is set in arbitrage');

        const eliteMetadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/EliteToken.json`));
        const eliteFactory = new ethers.ContractFactory(eliteMetadata.abi, eliteMetadata.data.bytecode.object, signer);  
        const eliteContract = await eliteFactory.attach(eliteToken);

        txResponse = await eliteContract.setSweeper(vaultContract.address, true);
        await txResponse.wait();
        console.log('Vault is sweeper');

        txResponse = await eliteContract.setFreeParticipant(vaultContract.address, true);
        await txResponse.wait();
        console.log('Vault is Free Participant in Elite');

        txResponse = await eliteContract.setFreeParticipant(arbitrageContract.address, true);
        await txResponse.wait();
        console.log('Arbitrage is Free Participant in Elite');

        //=======================================================================================
        //                                      RECOVER TOKENS
        //=======================================================================================

        const tokensRecoverableMetadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/ITokensRecoverable.json`));
        const tokensRecoverableFactory = new ethers.ContractFactory(tokensRecoverableMetadata.abi, tokensRecoverableMetadata.data.bytecode.object, signer);  
        const oldVaultContract = await tokensRecoverableFactory.attach(oldVault);        
        const erc20Metadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/IERC20.json`));
        const erc20Factory = new ethers.ContractFactory(erc20Metadata.abi, erc20Metadata.data.bytecode.object, signer);  
        
        // Recovering Base from Vault
        let baseContract = await erc20Factory.attach(baseToken);
        let balanceBefore = await baseContract.balanceOf(deployer);
        txResponse = await oldVaultContract.recoverTokens(baseToken);
        await txResponse.wait();
        let balanceAfter = await baseContract.balanceOf(deployer);
        let recovered = balanceAfter.sub(balanceBefore);
        await baseContract.transfer(vaultContract.address, recovered);
        console.log(`${ethers.utils.formatEther(recovered)} Base tokens recovered and sent to the new vault`);

        // Recovering Elite from Vault
        txResponse = await oldVaultContract.recoverTokens(eliteToken);
        await txResponse.wait();
        recovered = await eliteContract.balanceOf(deployer);
        await eliteContract.transfer(vaultContract.address, recovered);
        console.log(`${ethers.utils.formatEther(recovered)} Elite tokens recovered and sent to the new vault`);

        // Recovering Rooted from Vault
        let rootedContract = await erc20Factory.attach(rootedToken);
        balanceBefore = await rootedContract.balanceOf(deployer);
        txResponse = await oldVaultContract.recoverTokens(rootedToken);
        await txResponse.wait();
        balanceAfter = await rootedContract.balanceOf(deployer);
        recovered = balanceAfter.sub(balanceBefore);
        await rootedContract.transfer(vaultContract.address, recovered);
        console.log(`${ethers.utils.formatEther(recovered)} Rooted tokens recovered and sent to the new vault`);

        // Recovering Base Pool LPs from Vault
        const basePoolContract = await erc20Factory.attach(basePool);
        txResponse = await oldVaultContract.recoverTokens(basePool);
        await txResponse.wait();
        recovered = await basePoolContract.balanceOf(deployer);        
        txResponse = await basePoolContract.transfer(vaultContract.address, recovered);
        await txResponse.wait();
        console.log(`${ethers.utils.formatEther(recovered)} Base Pool LPs recovered and sent to the new vault`);

        // Recovering Elite Pool LPs from Vault
        const elitePoolContract = await erc20Factory.attach(elitePool);
        txResponse = await oldVaultContract.recoverTokens(elitePool);
        await txResponse.wait();
        recovered = await elitePoolContract.balanceOf(deployer);
        txResponse = await elitePoolContract.transfer(vaultContract.address, recovered);
        await txResponse.wait();
        console.log(`${ethers.utils.formatEther(recovered)} Elite Pool LPs recovered and sent to the new vault`);

        // Recovering Base from Arbitrage
        const oldArbitrageContract = await tokensRecoverableFactory.attach(oldArbitrage);
        baseContract = await erc20Factory.attach(baseToken);
        balanceBefore = await baseContract.balanceOf(deployer);
        txResponse = await oldArbitrageContract.recoverTokens(baseToken);
        await txResponse.wait();
        balanceAfter = await baseContract.balanceOf(deployer);
        recovered = balanceAfter.sub(balanceBefore);
        await baseContract.transfer(arbitrageContract.address, recovered);
        console.log(`${ethers.utils.formatEther(recovered)} Base tokens recovered and sent to the new arbitrage`);

        console.log('Done!');
    } 
    catch (e) {
        console.log(e)
    }
})()