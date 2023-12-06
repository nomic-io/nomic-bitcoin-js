import {
  generateDepositAddress,
  DepositOptions,
  getPendingDeposits,
  DepositSuccess,
} from ".";

const sampleGetDepositAddress = async () => {
  const config = {
    relayers: ["https://oraibtc.relayer.orai.io:443"],
    channel: "channel-0", // ibc between oraibtc and orai chain
    network: "testnet",
    receiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd", // bech32 address of the depositing user,
    sender: "oraibtc1ehmhqcn8erf3dgavrca69zgp4rtxj5kqzpga4j",
  } as DepositOptions;

  const btcAddressToDeposit = (await generateDepositAddress(
    config
  )) as DepositSuccess;

  console.log("BTC Address To Deposit For Bridging: ", btcAddressToDeposit);
};

const getPendingDepositsWhenFaucetingOnBtcAddress = async () => {
  const config = {
    relayers: ["https://oraibtc.relayer.orai.io:443"],
    receiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd", // orai address to check
  };

  const data = await getPendingDeposits(config.relayers, config.receiver);

  let total = 0;
  data.forEach((item) => {
    total += item.amount;
  });

  console.log("Pending Deposits:", data);
  console.log("There are", total, "tokens pending");
};

const main = async () => {
  await sampleGetDepositAddress();
  console.log("====================================================");
  console.log("====================================================");
  console.log("====================================================");
  setInterval(async () => {
    await getPendingDepositsWhenFaucetingOnBtcAddress();
  }, 1000);
};

main();
