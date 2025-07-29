import crypto, { BinaryToTextEncoding } from 'crypto'

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
  let encrypted = cipher.update(Buffer.from(p).toString('hex'), 'utf-8', 'hex')
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

export const randomString = (f: string) => {
  return f.replace(/[xy]/g, (e) => {
    var t = (16 * Math.random()) | 0,
      n = 'x' === e ? t : (3 & t) | 8
    return n.toString(16)
  })
}
