import { expect } from 'chai'
import sinon from 'sinon'
import nock from 'nock'
import fs from 'fs'
import path from 'path'
import { CloudClient, MemoryStore, logger } from '../src'
import {
  UserSizeInfoResponse,
  UserSignResponse,
  FamilyListResponse,
  FamilyUserSignResponse
} from '../src/types'
import { WEB_URL, API_URL, AUTH_URL, ReturnURL, UPLOAD_URL } from '../src/const'
import * as util from '../src/util'

logger.configure({
  isDebugEnabled: true
})

describe('CloudClient', () => {
  let cloudClient: CloudClient
  const mockSession = {
    sessionKey: 'test_session_key',
    accessToken: 'test_access_token',
    refreshToken: 'test_refresh_token'
  }

  beforeEach(() => {
    // Mock store
    const store = new MemoryStore()
    sinon.stub(store, 'get').resolves({
      accessToken: 'stored_access_token',
      refreshToken: 'stored_refresh_token',
      expiresIn: Date.now() + 3600000 // 1 hour later
    })

    cloudClient = new CloudClient({
      username: 'test_user',
      password: 'test_pass',
      token: store
    })

    // Mock getSessionKey
    nock(API_URL).post('/getSessionForPC.action').query(true).reply(200, mockSession)

    // Mock getAccessToken
    nock(WEB_URL).get('/api/open/oauth2/getAccessTokenBySsKey.action').query(true).reply(200, {
      accessToken: 'test_access_token'
    })
  })

  afterEach(() => {
    sinon.restore()
    nock.cleanAll()
  })

  describe('getUserSizeInfo', () => {
    it('should return user size info', async () => {
      const mockResponse: UserSizeInfoResponse = {
        cloudCapacityInfo: {
          totalSize: 100,
          usedSize: 50,
          freeSize: 50
        },
        familyCapacityInfo: {
          totalSize: 100,
          usedSize: 50,
          freeSize: 50
        }
      }

      nock(WEB_URL)
        .get('/api/portal/getUserSizeInfo.action')
        .query({ sessionKey: 'test_session_key' })
        .reply(200, mockResponse)

      const result = await cloudClient.getUserSizeInfo()
      expect(result).to.deep.equal(mockResponse)
    })
  })

  describe('userSign', () => {
    it('should sign in successfully', async () => {
      const mockResponse: UserSignResponse = {
        netdiskBonus: 50,
        isSign: true
      }

      nock(WEB_URL).get('/mkt/userSign.action').query(true).reply(200, mockResponse)

      const result = await cloudClient.userSign()
      expect(result).to.deep.equal(mockResponse)
    })
  })

  describe('getFamilyList', () => {
    it('should return family list', async () => {
      const mockResponse: FamilyListResponse = {
        familyInfoResp: [
          {
            familyId: '123',
            remarkName: '测试家庭',
            type: 1,
            userRole: 1
          }
        ]
      }

      nock(API_URL).get('/open/family/manage/getFamilyList.action').reply(200, mockResponse)

      const result = await cloudClient.getFamilyList()
      expect(result).to.deep.equal(mockResponse)
    })
  })

  describe('getFileDownloadUrl', () => {
    it('should return file download url', async () => {
      const mockResponse = {
        fileDownloadUrl: 'https://download.cloud.189.cn/file/downloadFile.action'
      }

      nock(API_URL).get('/open/file/getFileDownloadUrl.action').query(true).reply(200, mockResponse)

      const result = await cloudClient.getFileDownloadUrl({
        fileId: '1234'
      })
      expect(result).to.deep.equal(mockResponse)
    })

    it('should return family file download url', async () => {
      const mockResponse = {
        fileDownloadUrl: 'https://download.cloud.189.cn/file/downloadFile.action'
      }

      nock(API_URL)
        .get('/open/family/file/getFileDownloadUrl.action')
        .query(true)
        .reply(200, mockResponse)

      const result = await cloudClient.getFileDownloadUrl({
        fileId: '1234',
        familyId: '1234'
      })
      expect(result).to.deep.equal(mockResponse)
    })
  })

  describe('createBatchTask', () => {
    it('should return createBatchTask success', async () => {
      const mockResponse = { successedFileIdList: [1234], taskId: '1', taskStatus: 4 }

      nock(API_URL).post('/open/batch/createBatchTask.action').reply(200, {
        taskId: '1'
      })
      nock(API_URL).post('/open/batch/checkBatchTask.action').reply(200, mockResponse)

      const result = await cloudClient.createBatchTask({
        type: 'COPY',
        taskInfos: [
          {
            fileId: '1111',
            isFolder: 1
          }
        ]
      })
      expect(result).to.deep.equal(mockResponse)
    })
  })
})

