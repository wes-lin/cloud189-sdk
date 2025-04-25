import { expect } from 'chai'
import sinon from 'sinon'
import nock from 'nock'
import { CloudClient } from '../src/CloudClient'
import { MemoryStore } from '../src/store'
import { logger } from '../src/log'
import {
  UserSizeInfoResponse,
  UserSignResponse,
  FamilyListResponse,
  FamilyUserSignResponse
} from '../src/types'
import { WEB_URL, API_URL, AUTH_URL } from '../src/const'

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

// describe('CloudClient getSession', () => {
//   it('Auto login', async () => {
//     logger.configure({
//       isDebugEnabled: true
//     })
//     const encryptConfResponse = {
//       data: {
//         pubKey:
//           'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCZLyV4gHNDUGJMZoOcYauxmNEsKrc0TlLeBEVVIIQNzG4WqjimceOj5R9ETwDeeSN3yejAKLGHgx83lyy2wBjvnbfm/nLObyWwQD/09CmpZdxoFYCH6rdDjRpwZOZ2nXSZpgkZXoOBkfNXNxnN74aXtho2dqBynTw3NFTWyQl8BQIDAQAB',
//         pre: '{NRP}'
//       }
//     }

//     nock(API_URL).post('/getSessionForPC.action').query .reply(200, {
//       sessionKey: 'test_session_key11111',
//       accessToken: 'test_access_token',
//       refreshToken: 'test_refresh_token'
//     })

//     nock(AUTH_URL).post('/api/logbox/config/encryptConf.do').reply(200, encryptConfResponse)

//     // nock(API_URL)
//     //   .post(
//     //     '/getSessionForPC.action?appId=8025431004&clientType=TELEPC&version=6.2&channelId=web_cloud.189.cn&rand=1745558693401&redirectURL=https%3A%2F%2Fm.cloud.189.cn%2Fzhuanti%2F2020%2FloginErrorPc%2Findex.html%3FappId%3D8025431004%26paras%3DDA95B973583E0167656DD19E372DFD443C56452DB111C1844EA92E7416CA5ABADB416432F6D7AD435090E6E450AD033D0F38FF8209C09D1E1BCE7868C8FD6FB852A87482D6282B88E5233742ACB4E1147C0E0E956C7207D9765DDBA25F051D98938AAC1101FD4306B3AE393C71CFF42E48FAF7C55766A1170C709B87677B973D586901D6FCF2505636B9F02C237CDF92D7778B7C465BA08C09C91C0E3AAC1787714C0DFD286D3655C2FA9E9947F488AB8ADFE5AF1057A39843BE9B7658841D57D40D0637E9D19487D39549ACE92D50447E1F54357B2F335E66B627728818896B4133F1C6D89A1D5BE9BF44CF5B335E993367139E08405D26C3ABBC50F0DCAFF90CE319656731F9EA9910D26BCA7BE7ED840CD5559930D1DD7149C1281AE43F9ADBBF1CE89CA6D0880DC7C7EE3027D9E543B863FC748CA809BF5519F8B612C7B88AF2406B0A6D1BAA2D2DEAF6F5B8C12932D94A002DC4BA3EA9EFC4E4E8225375740D5B0FC228B9DDA8CC160296C5EA588FC4B3CA80A37FAB2CD092E7C880A5678862D37891468B6F356CAE468A0AEC6E485E6C9D8C0A05CE0FF335B8C5D7AAA9B58A13D95C776107075C2389F5E8966AEB2C01BC59C3B47B97E8A4DF7F1FB0BD08F782E0772874EDF4DAC9E11862588A0ABDE8B4C14141CD0AB2EF356CBAA0CCB72B852513C861C36BEC0BDB77A638E679BA9248C1498152904436CE9F01E740811BE54F26A268D8B26B8D347FF746A6B258CF86E0CAA6BFC87AED1413973ABDD3EBFAFEAADA70A70AE9C4DAFEBFD9DCAFAC2E9D4F233AF20DE727E8FA6250EEEDF61BD3F79D8CFA802DFDB79AAA1ACD5F5E42099200EB35D53ED3A98D9451940B97D651B5DE7ABCF6F171EA536032F2362559812BCCC36803DF98AEF7B42A311DE280EE75456C772F02B66EE0B221EF35E678A1E8920FC2EE6AC80995C014BDB9BBDA0A3256974FB56D45E03E8E502961E55FB14E0F2802CF072D96C0292B4A1E55B9091B318C88162A7CC17F11BE3FE22F95EA1F0B45CC59A44844%26sign%3D341C66F8B477F6C20D1712CFBB0856703B2C1982'
//     //   )
//     //   .reply(200, {
//     //     sessionKey: 'test_session_key1',
//     //     accessToken: 'test_access_token',
//     //     refreshToken: 'test_refresh_token'
//     //   })
//     // nock(WEB_URL)
//     //   .get('/api/portal/getUserSizeInfo.action')
//     //   .query({
//     //     sessionKey: 'test_session_key'
//     //   })
//     //   .reply(400, {
//     //     errorCode: 'InvalidSessionKey'
//     //   })
//     // Mock store
//     const store = new MemoryStore()
//     store.update({
//       accessToken: 'stored_access_token',
//       expiresIn: Date.now() + 3600000 // 1 hour later
//     })
//     const cloudClient = new CloudClient({
//       username: 'test_user',
//       password: 'test_pass',
//       token: store
//     })
//     await cloudClient.getUserSizeInfo()
//   })
// })
