import crypto from 'crypto'

const sortParameter = (data): string => {
  if (!data) {
    return ''
  }
  const e = Object.entries(data).map((t) => t.join('='))
  e.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))
  return e.join('&')
}

const getSignature = (data) => {
  const parameter = sortParameter(data)
  return crypto.createHash('md5').update(parameter).digest('hex')
}

export { getSignature }
