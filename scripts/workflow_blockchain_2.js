// ECONNRESET error for hardhat network: The ECONNRESET error typically indicates that the TCP connection was abruptly closed by the remote server, or some network issue occurred.

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { expect } = require("chai");

class Blockchain {
  constructor(name, tokenName, nftMinterName, nftBridgeName) {
    this.name = name;

    this.tokenName = tokenName;
    this.nftMinterName = nftMinterName;
    this.nftBridgeName = nftBridgeName;

    this.tokenInfo = null;
    this.nftMinterInfo = null;
    this.nftBridgeInfo = null;

    this.token = null;
    this.nftMinter = null;
    this.nftBridge = null;
  }

  async setContracts() {
    const folder_path = path.join(
      __dirname,
      "../dapp_contracts_info/",
      this.name,
      "/"
    );

    this.tokenInfo = JSON.parse(
      fs.readFileSync(path.join(folder_path, `${this.tokenName}.json`), "utf8")
    );
    this.nftMinterInfo = JSON.parse(
      fs.readFileSync(
        path.join(folder_path, `${this.nftMinterName}.json`),
        "utf8"
      )
    );
    this.nftBridgeInfo = JSON.parse(
      fs.readFileSync(
        path.join(folder_path, `${this.nftBridgeName}.json`),
        "utf8"
      )
    );

    this.token = new hre.ethers.Contract(
      this.tokenInfo.contractInstances[0].address,
      this.tokenInfo.abi
    );
    this.nftMinter = new hre.ethers.Contract(
      this.nftMinterInfo.contractInstances[0].address,
      this.nftMinterInfo.abi
    );
    this.nftBridge = new hre.ethers.Contract(
      this.nftBridgeInfo.contractInstances[0].address,
      this.nftBridgeInfo.abi
    );
  }
}

async function main() {
  const b2 = new Blockchain(
    "blockchain_2",
    "Token",
    "BridgeNFTMinter",
    "NFTBridge"
  );
  await b2.setContracts();

  console.log("b2: ", b2);

  [owner, user1, user2] = await hre.ethers.getSigners();

  // Moving NFT from one blockchain to another blockchain.

  const user_account_1 = user1;
  const user_account_2 = user2;
  const tokenId = 3;

  try {
    // 2: check if tokenId exists
    await b2.nftMinter.connect(owner).ownerOf(tokenId);
  } catch (error) {
    // 3: if tokenId doesn't exists
    await b2.nftMinter.connect(owner).mint(owner, tokenId);
    console.log(
      "owner_tokens: ",
      await b2.nftMinter.connect(owner).walletOfOwner(owner.address)
    );
    let account_address = await b2.nftMinter.connect(owner).ownerOf(tokenId);
    expect(account_address).to.equal(owner.address);

    // 4:
    await b2.nftMinter.connect(owner).approve(b2.nftBridge.target, tokenId);
    account_address = await b2.nftMinter.connect(owner).getApproved(tokenId);
    expect(account_address).to.equal(b2.nftBridge.target);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.log(
    "\n--------------------------- ERROR --------------------------\n"
  );
  console.error(error);
  console.log(
    "\n------------------------------------------------------------\n"
  );
  console.log(
    "ERROR NOTE:\n \
      1) Make sure hardhat network is running."
  );
  process.exitCode = 1;
});
