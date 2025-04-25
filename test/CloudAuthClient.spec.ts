import { expect } from 'chai'
import nock from 'nock'
import { CloudAuthClient } from '../src/CloudClient'
import { AUTH_URL, API_URL, WEB_URL, ReturnURL } from '../src/const'

describe('CloudAuthClient', () => {
  const authClient = new CloudAuthClient()
  let sessionForPCMock: nock.Scope

  beforeEach(() => {
    const mockSession = {
      sessionKey: 'test_session_key',
      accessToken: 'test_access_token',
      refreshToken: 'test_refresh_token'
    }
    sessionForPCMock = nock(API_URL)
      .post('/getSessionForPC.action')
      .query(true)
      .reply(200, mockSession)
  })

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

    it('should return encrypt data fail', async () => {
      nock(AUTH_URL).post('/api/logbox/config/encryptConf.do').reply(200, {
        result: -1,
        msg: 'get encrypt data fail'
      })

      try {
        await authClient.getEncrypt()
      } catch (err) {
        expect(err).to.be.an('error')
        expect(err.message).to.equal('get encrypt data fail')
      }
    })
  })

  describe('loginByAccessToken', () => {
    it('should login with access token successfully', async () => {
      await authClient.loginByAccessToken('test_token')
      expect(sessionForPCMock.isDone()).to.be.true
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

    it('should refresh token fail', async () => {
      nock(AUTH_URL).post('/api/oauth2/refreshToken.do').reply(200, {
        result: -117,
        msg: 'refresh token fail'
      })

      try {
        await authClient.refreshToken('old_refresh_token')
      } catch (err) {
        expect(err).to.be.an('error')
        expect(err.message).to.equal('refresh token fail')
      }
    })
  })

  it('loginBySsoCooike', async () => {
    const redirectUrl = '/api/logbox/oauth2/unifyAccountLogin.do'
    const testCookie = 'test-sso-cookie'
    nock(WEB_URL)
      .get('/api/portal/unifyLoginForPC.action')
      .query(true)
      .reply(302, undefined, { Location: AUTH_URL + redirectUrl })
    nock(AUTH_URL).get(redirectUrl).reply(200, '<html></html>')
    nock(AUTH_URL)
      .get(redirectUrl)
      .matchHeader('Cookie', `SSON=${testCookie}`)
      .reply(302, undefined, { Location: ReturnURL })
    nock('https://m.cloud.189.cn').get('/zhuanti/2020/loginErrorPc/index.html').reply(200)
    await authClient.loginBySsoCooike(testCookie)
    expect(sessionForPCMock.isDone()).to.be.true
  })

  it('loginByPassword', async () => {
    const encryptConfResponse = {
      data: {
        pubKey:
          'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCZLyV4gHNDUGJMZoOcYauxmNEsKrc0TlLeBEVVIIQNzG4WqjimceOj5R9ETwDeeSN3yejAKLGHgx83lyy2wBjvnbfm/nLObyWwQD/09CmpZdxoFYCH6rdDjRpwZOZ2nXSZpgkZXoOBkfNXNxnN74aXtho2dqBynTw3NFTWyQl8BQIDAQAB',
        pre: '{NRP}'
      }
    }

    nock(AUTH_URL).post('/api/logbox/config/encryptConf.do').reply(200, encryptConfResponse)
    nock(WEB_URL)
      .get('/api/portal/unifyLoginForPC.action')
      .query(true)
      .reply(
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
      )
    nock(AUTH_URL).post('/api/logbox/oauth2/loginSubmit.do').reply(200, {
      result: 0,
      msg: '登录成功',
      toUrl:
        'https://m.cloud.189.cn/zhuanti/2020/loginErrorPc/index.html?appId=8025431004&paras=DA95B973583E0167656DD19E372DFD443C56452DB111C1844EA92E7416CA5ABADB416432F6D7AD435090E6E450AD033D0F38FF8209C09D1E1BCE7868C8FD6FB852A87482D6282B88E5233742ACB4E1147C0E0E956C7207D9765DDBA25F051D98938AAC1101FD4306B3AE393C71CFF42E48FAF7C55766A1170C709B87677B973D586901D6FCF2505636B9F02C237CDF92D7778B7C465BA08C09C91C0E3AAC1787714C0DFD286D3655C2FA9E9947F488AB8ADFE5AF1057A39843BE9B7658841D57D40D0637E9D19487D39549ACE92D50447E1F54357B2F335E66B627728818896B4133F1C6D89A1D5BE9BF44CF5B335E993367139E08405D26C3ABBC50F0DCAFF90CE319656731F9EA9910D26BCA7BE7ED840CD5559930D1DD7149C1281AE43F9ADBBF1CE89CA6D0880DC7C7EE3027D9E543B863FC748CA809BF5519F8B612C7B88AF2406B0A6D1BAA2D2DEAF6F5B8C12932D94A002DC4BA3EA9EFC4E4E8225375740D5B0FC228B9DDA8CC160296C5EA588FC4B3CA80A37FAB2CD092E7C880A5678862D37891468B6F356CAE468A0AEC6E485E6C9D8C0A05CE0FF335B8C5D7AAA9B58A13D95C776107075C2389F5E8966AEB2C01BC59C3B47B97E8A4DF7F1FB0BD08F782E0772874EDF4DAC9E11862588A0ABDE8B4C14141CD0AB2EF356CBAA0CCB72B852513C861C36BEC0BDB77A638E679BA9248C1498152904436CE9F01E740811BE54F26A268D8B26B8D347FF746A6B258CF86E0CAA6BFC87AED1413973ABDD3EBFAFEAADA70A70AE9C4DAFEBFD9DCAFAC2E9D4F233AF20DE727E8FA6250EEEDF61BD3F79D8CFA802DFDB79AAA1ACD5F5E42099200EB35D53ED3A98D9451940B97D651B5DE7ABCF6F171EA536032F2362559812BCCC36803DF98AEF7B42A311DE280EE75456C772F02B66EE0B221EF35E678A1E8920FC2EE6AC80995C014BDB9BBDA0A3256974FB56D45E03E8E502961E55FB14E0F2802CF072D96C0292B4A1E55B9091B318C88162A7CC17F11BE3FE22F95EA1F0B45CC59A44844&sign=341C66F8B477F6C20D1712CFBB0856703B2C1982'
    })
    nock('https://m.cloud.189.cn')
      .get('/zhuanti/2020/loginErrorPc/index.html')
      .query(true)
      .reply(200)
    await authClient.loginByPassword('username', 'password')
    expect(sessionForPCMock.isDone()).to.be.true
  })

  it('loginByPassword getLoginForm fail', async () => {
    const encryptConfResponse = {
      data: {
        pubKey:
          'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCZLyV4gHNDUGJMZoOcYauxmNEsKrc0TlLeBEVVIIQNzG4WqjimceOj5R9ETwDeeSN3yejAKLGHgx83lyy2wBjvnbfm/nLObyWwQD/09CmpZdxoFYCH6rdDjRpwZOZ2nXSZpgkZXoOBkfNXNxnN74aXtho2dqBynTw3NFTWyQl8BQIDAQAB',
        pre: '{NRP}'
      }
    }

    nock(AUTH_URL).post('/api/logbox/config/encryptConf.do').reply(200, encryptConfResponse)

    nock(WEB_URL).get('/api/portal/unifyLoginForPC.action').query(true).reply(200, undefined)
    try {
      await authClient.loginByPassword('username', 'password')
    } catch (err) {
      expect(err).to.be.an('error')
    }
  })
})
