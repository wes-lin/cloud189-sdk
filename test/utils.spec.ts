import { expect } from 'chai'
import fs from 'fs'
import crypto from 'crypto'
import {
  sortParameter,
  getSignature,
  rsaEncrypt,
  aesECBEncrypt,
  hmacSha1,
  hexToBase64,
  md5,
  partSize,
  randomString,
  calculateFileAndChunkMD5,
  asyncPool
} from '../src/util'

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
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    })
    const publicPem = publicKey.toString('base64')
    it('should encrypt data correctly', () => {
      const testData = 'hello world'
      const encrypted = rsaEncrypt(publicPem, testData)

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
      const encrypted = rsaEncrypt(publicPem, testData)

      expect(encrypted).to.match(/^[0-9a-f]+$/)
    })

    it('should handle empty string input', () => {
      const encrypted = rsaEncrypt(publicPem, '')
      expect(encrypted).to.be.a('string')
    })

    it('should throw error for invalid public key', () => {
      const invalidKey = 'invalid-public-key'
      expect(() => rsaEncrypt(invalidKey, 'test')).to.throw()
    })
  })

  describe('aesECBEncrypt()', () => {
    it('should encrypt data with AES-128-ECB', () => {
      const data = { foo: 'bar', baz: 'qux' }
      const key = crypto.randomUUID().replace(/-/g, '').substring(0, 16)
      const result = aesECBEncrypt(data, key)

      expect(result).to.match(/^[a-f0-9]+$/) // Hex output
      expect(result).to.have.length.greaterThan(0)

      // Verify decryption round trip
      const decipher = crypto.createDecipheriv('aes-128-ecb', Buffer.from(key, 'utf8'), null)
      let decrypted = decipher.update(result, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      expect(decrypted).to.equal('foo=bar&baz=qux')
    })

    it('should throw for invalid key length', () => {
      expect(() => aesECBEncrypt({}, 'shortkey')).to.throw()
    })
  })

  describe('hmacSha1()', () => {
    it('should generate HMAC-SHA1 signature in hex by default', () => {
      const data = { param1: 'value1', param2: 'value2' }
      const key = 'secret-key'
      const result = hmacSha1(data, key)

      expect(result).to.match(/^[a-f0-9]+$/)
      expect(result).to.have.length(40) // SHA-1 hex is 40 chars
    })

    it('should support base64 output', () => {
      const result = hmacSha1({ test: 'data' }, 'key', 'base64')
      expect(result).to.match(/^[A-Za-z0-9+/]+={0,2}$/)
    })
  })

  describe('hexToBase64()', () => {
    it('should convert hex string to base64', () => {
      const hex = '48656c6c6f20576f726c64' // "Hello World"
      const result = hexToBase64(hex)
      expect(result).to.equal('SGVsbG8gV29ybGQ=')
    })

    it('should handle empty string', () => {
      expect(hexToBase64('')).to.equal('')
    })
  })

  describe('md5()', () => {
    it('should generate correct MD5 hash', () => {
      const input = 'test string'
      const expected = crypto.createHash('md5').update(input).digest('hex')
      expect(md5(input)).to.equal(expected)
    })

    it('should handle empty input', () => {
      expect(md5('')).to.equal('d41d8cd98f00b204e9800998ecf8427e')
    })
  })

  describe('randomString()', () => {
    it('should replace x/y with random hex digits', () => {
      const template = 'x-x-y-y-x'
      const result = randomString(template)
      expect(result).to.match(/^[0-9a-f]-[0-9a-f]-[0-9a-f]-[0-9a-f]-[0-9a-f]$/)
    })

    it('should preserve non-x/y characters', () => {
      const result = randomString('a-x-b-y-c')
      expect(result).to.match(/^a-[0-9a-f]-b-[0-9a-f]-c$/)
    })
  })

  describe('partSize()', () => {
    it('should return 10MB for small files (<10MB)', () => {
      expect(partSize(1024 * 1024 * 5)).to.equal(1024 * 1024 * 10)
    })

    it('should return 20MB for medium files (10MB-20GB)', () => {
      expect(partSize(1024 * 1024 * 10 * 1000)).to.equal(1024 * 1024 * 20)
    })

    it('should return larger chunks for huge files (>20GB)', () => {
      const hugeFile = 1024 * 1024 * 10 * 2000 // ~20GB
      expect(partSize(hugeFile)).to.be.equal(1024 * 1024 * 50)
    })

    it('should handle zero size', () => {
      expect(partSize(0)).to.equal(1024 * 1024 * 10)
    })
  })

  describe('calculateFileAndChunkMD5', () => {
    const testFilePath = './test-file.txt'
    const testFileContent = 'This is a test file content for MD5 calculation'
    const testFileMd5 = crypto.createHash('md5').update(testFileContent).digest('hex')
    const chunkSize = 10 // Small chunk size for testing

    before(() => {
      // Create a test file
      fs.writeFileSync(testFilePath, testFileContent)
    })

    after(() => {
      // Clean up test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath)
      }
    })

    it('should calculate correct file MD5 and chunk MD5s', async () => {
      const result = await calculateFileAndChunkMD5(testFilePath, chunkSize)

      expect(result.fileMd5).to.equal(testFileMd5)
      expect(result.chunkMd5s).to.have.length(Math.ceil(testFileContent.length / chunkSize))

      // Verify chunk MD5s
      const expectedChunkMd5s: string[] = []
      for (let i = 0; i < testFileContent.length; i += chunkSize) {
        const chunk = testFileContent.slice(i, i + chunkSize)
        expectedChunkMd5s.push(crypto.createHash('md5').update(chunk).digest('hex').toUpperCase())
      }

      expect(result.chunkMd5s).to.deep.equal(expectedChunkMd5s)
    })

    it('should reject when file read fails', async () => {
      const nonExistentFile = './non-existent-file.txt'
      try {
        await calculateFileAndChunkMD5(nonExistentFile)
        expect.fail('Should have thrown an error')
      } catch (err) {
        expect(err).to.be.an('error')
      }
    })

    it('should handle empty file', async () => {
      const emptyFilePath = './empty-file.txt'
      fs.writeFileSync(emptyFilePath, '')

      try {
        const result = await calculateFileAndChunkMD5(emptyFilePath)
        expect(result.fileMd5).to.equal(crypto.createHash('md5').update('').digest('hex'))
        expect(result.chunkMd5s).to.be.an('array').that.is.empty
      } finally {
        fs.unlinkSync(emptyFilePath)
      }
    })
  })

  describe('asyncPool', () => {
    it('should execute tasks with concurrency limit', async () => {
      const tasks = [1, 2, 3, 4, 5]
      const results = []
      const iteratorFn = async (n) => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return n * 2
      }

      const startTime = Date.now()
      const result = await asyncPool(2, tasks, iteratorFn)
      const duration = Date.now() - startTime

      expect(result).to.deep.equal([2, 4, 6, 8, 10])
      // Should take ~300ms (3 batches of 2,2,1 with 100ms each)
      expect(duration).to.be.greaterThan(290).and.lessThan(400)
    })

    it('should handle empty task array', async () => {
      const result = await asyncPool(2, [], () => Promise.resolve())
      expect(result).to.be.an('array').that.is.empty
    })

    it('should handle poolLimit greater than task count', async () => {
      const tasks = [1, 2]
      const result = await asyncPool(5, tasks, (n) => Promise.resolve(n * 2))
      expect(result).to.deep.equal([2, 4])
    })

    it('should propagate errors correctly', async () => {
      const tasks = [1, 2, 3]
      const iteratorFn = async (n) => {
        if (n === 2) throw new Error('Test error')
        return n
      }

      try {
        await asyncPool(2, tasks, iteratorFn)
        expect.fail('Should have thrown an error')
      } catch (err) {
        expect(err.message).to.equal('Test error')
      }
    })

    it('should maintain order of results', async () => {
      const tasks = [1, 2, 3, 4, 5]
      // Delays: 1=200ms, 2=100ms, 3=50ms, etc.
      const iteratorFn = async (n) => {
        await new Promise((resolve) => setTimeout(resolve, (6 - n) * 50))
        return n
      }

      const result = await asyncPool(2, tasks, iteratorFn)
      expect(result).to.deep.equal([1, 2, 3, 4, 5])
    })
  })
})
