import { expect } from 'chai'
import nock from 'nock'
import { CloudAuthClient } from '../src/CloudClient'
import { AUTH_URL, API_URL } from '../src/const'

describe('CloudAuthClient', () => {
  const authClient = new CloudAuthClient()

  afterEach(() => {
    nock.cleanAll()
  })

  describe('getEncrypt', () => {
    it('should return encrypt data', async () => {
      const mockResponse = {
        data: {
          pubKey: 'test_pub_key',
          pre: '{NRP}'
        }
      }

      nock(AUTH_URL).post('/api/logbox/config/encryptConf.do').reply(200, mockResponse)

      const result = await authClient.getEncrypt()
      expect(result).to.deep.equal(mockResponse)
    })
  })

  describe('loginByAccessToken', () => {
    it('should login with access token successfully', async () => {
      const mockSession = {
        sessionKey: 'test_session_key',
        accessToken: 'test_access_token',
        refreshToken: 'test_refresh_token'
      }
      nock(API_URL).post('/getSessionForPC.action').query(true).reply(200, mockSession)

      const result = await authClient.loginByAccessToken('test_token')
      expect(result).to.deep.equal(mockSession)
    })
  })

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockResponse = {
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresIn: 86400
      }
      nock(AUTH_URL).post('/api/oauth2/refreshToken.do').reply(200, mockResponse)

      const result = await authClient.refreshToken('old_refresh_token')
      expect(result).to.deep.equal(mockResponse)
    })
  })
})
