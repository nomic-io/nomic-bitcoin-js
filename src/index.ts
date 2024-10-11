import * as btc from 'bitcoinjs-lib'
import { sha256 } from 'bitcoinjs-lib/src/crypto'
import { fromBech32, toBech32 } from '@cosmjs/encoding'
import { create } from './qrcode'
import { Buffer } from 'buffer'

interface BridgeFeeOverrides {
  ibc: {
    [channel: string]: number
  }
}

interface SigSet {
  signatories: Array<{ voting_power: number; pubkey: number[] }>
  index: number
  bridgeFeeRate: number
  minerFeeRate: number // sats per deposit
  depositsEnabled: boolean
  threshold: [number, number]
  bridgeFeeOverrides: BridgeFeeOverrides
}

interface IbcDest {
  sourcePort: string
  sourceChannel: string
  receiver: string
  sender: string
  timeoutTimestamp: bigint
  memo: string
}

interface PendingDeposit {
  deposit: Deposit
  confirmations: number
}

interface Deposit {
  txid: string
  vout: number
  amount: number
  height: number | null

  // Optional for compatibility with older relayers:
  sigsetIndex?: number
  bridgeFeeRate?: number
  minerFeeRate?: number
}

export type DepositInfo = Deposit & { confirmations: number }

function encodeIbc(dest: IbcDest) {
  let buf = Buffer.from([dest.sourcePort.length])
  buf = Buffer.concat([buf, Buffer.from(dest.sourcePort)])
  buf = Buffer.concat([buf, Buffer.from([dest.sourceChannel.length])])
  buf = Buffer.concat([buf, Buffer.from(dest.sourceChannel)])
  let receiverLen = Buffer.from([dest.receiver.length])
  buf = Buffer.concat([buf, receiverLen])
  buf = Buffer.concat([buf, Buffer.from(dest.receiver)])
  let senderLen = Buffer.from([dest.sender.length])
  buf = Buffer.concat([buf, senderLen])
  buf = Buffer.concat([buf, Buffer.from(dest.sender)])
  let timeout = Buffer.alloc(8)
  timeout.writeBigUInt64BE(dest.timeoutTimestamp, 0)
  buf = Buffer.concat([buf, timeout])
  buf = Buffer.concat([buf, Buffer.from([dest.memo.length])])
  buf = Buffer.concat([buf, Buffer.from(dest.memo)])

  return buf
}

function presentVp(sigset: SigSet) {
  return sigset.signatories.reduce(
    (acc, cur) => acc + BigInt(cur.voting_power),
    0n,
  )
}

async function getSigset(relayer: string) {
  return await fetch(`${relayer}/sigset`).then((res) => res.text())
}

export async function getPendingDeposits(
  relayers: string[],
  receiver: string,
): Promise<DepositInfo[]> {
  let relayer = relayers[Math.floor(Math.random() * relayers.length)]
  let info: PendingDeposit[] = await fetch(
    `${relayer}/pending_deposits?receiver=${receiver}`,
  ).then((res) => res.json())

  return info.map(({ deposit, confirmations }) => ({
    confirmations,
    ...deposit,
  }))
}

function clz64(n: bigint) {
  if (n === 0n) {
    return 0
  }
  return 64 - n.toString(2).length
}

function getTruncation(sigset: SigSet, targetPrecision: number) {
  let vp = presentVp(sigset)
  let vpBits = 64 - clz64(vp)
  if (vpBits < targetPrecision) {
    return 0
  }
  return vpBits - targetPrecision
}

function pushInt(n: bigint) {
  return btc.script.number.encode(Number(n))
}

function op(name: string) {
  if (typeof btc.script.OPS[name] !== 'number') {
    throw new Error(`Invalid op ${name}`)
  }
  return btc.script.OPS[name]
}

