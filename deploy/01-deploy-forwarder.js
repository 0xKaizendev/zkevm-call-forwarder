/* eslint-disable linebreak-style */
const { ethers, network } = require('hardhat');
const path = require('path');
const fs = require('fs');
const saltCreate2 = '0x0000000000000000000000000000000000000000000000000000000000000000';
const create2Contract = '0x4e59b44847b379578588920ca78fbf26c0b4956c';
const mainnetBridgeAddress = '0x2a3DD3EB832aF982ec71669E178424b10Dca2EDe';
const testnetBridgeAddress = '0xF6BEEeBB578e214CA9E23B0e9683454Ff88Ed2A7';
module.exports = async (
    hre,
) => {
    const { deployments, getNamedAccounts } = hre;
    const { log, deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    let zkEVMBridgeContractAddress; let zkEVMProvider; let deployerMainnet; let
        deployerZkEVM;

    // Use mainnet bridge address
    if (network.name === 'mainnet') {
        zkEVMBridgeContractAddress = mainnetBridgeAddress;
        zkEVMProvider = new ethers.providers.JsonRpcProvider('https://zkevm-rpc.com');
        deployerMainnet = new ethers.Wallet(process.env.MAIN_ACCOUNT, ethers.provider);
        deployerZkEVM = new ethers.Wallet(process.env.MAIN_ACCOUNT, zkEVMProvider);
    } else if (network.name === 'goerli') {
    // Use testnet bridge address
        zkEVMBridgeContractAddress = testnetBridgeAddress;
        zkEVMProvider = new ethers.providers.JsonRpcProvider(
            'https://rpc.public.zkevm-test.net',
        );
        deployerMainnet = new ethers.Wallet(process.env.MAIN_ACCOUNT, ethers.provider);
        deployerZkEVM = new ethers.Wallet(process.env.MAIN_ACCOUNT, zkEVMProvider);
    } else {
        throw new Error('Network not supported');
    }
    log('00 Deploying CrossChainForwarder on both chain');
    const factory = await ethers.getContractFactory(
        'CrossChainForwarder',
        deployerMainnet,
    );
    const deployTxData = (
        await factory.getDeployTransaction(zkEVMBridgeContractAddress)
    ).data;
    // encode deploy transaction
    const hashInitCode = ethers.utils.solidityKeccak256(
        ['bytes'],
        [deployTxData],
    );
    // Precalculate create2 address
    const precalculatedAddressDeployed = ethers.utils.getCreate2Address(
        create2Contract,
        saltCreate2,
        hashInitCode,
    );
    const txParams = {
        to: create2Contract,
        data: ethers.utils.concat([saltCreate2, deployTxData]),
    };
    // Deploy L1
    if (
        (await deployerMainnet.provider.getCode(precalculatedAddressDeployed)) === '0x'
    ) {
        await deploy('CrossChainForwarder', {
            contract: 'CrossChainForwarder',
            from: deployer,
            to: create2Contract,
            deterministicDeployment: true,
            data: ethers.utils.concat([saltCreate2, deployTxData]),
            waitConfirmations: 2,
            args: [zkEVMBridgeContractAddress],
        });
    } else {
        console.log('Contract already deployed on L1');
    }
    // Deploy L2
    if (
        (await deployerZkEVM.provider.getCode(precalculatedAddressDeployed))
    === '0x'
    ) {
        await (await deployerZkEVM.sendTransaction(txParams)).wait(2);
    } else {
        console.log('Contract already deployed on L2');
    }
    // Check succesfull deployment
    if (
        (await deployerMainnet.provider.getCode(precalculatedAddressDeployed)) === '0x'
    || (await deployerZkEVM.provider.getCode(precalculatedAddressDeployed))
      === '0x'
    ) {
        throw new Error('Deployment failed');
    }
    const outputJson = {
        address: precalculatedAddressDeployed,
    }
    const pathOutputJson = path.join(__dirname, './forwarder.json');
    fs.writeFileSync(pathOutputJson, JSON.stringify(outputJson, null, 1));
    console.log(
        `Call forwarder deployed on L1 and L2 at ${precalculatedAddressDeployed}`,
    );
    //   log("NFT Deployed to ", CallReceiver.address);
};
module.exports.tags = ['all', 'Forwarder'];
