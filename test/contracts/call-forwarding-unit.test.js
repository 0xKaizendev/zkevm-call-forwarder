/* eslint-disable no-unused-expressions */
const { expect, assert } = require('chai');
const { ethers, upgrades, network } = require('hardhat');
const MerkleTreeBridge = require('@0xpolygonhermez/zkevm-commonjs').MTBridge;
const {
    verifyMerkleProof,
    getLeafValue,
} = require('@0xpolygonhermez/zkevm-commonjs').mtBridgeUtils;

function calculateGlobalExitRoot(mainnetExitRoot, rollupExitRoot) {
    return ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [mainnetExitRoot, rollupExitRoot]);
}
const developmentChain = ['localhost', 'hardhat'];
!developmentChain.includes(network.name) ? describe.skip
    : describe('CrossChainForwarder', () => {
        let deployer;
        let rollup;
        let crossChainForwarder;
        let sender;
        let polygonZkEVMGlobalExitRoot;
        let polygonZkEVMBridgeContract;
        const ABI = [
            'function bridgeMessage(uint32 destinationNetwork,address destinationAddress,bool forceUpdateGlobalExitRoot,bytes calldata metadata)',
            'function setNumber(uint256 _favoriteNumber)',
            'function bridgeAsset(uint32 destinationNetwork,address destinationAddress,uint256 amount,address token,bool forceUpdateGlobalExitRoot,bytes calldata permitData)',
        ];
        const iface = new ethers.utils.Interface(ABI);
        const amount = ethers.utils.parseEther('10');
        const favoriteNumber = 56334;
        const callMetadata = iface.encodeFunctionData('setNumber', [favoriteNumber]);
        // meteadata that will be sent to L2 and forwarder to sender address
        const metadata = callMetadata;
        const metadataHash = ethers.utils.solidityKeccak256(['bytes'], [metadata]);
        const networkIDMainnet = 0;
        const networkIDRollup = 1;
        const LEAF_TYPE_MESSAGE = 1;

        const polygonZkEVMAddress = ethers.constants.AddressZero;

        beforeEach('Deploy contracts', async () => {
        // load signers
            [deployer, rollup] = await ethers.getSigners();

            // deploy PolygonZkEVMBridge
            const polygonZkEVMBridgeFactory = await ethers.getContractFactory('PolygonZkEVMBridgeMock');
            polygonZkEVMBridgeContract = await upgrades.deployProxy(polygonZkEVMBridgeFactory, [], { initializer: false });

            // deploy global exit root manager
            const PolygonZkEVMGlobalExitRootFactory = await ethers.getContractFactory('PolygonZkEVMGlobalExitRootMock');
            polygonZkEVMGlobalExitRoot = await PolygonZkEVMGlobalExitRootFactory.deploy(rollup.address, polygonZkEVMBridgeContract.address);

            await polygonZkEVMBridgeContract.initialize(networkIDMainnet, polygonZkEVMGlobalExitRoot.address, polygonZkEVMAddress);
            // deploy call forwarder
            const forwarderFactory = await ethers.getContractFactory('CrossChainForwarder');
            crossChainForwarder = await forwarderFactory.deploy(polygonZkEVMBridgeContract.address);
            // deploy sender
            const senderFactory = await ethers.getContractFactory('Sender');
            sender = await senderFactory.deploy();
        });
        describe('Call Receiver unit Tests', () => {
            it('should update the favoriteNumber with setNumber', async () => {
                const expectedValue = '55';
                const transaction = await sender.setNumber(expectedValue);
                await transaction.wait(1);
                const currentValue = await sender.favoriteNumber();
                assert.equal(currentValue.toString(), expectedValue);
            });
            it('should update the favoriteNumber with executeCall', async () => {
                const expectedValue = '56334';
                const transaction = await sender.executeCall(sender.address, metadata);
                await transaction.wait(1);
                const currentValue = await sender.favoriteNumber();
                assert.equal(currentValue.toString(), expectedValue);
            });
        });
        it('should check the constructor parameters', async () => {
            expect(await polygonZkEVMBridgeContract.globalExitRootManager()).to.be.equal(polygonZkEVMGlobalExitRoot.address);
            expect(await polygonZkEVMBridgeContract.networkID()).to.be.equal(networkIDMainnet);
            expect(await polygonZkEVMBridgeContract.polygonZkEVMaddress()).to.be.equal(polygonZkEVMAddress);
            expect(await crossChainForwarder.polygonZkEVMBridge()).to.be.equal(polygonZkEVMBridgeContract.address);
            expect(await crossChainForwarder.networkID()).to.be.equal(await polygonZkEVMBridgeContract.networkID());
        });
        it('should bridge call metadata and Ether from L1 to L2', async () => {
            const depositCount = await polygonZkEVMBridgeContract.depositCount();
            const originNetwork = networkIDMainnet;
            const originAddress = sender.address;
            const destinationNetwork = networkIDRollup;
            const destinationAddress = crossChainForwarder.address;
            // encoded bridgeMessage call
            const bridgeMetada = iface.encodeFunctionData('bridgeMessage', [
                destinationNetwork,
                destinationAddress,
                true,
                callMetadata,
            ]);
            const rollupExitRoot = await polygonZkEVMGlobalExitRoot.lastRollupExitRoot();

            // pre compute root merkle tree in Js
            const height = 32;
            const merkleTree = new MerkleTreeBridge(height);
            const leafValue = getLeafValue(
                LEAF_TYPE_MESSAGE,
                originNetwork,
                originAddress,
                destinationNetwork,
                destinationAddress,
                amount,
                metadataHash,
            );
            merkleTree.add(leafValue);
            const rootJSMainnet = merkleTree.getRoot();
            await expect(await sender.executeCall(polygonZkEVMBridgeContract.address, bridgeMetada, { value: amount }))
                .to.emit(polygonZkEVMBridgeContract, 'BridgeEvent')
                .withArgs(
                    LEAF_TYPE_MESSAGE,
                    originNetwork,
                    originAddress,
                    destinationNetwork,
                    destinationAddress,
                    amount,
                    metadata,
                    depositCount,
                );
            // check merkle root with SC
            const rootSCMainnet = await polygonZkEVMBridgeContract.getDepositRoot();
            expect(rootSCMainnet).to.be.equal(rootJSMainnet);

            // check merkle proof
            const proof = merkleTree.getProofTreeByIndex(0);
            const index = 0;

            // verify merkle proof
            expect(verifyMerkleProof(leafValue, proof, index, rootSCMainnet)).to.be.equal(true);
            expect(await polygonZkEVMBridgeContract.verifyMerkleProof(
                leafValue,
                proof,
                index,
                rootSCMainnet,
            )).to.be.equal(true);

            const computedGlobalExitRoot = calculateGlobalExitRoot(rootJSMainnet, rollupExitRoot);
            expect(computedGlobalExitRoot).to.be.equal(await polygonZkEVMGlobalExitRoot.getLastGlobalExitRoot());
        });

        it('should claim message', async () => {
        // Add a claim leaf to rollup exit tree
            const originNetwork = networkIDMainnet;
            const tokenAddress = sender.address; // ether
            const destinationNetwork = networkIDMainnet;
            const destinationAddress = crossChainForwarder.address;
            const mainnetExitRoot = await polygonZkEVMGlobalExitRoot.lastMainnetExitRoot();

            // compute root merkle tree in Js
            const height = 32;
            const merkleTree = new MerkleTreeBridge(height);
            const leafValue = getLeafValue(
                LEAF_TYPE_MESSAGE,
                originNetwork,
                tokenAddress,
                destinationNetwork,
                destinationAddress,
                amount,
                metadataHash,
            );
            merkleTree.add(leafValue);

            // check merkle root with SC
            const rootJSRollup = merkleTree.getRoot();

            // add rollup Merkle root
            await expect(polygonZkEVMGlobalExitRoot.connect(rollup).updateExitRoot(rootJSRollup))
                .to.emit(polygonZkEVMGlobalExitRoot, 'UpdateGlobalExitRoot')
                .withArgs(mainnetExitRoot, rootJSRollup);

            // check roots
            const rollupExitRootSC = await polygonZkEVMGlobalExitRoot.lastRollupExitRoot();
            expect(rollupExitRootSC).to.be.equal(rootJSRollup);

            const computedGlobalExitRoot = calculateGlobalExitRoot(mainnetExitRoot, rollupExitRootSC);
            expect(computedGlobalExitRoot).to.be.equal(await polygonZkEVMGlobalExitRoot.getLastGlobalExitRoot());

            // check merkle proof
            const proof = merkleTree.getProofTreeByIndex(0);
            const index = 0;

            // verify merkle proof
            expect(verifyMerkleProof(leafValue, proof, index, rootJSRollup)).to.be.equal(true);
            expect(await polygonZkEVMBridgeContract.verifyMerkleProof(
                leafValue,
                proof,
                index,
                rootJSRollup,
            )).to.be.equal(true);

            const balanceDeployer = await ethers.provider.getBalance(deployer.address);
            /*
             * Create a deposit to add ether to the PolygonZkEVMBridge
             * Check deposit amount ether asserts
             */
            // This is used just to pay ether to the PolygonZkEVMBridge smart contract and be able to claim it afterwards.
            expect(await polygonZkEVMBridgeContract.bridgeAsset(
                networkIDRollup,
                destinationAddress,
                amount,
                '0x0000000000000000000000000000000000000000',
                true,
                '0x',
                { value: amount },
            ));

            // Check balances before claim
            expect(await ethers.provider.getBalance(polygonZkEVMBridgeContract.address)).to.be.equal(amount);
            expect(await ethers.provider.getBalance(deployer.address)).to.be.lte(balanceDeployer.sub(amount));
            await expect(polygonZkEVMBridgeContract.claimMessage(
                proof,
                index,
                mainnetExitRoot,
                rollupExitRootSC,
                originNetwork,
                tokenAddress,
                destinationNetwork,
                destinationAddress,
                amount,
                metadata,
            ))
                .to.emit(polygonZkEVMBridgeContract, 'ClaimEvent')
                .withArgs(
                    index,
                    originNetwork,
                    tokenAddress,
                    destinationAddress,
                    amount,
                );
            //  check the call forwarding after claiming message, current number should be 56334
            const currentValue = await sender.favoriteNumber();
            expect(currentValue).to.be.equal(favoriteNumber);

            //   Check balances after claim
            expect(await ethers.provider.getBalance(polygonZkEVMBridgeContract.address)).to.be.equal(ethers.utils.parseEther('0'));
            expect(await ethers.provider.getBalance(sender.address)).to.be.equal(amount);
        });
    });
