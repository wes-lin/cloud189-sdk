import url from 'url'
import JSEncrypt from 'node-jsencrypt'
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
import { getSignature } from './util'
import { WEB_URL, API_URL, AUTH_URL, UserAgent, clientSuffix } from './const'

const config = {
  clientId: '538135150693412',
  model: 'KB2000',
  version: '9.0.6'
}

interface CacheQuery {
  appId: string
  reqId: string
  lt: string
}

interface LoginResponse {
  result: number
  msg: string
  toUrl: string
}

/**
 * 天翼网盘客户端
 * @public
 */
export default class CloudClient {
  #accessToken = ''
  #sessionKey = ''
  username: string
  password: string
  #cacheQuery: CacheQuery
  cookie: CookieJar
  readonly request: Got

  constructor(_options: ConfigurationOptions) {
    this.#valid(_options)
    this.username = _options.username
    this.password = _options.password
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
            if (
              options.url.href.includes(API_URL) &&
              !options.url.href.includes('getSessionForPC.action')
            ) {
              const accessToken = await this.getAccessToken()
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
            }
          }
        ],
        afterResponse: [
          async (response, retryWithMergedOptions) => {
            log.debug(`url: ${response.requestUrl}, response: ${response.body}`)
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

  /**
   * 跳转到登录页面
   * @returns 登录的参数
   */
  redirectURL(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request
        .get(
          `${WEB_URL}/api/portal/loginUrl.action?redirectURL=${WEB_URL}/web/redirect.html?returnURL=/main.action`
        )
        .then((res) => {
          const { query } = url.parse(res.url, true)
          resolve(query)
        })
        .catch((e) => reject(e))
    })
  }

  /**
   * 获取登录的参数
   * @returns
   */
  #appConf(): Promise<{
    data: {
      returnUrl: string
      paramId: string
    }
  }> {
    return this.request
      .post(`${AUTH_URL}/api/logbox/oauth2/appConf.do`, {
        headers: {
          Referer: AUTH_URL,
          lt: this.#cacheQuery.lt,
          REQID: this.#cacheQuery.reqId
        },
        form: { version: '2.0', appKey: this.#cacheQuery.appId }
      })
      .json()
  }

  #builLoginForm = (encrypt, appConf) => {
    const jsencrypt = new JSEncrypt()
    const keyData = `-----BEGIN PUBLIC KEY-----\n${encrypt.pubKey}\n-----END PUBLIC KEY-----`
    jsencrypt.setPublicKey(keyData)
    const usernameEncrypt = Buffer.from(jsencrypt.encrypt(this.username), 'base64').toString('hex')
    const passwordEncrypt = Buffer.from(jsencrypt.encrypt(this.password), 'base64').toString('hex')
    const data = {
      appKey: 'cloud',
      version: '2.0',
      accountType: '01',
      mailSuffix: '@189.cn',
      validateCode: '',
      captchaToken: '',
      dynamicCheck: 'FALSE',
      clientType: '1',
      cb_SaveName: '3',
      isOauth2: false,
      returnUrl: appConf.returnUrl,
      paramId: appConf.paramId,
      userName: `${encrypt.pre}${usernameEncrypt}`,
      password: `${encrypt.pre}${passwordEncrypt}`
    }
    return data
  }

  /**
   * 用户名密码登录
   * */
  login(): Promise<any> {
    /**
     * 1.获取公钥
     * 2.获取登录参数
     * 3.获取登录地址
     * 4.跳转到登录页
     */
    return new Promise((resolve, reject) => {
      if (!this.username || !this.password) {
        throw new Error('Please provide username and password!')
      }
      log.debug('login...')
      this.cookie.removeAllCookiesSync()
      Promise.all([
        //1.获取公钥
        this.getEncrypt(),
        //2.获取登录参数
        this.redirectURL().then((query: CacheQuery) => {
          this.#cacheQuery = query
          return this.#appConf()
        })
      ])
        .then((res: any[]) => {
          const encrypt = res[0].data
          const appConf = res[1].data
          const data = this.#builLoginForm(encrypt, appConf)
          //3.获取登录地址
          return this.request
            .post(`${AUTH_URL}/api/logbox/oauth2/loginSubmit.do`, {
              headers: {
                Referer: AUTH_URL,
                lt: this.#cacheQuery.lt,
                REQID: this.#cacheQuery.reqId
              },
              form: data
            })
            .json()
        })
        .then((res: LoginResponse) => {
          // 4.跳转到登录页
          if (res.result !== 0) {
            reject(res.msg)
          } else {
            return this.request.get(res.toUrl).then((r) => resolve(r.statusCode))
          }
        })
        .catch((e) => reject(e))
    })
  }

  /**
   * 是否存在登录信息
   * @returns
   */
  isLoggedSession(): boolean {
    const loginUserCookie = this.cookie
      .getCookiesSync(WEB_URL)
      ?.find((cookie) => cookie.key === 'COOKIE_LOGIN_USER' && cookie.value)
    if (loginUserCookie) {
      return true
    }
    return false
  }

  /**
   * 获取 sessionKey
   * @param needRefresh - 是否重新获取
   * @returns sessionKey
   */
  async getSessionKey(needRefresh = false): Promise<string> {
    if (!this.#sessionKey || needRefresh) {
      if (!this.isLoggedSession()) {
        await this.login()
      }
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
   * 任务无效， 1.0.4版本废弃
   * @deprecated 任务过期
   */
  taskSign(): Promise<UserTaskResponse> {
    return this.request(
      'https://m.cloud.189.cn/v2/drawPrizeMarketDetails.action?taskId=TASK_SIGNIN&activityId=ACT_SIGNIN'
    ).json()
  }

  /**
   * 任务无效， 1.0.4版本废弃
   * @deprecated 任务过期
   */
  taskPhoto(): Promise<UserTaskResponse> {
    return this.request(
      'https://m.cloud.189.cn/v2/drawPrizeMarketDetails.action?taskId=TASK_SIGNIN_PHOTOS&activityId=ACT_SIGNIN'
    ).json()
  }

  /**
   * 任务无效， 1.0.3版本废弃
   * @deprecated 任务过期
   */
  taskKJ(): Promise<UserTaskResponse> {
    return this.request
      .get(
        'https://m.cloud.189.cn/v2/drawPrizeMarketDetails.action?taskId=TASK_2022_FLDFS_KJ&activityId=ACT_SIGNIN'
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
