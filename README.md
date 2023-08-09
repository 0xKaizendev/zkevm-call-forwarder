# LxLy Call Forwarder

This repo provides a smart contract implementation on how bridge messages to sender's address on the other network using PolygonZkEVM LxLy bridge


## Note

Private keys and mnemonics contained in this repository are used for internal test exclusively. Do not use them in production environments

## Requirements

- node version: 16.x
- npm version: 7.x

## Repository structure

- `contracts`: zkevm contracts
  - `PolygonZkEVMBridge.sol`: transfer assets between chains
    - `PolygonZkEVMGlobalExitRoot.sol`: manage global exit root in L1
    - `PolygonZkEVMGlobalExitRootL2.sol`: manage global exit root in L2
  - `PolygonZkEVM.sol`: consensus algorithm used by polygon hermez zkevm
  - `Sender.sol`: bridge call to another chain using PolygonZkEVMBridge
  - `CrossChainForwarder.sol`: receive calls and forward them to sender's address
- `test`: contracts tests


## Install
In project root execute:

```
npm i
cp .env.example .env
```
## Run tests

```
npm run test
```

## Deployment
Fill `.env` with your private key `MAIN_ACCOUNT` and `ALCHEMY_KEY` for every network. If you want to verify the contracts also fill the `ETHERSCAN_API_KEY` and `POLYGONSCAN_API_KEY`

To deploy use:`deploy:sender:goerli` for the `sender` and `deploy:forwarder:goerli` for the `forwarder`. These commands will deploy two identical instances of `forwarder` and `sender` contract on `goerli` and `polygonZKEVMTestnet` at the same address and this will replace existing deployment int `./deployments/goerli`. 

To verify contracts use npm run `verify:sender:${network}` and npm run `verify:forwarder:${network}` for each instance

```
npm run verify:sender:goerli
npm run verify:sender:polygonZKEVMTestnet
npm run verify:forwarder:goerli
npm run verify:forwarder:polygonZKEVMTestnet

```

## Using the forward service

In order to use the forwarder, there are already provided some scripts:

- Send call using the command bellow, it will call `bridgeMessage` on `PolygonZkEVMBridge` from the origin network and bridge message to `forwarder address` on the other network. the call medata is supposed to call function `setNumber` of `caller` on the destination network and change the value. You can change favorite number value in `./scripts/bridge-call.js` 
```
npm run bridge:forwarder:goerli

```
- Now we have to wait until the message is forwarded to destination network, there's the final script that will check it and if it's ready will actually claim the call and forward it to `sender` address the other layer. the favoriteNumber of `caller` contract on destination network should be the same sent while bridging the call:

```
npm run claim:forwarder:polygonZKEVMTestnet

```
- The call forwarding can also be performed from L2 to L1, we just have to we just have to swap the network arguments when executing the last two commands.
