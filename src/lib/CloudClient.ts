import url from 'url'
import JSEncrypt from 'node-jsencrypt'
import crypto from 'crypto'
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
  Options
} from './types'

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
  accessToken = ''
  sessionKey = ''
  username: string
  password: string
  #cacheQuery: CacheQuery
  cookie: CookieJar
  readonly request: Got

  constructor(_options: Options) {
    this.#valid(_options)
    this.username = _options.username
    this.password = _options.password
    this.accessToken = _options.accessToken
    this.sessionKey = _options.sessionKey
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
        'User-Agent': `Mozilla/5.0 (Linux; U; Android 11; ${config.model} Build/RP1A.201005.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/74.0.3729.136 Mobile Safari/537.36 Ecloud/${config.version} Android/30 clientId/${config.clientId} clientModel/${config.model} clientChannelId/qq proVersion/1.0.6`,
        Referer: 'https://cloud.189.cn/web/main/'
      },
      hooks: {
        beforeRequest: [
          async (options) => {
            console.debug(`Request url: ${options.url}`)
            if (options.url.host === 'api.cloud.189.cn') {
              const accessToken = await this.getAccessToken();
              const { query } = url.parse(options.url.toString(), true)
              const time = String(Date.now())
              const signature = this.#getSignature({
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
            if (response.statusCode === 400) {
              const { errorCode, errorMsg } = JSON.parse(response.body.toString()) as {
                errorCode: string,
                errorMsg: string
              }
              console.debug(`url: ${response.requestUrl}, errorCode: ${errorCode}, errorMsg : ${errorMsg}`)
              if (errorCode === 'InvalidAccessToken') {
                console.debug('InvalidAccessToken retry...')
                console.debug('Refresh AccessToken')
                await this.getAccessToken(true)
                return retryWithMergedOptions({})
              } else if(errorCode === 'InvalidSessionKey') {
                console.debug('InvalidSessionKey retry...')
                console.debug('Refresh InvalidSessionKey')
                const sessionKey = await this.getSessionKey(true)
                const urlObj = new URL(response.requestUrl)
                urlObj.searchParams.set("sessionKey",sessionKey)
                return retryWithMergedOptions({
                  url: urlObj.toString()
                })
              }
            }
            return response
          }
        ],
        beforeRetry: [
          (options, error, retryCount) => {
            // This will be called on `retryWithMergedOptions(...)`
            console.log('retry.....')
          }
        ]
      }
    })
  }

  #valid = (options: Options) => {
    if (!options.cookie && (!options.username || !options.password)) {
      console.log('valid')
      throw new Error('Please provide username and password or Cookie')
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
    return this.request.post('https://open.e.189.cn/api/logbox/config/encryptConf.do').json()
  }

  /**
   * 跳转到登录页面
   * @returns 登录的参数
   */
  redirectURL(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request
        .get(
          'https://cloud.189.cn/api/portal/loginUrl.action?redirectURL=https://cloud.189.cn/web/redirect.html?returnURL=/main.action'
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
      .post('https://open.e.189.cn/api/logbox/oauth2/appConf.do', {
        headers: {
          Referer: 'https://open.e.189.cn/',
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
      cb_SaveName: '0',
      isOauth2: false,
      returnUrl: appConf.returnUrl,
      paramId: appConf.paramId,
      userName: `${encrypt.pre}${usernameEncrypt}`,
      password: `${encrypt.pre}${passwordEncrypt}`
    }
    return data
  }

  #sortParameter = (data): string => {
    if (!data) {
      return ''
    }
    const e = Object.entries(data).map((t) => t.join('='))
    e.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))
    return e.join('&')
  }

  #getSignature = (data) => {
    const parameter = this.#sortParameter(data)
    return crypto.createHash('md5').update(parameter).digest('hex')
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
      console.log('login...')
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
            .post('https://open.e.189.cn/api/logbox/oauth2/loginSubmit.do', {
              headers: {
                Referer: 'https://open.e.189.cn/',
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
   * 获取 sessionKey
   * @param needRefresh - 是否重新获取
   * @returns sessionKey
   */
  async getSessionKey(needRefresh = false): Promise<string> {
    if(!this.sessionKey || needRefresh) {
      const { sessionKey } = await this.#getUserBriefInfo()
      this.sessionKey = sessionKey
    }
    return this.sessionKey
  }

  /**
   * 获取 accessToken
   * @param needRefresh - 是否重新获取
   * @returns accessToken
   */
  async getAccessToken(needRefresh = false): Promise<string> {
    if (!this.accessToken || needRefresh) {
      const sessionKey = await this.getSessionKey()
      const { accessToken } = await this.#getAccessTokenBySsKey(sessionKey)
      this.accessToken = accessToken
    }
    return this.accessToken
  }

  /**
   * 获取用户网盘存储容量信息
   * @returns 账号容量结果
   */
  getUserSizeInfo(): Promise<UserSizeInfoResponse> {
    return this.request
      .get('https://cloud.189.cn/api/portal/getUserSizeInfo.action', {
        headers: { Accept: 'application/json;charset=UTF-8' }
      })
      .json()
  }

  /**
   * 个人用户签到任务
   * @returns 签到结果
   */
  userSign(): Promise<UserSignResponse> {
    return this.request
      .get(
        `https://cloud.189.cn/mkt/userSign.action?rand=${new Date().getTime()}&clientType=TELEANDROID&version=${
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
    return this.request.get('https://cloud.189.cn/api/portal/v2/getUserBriefInfo.action').json()
  }

  /**
   * 获取 accessToken
   * @param sessionKey - sessionKey
   */
  #getAccessTokenBySsKey(sessionKey: string): Promise<AccessTokenResponse> {
    const appkey = '600100422'
    const time = String(Date.now())
    const signature = this.#getSignature({
      sessionKey,
      Timestamp: time,
      AppKey: appkey
    })
    return this.request
      .get(
        `https://cloud.189.cn/api/open/oauth2/getAccessTokenBySsKey.action?sessionKey=${sessionKey}`,
        {
          headers: {
            'Sign-Type': '1',
            Signature: signature,
            Timestamp: time,
            Appkey: appkey
          }
        }
      )
      .json()
  }

  /**
   * 获取家庭信息
   * @returns 家庭列表信息
   */
  getFamilyList(): Promise<FamilyListResponse> {
    return this.request
      .get('https://api.cloud.189.cn/open/family/manage/getFamilyList.action')
      .json()
  }

  /**
   * 家庭签到任务
   * @param familyId - 家庭id
   * @returns 签到结果
   */
  familyUserSign(familyId: number): Promise<FamilyUserSignResponse> {
    return this.request
      .get(
        `https://api.cloud.189.cn/open/family/manage/exeFamilyUserSign.action?familyId=${familyId}`
      )
      .json()
  }
}
