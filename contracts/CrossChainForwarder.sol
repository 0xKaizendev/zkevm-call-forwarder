// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.17;

import "./interfaces/IPolygonZkEVMBridge.sol";
import "./interfaces/IBridgeMessageReceiver.sol";

contract CrossChainForwarder is IBridgeMessageReceiver {
    //  LxLy bridge contract address for communication
    IPolygonZkEVMBridge public immutable polygonZkEVMBridge;

    // network Id
    uint32 public immutable networkID;

    /**
     * @param _polygonZkEVMBridge Address of the LxLy bridge contract for zkEVM
     */
    constructor(IPolygonZkEVMBridge _polygonZkEVMBridge) {
        polygonZkEVMBridge = _polygonZkEVMBridge;
        networkID = polygonZkEVMBridge.networkID();
    }

    /**
     * @dev Emitted when a call is received from another network
     */

    event CallForwarded(uint32 destinationNetwork, address callReceiver);

    /**
     * @notice Execute instructions when a message is received
     * @param originAddress Origin address that the message was sent from
     * @param originNetwork Origin network that the message was sent from (not used in this contract)
     * @param data ABI-encoded metadata
     */
    function onMessageReceived(
        address originAddress,
        uint32 originNetwork,
        bytes memory data
    ) external payable {
        require(
            originAddress != address(0),
            "CrossChainForwarder: Invalid origin address"
        );
        require(data.length > 0, "CrossChainForwarder: Empty data");
        require(
            msg.sender == address(polygonZkEVMBridge),
            "CrossChainForwarder: Not authorized"
        );

        emit CallForwarded(originNetwork, originAddress);
        // Gas optimization: breaking the execution into smaller operations
        _execute(originAddress, data);
        // Forward any attached Ether (msg.value) to the originAddress
        if (msg.value > 0) {
            (bool success, ) = originAddress.call{value: msg.value}(
                new bytes(0)
            );
            require(success, "CrossChainForwarder: Failed to forward Ether");
        }
    }

    /**
     * @dev Internal function to execute the ABI-encoded data
     */
    function _execute(address target, bytes memory data) internal {
        (bool success, ) = target.call(data);
        require(success, "CrossChainForwarder: Execution failed");
    }
}
