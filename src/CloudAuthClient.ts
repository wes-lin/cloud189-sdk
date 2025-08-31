import got, { Got } from 'got'
import { logger } from './log'
import {
  WEB_URL,
  API_URL,
  AUTH_URL,
  UserAgent,
  clientSuffix,
  AppID,
  ClientType,
  ReturnURL,
  AccountType
} from './const'
import { RefreshTokenSession, TokenSession, CacheQuery, ConfigurationOptions } from './types'
import { rsaEncrypt } from './util'
import { logHook, checkErrorHook } from './hook'

interface LoginResponse {
  result: number
  msg: string
  toUrl: string
}

/**
 * @public
 */
export class CloudAuthClient {
  readonly authRequest: Got

  constructor() {
    this.authRequest = got.extend({
      headers: {
        'User-Agent': UserAgent,
        Accept: 'application/json;charset=UTF-8'
      },
      hooks: {
        afterResponse: [logHook, checkErrorHook]
      }
    })
  }

  /**
   * 获取加密参数
   * @returns
   */
  getEncrypt(): Promise<{
    data: {
      pubKey: string
      pre: string
    }
  }> {
    return this.authRequest.post(`${AUTH_URL}/api/logbox/config/encryptConf.do`).json()
  }

  async getLoginForm(): Promise<CacheQuery> {
    const res = await this.authRequest
      .get(`${WEB_URL}/api/portal/unifyLoginForPC.action`, {
        searchParams: {
          appId: AppID,
          clientType: ClientType,
          returnURL: ReturnURL,
          timeStamp: Date.now()
        }
      })
      .text()
    if (res) {
      const captchaToken = res.match(`'captchaToken' value='(.+?)'`)[1]
      const lt = res.match(`lt = "(.+?)"`)[1]
      const paramId = res.match(`paramId = "(.+?)"`)[1]
      const reqId = res.match(`reqId = "(.+?)"`)[1]
      return { captchaToken, lt, paramId, reqId }
    }
    return null
  }

  #builLoginForm = (encrypt, appConf: CacheQuery, username: string, password: string) => {
    const usernameEncrypt = rsaEncrypt(encrypt.pubKey, username)
    const passwordEncrypt = rsaEncrypt(encrypt.pubKey, password)
    const data = {
      appKey: AppID,
      accountType: AccountType,
      // mailSuffix: '@189.cn',
      validateCode: '',
      captchaToken: appConf.captchaToken,
      dynamicCheck: 'FALSE',
      clientType: '1',
      cb_SaveName: '3',
      isOauth2: false,
      returnUrl: ReturnURL,
      paramId: appConf.paramId,
      userName: `${encrypt.pre}${usernameEncrypt}`,
      password: `${encrypt.pre}${passwordEncrypt}`
    }
    return data
  }

  async getSessionForPC(param: { redirectURL?: string; accessToken?: string }) {
    const params = {
      appId: AppID,
      ...clientSuffix(),
      ...param
    }
    const res = await this.authRequest
      .post(`${API_URL}/getSessionForPC.action`, {
        searchParams: params
      })
      .json<TokenSession>()
    return res
  }

  /**
   * 用户名密码登录
   * */
  async loginByPassword(username: string, password: string) {
    logger.debug('loginByPassword...')
    try {
      const res = await Promise.all([
        //1.获取公钥
        this.getEncrypt(),
        //2.获取登录参数
        this.getLoginForm()
      ])
      const encrypt = res[0].data
      const appConf = res[1]
      const data = this.#builLoginForm(encrypt, appConf, username, password)
      const loginRes = await this.authRequest
        .post(`${AUTH_URL}/api/logbox/oauth2/loginSubmit.do`, {
          headers: {
            Referer: AUTH_URL,
            lt: appConf.lt,
            REQID: appConf.reqId
          },
          form: data
        })
        .json<LoginResponse>()
      return await this.getSessionForPC({ redirectURL: loginRes.toUrl })
    } catch (e) {
      logger.error(e)
      throw e
    }
  }

  /**
   * token登录
   */
  async loginByAccessToken(accessToken: string) {
    logger.debug('loginByAccessToken...')
    return await this.getSessionForPC({ accessToken })
  }

  /**
   * sso登录
   */
  async loginBySsoCooike(cookie: string) {
    logger.debug('loginBySsoCooike...')
    const res = await this.authRequest.get(`${WEB_URL}/api/portal/unifyLoginForPC.action`, {
      searchParams: {
        appId: AppID,
        clientType: ClientType,
        returnURL: ReturnURL,
        timeStamp: Date.now()
      }
    })
    const redirect = await this.authRequest(res.url, {
      headers: {
        Cookie: `SSON=${cookie}`
      }
    })
    return await this.getSessionForPC({ redirectURL: redirect.url })
  }

  /**
   * 刷新token
   */
  refreshToken(refreshToken: string): Promise<RefreshTokenSession> {
    return this.authRequest
      .post(`${AUTH_URL}/api/oauth2/refreshToken.do`, {
        form: {
          clientId: AppID,
          refreshToken,
          grantType: 'refresh_token',
          format: 'json'
        }
      })
      .json()
  }
}
