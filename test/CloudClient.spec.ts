import { expect } from 'chai'
import sinon from 'sinon'
import nock from 'nock'
import { CloudClient } from '../src/CloudClient'
import { MemoryStore } from '../src/store'
import {
  UserSizeInfoResponse,
  UserSignResponse,
  FamilyListResponse,
  FamilyUserSignResponse
} from '../src/types'
import { WEB_URL, API_URL } from '../src/const'

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
            familyId: 123,
            remarkName: '测试家庭',
            type: 1,
            userRole: 1
          }
        ]
      }

      nock(API_URL).get('/open/family/manage/getFamilyList.action').reply(200, mockResponse)

      // Mock getAccessToken
      nock(WEB_URL).get('/api/open/oauth2/getAccessTokenBySsKey.action').query(true).reply(200, {
        accessToken: 'test_access_token'
      })

      const result = await cloudClient.getFamilyList()
      expect(result).to.deep.equal(mockResponse)
    })
  })
})