describe('CloudClient valid', () => {
  it('token is empty', () => {
    try {
      new CloudClient({})
    } catch (err) {
      expect(err).to.be.an('error')
      expect(err.message).to.equal('Please provide username and password or token !')
    }
  })
  it('password is empty', () => {
    try {
      new CloudClient({ username: 'username' })
    } catch (err) {
      expect(err).to.be.an('error')
      expect(err.message).to.equal('Please provide username and password or token !')
    }
  })
})

describe('CloudClient session', () => {

  it('Get Session', async () => {
    let count = 0
    nock(API_URL)
      .post('/getSessionForPC.action')
      .times(4)
      .query(true)
      .reply(() => {
        count++
        if (count > 3) {
          return [200, { sessionKey: 'SessionKey' }]
        } else {
          return [400]
        }
      })

    nock(AUTH_URL)
      .post('/api/oauth2/refreshToken.do')
      .query(true)
      .reply(200, { accessToken: 'accessToken', expiresIn: 10 })

    let retryUnifyLoginForPC = true
    const testCookie = 'test-sso-cookie'
    const redirectUrl = '/api/logbox/oauth2/unifyAccountLogin.do'
    nock(AUTH_URL).get(redirectUrl).reply(200, '<html></html>')
    nock(AUTH_URL)
      .get(redirectUrl)
      .matchHeader('Cookie', `SSON=${testCookie}`)
      .reply(302, undefined, { Location: ReturnURL })
    nock(WEB_URL)
      .get('/api/portal/unifyLoginForPC.action')
      .times(2)
      .query(true)
      .reply(() => {
        if (retryUnifyLoginForPC) {
          // sson cookie登陆
          retryUnifyLoginForPC = false
          return [302, undefined, { Location: AUTH_URL + redirectUrl }]
        } else {
          // 密码登陆
          return [
            200,
            `<input type='hidden' name='captchaToken' value='8d30750b3368284234a14361ef6a21dam9vi7nay'>
            <script type="text/javascript">
            /*qr扫码登录客户端配置*/
            var qrLoginClientDownloadLink = 'https://user.e.189.cn/topic/intro/intro.html',
              qrLoginClientName = 'none',
              qrLoginText = '公告：部分新版微信安卓端存在扫码登录失败问题，建议通过小翼管家、支付宝等扫码登录';

            var clientType = '10020', //客户端类型  1web  2wap
              accountType = '02', //所支持的账号类型
              appKey = '8025431004',
              sso = 'yes', //no不显示
              returnUrl = 'https://m.cloud.189.cn/zhuanti/2020/loginErrorPc/index.html', //未解析的成功跳转链接
              regReturnUrl = '';

            var loginSort = 'Qr|Pw|Sms', //登录模式显示顺序
              themeStyle = '', //配置主题色
              borderStyle = 'false', //配置边框
              placeholder = '手机号/邮箱', //手机号 / 邮箱
              mailSuffix = ''; //undefined eg'@189.cn'

            var EmailExt;
            EmailExt = '';

            var isNeedSecondAuth = '',
              mobile = '',
              showName = '',
              loginName = '',
              romaName = '';
            var romaSecondAuth = '';
            var defaultUserName = "";
            var llnum = '';
            var message5gLogin = '';
            var isOauth2 = "false";
            var state = "";
            var showQrSaveName = "false";
            var showPwSaveName = "true";
            var showFeedback = "false";
            var size = "";
            var regUrl1 = "https://e.189.cn/register.do?returnUrl=" + regReturnUrl + "&appKey=" + appKey +
              "&mobileOnly=true";
            var regUrl2 = "https://e.189.cn/register/mobile/step1.do?returnUrl=" + regReturnUrl + "&appKey=" +
              appKey + "&mobileOnly=true";
            var lt = "EE2CF58D2B6686042278AA0775F7724DA53F0C5CC479D064B7FEB8F624E4C580DF078F857715085E223C44561C23490DF0ACFCB3A7FF82125908D3E2C224EE1C10BF8E5FAF8A8219DD58316DBD8812C1959F1F9221F38B30";
            var paramId = "F3E625A8AFAAF0D80C5FA07094033CC4203A1D7086907000A6AA0E4E99D33FEFE54FE6B66DA10CB9BB8FAD1E2060ACE74440A73E0E327B5E4B87BBB175AC92C2F5BEDCB701849A56";
            var reqId = "1a6f8428ca8544ba";
            var guid = "4e4b5d2619e94b239d2be09edd73e342";
            var _ux_version = "V4.1"
          </script>`
          ]
        }
      })

    const encryptConfResponse = {
      data: {
        pubKey:
          'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCZLyV4gHNDUGJMZoOcYauxmNEsKrc0TlLeBEVVIIQNzG4WqjimceOj5R9ETwDeeSN3yejAKLGHgx83lyy2wBjvnbfm/nLObyWwQD/09CmpZdxoFYCH6rdDjRpwZOZ2nXSZpgkZXoOBkfNXNxnN74aXtho2dqBynTw3NFTWyQl8BQIDAQAB',
        pre: '{NRP}'
      }
    }

    nock(AUTH_URL).post('/api/logbox/config/encryptConf.do').reply(200, encryptConfResponse)

    nock(AUTH_URL).post('/api/logbox/oauth2/loginSubmit.do').reply(200, {
      result: 0,
      msg: '登录成功',
      toUrl:
        'https://m.cloud.189.cn/zhuanti/2020/loginErrorPc/index.html?appId=8025431004&paras=DA95B973583E0167656DD19E372DFD443C56452DB111C1844EA92E7416CA5ABADB416432F6D7AD435090E6E450AD033D0F38FF8209C09D1E1BCE7868C8FD6FB852A87482D6282B88E5233742ACB4E1147C0E0E956C7207D9765DDBA25F051D98938AAC1101FD4306B3AE393C71CFF42E48FAF7C55766A1170C709B87677B973D586901D6FCF2505636B9F02C237CDF92D7778B7C465BA08C09C91C0E3AAC1787714C0DFD286D3655C2FA9E9947F488AB8ADFE5AF1057A39843BE9B7658841D57D40D0637E9D19487D39549ACE92D50447E1F54357B2F335E66B627728818896B4133F1C6D89A1D5BE9BF44CF5B335E993367139E08405D26C3ABBC50F0DCAFF90CE319656731F9EA9910D26BCA7BE7ED840CD5559930D1DD7149C1281AE43F9ADBBF1CE89CA6D0880DC7C7EE3027D9E543B863FC748CA809BF5519F8B612C7B88AF2406B0A6D1BAA2D2DEAF6F5B8C12932D94A002DC4BA3EA9EFC4E4E8225375740D5B0FC228B9DDA8CC160296C5EA588FC4B3CA80A37FAB2CD092E7C880A5678862D37891468B6F356CAE468A0AEC6E485E6C9D8C0A05CE0FF335B8C5D7AAA9B58A13D95C776107075C2389F5E8966AEB2C01BC59C3B47B97E8A4DF7F1FB0BD08F782E0772874EDF4DAC9E11862588A0ABDE8B4C14141CD0AB2EF356CBAA0CCB72B852513C861C36BEC0BDB77A638E679BA9248C1498152904436CE9F01E740811BE54F26A268D8B26B8D347FF746A6B258CF86E0CAA6BFC87AED1413973ABDD3EBFAFEAADA70A70AE9C4DAFEBFD9DCAFAC2E9D4F233AF20DE727E8FA6250EEEDF61BD3F79D8CFA802DFDB79AAA1ACD5F5E42099200EB35D53ED3A98D9451940B97D651B5DE7ABCF6F171EA536032F2362559812BCCC36803DF98AEF7B42A311DE280EE75456C772F02B66EE0B221EF35E678A1E8920FC2EE6AC80995C014BDB9BBDA0A3256974FB56D45E03E8E502961E55FB14E0F2802CF072D96C0292B4A1E55B9091B318C88162A7CC17F11BE3FE22F95EA1F0B45CC59A44844&sign=341C66F8B477F6C20D1712CFBB0856703B2C1982'
    })
    nock('https://m.cloud.189.cn')
      .get('/zhuanti/2020/loginErrorPc/index.html')
      .times(2)
      .query(true)
      .reply(200)
    // Mock store
    const store = new MemoryStore()
    store.update({
      accessToken: 'stored_access_token',
      refreshToken: 'stored_refresh_token',
      expiresIn: Date.now() + 3600000 // 1 hour later
    })
    const cloudClient = new CloudClient({
      username: 'test_user',
      password: 'test_pass',
      token: store,
      ssonCookie: testCookie
    })
    await cloudClient.getSession()
  })

  it('Get Session fail', async () => {
    const cloudClient = new CloudClient({
      username: 'test_user',
      password: 'test_pass',
    })
    try {
      await cloudClient.getSession()
    } catch(error) {
      expect(error.message).to.include('Can not get session')
    }
   
  })

  it('Refresh InvalidSessionKey', async () => {
    const responses = [{ sessionKey: 'InvalidSessionKey' }, { sessionKey: 'SessionKey' }]
    nock(API_URL)
      .post('/getSessionForPC.action')
      .times(responses.length)
      .query(true)
      .reply(() => [200, responses.shift()])

    nock(WEB_URL)
      .get('/api/portal/getUserSizeInfo.action')
      .times(3)
      .query(true)
      .reply((uri) => {
        const query = new URLSearchParams(uri.split('?')[1])
        const sessionKey = query.get('sessionKey')
        if (sessionKey === 'InvalidSessionKey') {
          return [
            400,
            {
              errorCode: 'InvalidSessionKey',
              errorMsg: 'sessionKey is expirated'
            }
          ]
        } else {
          return [200]
        }
      })

    // Mock store
    const store = new MemoryStore()
    store.update({
      accessToken: 'stored_access_token',
      expiresIn: Date.now() + 3600000 // 1 hour later
    })
    const cloudClient = new CloudClient({
      username: 'test_user',
      password: 'test_pass',
      token: store
    })
    await cloudClient.getUserSizeInfo()
  })

  it('Refresh InvalidAccessToken', async () => {
    // 第一次过期，第二次尝试重新登陆
    let retry = true
    nock(API_URL)
      .post('/getSessionForPC.action')
      .query(true)
      .reply(200, { sessionKey: 'SessionKey' })

    nock(WEB_URL)
      .get('/api/open/oauth2/getAccessTokenBySsKey.action')
      .times(2)
      .query(true)
      .reply(200, {
        accessToken: 'test_access_token'
      })

    nock(API_URL)
      .get('/open/family/manage/exeFamilyUserSign.action')
      .times(3)
      .query(true)
      .reply(() => {
        if (retry) {
          retry = false
          return [400, { errorCode: 'InvalidAccessToken', errorMsg: 'accessToken is expirated' }]
        } else {
          return [200]
        }
      })

    // Mock store
    const store = new MemoryStore()
    store.update({
      accessToken: 'stored_access_token',
      expiresIn: Date.now() + 3600000 // 1 hour later
    })
    const cloudClient = new CloudClient({
      username: 'test_user',
      password: 'test_pass',
      token: store
    })

    await cloudClient.familyUserSign('1')
  })
  
})


