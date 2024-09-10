<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nomic-io/nomic/develop/nomic-logo-dark-100.png">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/nomic-io/nomic/develop/nomic-logo-100.png">
  <img alt="Nomic" src="https://raw.githubusercontent.com/nomic-io/nomic/develop/nomic-logo-100.png">
</picture>

  <h1><code>nomic-bitcoin</code></h1>

<strong>A JavaScript library for accepting Bitcoin deposits with Interchain Deposits to any EVM-based or <a
  href="https://www.ibcprotocol.dev">IBC-compatible</a> blockchain, powered by <a
  href="https://nomic.io">Nomic</a>.</strong>

</div>

## Installation

```
npm install nomic-bitcoin
```

## Interchain Deposits

### nBTC on IBC-Compatible Chains

```typescript
import { generateDepositAddress } from 'nomic-bitcoin'

let depositInfo = await generateDepositAddress({
  relayers: ['https://my-bitcoin-relayer.example.com:1234'],
  channel: 'channel-0', // IBC channel ID on Nomic
  network: 'testnet',
  receiver: 'cosmos1...', // bech32 address of the depositing user
})

console.log(depositInfo)
/*
{
  code: 0,
  bitcoinAddress: "tb1q73yhgsjedp2uuwjew6zcj0kurryyue2zqjdgn5g5cf7w4krwgtusgsmpku",
  expirationTimeMs: 1624296000000,
  bridgeFeeRate: 0.015,
  minerFeeRate: 0.0001,
}
*/
```

Bitcoin sent to `bitcoinAddress` before the expiration date will be automatically IBC-transferred over the specified channel and should appear in the user's account with no further interaction required.

### nBTC on Ethereum

```typescript
import { generateDepositAddressEth } from 'nomic-bitcoin'

let depositInfo = await generateDepositAddressEth({
  relayers: ['https://my-bitcoin-relayer.example.com:1234'],
  bitcoinNetwork: 'testnet',
  receiver: '0x...', // an Ethereum address

})

console.log(depositInfo)
/*
{
  code: 0,
  bitcoinAddress: "tb1q73yhgsjedp2uuwjew6zcj0kurryyue2zqjdgn5g5cf7w4krwgtusgsmpku",
  expirationTimeMs: 1624296000000,
  bridgeFeeRate: 0.015,
  minerFeeRate: 0.0001,
}
*/
```
Additional Ethereum functionality including depositing to a contract call and support for other EVM chains will be released in a future upgrade.

### QR code

A QR code similar to the below will be returned as a base64 data URL string and should be shown to users on desktop devices for ease of use with mobile wallets.

```typescript
import { generateQRCode } from 'nomic-bitcoin'

const qrCode = await generateQRCode(depositInfo.bitcoinAddress);
```

![QR code example](https://raw.githubusercontent.com/nomic-io/nomic-bitcoin-js/main/qr-code-styling.png)

The returned data URL can be used as the `src` attribute on `img` elements:
```jsx
<img src={qrCodeData} />
```


### Capacity limit

The bridge currently has a capacity limit, which is the maximum amount of BTC that can be held in the bridge at any given time. When the capacity limit is reached, relayers will reject newly-broadcasted deposit addresses.

If the bridge is over capacity, the response code in `depositInfo` will be `2`.

```typescript
let depositInfo = await generateDepositAddress(opts)
if (depositInfo.code === 2) {
  console.error(`Capacity limit reached`)
}
```

Partner chains should communicate clearly to the user that a deposit address could not be safely generated because the bridge is currently over capacity.

### Deposit address expiration

When a deposit address is successfully generated, an expiration time in milliseconds is returned in `depositInfo`.

```typescript
let depositInfo = await generateDepositAddress(opts)
if (depositInfo.code === 0) {
  let { expirationTimeMs, bitcoinAddress } = depositInfo
  console.log(
    `Deposit address ${bitcoinAddress} expires at ${expirationTimeMs}`
  )
}
```

> [!WARNING]
>It is critical that the user understands that deposits to this Bitcoin address **will be lost** if they are sent after the expiration time. Addresses typically expire 4-5 days after creation. Do not save the address for later use, and warn the user not to reuse the address, even though multiple deposits to the same address will work as expected before the address expires.

### Fee rates

The Nomic bridge will deduct a fee from incoming deposits. The fee rate is currently a percentage of the deposit amount, and is returned in `depositInfo`.

```typescript
let depositInfo = await generateDepositAddress(opts)
if (depositInfo.code === 0) {
  let { bridgeFeeRate, minerFeeRate, bitcoinAddress } = depositInfo
  console.log(
    `The fee rate for deposits to ${bitcoinAddress} is ${
      bridgeFeeRate * 100
    }% and ${minerFeeRate} sats per byte`
  )
}
```

Additionally, a small fixed fee will deducted by Bitcoin miners before the deposit is processed.

These fees should be communicated clearly to the user as "Bridge fee" (a percentage) and "Bitcoin miner fee" respectively.

### Pending deposits

You can query all pending deposits by receiver address with `getPendingDeposits`:

```typescript
import { getPendingDeposits } from 'nomic-bitcoin'

let pendingDeposits = await getPendingDeposits(relayers, address)
console.log(pendingDeposits) // [{ confirmations: 2, txid: '...', vout: 1, amount: 100000, height: 812000 }]
```

### Bitcoin Relayers

Interchain Deposits require communication with Bitcoin relayers to relay generated deposit addresses to Nomic. Where possible multiple relayers should be included, 2/3rds of the relayers must relay the generated deposit addresses for a successful deposit. Running a relayer is part of running a Nomic node, see [Bitcoin Relayer](https://docs.nomic.io/00-03-bitcoin-relayer.html) for more information.

> [!WARNING]
> The set of relayers used by your app should be selected with care. Unsucessful relaying of generated deposit addresses will result in loss of deposited funds.

### Usage guidelines

- Display a deposit address QR code on desktop for mobile Bitcoin wallets.
- Display the deposit address expiration time.
- Communicate bridge and miner fees.
- Show pending deposits to users to avoid user concern during processing times.