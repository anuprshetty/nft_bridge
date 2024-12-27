// ECONNRESET error for hardhat network: The ECONNRESET error typically indicates that the TCP connection was abruptly closed by the remote server, or some network issue occurred.

// NOTE:
// - Keep breakpoint at step-1 in workflow_blockchain_1.js script and at step-2 in workflow_blockchain_2.js script.
// - While debugging, once a step is completed, pause for few seconds before executing next step so that our previous steps changes are recorded in the world state of the canonical chain in the underlying blockchain.

// NOTE for reverse nft transfer:
// - interchange hardhat network names (eth_local_net_1 and eth_local_net_2) for hre.network.name in Utils.getSigners() method in both workflow scripts (workflow_blockchain_1.js and workflow_blockchain_2.js).
// - interchange blockchain names (blockchain_1 and blockchain_2) and nft_minter names (NFTMinter and BridgeNFTMinter) in const b1 and const b2 variables in both scripts(workflow_blockchain_1.js and workflow_blockchain_2.js).
// - Comment step-0: Minting NFT tokens code.
// - interchange user1 and user2 in both workflow scripts (workflow_blockchain_1.js and workflow_blockchain_2.js).
// - Execute workflow_blockchain_1.js in blockchain_2 and workflow_blockchain_2.js in blockchain_1.

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

class Utils {
  static async getSigners() {
    var owner = null,
      user1 = null,
      user2 = null;
    if (hre.network.name === "eth_local_net_2") {
      owner = new hre.ethers.Wallet(
        hre.network.config.owner_private_key,
        new hre.ethers.JsonRpcProvider(hre.network.config.url)
      );
      user1 = new hre.ethers.Wallet(
        hre.network.config.user1_private_key,
        new hre.ethers.JsonRpcProvider(hre.network.config.url)
      );
      user2 = new hre.ethers.Wallet(
        hre.network.config.user2_private_key,
        new hre.ethers.JsonRpcProvider(hre.network.config.url)
      );
    } else {
      [owner, user1, user2] = await hre.ethers.getSigners();
    }
    return [owner, user1, user2];
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

  [owner, user1, user2] = await Utils.getSigners();

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

    // 5:
    await b2.nftBridge.connect(owner).retainNFT(tokenId);

    console.log(
      "nftBridge_tokens: ",
      await b2.nftMinter.connect(owner).walletOfOwner(b2.nftBridge.target)
    );
    account_address = await b2.nftMinter.connect(owner).ownerOf(tokenId);
    expect(account_address).to.equal(b2.nftBridge.target);

    let custodialNFT = await b2.nftBridge.connect(owner).custodialNFTs(tokenId);
    console.log(`custodialNFT for tokenId : ${tokenId}`, custodialNFT);
    expect(custodialNFT.tokenId).to.equal(tokenId);
    expect(custodialNFT.holder).to.equal(owner);
  }

  // 6: if tokenId already exists, then it should belong to the bridgeNFT smart contract and stored in custodialNFTs.
  let account_address = await b2.nftMinter.connect(owner).ownerOf(tokenId);
  expect(account_address).to.equal(b2.nftBridge.target);
  let custodialNFT = await b2.nftBridge.connect(owner).custodialNFTs(tokenId);
  console.log(`custodialNFT for tokenId : ${tokenId}`, custodialNFT);
  expect(custodialNFT.tokenId).to.equal(tokenId);

  // 10:
  await b2.nftBridge.connect(owner).releaseNFT(tokenId, user_account_1.address);

  console.log(
    "user_account_tokens: ",
    await b2.nftMinter.connect(owner).walletOfOwner(user_account_1.address)
  );
  account_address = await b2.nftMinter.connect(owner).ownerOf(tokenId);
  expect(account_address).to.equal(user_account_1.address);

  custodialNFT = await b2.nftBridge.connect(owner).custodialNFTs(tokenId);
  console.log(`custodialNFT for tokenId : ${tokenId}`, custodialNFT);
  expect(custodialNFT.tokenId).to.equal(0);
  expect(custodialNFT.holder).to.equal(hre.ethers.ZeroAddress);

  // N-1: Transferring NFT token from one user to another.
  await b2.nftMinter
    .connect(user_account_1)
    .transferFrom(user_account_1.address, user_account_2.address, tokenId);
  account_address = await b2.nftMinter.connect(owner).ownerOf(tokenId);
  expect(account_address).to.equal(user_account_2.address);
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
