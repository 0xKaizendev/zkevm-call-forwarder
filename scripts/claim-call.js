/* eslint-disable no-await-in-loop */
/* eslint-disable linebreak-style */
const { ethers, network } = require('hardhat');

async function main() {
    const mekrleProofString = '/merkle-proof';
    const getClaimsFromAcc = '/bridges/';
    const [deployer] = await ethers.getSigners();
    // eslint-disable-next-line global-require
    const forwarderAddress = require('../deploy/forwarder.json').address;
    let bridgeAddress; let baseURL;
    if (network.name === 'goerli' || network.name === 'polygonZKEVMTestnet') {
        bridgeAddress = '0xF6BEEeBB578e214CA9E23B0e9683454Ff88Ed2A7';
        baseURL = 'https://bridge-api.public.zkevm-test.net';
    } else if (network.name === 'mainnet' || network.name === 'zkevmMainnet') {
        bridgeAddress = '0x2a3DD3EB832aF982ec71669E178424b10Dca2EDe';
        baseURL = 'https://bridge-api.zkevm-rpc.com';
    } else {
        throw new Error('Network not supported');
    }
    const bridgeContractZkeVM = await ethers.getContractAt(
        'IPolygonZkEVMBridge',
        bridgeAddress,
        deployer,
    );
    // eslint-disable-next-line global-require
    const request = require('axios').create({ baseURL });
    const deposits = await request.get(getClaimsFromAcc + forwarderAddress, {
        params: { limit: 100, offset: 0 },
    });
    const depositsArray = deposits.data.deposits;
    if (depositsArray.length === 0) {
        console.log('Not ready yet');
        return;
    }
    for (let i = 0; i < depositsArray.length; i++) {
        const currentDeposit = depositsArray[i];
        console.log(currentDeposit);
        if (currentDeposit.ready_for_claim && currentDeposit.claim_tx_hash === '') {
            // eslint-disable-next-line no-await-in-loop
            const proofAxios = await request.get(mekrleProofString, {
                params: {
                    deposit_cnt: currentDeposit.deposit_cnt,
                    net_id: currentDeposit.orig_net,
                },
            });
            const { proof } = proofAxios.data;
            const claimTx = await bridgeContractZkeVM.claimMessage(
                proof.merkle_proof,
                currentDeposit.deposit_cnt,
                proof.main_exit_root,
                proof.rollup_exit_root,
                currentDeposit.orig_net,
                currentDeposit.orig_addr,
                currentDeposit.dest_net,
                currentDeposit.dest_addr,
                currentDeposit.amount,
                currentDeposit.metadata,
            );
            console.log('claim message succesfully send: ', claimTx.hash);
            await claimTx.wait();
            console.log('claim message succesfully mined');
        } else {
            console.log('bridge not ready for claim');
        }
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
