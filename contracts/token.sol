// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    uint256 public immutable maxSupply;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _maxSupply
    )
        ERC20(
            bytes(_name).length > 0 ? _name : "Token Null",
            bytes(_symbol).length > 0 ? _symbol : "TKN-NUL"
        )
    {
        maxSupply = _maxSupply * 1 ether;
    }

    function mint(address to, uint256 amount) public {
        require(
            (totalSupply() + amount) <= maxSupply,
            "Maximum supply has been reached"
        );
        _mint(to, amount);
    }
}
