import url from 'url'
import fs from 'fs'
import path from 'path'
import got, { Got } from 'got'
import {
  UserSignResponse,
  UserSizeInfoResponse,
  AccessTokenResponse,
  FamilyListResponse,
  FamilyUserSignResponse,
  ConfigurationOptions,
  ClientSession,
  RefreshTokenSession,
  TokenSession,
  CacheQuery,
  PageQuery,
  MediaType,
  OrderByType,
  FileListResponse,
  RsaKeyResponse,
  RsaKey,
  UploadInitResponse,
  UploadCommitResponse,
  UploadPartsInfoResponse,
  MultiUploadUrlsResponse,
  CreateFolderReuest,
  RenameFolderReuest
} from './types'
import { logger } from './log'
import {
  aesECBEncrypt,
  calculateFileAndChunkMD5,
  getSignature,
  hexToBase64,
  hmacSha1,
  md5,
  partSize,
  randomString,
  rsaEncrypt
} from './util'
import {
  WEB_URL,
  API_URL,
  AUTH_URL,
  UserAgent,
  clientSuffix,
  AppID,
  ClientType,
  ReturnURL,
  AccountType,
  UPLOAD_URL
} from './const'
import { Store, MemoryStore } from './store'
import { checkError } from './error'

const config = {
  clientId: '538135150693412',
  model: 'KB2000',
  version: '9.0.6'
}

interface LoginResponse {
  result: number
  msg: string
  toUrl: string
}

