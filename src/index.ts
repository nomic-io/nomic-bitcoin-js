import * as btc from 'bitcoinjs-lib'
import { sha256 } from 'bitcoinjs-lib/src/crypto'
import { fromBech32, toBech32 } from '@cosmjs/encoding'
import { create } from './qrcode'
import { Buffer } from 'buffer'

interface SigSet {
  signatories: Array<{ voting_power: number; pubkey: number[] }>
  index: number
  bridgeFeeRate: number
  minerFeeRate: number // sats per deposit
  depositsEnabled: boolean
}

interface IbcDest {
  sourcePort: string
  sourceChannel: string
  receiver: string
  sender: string
  timeoutTimestamp: bigint
  memo: string
}

function encode(dest: IbcDest) {
  let buf = Buffer.from([dest.sourcePort.length])
  buf = Buffer.concat([buf, Buffer.from(dest.sourcePort)])
  buf = Buffer.concat([buf, Buffer.from([dest.sourceChannel.length])])
  buf = Buffer.concat([buf, Buffer.from(dest.sourceChannel)])
  let receiverLen = Buffer.alloc(4)
  receiverLen.writeUInt32LE(dest.receiver.length, 0)
  buf = Buffer.concat([buf, receiverLen])
  buf = Buffer.concat([buf, Buffer.from(dest.receiver)])
  let senderLen = Buffer.alloc(4)
  senderLen.writeUInt32LE(dest.sender.length, 0)
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
    0n
  )
}

async function getSigset(relayer: string) {
  return await fetch(`${relayer}/sigset`).then((res) => res.text())
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

  let truncatedThreshold = ((presentVp(sigset) * 9n) / 10n) >> truncation
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
  dest: Buffer
) {
  return await fetch(
    `${relayer}/address?deposit_addr=${depositAddr}&sigset_index=${sigsetIndex}`,
    {
      method: 'POST',
      body: dest,
    }
  )
}

export function deriveNomicAddress(addr: string) {
  let address = fromBech32(addr)

  return toBech32('nomic', address.data)
}

export type BitcoinNetwork = 'bitcoin' | 'testnet' | 'regtest'
const oneDaySeconds = 86400

function makeIbcDest(opts: DepositOptions): IbcDest {
  let now = Date.now()
  let timeoutTimestampMs
  if (typeof opts.transferTimeoutOffsetSeconds === 'undefined') {
    timeoutTimestampMs = now + oneDaySeconds * 1000 - (now % (60 * 60 * 1000))
  } else {
    timeoutTimestampMs = now + opts.transferTimeoutOffsetSeconds * 1000
  }

  const timeoutTimestamp = BigInt(timeoutTimestampMs) * 1000000n

  return {
    sourceChannel: opts.channel,
    sourcePort: 'transfer',
    receiver: opts.receiver,
    sender: opts.sender ? opts.sender : deriveNomicAddress(opts.receiver),
    memo: opts.memo || '',
    timeoutTimestamp,
  }
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
  ibcDestBytes: Buffer
) {
  let commitmentBytes = sha256(ibcDestBytes)
  let script = redeemScript(sigset, commitmentBytes)
  let { address } = btc.payments.p2wsh({
    redeem: { output: script, redeemVersion: 0 },
    network: toNetwork(network),
  })
  if (typeof address !== 'string') {
    throw new Error('Failed to generate deposit address')
  }

  let dest = Buffer.concat([Buffer.from([1]), ibcDestBytes])
  let res = await broadcast(relayer, address, sigset.index, dest)

  if (!res.ok) {
    throw new Error(await res.text())
  }

  return address
}

export interface DepositOptions {
  relayers: string[]
  channel: string
  receiver: string
  sender?: string
  requestTimeoutMs?: number
  transferTimeoutOffsetSeconds?: number
  memo?: string
  network?: BitcoinNetwork
  successThreshold?: number
}

export interface DepositSuccess {
  code: 0
  bitcoinAddress: string
  expirationTimeMs: number
  bridgeFeeRate: number
  minerFeeRate: number // sats per deposit
  qrCodeData: string
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
  f: any
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
        }
      )
    }
  })
}

export async function generateDepositAddress(
  opts: DepositOptions
): Promise<DepositResult> {
  try {
    let requestTimeoutMs = opts.requestTimeoutMs || 20_000
    let successThreshold =
      typeof opts.successThreshold === 'number' ? opts.successThreshold : 2 / 3
    if (successThreshold <= 0 || successThreshold > 1) {
      throw new Error('opts.successThreshold must be between 0 - 1')
    }
    let successThresholdCount = Math.round(
      opts.relayers.length * successThreshold
    )

    let ibcDestBytes = encode(makeIbcDest(opts))

    let consensusRelayerResponse: string = await consensusReq(
      opts.relayers,
      successThresholdCount,
      requestTimeoutMs,
      getSigset
    )
    let sigset = JSON.parse(consensusRelayerResponse) as SigSet

    if (!sigset.depositsEnabled) {
      return {
        code: 2,
        reason: 'Capacity limit reached',
      }
    }

    let consensusDepositAddress: string = await consensusReq(
      opts.relayers,
      successThresholdCount,
      requestTimeoutMs,
      (relayer: string) => {
        return getDepositAddress(relayer, sigset, opts.network, ibcDestBytes)
      }
    )

    // generate QR code base64
    let qrCode = create({})
    qrCode.update({
      data: consensusDepositAddress,
    })
    let blob = await qrCode.getRawData('svg')
    let qrCodeData: string = await new Promise((resolve, reject) => {
      let reader = new FileReader()
      reader.readAsDataURL(blob)
      reader.onloadend = function () {
        resolve(reader.result as any)
      }
    })

    return {
      code: 0,
      bitcoinAddress: consensusDepositAddress,
      expirationTimeMs: Date.now() + 5 * oneDaySeconds * 1000,
      bridgeFeeRate: sigset.bridgeFeeRate,
      minerFeeRate: sigset.minerFeeRate,
      qrCodeData,
    }
  } catch (e: any) {
    return {
      code: 1,
      reason: e.toString(),
    }
  }
}

export async function generateQRCode(data: string) {
  let qrCode = create({})
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
