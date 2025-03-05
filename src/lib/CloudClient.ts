import url from 'url'
import got, { Got } from 'got'
import { CookieJar } from 'tough-cookie'
import {
  UserSignResponse,
  UserSizeInfoResponse,
  UserBriefInfoResponse,
  UserTaskResponse,
  AccessTokenResponse,
  FamilyListResponse,
  FamilyUserSignResponse,
  ConfigurationOptions
} from './types'
import { log } from './log'
import { getSignature, rsaEncrypt } from './util'
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

const config = {
  clientId: '538135150693412',
  model: 'KB2000',
  version: '9.0.6'
}

interface CacheQuery {
  captchaToken: string
  reqId: string
  lt: string
  paramId: string
}

interface LoginResponse {
  result: number
  msg: string
  toUrl: string
}

interface TokenSession {
  res_code: number
  res_message: string
  accessToken: string
  familySessionKey: string
  familySessionSecret: string
  loginName: string
  refreshToken: string
  sessionKey: string
  sessionSecret: string
}

export class CloudAuthClient {
  readonly request: Got

  constructor() {
    this.request = got.extend({
      headers: {
        'User-Agent': UserAgent,
        Accept: 'application/json;charset=UTF-8'
      },
      hooks: {
        afterResponse: [
          async (response, retryWithMergedOptions) => {
            log.debug(`url: ${response.requestUrl}, response: ${response.body})}`)
            return response
          }
        ]
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
    return this.request.post(`${AUTH_URL}/api/logbox/config/encryptConf.do`).json()
  }

  async getLoginForm(): Promise<CacheQuery> {
    const res = await this.request
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
    const keyData = `-----BEGIN PUBLIC KEY-----\n${encrypt.pubKey}\n-----END PUBLIC KEY-----`
    const usernameEncrypt = rsaEncrypt(keyData, username)
    const passwordEncrypt = rsaEncrypt(keyData, password)
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

  async getSessionForPC(param: { redirectURL?: string }) {
    const params = {
      appId: AppID,
      redirectURL: param.redirectURL,
      ...clientSuffix()
    }
    const res = await this.request
      .post(`${API_URL}/getSessionForPC.action`, {
        searchParams: params,
        headers: {
          Accept: 'application/json;charset=UTF-8'
        }
      })
      .json<TokenSession>()
    return res
  }

  /**
   * 用户名密码登录
   * */
  async login(username: string, password: string): Promise<TokenSession> {
    if (!username || !password) {
      throw new Error('Please provide username and password!')
    }
    log.debug('login...')
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
      const loginRes = await this.request
        .post(`${AUTH_URL}/api/logbox/oauth2/loginSubmit.do`, {
          headers: {
            Referer: AUTH_URL,
            lt: appConf.lt,
            REQID: appConf.reqId
          },
          form: data
        })
        .json<LoginResponse>()
      if (loginRes.result !== 0) {
        throw new Error(loginRes.msg)
      }
      return await this.getSessionForPC({ redirectURL: loginRes.toUrl })
    } catch (e) {
      log.error(e)
      throw e
    }
  }
}

/**
 * 天翼网盘客户端
 * @public
 */
export class CloudClient {
  #accessToken = ''
  #sessionKey = ''
  username: string
  password: string
  cookie: CookieJar
  readonly request: Got

  constructor(_options: ConfigurationOptions) {
    this.#valid(_options)
    this.username = _options.username
    this.password = _options.password
    this.#accessToken = _options.accessToken
    if (_options.cookie) {
      this.cookie = _options.cookie
    } else {
      this.cookie = new CookieJar()
    }
    this.request = got.extend({
      cookieJar: this.cookie,
      retry: {
        limit: 5
      },
      headers: {
        'User-Agent': UserAgent,
        Referer: `${WEB_URL}/web/main/`
      },
      hooks: {
        beforeRequest: [
          async (options) => {
            if (options.url.href.includes(API_URL)) {
              const accessToken = this.#accessToken
              console.log(accessToken)
              const { query } = url.parse(options.url.toString(), true)
              const time = String(Date.now())
              const signature = getSignature({
                ...(options.method === 'GET' ? query : options.json),
                Timestamp: time,
                AccessToken: accessToken
              })
              options.headers['Sign-Type'] = '1'
              options.headers['Signature'] = signature
              options.headers['Timestamp'] = time
              options.headers['Accesstoken'] = accessToken
              options.headers['Accept'] = 'application/json;charset=UTF-8'
            } else if (options.url.href.includes(WEB_URL)) {
              const urlObj = new URL(options.url)
              urlObj.searchParams.set('sessionKey', this.#sessionKey)
              options.url = urlObj
            }
          }
        ],
        afterResponse: [
          async (response, retryWithMergedOptions) => {
            log.debug(
              `url: ${response.requestUrl}, response: ${response.body}, cookie:${JSON.stringify(this.cookie.serializeSync())}`
            )
            if (response.statusCode === 400) {
              const { errorCode, errorMsg } = JSON.parse(response.body.toString()) as {
                errorCode: string
                errorMsg: string
              }
              if (errorCode === 'InvalidAccessToken') {
                log.debug('InvalidAccessToken retry...')
                log.debug('Refresh AccessToken')
                await this.getAccessToken(true)
                return retryWithMergedOptions({})
              } else if (errorCode === 'InvalidSessionKey') {
                log.debug('InvalidSessionKey retry...')
                log.debug('Refresh InvalidSessionKey')
                const sessionKey = await this.getSessionKey(true)
                const urlObj = new URL(response.requestUrl)
                if (urlObj.searchParams.has('sessionKey')) {
                  urlObj.searchParams.set('sessionKey', sessionKey)
                }
                return retryWithMergedOptions({
                  url: urlObj.toString()
                })
              }
            }
            return response
          }
        ]
      }
    })
  }

  #valid = (options: ConfigurationOptions) => {
    if (!options.cookie && (!options.username || !options.password)) {
      log.error('valid')
      throw new Error('Please provide username and password or Cookie!')
    }
  }

  /**
   * 获取 sessionKey
   * @param needRefresh - 是否重新获取
   * @returns sessionKey
   */
  async getSessionKey(needRefresh = false): Promise<string> {
    if (!this.#sessionKey || needRefresh) {
      const { sessionKey } = await this.#getUserBriefInfo()
      this.#sessionKey = sessionKey
    }
    return this.#sessionKey
  }

  /**
   * 获取 accessToken
   * @param needRefresh - 是否重新获取
   * @returns accessToken
   */
  async getAccessToken(needRefresh = false): Promise<string> {
    if (!this.#accessToken || needRefresh) {
      const sessionKey = await this.getSessionKey()
      const { accessToken } = await this.#getAccessTokenBySsKey(sessionKey)
      this.#accessToken = accessToken
    }
    return this.#accessToken
  }

  /**
   * 获取用户网盘存储容量信息
   * @returns 账号容量结果
   */
  getUserSizeInfo(): Promise<UserSizeInfoResponse> {
    return this.request
      .get(`${WEB_URL}/api/portal/getUserSizeInfo.action`, {
        headers: { Accept: 'application/json;charset=UTF-8' }
      })
      .json()
  }

  /**
   * 个人签到任务
   * @returns 签到结果
   */
  userSign(): Promise<UserSignResponse> {
    return this.request
      .get(
        `${WEB_URL}/mkt/userSign.action?rand=${new Date().getTime()}&clientType=TELEANDROID&version=${
          config.version
        }&model=${config.model}`
      )
      .json()
  }

  /**
   * 获取 sessionKey
   * @returns 用户session
   */
  #getUserBriefInfo(): Promise<UserBriefInfoResponse> {
    return this.request.get(`${WEB_URL}/api/portal/v2/getUserBriefInfo.action`).json()
  }

  /**
   * 获取 accessToken
   * @param sessionKey - sessionKey
   */
  #getAccessTokenBySsKey(sessionKey: string): Promise<AccessTokenResponse> {
    const appkey = '600100422'
    const time = String(Date.now())
    const signature = getSignature({
      sessionKey,
      Timestamp: time,
      AppKey: appkey
    })
    return this.request
      .get(`${WEB_URL}/api/open/oauth2/getAccessTokenBySsKey.action?sessionKey=${sessionKey}`, {
        headers: {
          'Sign-Type': '1',
          Signature: signature,
          Timestamp: time,
          Appkey: appkey
        }
      })
      .json()
  }

  /**
   * 获取家庭信息
   * @returns 家庭列表信息
   */
  getFamilyList(): Promise<FamilyListResponse> {
    return this.request.get(`${API_URL}/open/family/manage/getFamilyList.action`).json()
  }

  /**
   * 家庭签到任务
   * @param familyId - 家庭id
   * @returns 签到结果
   */
  familyUserSign(familyId: number): Promise<FamilyUserSignResponse> {
    return this.request
      .get(`${API_URL}/open/family/manage/exeFamilyUserSign.action?familyId=${familyId}`)
      .json()
  }
}
