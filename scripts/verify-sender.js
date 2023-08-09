/* eslint-disable import/no-dynamic-require, no-await-in-loop, no-restricted-syntax, guard-for-in */
require('dotenv').config();
const path = require('path');
const hre = require('hardhat');
const expect = require('chai');


const senderAddress = require('../deployments/goerli/Sender.json').address

async function main() {
    const pathDeployOutputParameters = path.join(__dirname, './deployMockNFT_output.json');
    try {
        // verify governance
        await hre.run(
            'verify:verify',
            {
                address: senderAddress,
            },
        );
    } catch (error) {
        expect(error.message.toLowerCase().includes('already verified')).to.be.equal(true);
    }
}
main().then(() => process.exit(0)).catch((error) => {
        console.error(error);
        process.exit(1);
    });