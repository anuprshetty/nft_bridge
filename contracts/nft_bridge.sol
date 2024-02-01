// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTBridge is IERC721Receiver, ReentrancyGuard, Ownable {
    IERC721Enumerable public nftMinter;
    IERC20 public feeToken;
    uint256 public nftMovingFeeNative = 0.0025 ether;
    uint256 public nftMovingFeeCustom = 10;

    struct CustodialNFT {
        uint256 tokenId;
        address holder;
    }

    mapping(uint256 tokenId => CustodialNFT custodialNFT) public custodialNFTs;
}
