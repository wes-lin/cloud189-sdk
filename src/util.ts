import crypto, { BinaryToTextEncoding } from 'crypto'
import fs from 'fs'
import path from 'path'

export const sortParameter = (data): string => {
  if (!data) {
    return ''
  }
  const e = Object.entries(data).map((t) => t.join('='))
  e.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))
  return e.join('&')
}

export const getSignature = (data) => {
  const parameter = sortParameter(data)
  return crypto.createHash('md5').update(parameter).digest('hex')
}

export const rsaEncrypt = (
  publicKey: string,
  origData: string,
  encoding: BinaryToTextEncoding = 'hex'
) => {
  const encryptedData = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING
    },
    Buffer.from(origData)
  )
  return encryptedData.toString(encoding)
}

export const aesECBEncrypt = (data, key: string) => {
  const p = Object.entries(data)
    .map((t) => t.join('='))
    .join('&')
  const cipher = crypto.createCipheriv('aes-128-ecb', Buffer.from(key, 'utf8'), null)
  cipher.setAutoPadding(true)
  let encrypted = cipher.update(p, 'utf-8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted
}

export const hmacSha1 = (data, key, encoding: BinaryToTextEncoding = 'hex') => {
  const p = Object.entries(data)
    .map((t) => t.join('='))
    .join('&')
  const hmac = crypto.createHmac('sha1', key)
  hmac.update(p)
  return hmac.digest(encoding)
}

export const hexToBase64 = (data) => {
  const buffer = Buffer.from(data, 'hex')
  return buffer.toString('base64')
}

export const md5 = (data)=>{
  return crypto.createHash('md5').update(data).digest('hex')
}

export const randomString = (f: string) => {
  return f.replace(/[xy]/g, (e) => {
    var t = (16 * Math.random()) | 0,
      n = 'x' === e ? t : (3 & t) | 8
    return n.toString(16)
  })
}

export const partSize = (size) => {
  const DEFAULT = 1024 * 1024 * 10 // 10 MiB

  if (size > DEFAULT * 2 * 999) {
    const chunkSize = size / 1999
    const ratio = chunkSize / DEFAULT
    const multiplier = Math.max(Math.ceil(ratio), 5)
    return multiplier * DEFAULT
  }

  if (size > DEFAULT * 999) {
    return DEFAULT * 2 // 20 MiB
  }

  return DEFAULT
}

export const calculateFileAndChunkMD5 = (
  filePath,
  chunkSize = 1024 * 1024
): Promise<{
  fileMd5: string
  chunkMd5s: string[]
}> => {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { highWaterMark: chunkSize })
    const fileHash = crypto.createHash('md5')
    const chunkMd5s = []
    // const chunkPaths = []
    // const tempDir = path.join(__dirname, 'temp', Date.now().toString())

    // fs.mkdirSync(tempDir, { recursive: true })
    // let chunkIndex = 0

    stream.on('data', (chunk) => {
      fileHash.update(chunk)
      const chunkHash = md5(chunk)
      chunkMd5s.push(chunkHash)
      // const chunkPath = path.join(tempDir, `chunk-${chunkIndex}`)
      // fs.writeFileSync(chunkPath, chunk)
      // chunkPaths.push(chunkPath)
      // chunkIndex++
    })

    stream.on('end', () => {
      const fileMd5 = fileHash.digest('hex')
      stream.close()
      resolve({ fileMd5, chunkMd5s })
    })

    stream.on('error', (err) => {
      // fs.rmSync(tempDir, { recursive: true, force: true })
      reject(err)
    })
  })
}
