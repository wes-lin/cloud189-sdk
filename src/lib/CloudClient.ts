import url from 'url'
import JSEncrypt from 'node-jsencrypt'
import crypto from 'crypto'
import got, { Got, HTTPError } from 'got'
import { CookieJar } from 'tough-cookie'

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

interface FamilyListResponse {
  familyInfoResp: [
    {
      familyId: number
      remarkName: string
      type: number
      userRole: number
    }
  ]
}

interface LoginResponse {
  result: number
  msg: string
  toUrl: string
}

interface UserBriefInfoResponse {
  sessionKey: string
}

interface AccessTokenResponse {
  accessToken: string
  expiresIn: number
}

interface FamilyUserSignResponse {
  bonusSpace: number
  signFamilyId: number
  signStatus: number
  signTime: string
  userId: string
}

interface UserSizeInfoResponse {
  cloudCapacityInfo: {
    totalSize: number
  }
  familyCapacityInfo: {
    totalSize: number
  }
}

interface UserSignResponse {
  isSign: boolean
  netdiskBonus: number
}

interface TaskResponse {
  errorCode: string
  prizeName: string
}

interface UserSizeInfoResponse {
  account: string
  cloudCapacityInfo: {
    totalSize: number
  }
  familyCapacityInfo: {
    totalSize: number
  }
}

class CloudClient {
  accessToken = ''
  sessionKey = ''
  username: string
  password: string
  #cacheQuery: CacheQuery
  cookieJar: CookieJar
  readonly client: Got

