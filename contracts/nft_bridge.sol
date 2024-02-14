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

    event NFTCustody(uint256 indexed tokenId, address holder);

    function setNFTMinter(IERC721Enumerable newNFTMinter) public onlyOwner {
        nftMinter = newNFTMinter;
    }

    function setFeeToken(IERC20 newFeeToken) public onlyOwner {
        feeToken = newFeeToken;
    }

    function retainNFT(
        uint256 tokenId,
        bool isCustomPaymentCurrency
    ) public payable nonReentrant {
        require(
            nftMinter.ownerOf(tokenId) == msg.sender,
            "token doesn't belong to the user"
        );
        require(
            custodialNFTs[tokenId].tokenId == 0,
            "token already stored on the bridge."
        );

        if (isCustomPaymentCurrency) {
            feeToken.transferFrom(
                msg.sender,
                address(this),
                nftMovingFeeCustom
            );
        } else {
            require(
                msg.value == nftMovingFeeNative,
                "Need to send 0.0025 ether to move nft token from one blockchain to another."
            );
        }

        custodialNFTs[tokenId] = CustodialNFT(tokenId, msg.sender);
        nftMinter.transferFrom(msg.sender, address(this), tokenId);
        emit NFTCustody(tokenId, msg.sender);
    }

    function retainNFT(uint256 tokenId) public nonReentrant onlyOwner {
        require(
            nftMinter.ownerOf(tokenId) == msg.sender,
            "token doesn't belong to the owner"
        );
        require(
            custodialNFTs[tokenId].tokenId == 0,
            "token already stored on the bridge."
        );

        custodialNFTs[tokenId] = CustodialNFT(tokenId, msg.sender);
        nftMinter.transferFrom(msg.sender, address(this), tokenId);
        emit NFTCustody(tokenId, msg.sender);
    }

    // function updateNFTHolder(
    //     uint256 tokenId,
    //     address newHolder
    // ) public nonReentrant onlyOwner {
    //     custodialNFTs[tokenId] = CustodialNFT(tokenId, newHolder);
    //     emit NFTCustody(tokenId, newHolder);
    // }

    function releaseNFT(
        uint256 tokenId,
        address to
    ) public nonReentrant onlyOwner {
        delete custodialNFTs[tokenId];
        nftMinter.transferFrom(address(this), to, tokenId);
    }

    function onERC721Received(
        address,
        address from,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        require(
            from != address(0x0),
            "cannot send(or mint) NFT token to nft bridge contract directly"
        );
        return IERC721Receiver.onERC721Received.selector;
    }
}
