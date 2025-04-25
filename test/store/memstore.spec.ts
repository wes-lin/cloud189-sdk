import { expect } from 'chai'
import { MemoryStore } from '../../src/store'

describe('MemoryStore', () => {
  let store: MemoryStore

  beforeEach(() => {
    store = new MemoryStore()
  })

  describe('get', () => {
    it('should return undefined for empty store', async () => {
      const result = await store.get()
      expect(result.accessToken).to.be.empty
      expect(result.refreshToken).to.be.empty
    })

    it('should return stored data', async () => {
      const testData = {
        accessToken: 'test_token',
        refreshToken: 'test_refresh',
        expiresIn: 123456
      }
      await store.update(testData)
      const result = await store.get()
      expect(result).to.deep.equal(testData)
    })
  })

  describe('update', () => {
    it('should store data correctly', async () => {
      const testData = {
        accessToken: 'test_token',
        refreshToken: 'test_refresh',
        expiresIn: 123456
      }
      await store.update(testData)
      const result = await store.get()
      expect(result).to.deep.equal(testData)
    })
  })
})
