/* eslint-disable global-require */
/* eslint-disable linebreak-style */
const { ethers, network } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();
    let bridgeAddress;
    const destinationNetwork = network.name === 'goerli' || network.name === 'mainnet' ? 1 : 0;
    // eslint-disable-next-line no-unused-expressions
    network.name === 'goerli' || network.name === 'polygonZKEVMTestnet'
        ? (bridgeAddress = '0xF6BEEeBB578e214CA9E23B0e9683454Ff88Ed2A7')
        : (bridgeAddress = '0x2a3DD3EB832aF982ec71669E178424b10Dca2EDe');
    const senderAddress = require('../deploy/sender.json').address;
    const forwarderAddress = require('../deploy/forwarder.json').address;
    const sender = await ethers.getContractAt(
        'Sender',
        senderAddress,
        deployer,
    );
    // ABI for encoding function call
    const ABI = [
        'function bridgeMessage(uint32 destinationNetwork,address destinationAddress,bool forceUpdateGlobalExitRoot,bytes calldata metadata)',
        'function setNumber(uint256 _favoriteNumber)',
    ];
    const iface = new ethers.utils.Interface(ABI);
    /**
     * This is the state change sent from origin network to destination net, the sender's favoriteNumber should
     * be the same after claiming the call feel free to change it
     */

    const favoriteNumber = 6551;
    // call data to send to the sender's address on the other chain for changing his state
    const dataTobridge = iface.encodeFunctionData('setNumber', [favoriteNumber]);
    //   zkevm bridgeMessage encoded data
    const callData = iface.encodeFunctionData('bridgeMessage', [
        destinationNetwork,
        forwarderAddress,
        false,
        dataTobridge,
    ]);
    //   Encode calldata with
    const sendCall = await sender.executeCall(bridgeAddress, callData, {
        gasLimit: 100000, // to avoid Out of gas error we set gasLimit to 1000000
    });
    await sendCall.wait(2);
    console.log(`Message sent with metadata to sender's address ${sender.address} for setting favoriteNumber to ${favoriteNumber} on ${destinationNetwork===1?'L2':'L1'}`);
    console.log('Bridge tx hash', sendCall.hash);
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