  constructor(
    username: string,
    password: string,
    session?: {
      accessToken?: string
      sessionKey?: string
      cookieJar?: CookieJar
    }
  ) {
    this.username = username
    this.password = password
    if (session) {
      this.#init(session)
    }
    this.client = got.extend({
      cookieJar: this.cookieJar,
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
            if (options.url.host === 'cloud.189.cn') {
              if (!this.accessToken) {
                await this.getNewToken()
              }
              const { query } = url.parse(options.url.toString(), true)
              const time = String(Date.now())
              const signature = this.#getSignature({
                ...(options.method === 'GET' ? query : options.json),
                Timestamp: time,
                AccessToken: this.accessToken
              })
              options.headers['Sign-Type'] = '1'
              options.headers['Signature'] = signature
              options.headers['Timestamp'] = time
              options.headers['Accesstoken'] = this.accessToken
              options.headers['Accept'] = 'application/json;charset=UTF-8'
            }
          }
        ],
        afterResponse: [
          async (response, retryWithMergedOptions) => {
            if (response.statusCode === 400) {
              const { errorCode } = JSON.parse(response.body.toString()) as {
                errorCode: string
              }
              if (errorCode === 'InvalidAccessToken') {
                console.log('InvalidAccessToken retry')
                this.accessToken = undefined
                this.sessionKey = undefined
                return retryWithMergedOptions({})
              } else if (errorCode === 'InvalidSessionKey') {
                this.cookieJar = new CookieJar()
                this.sessionKey = undefined
                this.accessToken = undefined
                await this.login()
                if (response.url.includes('getAccessTokenBySsKey.action')) {
                  console.log('InvalidSessionKey retry')
                  response.statusCode = 401
                  return response
                } else {
                  console.log('InvalidCookie retry')
                  return retryWithMergedOptions({})
                }
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

  #init(session: { accessToken?: string; sessionKey?: string; cookieJar?: CookieJar }) {
    if (session.cookieJar) {
      this.cookieJar = session.cookieJar
    } else {
      this.cookieJar = new CookieJar()
    }
    if (session.accessToken) {
      this.accessToken = session.accessToken
    }
    if (session.sessionKey) {
      this.sessionKey = session.sessionKey
    }
  }

  getEncrypt = (): Promise<any> =>
    this.client.post('https://open.e.189.cn/api/logbox/config/encryptConf.do').json()

  redirectURL = () =>
    new Promise((resolve, reject) => {
      this.client
        .get(
          'https://cloud.189.cn/api/portal/loginUrl.action?redirectURL=https://cloud.189.cn/web/redirect.html?returnURL=/main.action'
        )
        .then((res) => {
          const { query } = url.parse(res.url, true)
          resolve(query)
        })
        .catch((e) => reject(e))
    })

  appConf = (): Promise<any> =>
    this.client
      .post('https://open.e.189.cn/api/logbox/oauth2/appConf.do', {
        headers: {
          Referer: 'https://open.e.189.cn/',
          lt: this.#cacheQuery.lt,
          REQID: this.#cacheQuery.reqId
        },
        form: { version: '2.0', appKey: this.#cacheQuery.appId }
      })
      .json()

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
   * 登录流程
   * 1.获取公钥
   * 2.获取登录参数
   * 3.获取登录地址
   * 4.跳转到登录页
   * */
  login = (): Promise<any> =>
    new Promise((resolve, reject) => {
      console.log('login...')
      Promise.all([
        //1.获取公钥
        this.getEncrypt(),
        //2.获取登录参数
        this.redirectURL().then((query: CacheQuery) => {
          this.#cacheQuery = query
          return this.appConf()
        })
      ])
        .then((res: any[]) => {
          const encrypt = res[0].data
          const appConf = res[1].data
          const data = this.#builLoginForm(encrypt, appConf)
          //3.获取登录地址
          return this.client
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
            return this.client.get(res.toUrl).then((r) => resolve(r.statusCode))
          }
        })
        .catch((e) => reject(e))
    })

  getNewSessionKey = async () => {
    const { sessionKey } = await this.getUserBriefInfo()
    this.sessionKey = sessionKey
  }

  getNewToken = async () => {
    if (!this.sessionKey) {
      await this.getNewSessionKey()
    }
    try {
      const { accessToken } = await this.getAccessTokenBySsKey(this.sessionKey)
      this.accessToken = accessToken
    } catch (e) {
      if (e instanceof HTTPError && e.response.statusCode === 401) {
        await this.getNewSessionKey()
        const { accessToken } = await this.getAccessTokenBySsKey(this.sessionKey)
        this.accessToken = accessToken
      } else {
        throw e
      }
    }
  }

  getUserSizeInfo = (): Promise<UserSizeInfoResponse> => {
    return this.client
      .get('https://cloud.189.cn/api/portal/getUserSizeInfo.action', {
        headers: { Accept: 'application/json;charset=UTF-8' }
      })
      .json()
  }

  userSign = (): Promise<UserSignResponse> => {
    return this.client
      .get(
        `https://cloud.189.cn/mkt/userSign.action?rand=${new Date().getTime()}&clientType=TELEANDROID&version=${
          config.version
        }&model=${config.model}`
      )
      .json()
  }

  /**
   * @deprecated 任务无效， 1.0.4版本废弃
   */
  taskSign = (): Promise<TaskResponse> => {
    return this.client(
      'https://m.cloud.189.cn/v2/drawPrizeMarketDetails.action?taskId=TASK_SIGNIN&activityId=ACT_SIGNIN'
    ).json()
  }

  /**
   * @deprecated 任务无效， 1.0.4版本废弃
   */
  taskPhoto = (): Promise<TaskResponse> => {
    return this.client(
      'https://m.cloud.189.cn/v2/drawPrizeMarketDetails.action?taskId=TASK_SIGNIN_PHOTOS&activityId=ACT_SIGNIN'
    ).json()
  }

  /**
   * @deprecated 任务无效， 1.0.3版本废弃
   */
  taskKJ = (): Promise<TaskResponse> => {
    return this.client
      .get(
        'https://m.cloud.189.cn/v2/drawPrizeMarketDetails.action?taskId=TASK_2022_FLDFS_KJ&activityId=ACT_SIGNIN'
      )
      .json()
  }

  getUserBriefInfo = (): Promise<UserBriefInfoResponse> => {
    return this.client.get('https://cloud.189.cn/api/portal/v2/getUserBriefInfo.action').json()
  }

  getAccessTokenBySsKey = (sessionKey: string): Promise<AccessTokenResponse> => {
    const appkey = '600100422'
    const time = String(Date.now())
    const signature = this.#getSignature({
      sessionKey,
      Timestamp: time,
      AppKey: appkey
    })
    return this.client
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

  getFamilyList = (): Promise<FamilyListResponse> =>
    this.client.get('https://api.cloud.189.cn/open/family/manage/getFamilyList.action').json()

  familyUserSign = (familyId: number): Promise<FamilyUserSignResponse> =>
    this.client
      .get(
        `https://api.cloud.189.cn/open/family/manage/exeFamilyUserSign.action?familyId=${familyId}`
      )
      .json()
}

export default CloudClient