function redeemScript(sigset: SigSet, dest: Buffer) {
  let truncation = BigInt(getTruncation(sigset, 23))
  let [numerator, denominator] = sigset.threshold

  let firstSig = sigset.signatories[0]
  let truncatedVp = BigInt(firstSig.voting_power) >> truncation

  let script = []
  script.push(Buffer.from(firstSig.pubkey))
  script.push(op('OP_CHECKSIG'))
  script.push(op('OP_IF'))
  script.push(pushInt(truncatedVp))
  script.push(op('OP_ELSE'))
  script.push(op('OP_0'))
  script.push(op('OP_ENDIF'))

  for (let i = 1; i < sigset.signatories.length; i++) {
    let sig = sigset.signatories[i]
    let truncatedVp = BigInt(sig.voting_power) >> truncation
    script.push(op('OP_SWAP'))
    script.push(Buffer.from(sig.pubkey))
    script.push(op('OP_CHECKSIG'))
    script.push(op('OP_IF'))
    script.push(pushInt(truncatedVp))
    script.push(op('OP_ADD'))
    script.push(op('OP_ENDIF'))
  }

  let truncatedThreshold =
    ((presentVp(sigset) * BigInt(numerator)) / BigInt(denominator)) >>
    truncation
  script.push(pushInt(truncatedThreshold))
  script.push(op('OP_GREATERTHAN'))
  script.push(dest)
  script.push(op('OP_DROP'))

  return btc.script.compile(script as any)
}

async function broadcast(
  relayer: string,
  depositAddr: string,
  sigsetIndex: number,
  dest: Buffer,
) {
  return await fetch(
    `${relayer}/address?deposit_addr=${depositAddr}&sigset_index=${sigsetIndex}`,
    {
      method: 'POST',
      body: dest,
    },
  )
}

export function deriveNomicAddress(addr: string) {
  let address = fromBech32(addr)

  return toBech32('nomic', address.data)
}

export type BitcoinNetwork = 'bitcoin' | 'testnet' | 'regtest'
const oneDaySeconds = 86400

function makeIbcDest(opts: IbcDepositOptions): IbcDest {
  let now = Date.now()
  let timeoutTimestampMs
  if (typeof opts.transferTimeoutOffsetSeconds === 'undefined') {
    timeoutTimestampMs =
      now + oneDaySeconds * 5 * 1000 - (now % (60 * 60 * 1000))
  } else {
    timeoutTimestampMs = now + opts.transferTimeoutOffsetSeconds * 1000
  }

  const timeoutTimestamp = BigInt(timeoutTimestampMs) * 1000000n

  let ibcDest = {
    sourceChannel: opts.channel,
    sourcePort: 'transfer',
    receiver: opts.receiver,
    sender: opts.sender ? opts.sender : deriveNomicAddress(opts.receiver),
    memo: opts.memo || '',
    timeoutTimestamp,
  }

  if (ibcDest.memo.length > 255) {
    throw new Error('Memo must be less than 256 characters')
  }

  if (!ibcDest.sender.startsWith('nomic1')) {
    throw new Error('Sender must be a Nomic address')
  }

  if (ibcDest.sender.length !== 44) {
    throw new Error('Sender must be a 20-byte Nomic address')
  }

  let parts = ibcDest.sourceChannel.split('-')
  if (parts.length !== 2 || parts[0] !== 'channel' || isNaN(Number(parts[1]))) {
    throw new Error('Invalid source channel')
  }

  return ibcDest
}

function toNetwork(network: BitcoinNetwork | undefined) {
  if (network === 'bitcoin' || typeof network === 'undefined') {
    return btc.networks.bitcoin
  } else if (network === 'testnet') {
    return btc.networks.testnet
  } else if (network === 'regtest') {
    return btc.networks.regtest
  }

  throw new Error(`Invalid Bitcoin network: ${network}`)
}

