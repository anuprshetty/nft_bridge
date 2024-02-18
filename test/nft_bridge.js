// mocha --> a javascript test framework.
// chai --> an assertion library.

const { expect } = require("chai");
const { ethers, run } = require("hardhat");
const { itParam } = require("mocha-param");

describe("NFTBridge", function () {
  let nftBridge;
  let owner;
  let user1;
  let user2;

  before(async function () {
    // console.log("Testing started – before all tests");
    await run("compile");
  });
  after(async function () {
    // console.log("Testing finished – after all tests");
  });
  beforeEach(async function () {
    // console.log("Before a test – enter a test");

    // JavaScript destructuring for arrays and objects.
    [owner, user1, user2] = await ethers.getSigners();
    const NFTBridge = await ethers.getContractFactory("NFTBridge"); // this method looks for a contract artifact file in the artifacts/ directory of your Hardhat project. If it finds the file, it returns a contract factory object that you can use to deploy and interact with the contract.
    nftBridge = await NFTBridge.connect(owner).deploy(); // initiates for deploying the smart contract to this local testnet
    await nftBridge.waitForDeployment(); // waits for the contract deployment transaction to be confirmed and for the contract to be fully deployed on the local testnet
  });
  afterEach(async function () {
    // console.log("After a test – exit a test");
  });
});
