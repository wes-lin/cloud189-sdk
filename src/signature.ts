import url from 'url'
import { NormalizedOptions } from 'got'
import { aesECBEncrypt, getSignature, hmacSha1, randomString, rsaEncrypt } from './util'
import { logger } from './log'

export const signatureAccesstoken = (options: NormalizedOptions, accessToken: string) => {
  const time = String(Date.now())
  const { query } = url.parse(options.url.toString(), true)
  const signature = getSignature({
    ...(options.method === 'GET' ? query : options.json || options.form),
    Timestamp: time,
    AccessToken: accessToken
  })
  options.headers['Sign-Type'] = '1'
  options.headers['Signature'] = signature
  options.headers['Timestamp'] = time
  options.headers['Accesstoken'] = accessToken
}

export const signatureAppKey = (options: NormalizedOptions, appkey: string) => {
  const time = String(Date.now())
  const { query } = url.parse(options.url.toString(), true)
  const signature = getSignature({
    ...(options.method === 'GET' ? query : options.json || options.form),
    Timestamp: time,
    AppKey: appkey
  })
  options.headers['Sign-Type'] = '1'
  options.headers['Signature'] = signature
  options.headers['Timestamp'] = time
  options.headers['AppKey'] = appkey
}

export const signatureUpload = (
  options: NormalizedOptions,
  rsaKey: {
    pubKey: string
    pkId: string
  },
  sessionKey: string
) => {
  const time = String(Date.now())
  const { query } = url.parse(options.url.toString(), true)
  const requestID = randomString('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx')
  const uuid = randomString('xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx').slice(
    0,
    (16 + 16 * Math.random()) | 0
  )
  logger.debug(`upload query: ${JSON.stringify(query)}`)
  const params = aesECBEncrypt(query, uuid.substring(0, 16))
  const data = {
    SessionKey: sessionKey,
    Operate: 'GET',
    RequestURI: options.url.pathname,
    Date: time,
    params
  }
  const encryptionText = rsaEncrypt(rsaKey.pubKey, uuid, 'base64')
  options.headers['X-Request-Date'] = time
  options.headers['X-Request-ID'] = requestID
  options.headers['SessionKey'] = sessionKey
  options.headers['EncryptionText'] = encryptionText
  options.headers['PkId'] = rsaKey.pkId
  options.headers['Signature'] = hmacSha1(data, uuid)
  options.url.search = ''
  options.url.hash = ''
  options.url.searchParams.set('params', params)
}