async function getDepositAddress(
  relayer: string,
  sigset: SigSet,
  network: BitcoinNetwork | undefined,
  commitmentBytes: Buffer,
  broadcastBytes: Buffer,
) {
  let script = redeemScript(sigset, commitmentBytes)
  let { address } = btc.payments.p2wsh({
    redeem: { output: script, redeemVersion: 0 },
    network: toNetwork(network),
  })
  if (typeof address !== 'string') {
    throw new Error('Failed to generate deposit address')
  }

  let res = await broadcast(relayer, address, sigset.index, broadcastBytes)

  if (!res.ok) {
    throw new Error(await res.text())
  }

  return address
}

export interface IbcDepositOptions {
  channel: string
  receiver: string
  sender?: string
  transferTimeoutOffsetSeconds?: number
  memo?: string
}

export interface EthDepositOptions {
  receiver: string
  ethereumNetwork: 'sepolia' | 'berachain' | 'holesky'
}

export interface RawDepositOptions {
  broadcastBytes: Buffer
}

export interface BaseDepositOptions {
  relayers: string[]
  requestTimeoutMs?: number
  bitcoinNetwork?: BitcoinNetwork
  successThreshold?: number
}

export type DepositOptions = BaseDepositOptions &
  (IbcDepositOptions | RawDepositOptions)

export interface DepositSuccess {
  code: 0
  bitcoinAddress: string
  expirationTimeMs: number
  bridgeFeeRate: number
  minerFeeRate: number // sats per deposit
  sigset: SigSet
}

export interface DepositFailureOther {
  code: 1
  reason: string
}

export interface DepositFailureCapacity {
  code: 2
  reason: string
}

export type DepositResult =
  | DepositSuccess
  | DepositFailureOther
  | DepositFailureCapacity

function withTimeout(promise: Promise<any>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(Error('Timeout')), timeoutMs)
    }),
  ])
}

function consensusReq(
  relayers: string[],
  successThreshold: number,
  timeoutMs: number,
  f: any,
): Promise<any> {
  return new Promise((resolve, reject) => {
    let responseCount = 0
    let responses: Record<string, number> = {}

    function maybeReject() {
      if (responseCount === relayers.length) {
        reject(Error('Failed to get consensus response from relayer set'))
      }
    }

    for (let relayer of relayers) {
      withTimeout(f(relayer), timeoutMs).then(
        (res) => {
          responses[res] = (responses[res] || 0) + 1
          if (responses[res] >= successThreshold) {
            return resolve(res)
          }
          maybeReject()
        },
        (err) => {
          console.log(`${relayer}: ${err}`)
          responseCount += 1
          maybeReject()
        },
      )
    }
  })
}

function parseBaseOptions(opts: BaseDepositOptions) {
  let requestTimeoutMs = opts.requestTimeoutMs || 20_000
  let successThreshold =
    typeof opts.successThreshold === 'number' ? opts.successThreshold : 2 / 3
  if (successThreshold <= 0 || successThreshold > 1) {
    throw new Error('opts.successThreshold must be between 0 - 1')
  }
  let successThresholdCount = Math.round(
    opts.relayers.length * successThreshold,
  )

  return { requestTimeoutMs, successThresholdCount }
}

async function getConsensusSigset(opts: BaseDepositOptions) {
  let { requestTimeoutMs, successThresholdCount } = parseBaseOptions(opts)
  let consensusRelayerResponse: string = await consensusReq(
    opts.relayers,
    successThresholdCount,
    requestTimeoutMs,
    getSigset,
  )

  let sigset = JSON.parse(consensusRelayerResponse)

  // Backwards compatibility in case of older relayer:
  if (!sigset.bridgeFeeOverrides) {
    sigset.bridgeFeeOverrides = { ibc: {} }
  }

  return sigset as SigSet
}

