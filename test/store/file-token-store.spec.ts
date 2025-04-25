import { expect } from 'chai'
import sinon from 'sinon'
import fs from 'node:fs'
import path from 'path'
import { FileTokenStore } from '../../src/store'

describe('FileTokenStore', () => {
  const testFilePath = path.join(__dirname, 'test-tokens', 'token.json')

  beforeEach(() => {
    const dir = path.dirname(testFilePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  })

  afterEach(() => {
    sinon.restore()
    // Clean up test files
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath)
    }
    if (fs.existsSync(path.dirname(testFilePath))) {
      fs.rmdirSync(path.dirname(testFilePath))
    }
  })

  describe('constructor', () => {
    it('should create non-existent directories', () => {
      // Stub fs methods first
      const mkdirStub = sinon.stub(fs, 'mkdirSync')
      const existsStub = sinon.stub(fs, 'existsSync')

      // Configure existsSync to return false by default
      existsStub.returns(false)
      new FileTokenStore(testFilePath)
      const dir = path.dirname(testFilePath)
      expect(mkdirStub.calledWith(dir, { recursive: true })).to.be.true
    })

    it('should throw error for empty file path', () => {
      expect(() => new FileTokenStore('')).to.throw('Unknown file for read/write token')
    })

    it('should load token data from existing file', () => {
      const testData = {
        accessToken: 'existing_token',
        refreshToken: 'existing_refresh',
        expiresIn: 3600
      }
      fs.writeFileSync(testFilePath, JSON.stringify(testData))

      const store = new FileTokenStore(testFilePath)
      expect(store.get()).to.deep.equal(testData)
    })

    it('should throw error for corrupted JSON file', () => {
      fs.writeFileSync(testFilePath, 'invalid json')
      expect(() => new FileTokenStore(testFilePath)).to.throw('Could not parse token file')
    })
  })

  describe('MemoryStore inheritance', () => {
    it('should correctly inherit get method', async () => {
      const token = { accessToken: 'test' }
      const fileTokenStore = new FileTokenStore(testFilePath)
      await fileTokenStore.update(token)
      expect(fileTokenStore.get().accessToken).to.deep.equal(token.accessToken)
    })

    it('should return empty for empty store', () => {
      const fileTokenStore = new FileTokenStore(testFilePath)
      expect(fileTokenStore.get().accessToken).to.be.empty
    })
  })
})