it('get Session with sso username', async () => {
    let count = 0
    nock(API_URL)
      .post('/getSessionForPC.action')
      .times(4)
      .query(true)
      .reply(() => {
        count++
        if (count > 3) {
          return [200, { sessionKey: 'SessionKey' }]
        } else {
          return [400]
        }
      })
    nock(AUTH_URL)
      .post('/api/oauth2/refreshToken.do')
      .query(true)
      .reply(200, { accessToken: 'accessToken', expiresIn: 10 })
})

describe('CloudClient upload', () => {
  let fsStatStub: sinon.SinonStub
  let calculateMD5Stub: sinon.SinonStub
  let pathBasenameStub: sinon.SinonStub
  let fsOpenStub: sinon.SinonStub
  let partSizeStub: sinon.SinonStub
  let cloudClient: CloudClient
  
  const mockFilePath = '/path/to/file.txt'
  const mockFileName = 'file.txt'
  const mockFileMd5 = 'file-md5-hash'
  const mockChunkMd5s = ['file-md5-hash']
  const mockUploadFileId = '1234567890'

  const mockStats = {
      size: 1024
    }

  beforeEach(() => {
    fsStatStub = sinon.stub(fs.promises, 'stat').resolves(mockStats as any)
    calculateMD5Stub = sinon.stub(util, 'calculateFileAndChunkMD5')
    pathBasenameStub = sinon.stub(path, 'basename').returns(mockFileName)
    fsOpenStub = sinon.stub(fs.promises, 'open')
    partSizeStub = sinon.stub(util, 'partSize').returns(1024)
        // Mock store
    const store = new MemoryStore()
    sinon.stub(store, 'get').resolves({
      accessToken: 'stored_access_token',
      refreshToken: 'stored_refresh_token',
      expiresIn: Date.now() + 3600000 // 1 hour later
    })

    cloudClient = new CloudClient({
      username: 'test_user',
      password: 'test_pass',
      token: store
    })

    const mockSession = {
      sessionKey: 'test_session_key',
      accessToken: 'test_access_token',
      refreshToken: 'test_refresh_token'
    }
    // Mock getSessionKey
    nock(API_URL).post('/getSessionForPC.action').query(true).reply(200, mockSession)
    // Mock getRsaKey
    nock(WEB_URL).get('/api/security/generateRsaKey.action').query(true).reply(200, {
      res_code: 0,
      res_message: '成功',
      expire: new Date().getTime() + 1000,
      pkId: 'ce97e7b9e67040028fe756e2d2d18453',
      pubKey:
        'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDC72L803mNmrQgyvaUt115S5gSHuDcS+nGdqBakHYqFShEwrEaqKsr2Z/7DQt9AobB0ne2vISUW0tXjhgf5vfl00kT7K+J4j+t3WLkQ6Zwc9KtZHkSW6/fkFSC1EnShPYLsG6rHYa5+wfefOY2P7yEFRsd5DGCqHNWkzOZclsXawIDAQAB',
      ver: '2'
    })
  })

  afterEach(() => {
    sinon.restore()
    nock.cleanAll()
  })

  it('should handle single file upload with fast upload (file exists)', async () => {
    calculateMD5Stub.resolves({ fileMd5: mockFileMd5, chunkMd5s: mockChunkMd5s })
    
    nock(UPLOAD_URL)
      .get('/person/initMultiUpload')
      .query(true)
      .reply(200, {
        data: {
          uploadFileId: mockUploadFileId,
          fileDataExists: 1
        }
      })
    
    nock(UPLOAD_URL)
      .get('/person/commitMultiUploadFile')
      .query(true)
      .reply(200, {
        file: {
          userFileId: mockUploadFileId,
          fileMd5: mockFileMd5,
          fileName: mockFileName
        }
      })

    const result = await cloudClient.upload({
      parentFolderId: '',
      filePath: mockFilePath
    })
    
    expect(result).to.have.property('file')
    expect(result.file.fileMd5).to.equal(mockFileMd5)
    expect(fsOpenStub.called).to.be.false // Should not open file for fast upload
  })

  it('should handle single file upload with actual upload (file does not exist)', async () => {
    calculateMD5Stub.resolves({ fileMd5: mockFileMd5, chunkMd5s: mockChunkMd5s })
    
    const mockFileHandle = {
      read: sinon.stub().resolves({ bytesRead: 1024 }),
      close: sinon.stub().resolves()
    }
    fsOpenStub.resolves(mockFileHandle as any)

    nock(UPLOAD_URL)
      .get('/person/initMultiUpload')
      .query(true)
      .reply(200, {
        data: {
          uploadFileId: mockUploadFileId,
          fileDataExists: 0
        }
      })

    nock(UPLOAD_URL)
      .get('/person/getMultiUploadUrls')
      .query(true)
      .reply(200, {
        uploadUrls: {
          partNumber_1: {
            requestURL: 'http://mock-upload-url',
            requestHeader: 'Authorization=Bearer&Content-Type=application/octet-stream'
          }
        }
      })

    nock('http://mock-upload-url')
      .put('/')
      .reply(200)

    nock(UPLOAD_URL)
      .get('/person/commitMultiUploadFile')
      .query(true)
      .reply(200, {
        file: {
          userFileId: mockUploadFileId,
          fileMd5: mockFileMd5,
          fileName: mockFileName
        }
      })

    const result = await cloudClient.upload({
      parentFolderId: '',
      filePath: mockFilePath
    })

    expect(result).to.have.property('file')
    expect(result.file.fileMd5).to.equal(mockFileMd5)
    expect(fsOpenStub.calledOnce).to.be.true
    expect(mockFileHandle.close.calledOnce).to.be.true
  })

  it('should handle multi-part upload with fast upload', async () => {
    const largeFileStats = { ...mockStats, size: 20480 }
    fsStatStub.resolves(largeFileStats)
    calculateMD5Stub.resolves({ fileMd5: mockFileMd5, chunkMd5s: [mockFileMd5, 'chunk2-md5'] })

    nock(UPLOAD_URL)
      .get('/person/initMultiUpload')
      .query(true)
      .reply(200, {
        data: {
          uploadFileId: mockUploadFileId
        }
      })

    nock(UPLOAD_URL)
      .get('/person/checkTransSecond')
      .query(true)
      .reply(200, {
        data: {
          fileDataExists: 1
        }
      })

    nock(UPLOAD_URL)
      .get('/person/commitMultiUploadFile')
      .query(true)
      .reply(200, {
        file: {
          userFileId: mockUploadFileId,
          fileMd5: mockFileMd5,
          fileName: mockFileName
        }
      })

    const onProgressSpy = sinon.spy()
    const onCompleteSpy = sinon.spy()

    const result = await cloudClient.upload({
      parentFolderId: '',
      filePath: mockFilePath
    },{
      onProgress: onProgressSpy,
      onComplete: onCompleteSpy
    })

    expect(result).to.have.property('file')
    expect(result.file.fileMd5).to.equal(mockFileMd5)
    expect(fsOpenStub.called).to.be.false
    expect(onProgressSpy.calledWith(100)).to.be.true
    expect(onCompleteSpy.called).to.be.true
  })

  it('should handle multi-part upload with actual upload', async () => {
    const largeFileStats = { ...mockStats, size:20480 }
    fsStatStub.resolves(largeFileStats)
    calculateMD5Stub.resolves({ fileMd5: mockFileMd5, chunkMd5s: [mockFileMd5, 'chunk2-md5'] })

    const mockFileHandle = {
      read: sinon.stub().resolves({ bytesRead: 1024 }),
      close: sinon.stub().resolves()
    }
    fsOpenStub.resolves(mockFileHandle as any)

    nock(UPLOAD_URL)
      .get('/person/initMultiUpload')
      .query(true)
      .reply(200, {
        data: {
          uploadFileId: mockUploadFileId
        }
      })

    nock(UPLOAD_URL)
      .get('/person/checkTransSecond')
      .query(true)
      .reply(200, {
        data: {
          fileDataExists: 0
        }
      })

    nock(UPLOAD_URL)
      .get('/person/getMultiUploadUrls')
      .query(true)
      .times(2)
      .reply(200, {
        uploadUrls: {
          partNumber_1: {
            requestURL: 'http://mock-upload-url-1',
            requestHeader: 'Authorization=Bearer&Content-Type=application/octet-stream'
          },
          partNumber_2: {
            requestURL: 'http://mock-upload-url-2', 
            requestHeader: 'Authorization=Bearer&Content-Type=application/octet-stream'
          }
        }
      })

    nock('http://mock-upload-url-1')
      .put('/')
      .reply(200)

    nock('http://mock-upload-url-2')
      .put('/')
      .reply(200)

    nock(UPLOAD_URL)
      .get('/person/commitMultiUploadFile')
      .query(true)
      .reply(200, {
        file: {
          userFileId: mockUploadFileId,
          fileMd5: mockFileMd5,
          fileName: mockFileName
        }
      })

   const onProgressSpy = sinon.spy()

    const result = await cloudClient.upload({
      parentFolderId: '',
      filePath: mockFilePath
    },{
      onProgress: onProgressSpy,
    })

    expect(result).to.have.property('file')
    expect(result.file.fileMd5).to.equal(mockFileMd5)
    expect(fsOpenStub.calledOnce).to.be.true
    expect(mockFileHandle.close.calledOnce).to.be.true
    expect(onProgressSpy.calledWith(100)).to.be.true
  })

  it('should handle family upload', async () => {
    calculateMD5Stub.resolves({ fileMd5: mockFileMd5, chunkMd5s: mockChunkMd5s })

    nock(UPLOAD_URL)
      .get('/family/initMultiUpload')
      .query(true)
      .reply(200, {
        data: {
          uploadFileId: mockUploadFileId,
          fileDataExists: 1
        }
      })

    nock(UPLOAD_URL)
      .get('/family/commitMultiUploadFile')
      .query(true)
      .reply(200, {
        file: {
          userFileId: mockUploadFileId,
          fileMd5: mockFileMd5,
          fileName: mockFileName
        }
      })

    const result = await cloudClient.upload({
      parentFolderId: '',
      filePath: mockFilePath,
      familyId: '123'
    })

    expect(result).to.have.property('file')
    expect(result.file.fileMd5).to.equal(mockFileMd5)
  })

  it('should handle upload progress callbacks', async () => {
    calculateMD5Stub.resolves({ fileMd5: mockFileMd5, chunkMd5s: mockChunkMd5s })
    
    const onProgressSpy = sinon.spy()
    const onCompleteSpy = sinon.spy()

    nock(UPLOAD_URL)
      .get('/person/initMultiUpload')
      .query(true)
      .reply(200, {
        data: {
          uploadFileId: mockUploadFileId,
          fileDataExists: 1
        }
      })

    nock(UPLOAD_URL)
      .get('/person/commitMultiUploadFile')
      .query(true)
      .reply(200, {
        file: {
          userFileId: mockUploadFileId,
          fileMd5: mockFileMd5,
          fileName: mockFileName
        }
      })

    await cloudClient.upload({
      parentFolderId: '',
      filePath: mockFilePath
    }, {
      onProgress: onProgressSpy,
      onComplete: onCompleteSpy
    })

    expect(onProgressSpy.calledWith(100)).to.be.true
    expect(onCompleteSpy.calledOnce).to.be.true
  })

  it('should handle upload error callbacks', async () => {
    calculateMD5Stub.resolves({ fileMd5: mockFileMd5, chunkMd5s: mockChunkMd5s })
    
    const onErrorSpy = sinon.spy()

    nock(UPLOAD_URL)
      .get('/person/initMultiUpload')
      .query(true)
      .reply(500, 'Internal Server Error')

    try {
      await cloudClient.upload({
        parentFolderId: '',
        filePath: mockFilePath
      }, {
        onError: onErrorSpy
      })
    } catch (error) {
      expect(onErrorSpy.calledOnce).to.be.true
    }
  })

   it('should handle part upload error callbacks ', async () => {
    calculateMD5Stub.resolves({ fileMd5: mockFileMd5, chunkMd5s: mockChunkMd5s })
    
    const mockFileHandle = {
      read: sinon.stub().resolves({ bytesRead: 1024 }),
      close: sinon.stub().resolves()
    }
    fsOpenStub.resolves(mockFileHandle as any)

    nock(UPLOAD_URL)
      .get('/person/initMultiUpload')
      .query(true)
      .reply(200, {
        data: {
          uploadFileId: mockUploadFileId,
          fileDataExists: 0
        }
      })

    nock(UPLOAD_URL)
      .get('/person/getMultiUploadUrls')
      .query(true)
      .reply(500, 'Internal Server Error')

    const onErrorSpy = sinon.spy()
    
    try {
    await cloudClient.upload({
      parentFolderId: '',
      filePath: mockFilePath
    }, {
        onError: onErrorSpy
    })
    } catch (error) {
      expect(onErrorSpy.calledOnce).to.be.true
    }
  })

  it('should handle file stat error', async () => {
    fsStatStub.rejects(new Error('ENOENT: no such file or directory'))

    try {
      await cloudClient.upload({
        parentFolderId: '',
        filePath: mockFilePath
      })
      expect.fail('Should have thrown an error')
    } catch (error) {
      expect(error.message).to.include('ENOENT')
    }
  })

  it('should handle MD5 calculation error', async () => {
    calculateMD5Stub.rejects(new Error('MD5 calculation failed'))

    try {
      await cloudClient.upload({
        parentFolderId: '',
        filePath: mockFilePath
      })
      expect.fail('Should have thrown an error')
    } catch (error) {
      expect(error.message).to.include('MD5 calculation failed')
    }
  })
})

