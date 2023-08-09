require('dotenv').config();
require('@nomiclabs/hardhat-waffle');
require('hardhat-gas-reporter');
require('solidity-coverage');
require('@nomiclabs/hardhat-etherscan');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-dependency-compiler');
require('hardhat-deploy');
require('solidity-docgen');

const DEFAULT_MNEMONIC = 'test test test test test test test test test test test junk';

/*
 * You need to export an object to set up your config
 * Go to https://hardhat.org/config/ to learn more
 */

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    dependencyCompiler: {
        paths: [
            '@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol',
            '@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol',
            '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol',
        ], // ,
    // keep: true
    },
    solidity: {
        compilers: [
            {
                version: '0.8.17',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 999999,
                    },
                },
            },
            {
                version: '0.6.11',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 999999,
                    },
                },
            },
            {
                version: '0.5.12',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 999999,
                    },
                },
            },
            {
                version: '0.5.16',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 999999,
                    },
                },
            },
        ],
    },
    networks: {
        mainnet: {
            url: process.env.ALCHEMY_MAINNET ||'',
            accounts: [process.env.MAIN_ACCOUNT],
        },
        goerli: {
            url: process.env.ALCHEMY_GOERLI,
            accounts: [process.env.MAIN_ACCOUNT],
            chainId: 5,
        },
        localhost: {
            url: 'http://127.0.0.1:8545',
            accounts: {
                mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
                path: "m/44'/60'/0'/0",
                initialIndex: 0,
                count: 20,
            },
        },
        hardhat: {
            initialDate: '0',
            allowUnlimitedContractSize: true,
            accounts: {
                mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
                path: "m/44'/60'/0'/0",
                initialIndex: 0,
                count: 20,
            },
        },
        polygonZKEVMTestnet: {
            url: 'https://rpc.public.zkevm-test.net',
            accounts: [process.env.MAIN_ACCOUNT],
        },
        polygonZKEVMMainnet: {
            url: 'https://zkevm-rpc.com',
            accounts: {
                mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
                path: "m/44'/60'/0'/0",
                initialIndex: 0,
                count: 20,
            },
        },
    },
    gasReporter: {
        enabled: true,
        // outputFile: './gas_report.md',
        coinmarketcap: process.env.COIMMARKETCAP_API_KEY || '',
        currency: 'USD',
    },
    etherscan: {
        apiKey: {
            polygonZKEVMTestnet: `${process.env.POLYGONSCAN_API_KEY}`,
            polygonZKEVMMainnet: `${process.env.POLYGONSCAN_API_KEY}`,
            goerli: `${process.env.ETHERSCAN_API_KEY}`,
            mainnet: `${process.env.ETHERSCAN_API_KEY}`,
        },
        customChains: [
            {
                network: 'polygonZKEVMMainnet',
                chainId: 1101,
                urls: {
                    apiURL: 'https://api-zkevm.polygonscan.com/api',
                    browserURL: 'https://zkevm.polygonscan.com/',
                },
            },
            {
                network: 'polygonZKEVMTestnet',
                chainId: 1442,
                urls: {
                    apiURL: 'https://api-testnet-zkevm.polygonscan.com/api',
                    browserURL: 'https://testnet-zkevm.polygonscan.com/',
                },
            },
        ],
    },
    namedAccounts: {
        deployer: 0,
    },
};
