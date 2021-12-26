require("@nomiclabs/hardhat-waffle");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.7.6",
  networks: {
    hardhat: {
      accounts: {
        accountsBalance: "100000000000000000000000"
      },
      chainId: 1
    }
  }
};