describe('CloudClient file operations', () => {
  let cloudClient: CloudClient
  let store: MemoryStore

  beforeEach(() => {
    store = new MemoryStore()
    store.update({
      accessToken: 'test_access_token',
      expiresIn: Date.now() + 3600000 // 1 hour later
    })
    
    cloudClient = new CloudClient({
      username: 'test_user',
      password: 'test_pass',
      token: store
    })

    nock(API_URL)
      .post('/getSessionForPC.action')
      .query(true)
      .reply(200, { sessionKey: 'test_session_key' })

    nock(WEB_URL)
      .get('/api/open/oauth2/getAccessTokenBySsKey.action')
      .query(true)
      .reply(200, { accessToken: 'test_access_token' })
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('getListFiles', () => {
    it('should get personal files with default parameters', async () => {
      const mockResponse = {
        fileListAO: {
          fileList: [
            {
              id: '123',
              name: 'test.txt',
              size: 1024,
              createDate: '2025-01-01',
              lastOpTime: '2025-01-01'
            }
          ],
          folderList: [
            {
              id: '456',
              name: 'test_folder',
              createDate: '2025-01-01',
              lastOpTime: '2025-01-01'
            }
          ],
          count: 2
        }
      }

      nock(API_URL)
        .get('/open/file/listFiles.action')
        .query({
          pageNum: '1',
          pageSize: '60',
          mediaType: '0',
          orderBy: '3',
          descending: 'true',
          folderId: '',
          iconOption: '5'
        })
        .reply(200, mockResponse)

      const result = await cloudClient.getListFiles()
      expect(result).to.deep.equal(mockResponse)
    })

    it('should get personal files with custom parameters', async () => {
      const customQuery = {
        pageNum: 2,
        pageSize: 30,
        folderId: '789'
      }

      const mockResponse = {
        fileListAO: {
          fileList: [],
          folderList: [],
          count: 0
        }
      }

      nock(API_URL)
        .get('/open/file/listFiles.action')
        .query({
          pageNum: '2',
          pageSize: '30',
          mediaType: '0',
          orderBy: '3',
          descending: 'true',
          folderId: '789',
          iconOption: '5'
        })
        .reply(200, mockResponse)

      const result = await cloudClient.getListFiles(customQuery)
      expect(result).to.deep.equal(mockResponse)
    })

    it('should get family files', async () => {
      const familyId = '12345'
      const mockResponse = {
        fileListAO: {
          fileList: [
            {
              id: '999',
              name: 'family_file.pdf',
              size: 2048,
              createDate: '2025-01-01',
              lastOpTime: '2025-01-01'
            }
          ],
          folderList: [],
          count: 1
        }
      }

      nock(API_URL)
        .get('/open/family/file/listFiles.action')
        .query({
          pageNum: '1',
          pageSize: '60',
          mediaType: '0',
          orderBy: '3',
          descending: 'true',
          folderId: '',
          iconOption: '5',
          familyId: '12345'
        })
        .reply(200, mockResponse)

      const result = await cloudClient.getListFiles(undefined, familyId)
      expect(result).to.deep.equal(mockResponse)
    })

    it('should get family files with custom parameters', async () => {
      const customQuery = {
        pageNum: 3,
        folderId: 'family_folder_123'
      }
      const familyId = '67890'
      const mockResponse = {
        fileListAO: {
          fileList: [],
          folderList: [],
          count: 0
        }
      }

      nock(API_URL)
        .get('/open/family/file/listFiles.action')
        .query({
          pageNum: '3',
          pageSize: '60',
          mediaType: '0',
          orderBy: '3',
          descending: 'true',
          folderId: 'family_folder_123',
          iconOption: '5',
          familyId: '67890'
        })
        .reply(200, mockResponse)

      const result = await cloudClient.getListFiles(customQuery, familyId)
      expect(result).to.deep.equal(mockResponse)
    })
  })

  describe('createFolder', () => {
    it('should create personal folder', async () => {
      const createRequest = {
        folderName: 'New Folder',
        parentFolderId: '0'
      }

      const mockResponse = {
        id: '12345',
        name: 'New Folder',
        parentId: '0'
      }

      nock(API_URL)
        .post('/open/file/createFolder.action')
        .reply((uri, requestBody) => {
          const formData = new URLSearchParams(requestBody as string)
          expect(formData.get('folderName')).to.equal('New Folder')
          expect(formData.get('parentFolderId')).to.equal('0')
          return [200, mockResponse]
        })

      const result = await cloudClient.createFolder(createRequest)
      expect(result).to.deep.equal(mockResponse)
    })

    it('should create family folder', async () => {
      const createRequest = {
        folderName: 'Family Folder',
        parentFolderId: '0',
        familyId: '98765'
      }

      const mockResponse = {
        id: '54321',
        name: 'Family Folder',
        parentId: '0'
      }

      nock(API_URL)
        .post('/open/family/file/createFolder.action')
        .reply((uri, requestBody) => {
          const formData = new URLSearchParams(requestBody as string)
          expect(formData.get('folderName')).to.equal('Family Folder')
          expect(formData.get('parentFolderId')).to.equal('0')
          expect(formData.get('familyId')).to.equal('98765')
          return [200, mockResponse]
        })

      const result = await cloudClient.createFolder(createRequest)
      expect(result).to.deep.equal(mockResponse)
    })

    it('should handle create folder error', async () => {
      const createRequest = {
        folderName: 'Invalid Folder',
        parentFolderId: '999'
      }

      nock(API_URL)
        .post('/open/file/createFolder.action')
        .reply(400, { errorCode: 'FolderCreateFailed', errorMsg: 'Invalid parent folder' })

      try {
        await cloudClient.createFolder(createRequest)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error.response?.statusCode).to.equal(400)
      }
    })
  })

  describe('renameFolder', () => {
    it('should rename personal folder', async () => {
      const renameRequest = {
        folderId: '12345',
        folderName: 'Renamed Folder'
      }

      const mockResponse = { success: true }

      nock(API_URL)
        .post('/open/file/renameFolder.action')
        .reply((uri, requestBody) => {
          const formData = new URLSearchParams(requestBody as string)
          expect(formData.get('destFolderName')).to.equal('Renamed Folder')
          expect(formData.get('folderId')).to.equal('12345')
          expect(formData.has('familyId')).to.be.false
          return [200, mockResponse]
        })

      const result = await cloudClient.renameFolder(renameRequest)
      expect(result).to.deep.equal(mockResponse)
    })

    it('should rename family folder', async () => {
      const renameRequest = {
        folderId: '54321',
        folderName: 'Renamed Family Folder',
        familyId: '98765'
      }

      const mockResponse = { success: true }

      nock(API_URL)
        .post('/open/family/file/renameFolder.action')
        .reply((uri, requestBody) => {
          const formData = new URLSearchParams(requestBody as string)
          expect(formData.get('destFolderName')).to.equal('Renamed Family Folder')
          expect(formData.get('folderId')).to.equal('54321')
          expect(formData.get('familyId')).to.equal('98765')
          return [200, mockResponse]
        })

      const result = await cloudClient.renameFolder(renameRequest)
      expect(result).to.deep.equal(mockResponse)
    })

    it('should handle rename folder error - folder not found', async () => {
      const renameRequest = {
        folderId: 'nonexistent',
        folderName: 'New Name'
      }

      nock(API_URL)
        .post('/open/file/renameFolder.action')
        .reply(404, { errorCode: 'FolderNotFound', errorMsg: 'Folder does not exist' })

      try {
        await cloudClient.renameFolder(renameRequest)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error.response?.statusCode).to.equal(404)
      }
    })

    it('should handle rename folder error - invalid name', async () => {
      const renameRequest = {
        folderId: '12345',
        folderName: '' // Invalid empty name
      }

      nock(API_URL)
        .post('/open/file/renameFolder.action')
        .reply(400, { errorCode: 'InvalidFolderName', errorMsg: 'Folder name cannot be empty' })

      try {
        await cloudClient.renameFolder(renameRequest)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error.response?.statusCode).to.equal(400)
      }
    })

    it('should handle rename folder error - duplicate name', async () => {
      const renameRequest = {
        folderId: '12345',
        folderName: 'Existing Folder'
      }

      nock(API_URL)
        .post('/open/file/renameFolder.action')
        .reply(409, { errorCode: 'FolderNameExists', errorMsg: 'Folder name already exists' })

      try {
        await cloudClient.renameFolder(renameRequest)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error.response?.statusCode).to.equal(409)
      }
    })
  })
})
