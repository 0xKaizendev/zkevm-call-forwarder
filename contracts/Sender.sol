// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.8.17;

contract Sender {
    uint256 public favoriteNumber;

    receive()external payable{}
    function setNumber(uint256 _favoriteNumber) public {
        favoriteNumber = _favoriteNumber;
    }

    function executeCall(address _to, bytes calldata data) external payable {
        (bool success, ) = _to.call{value: msg.value}(data);
        require(success, "Execution failed");
    }
}
