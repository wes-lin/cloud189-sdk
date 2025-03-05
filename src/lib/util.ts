import crypto from 'crypto'

const sortParameter = (data): string => {
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

export const rsaEncrypt = (publicKey: string, origData: string | Uint8Array) => {
  const encryptedData = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING
    },
    Buffer.from(origData)
  )
  return encryptedData.toString('hex').toUpperCase()
}
