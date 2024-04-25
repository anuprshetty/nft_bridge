// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract BridgeNFTMinter is ERC721Enumerable, Ownable {
    using Strings for uint256;
    string public baseURI = "";
    string public baseExtension = ".json";
    uint256 public maxSupply = 1000;
    bool public paused = false;

    constructor(
        string memory _name,
        string memory _symbol
    )
        ERC721(
            bytes(_name).length > 0 ? _name : "NFT Collection Null",
            bytes(_symbol).length > 0 ? _symbol : "COL-NUL"
        )
    {}

    function mint(address _to, uint256 tokenId) public onlyOwner {
        require(!paused, "minting is paused");
        require(tokenId > 0, "tokenId is less than 1");
        require(tokenId <= maxSupply, "tokenId is greater than max supply");

        _safeMint(_to, tokenId);
    }

    function setBaseURI(string memory _NFTMetadataFolderCID) public onlyOwner {
        baseURI = bytes(_NFTMetadataFolderCID).length > 0
            ? string(abi.encodePacked("ipfs://", _NFTMetadataFolderCID, "/"))
            : "";
    }

    function setBaseExtension(
        string memory _newBaseExtension
    ) public onlyOwner {
        baseExtension = _newBaseExtension;
    }

    function pause(bool _state) public onlyOwner {
        paused = _state;
    }

    function walletOfOwner(
        address _owner
    ) public view returns (uint256[] memory) {
        uint256 ownerTokenCount = balanceOf(_owner);
        uint256[] memory tokenIds = new uint256[](ownerTokenCount);
        for (uint256 i; i < ownerTokenCount; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(_owner, i);
        }
        return tokenIds;
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );

        string memory currentBaseURI = _baseURI();
        return
            bytes(currentBaseURI).length > 0
                ? string(
                    abi.encodePacked(
                        currentBaseURI,
                        tokenId.toString(),
                        baseExtension
                    )
                )
                : "";
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }
}
