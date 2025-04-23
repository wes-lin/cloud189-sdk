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
    // 清理测试文件
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath)
    }
    if (fs.existsSync(path.dirname(testFilePath))) {
      fs.rmdirSync(path.dirname(testFilePath))
    }
  })

  describe('constructor', () => {
    it('应该创建不存在的目录', () => {
      // 先 stub fs 方法
      const mkdirStub = sinon.stub(fs, 'mkdirSync')
      const existsStub = sinon.stub(fs, 'existsSync')

      // 默认设置 existsSync 返回 true
      existsStub.returns(false)
      new FileTokenStore(testFilePath)
      const dir = path.dirname(testFilePath)
      expect(mkdirStub.calledWith(dir, { recursive: true })).to.be.true
    })

    it('空文件路径应该抛出错误', () => {
      expect(() => new FileTokenStore('')).to.throw('Unknown file for read/write token')
    })

    it('应该从现有文件加载token数据', () => {
      const testData = {
        accessToken: 'existing_token',
        refreshToken: 'existing_refresh',
        expiresIn: 3600
      }
      fs.writeFileSync(testFilePath, JSON.stringify(testData))

      const store = new FileTokenStore(testFilePath)
      expect(store.get()).to.deep.equal(testData)
    })

    it('损坏的JSON文件应该抛出错误', () => {
      fs.writeFileSync(testFilePath, 'invalid json')
      expect(() => new FileTokenStore(testFilePath)).to.throw('Could not parse token file')
    })
  })

  describe('继承MemoryStore功能', () => {
    it('应该正确继承get方法', async () => {
      const token = { accessToken: 'test' }
      const fileTokenStore = new FileTokenStore(testFilePath)
      await fileTokenStore.update(token)
      expect(fileTokenStore.get().accessToken).to.deep.equal(token.accessToken)
    })

    it('空存储应该返回空', () => {
      const fileTokenStore = new FileTokenStore(testFilePath)
      expect(fileTokenStore.get().accessToken).to.be.empty
    })
  })
})