async function generateAndBroadcast(
  opts: BaseDepositOptions,
  broadcastBytes: Buffer,
): Promise<DepositResult> {
  try {
    let sigset = await getConsensusSigset(opts)
    let commitmentBytes = Buffer.concat([
      Buffer.from([0]),
      sha256(broadcastBytes),
    ])
    if (!sigset.depositsEnabled) {
      return {
        code: 2,
        reason: 'Capacity limit reached',
      }
    }

    let { requestTimeoutMs, successThresholdCount } = parseBaseOptions(opts)
    let consensusDepositAddress: string = await consensusReq(
      opts.relayers,
      successThresholdCount,
      requestTimeoutMs,
      (relayer: string) => {
        return getDepositAddress(
          relayer,
          sigset,
          opts.bitcoinNetwork,
          commitmentBytes,
          broadcastBytes,
        )
      },
    )

    return {
      code: 0,
      bitcoinAddress: consensusDepositAddress,
      expirationTimeMs: Date.now() + 5 * oneDaySeconds * 1000,
      bridgeFeeRate: sigset.bridgeFeeRate,
      minerFeeRate: sigset.minerFeeRate,
      sigset,
    }
  } catch (e) {
    return {
      code: 1,
      reason: (e as any).toString(),
    }
  }
}

export async function generateDepositAddressIbc(
  opts: BaseDepositOptions & IbcDepositOptions,
): Promise<DepositResult> {
  try {
    let ibcDest = makeIbcDest(opts)
    let ibcDestBytes = encodeIbc(ibcDest)

    let broadcastBytes = Buffer.concat([Buffer.from([1]), ibcDestBytes])

    let result = await generateAndBroadcast(opts, broadcastBytes)
    if (
      result.code === 0 &&
      opts.channel in result.sigset.bridgeFeeOverrides.ibc
    ) {
      result.bridgeFeeRate = result.sigset.bridgeFeeOverrides.ibc[opts.channel]
    }

    return result
  } catch (e) {
    return {
      code: 1,
      reason: (e as any).toString(),
    }
  }
}

export const ethNetworks = {
  sepolia: {
    chainId: 11155111,
    bridge: '0x794bdA49337C667ED03265618821b944Ed11bcED',
  },
  berachain: {
    chainId: 80084,
    bridge: '0xea55b1E6df415b96C194146abCcE85e6f811CAb7',
  },
  holesky: {
    chainId: 17000,
    bridge: '0x936366c13b43Ab6eC8f70A69038E9187fED0Cd1e',
  },
}

export async function generateDepositAddressEth(
  opts: BaseDepositOptions & EthDepositOptions,
): Promise<DepositResult> {
  let network = ethNetworks[opts.ethereumNetwork]

  let addrBytes = Buffer.from(opts.receiver.replace('0x', ''), 'hex')
  let ethAccountDestPrefix = Buffer.from([4])
  let chainIdBytes = Buffer.alloc(4)
  chainIdBytes.writeUInt32BE(network.chainId)
  let ethNetworkBytes = Buffer.from(network.bridge.replace('0x', ''), 'hex')

  let broadcastBytes = Buffer.concat([
    ethAccountDestPrefix,
    chainIdBytes,
    ethNetworkBytes,
    addrBytes,
  ])

  return await generateAndBroadcast(opts, broadcastBytes)
}

export async function generateDepositAddressRaw(
  opts: BaseDepositOptions & RawDepositOptions,
): Promise<DepositResult> {
  return await generateAndBroadcast(opts, opts.broadcastBytes)
}

export interface DestinationOpts {
  bitcoinAddress: string
}

export function buildDestination(destOpts: DestinationOpts) {
  return JSON.stringify({ type: 'bitcoin', data: destOpts.bitcoinAddress })
}

export * as style from './style'
import { NBTC } from './style'

export async function generateQRCode(data: string, style: any = NBTC) {
  let qrCode = await create(style)
  qrCode.update({
    data,
  })
  let blob = await qrCode.getRawData('svg')
  let qrCodeData: string = await new Promise((resolve, reject) => {
    let reader = new FileReader()
    reader.readAsDataURL(blob)
    reader.onloadend = function () {
      resolve(reader.result as any)
    }
  })

  return qrCodeData
}