/**
 * @public
 */
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
            logger.debug(`url: ${response.requestUrl}, response: ${response.body})}`)
            checkError(response.body.toString())
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

  async getSessionForPC(param: { redirectURL?: string; accessToken?: string }) {
    const params = {
      appId: AppID,
      ...clientSuffix(),
      ...param
    }
    const res = await this.request
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
    const res = await this.request.get(`${WEB_URL}/api/portal/unifyLoginForPC.action`, {
      searchParams: {
        appId: AppID,
        clientType: ClientType,
        returnURL: ReturnURL,
        timeStamp: Date.now()
      }
    })
    const redirect = await this.request(res.url, {
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
    return this.request
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

/**
 * 天翼网盘客户端
 * @public
 */
export class CloudClient {
  username: string
  password: string
  ssonCookie: string
  tokenStore: Store
  readonly request: Got
  readonly authClient: CloudAuthClient
  readonly session: ClientSession
  private rsaKey: RsaKey
  #sessionKeyPromise: Promise<string>
  #accessTokenPromise: Promise<AccessTokenResponse>
  #generateRsaKeyPromise: Promise<RsaKeyResponse>

  constructor(_options: ConfigurationOptions) {
    this.#valid(_options)
    this.username = _options.username
    this.password = _options.password
    this.ssonCookie = _options.ssonCookie
    this.tokenStore = _options.token || new MemoryStore()
    this.authClient = new CloudAuthClient()
    this.session = {
      accessToken: '',
      sessionKey: ''
    }
    this.rsaKey = null
    this.request = got.extend({
      retry: {
        limit: 2,
        statusCodes: [408, 413, 429],
        errorCodes: ['ETIMEDOUT', 'ECONNRESET']
      },
      headers: {
        'User-Agent': UserAgent,
        Referer: `${WEB_URL}/web/main/`,
        Accept: 'application/json;charset=UTF-8'
      },
      hooks: {
        beforeRequest: [
          async (options) => {
            const time = String(Date.now())
            const { query } = url.parse(options.url.toString(), true)
            if (options.url.href.includes(API_URL)) {
              const accessToken = await this.getAccessToken()
              const signature = getSignature({
                ...(options.method === 'GET' ? query : options.json || options.form),
                Timestamp: time,
                AccessToken: accessToken
              })
              options.headers['Sign-Type'] = '1'
              options.headers['Signature'] = signature
              options.headers['Timestamp'] = time
              options.headers['Accesstoken'] = accessToken
            } else if (options.url.href.includes(WEB_URL)) {
              if (options.url.href.includes('/open')) {
                const appkey = '600100422'
                const signature = getSignature({
                  ...(options.method === 'GET' ? query : options.json || options.form),
                  Timestamp: time,
                  AppKey: appkey
                })
                options.headers['Sign-Type'] = '1'
                options.headers['Signature'] = signature
                options.headers['Timestamp'] = time
                options.headers['AppKey'] = appkey
              }
              const sessionKey = await this.getSessionKey()
              options.url.searchParams.set('sessionKey', sessionKey)
            } else if (options.url.href.includes(UPLOAD_URL)) {
              const sessionKey = await this.getSessionKey()
              const rsaKey = await this.generateRsaKey()
              const requestID = randomString('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx')
              const uuid = randomString('xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx').slice(
                0,
                (16 + 16 * Math.random()) | 0
              )
              logger.debug(`upload query: ${JSON.stringify(query)}`)
              const params = aesECBEncrypt(query, uuid.substring(0, 16))
              const data = {
                SessionKey: sessionKey,
                Operate: 'GET',
                RequestURI: options.url.pathname,
                Date: time,
                params
              }
              const keyData = `-----BEGIN PUBLIC KEY-----\n${rsaKey.pubKey}\n-----END PUBLIC KEY-----`
              const encryptionText = rsaEncrypt(keyData, uuid, 'base64')
              options.headers['X-Request-Date'] = time
              options.headers['X-Request-ID'] = requestID
              options.headers['SessionKey'] = sessionKey
              options.headers['EncryptionText'] = encryptionText
              options.headers['PkId'] = rsaKey.pkId
              options.headers['Signature'] = hmacSha1(data, uuid)
              options.url.search = ''
              options.url.hash = ''
              options.url.searchParams.set('params', params)
            }
          }
        ],
        afterResponse: [
          async (response, retryWithMergedOptions) => {
            logger.debug(`url: ${response.url}, response: ${response.body}`)
            if (response.statusCode === 400) {
              const { errorCode, errorMsg } = JSON.parse(response.body.toString()) as {
                errorCode: string
                errorMsg: string
              }
              if (errorCode === 'InvalidAccessToken') {
                logger.debug('InvalidAccessToken retry...')
                logger.debug('Refresh AccessToken')
                this.session.accessToken = ''
                return retryWithMergedOptions({})
              } else if (errorCode === 'InvalidSessionKey') {
                logger.debug('InvalidSessionKey retry...')
                logger.debug('Refresh InvalidSessionKey')
                this.session.sessionKey = ''
                return retryWithMergedOptions({})
              }
            }
            return response
          }
        ]
      }
    })
  }

  #valid = (options: ConfigurationOptions) => {
    if (!options.token && (!options.username || !options.password)) {
      logger.error('valid')
      throw new Error('Please provide username and password or token !')
    }
  }

  async getSession() {
    const { accessToken, expiresIn, refreshToken } = await this.tokenStore.get()

    if (accessToken && expiresIn && expiresIn > Date.now()) {
      try {
        return await this.authClient.loginByAccessToken(accessToken)
      } catch (e) {
        logger.error(e)
      }
    }

    if (refreshToken) {
      try {
        const refreshTokenSession = await this.authClient.refreshToken(refreshToken)
        await this.tokenStore.update({
          accessToken: refreshTokenSession.accessToken,
          refreshToken: refreshTokenSession.refreshToken,
          expiresIn: new Date(Date.now() + refreshTokenSession.expiresIn * 1000).getTime()
        })
        return await this.authClient.loginByAccessToken(refreshTokenSession.accessToken)
      } catch (e) {
        logger.error(e)
      }
    }

    if (this.ssonCookie) {
      try {
        const loginToken = await this.authClient.loginBySsoCooike(this.ssonCookie)
        await this.tokenStore.update({
          accessToken: loginToken.accessToken,
          refreshToken: loginToken.refreshToken,
          expiresIn: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).getTime()
        })
        return loginToken
      } catch (e) {
        logger.error(e)
      }
    }

    if (this.username && this.password) {
      try {
        const loginToken = await this.authClient.loginByPassword(this.username, this.password)
        await this.tokenStore.update({
          accessToken: loginToken.accessToken,
          refreshToken: loginToken.refreshToken,
          expiresIn: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).getTime()
        })
        return loginToken
      } catch (e) {
        logger.error(e)
      }
    }
    throw new Error('Can not get session.')
  }

  /**
   * 获取 sessionKey
   * @returns sessionKey
   */
  async getSessionKey() {
    if (this.session.sessionKey) {
      return this.session.sessionKey
    }
    if (!this.#sessionKeyPromise) {
      this.#sessionKeyPromise = this.getSession()
        .then((result) => {
          this.session.sessionKey = result.sessionKey
          return result.sessionKey
        })
        .finally(() => {
          this.#sessionKeyPromise = null
        })
    }
    const result = await this.#sessionKeyPromise
    return result
  }

  /**
   * 获取 accessToken
   * @returns accessToken
   */
  async getAccessToken() {
    if (this.session.accessToken) {
      return this.session.accessToken
    }
    if (!this.#accessTokenPromise) {
      this.#accessTokenPromise = this.#getAccessTokenBySsKey()
        .then((result) => {
          this.session.accessToken = result.accessToken
          return result
        })
        .finally(() => {
          this.#accessTokenPromise = null
        })
    }
    const result = await this.#accessTokenPromise
    return result.accessToken
  }

  /**
   * 获取 RSA key
   * @returns RSAKey
   */
  async generateRsaKey() {
    if (this.rsaKey && new Date(this.rsaKey.expire).getTime() > Date.now()) {
      return this.rsaKey
    }
    if (!this.#generateRsaKeyPromise) {
      this.#generateRsaKeyPromise = this.#generateRsaKey()
        .then((res) => {
          this.rsaKey = {
            expire: res.expire,
            pubKey: res.pubKey,
            pkId: res.pkId,
            ver: res.ver
          }
          return res
        })
        .finally(() => {
          this.#generateRsaKeyPromise = null
        })
    }
    const result = await this.#generateRsaKeyPromise
    return result
  }

  /**
   * 获取用户网盘存储容量信息
   * @returns 账号容量结果
   */
  getUserSizeInfo(): Promise<UserSizeInfoResponse> {
    return this.request.get(`${WEB_URL}/api/portal/getUserSizeInfo.action`).json()
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
   * 获取 accessToken
   */
  #getAccessTokenBySsKey(): Promise<AccessTokenResponse> {
    return this.request.get(`${WEB_URL}/api/open/oauth2/getAccessTokenBySsKey.action`).json()
  }

  #generateRsaKey(): Promise<RsaKeyResponse> {
    return this.request.get(`${WEB_URL}/api/security/generateRsaKey.action`).json()
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

  /**
   * 获取文件列表
   * @param pageQuery
   * @returns
   */
  getListFiles(pageQuery?: PageQuery, familyId?: number): Promise<FileListResponse> {
    const defaultQuery = {
      pageNum: 1,
      pageSize: 60,
      mediaType: MediaType.ALL.toString(),
      orderBy: OrderByType.LAST_OP_TIME.toString(),
      descending: true,
      folderId: '',
      iconOption: 5
    }
    const query = {
      ...defaultQuery,
      ...pageQuery
    }
    if (familyId) {
      return this.request
        .get(`${API_URL}/open/family/file/listFiles.action`, {
          searchParams: {
            ...query,
            familyId
          }
        })
        .json()
    } else {
      return this.request
        .get(`${API_URL}/open/file/listFiles.action`, {
          searchParams: { ...query }
        })
        .json()
    }
  }

  /**
   * 创建文件夹
   * @param folderReuest
   * @returns
   */
  createFolder(folderReuest: CreateFolderReuest): Promise<{
    id: string
    name: string
    parentId: number
  }> {
    if (folderReuest.familyId) {
      return this.request
        .post(`${API_URL}/open/family/file/createFolder.action`, {
          form: {
            folderName: folderReuest.folderName,
            parentId: folderReuest.parentFolderId,
            familyId: folderReuest.familyId
          }
        })
        .json()
    } else {
      return this.request
        .post(`${API_URL}/open/file/createFolder.action`, {
          form: {
            folderName: folderReuest.folderName,
            parentFolderId: folderReuest.parentFolderId
          }
        })
        .json()
    }
  }

  /**
   * 重命名文件夹
   * @param folderReuest
   * @returns
   */
  renameFolder(folderReuest: RenameFolderReuest) {
    if (folderReuest.familyId) {
      return this.request
        .post(`${API_URL}/open/family/file/renameFolder.action`, {
          form: {
            destFolderName: folderReuest.folderName,
            folderId: folderReuest.folderId,
            familyId: folderReuest.familyId
          }
        })
        .json()
    } else {
      return this.request
        .post(`${API_URL}/open/file/renameFolder.action`, {
          form: {
            destFolderName: folderReuest.folderName,
            folderId: folderReuest.folderId
          }
        })
        .json()
    }
  }

  async initMultiUpload(
    params: {
      parentFolderId: string
      fileName: string
      fileSize: number
      sliceSize: number
      fileMd5?: string
      sliceMd5?: string
    },
    familyId?: number
  ) {
    const { parentFolderId, fileName, fileSize, sliceSize, fileMd5, sliceMd5 } = params
    const initParams = {
      parentFolderId,
      fileName,
      fileSize,
      sliceSize,
      ...(fileMd5 && sliceMd5 ? { fileMd5, sliceMd5 } : { lazyCheck: 1 })
    }
    if (familyId) {
      return await this.request
        .get(`${UPLOAD_URL}/family/initMultiUpload`, {
          searchParams: {
            ...initParams,
            familyId
          }
        })
        .json<UploadInitResponse>()
    } else {
      return await this.request
        .get(`${UPLOAD_URL}/person/initMultiUpload`, {
          searchParams: {
            ...initParams
          }
        })
        .json<UploadInitResponse>()
    }
  }

  commitMultiUpload(
    params: {
      fileMd5: string
      sliceMd5: string
      uploadFileId: string
      lazyCheck?: number
    },
    familyId?: number
  ) {
    return this.request
      .get(`${UPLOAD_URL}/${familyId ? 'family' : 'person'}/commitMultiUploadFile`, {
        searchParams: params
      })
      .json<UploadCommitResponse>()
  }

  checkTransSecond(
    params: { fileMd5: string; sliceMd5: string; uploadFileId: string },
    familyId?: number
  ) {
    return this.request
      .get(`${UPLOAD_URL}/${familyId ? 'family' : 'person'}/checkTransSecond`, {
        searchParams: params
      })
      .json<UploadInitResponse>()
  }

  async #parentUpload({ partNumber, md5, buffer, uploadFileId }) {
    const partInfo = `${partNumber}-${hexToBase64(md5)}`
    logger.debug(`upload part: ${partNumber}`)
    const multiUploadUrParams = {
      partInfo,
      uploadFileId
    }
    const urls = await this.request
      .get(`${UPLOAD_URL}/family/getMultiUploadUrls`, {
        searchParams: multiUploadUrParams
      })
      .json<MultiUploadUrlsResponse>()
    const { requestURL, requestHeader } = urls.uploadUrls[`partNumber_${partNumber}`]
    const headers = requestHeader.split('&').reduce((acc, pair) => {
      const key = pair.split('=')[0]
      const value = pair.match(/=(.*)/)[1]
      acc[key] = value
      return acc
    }, {})
    logger.debug(`Upload URL: ${requestURL}`)
    logger.debug(`Upload Headers: ${JSON.stringify(headers)}`)
    const res = await got.put(requestURL, {
      headers,
      body: buffer
    })
  }

  /**
   * 单个小文件上传
   */
  async #singleUpload({
    parentFolderId,
    filePath,
    fileName,
    fileSize,
    fileMd5,
    sliceSize,
    familyId
  }) {
    const sliceMd5 = fileMd5
    const initParams = {
      parentFolderId,
      fileName,
      fileSize,
      sliceSize,
      fileMd5,
      sliceMd5
    }
    // md5校验
    const res = await this.initMultiUpload(initParams, familyId)
    const { uploadFileId, fileDataExists } = res.data
    if (!fileDataExists) {
      const fd = await fs.promises.open(filePath, 'r')
      const buffer = Buffer.alloc(fileSize)
      await fd.read(buffer, 0, fileSize)
      await this.#parentUpload({
        partNumber: 1,
        md5: fileMd5,
        buffer,
        uploadFileId
      })
    } else {
      logger.debug(`单文件 ${filePath} 秒传: ${uploadFileId}`)
    }
    return this.commitMultiUpload(
      {
        fileMd5,
        sliceMd5,
        uploadFileId
      },
      familyId
    )
  }

  /**
   * 大文件分块上传
   */
  async #multiUpload({
    parentFolderId,
    filePath,
    fileName,
    fileSize,
    fileMd5,
    sliceSize,
    chunkMd5s,
    familyId
  }) {
    const sliceMd5 = md5(chunkMd5s.join('\n'))
    const initParams = {
      parentFolderId,
      fileName,
      fileSize,
      sliceSize
    }
    const res = await this.initMultiUpload(initParams, familyId)
    const { uploadFileId } = res.data
    const checkTransSecondParams = {
      fileMd5,
      sliceMd5,
      uploadFileId
    }
    // md5校验
    const checkRes = await this.checkTransSecond(checkTransSecondParams, familyId)
    if (!checkRes.data.fileDataExists) {
      const fd = await fs.promises.open(filePath, 'r')
      const chunkCount = chunkMd5s.length
      for (let i = 0; i < chunkCount; i++) {
        const partNumber = i + 1
        const position = i * sliceSize
        const length = Math.min(sliceSize, fileSize - position)
        const buffer = Buffer.alloc(length)
        await fd.read(buffer, 0, length, position)
        await this.#parentUpload({
          partNumber: partNumber,
          md5: chunkMd5s[i],
          buffer,
          uploadFileId
        })
      }
    } else {
      logger.debug(`多块文件 ${filePath} 秒传: ${uploadFileId}`)
    }
    return this.commitMultiUpload(
      {
        fileMd5,
        sliceMd5,
        uploadFileId,
        lazyCheck: 1
      },
      familyId
    )
  }

  /**
   * 文件上传
   * @param param
   * @returns
   */
  async upload(param: { parentFolderId: string; filePath: string; familyId?: number }) {
    const { filePath, parentFolderId, familyId } = param
    const { size } = await fs.promises.stat(filePath)
    const fileName = encodeURIComponent(path.basename(filePath))
    const sliceSize = partSize(size)
    const { fileMd5, chunkMd5s } = await calculateFileAndChunkMD5(filePath, sliceSize)
    if (chunkMd5s.length === 1) {
      return this.#singleUpload({
        parentFolderId,
        filePath,
        fileName,
        fileSize: size,
        sliceSize,
        fileMd5,
        familyId
      })
    } else {
      return this.#multiUpload({
        parentFolderId,
        filePath,
        fileName,
        fileSize: size,
        sliceSize,
        fileMd5,
        chunkMd5s,
        familyId
      })
    }
  }
}
