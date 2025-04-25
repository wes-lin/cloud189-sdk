import { expect } from 'chai'
import crypto from 'crypto'
import { sortParameter, getSignature, rsaEncrypt } from '../src/util'

describe('Crypto Utility Functions', () => {
  describe('sortParameter function', () => {
    it('should handle empty input correctly', () => {
      expect(sortParameter(null)).to.equal('')
      expect(sortParameter(undefined)).to.equal('')
      expect(sortParameter({})).to.equal('')
    })

    it('should sort parameters alphabetically', () => {
      const input = { b: '2', a: '1', c: '3' }
      const expected = 'a=1&b=2&c=3'
      expect(sortParameter(input)).to.equal(expected)
    })
  })

  describe('getSignature function', () => {
    it('should generate correct MD5 signature', () => {
      const input = { timestamp: '1234567890', nonce: 'abcdef' }
      const parameter = 'nonce=abcdef&timestamp=1234567890'
      const expected = crypto.createHash('md5').update(parameter).digest('hex')

      expect(getSignature(input)).to.equal(expected)
    })

    it('should generate consistent signature for empty object', () => {
      const emptySignature = crypto.createHash('md5').update('').digest('hex')
      expect(getSignature({})).to.equal(emptySignature)
    })
  })

  describe('rsaEncrypt function', () => {
    // Generate RSA key pair for testing
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    })

    it('should encrypt data correctly', () => {
      const testData = 'hello world'
      const encrypted = rsaEncrypt(publicKey, testData)

      // Verify encrypted data can be decrypted
      const decrypted = crypto
        .privateDecrypt(
          {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_PADDING
          },
          Buffer.from(encrypted, 'hex')
        )
        .toString()

      expect(decrypted).to.equal(testData)
    })

    it('should return encrypted data in uppercase hex format', () => {
      const testData = 'test'
      const encrypted = rsaEncrypt(publicKey, testData)

      expect(encrypted).to.match(/^[0-9A-F]+$/)
    })

    it('should handle empty string input', () => {
      const encrypted = rsaEncrypt(publicKey, '')
      expect(encrypted).to.be.a('string')
    })

    it('should throw error for invalid public key', () => {
      const invalidKey = 'invalid-public-key'
      expect(() => rsaEncrypt(invalidKey, 'test')).to.throw()
    })
  })
})
