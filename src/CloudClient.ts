import fs from 'fs'
import path from 'path'
import got, { Got } from 'got'
import {
  UserSignResponse,
  UserSizeInfoResponse,
  FamilyListResponse,
  FamilyUserSignResponse,
  ConfigurationOptions,
  ClientSession,
  PageQuery,
  MediaType,
  OrderByType,
  FileListResponse,
  RsaKeyResponse,
  RsaKey,
  UploadInitResponse,
  UploadCommitResponse,
  MultiUploadUrlsResponse,
  CreateFolderRequest,
  UploadCallbacks,
  PartNumberKey,
  RenameFolderRequest,
  CreateBatchTaskRequest,
  AccessTokenResponse,
  CreateFamilyBatchTaskRequest,
  CreateFamilyFolderRequest,
  RenameFamilyFolderRequest,
  CommitMultiFamilyUploadRequest,
  CommitMultiUploadRequest,
  FamilyRequest,
  initMultiUploadRequest,
  initMultiFamilyUploadRequest
} from './types'
import { logger } from './log'
import { asyncPool, calculateFileAndChunkMD5, hexToBase64, md5, partSize } from './util'
import { WEB_URL, API_URL, UserAgent, UPLOAD_URL } from './const'
import { signatureAccesstoken, signatureAppKey, signatureUpload } from './signature'
import { CloudAuthClient } from './CloudAuthClient'
import { logHook } from './hook'
import { MemoryStore, Store } from './store'
import { FileHandle } from 'fs/promises'

const config = {
  clientId: '538135150693412',
  model: 'KB2000',
  version: '9.0.6'
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
  private sessionKeyPromise: Promise<string>
  private accessTokenPromise: Promise<AccessTokenResponse>
  private generateRsaKeyPromise: Promise<RsaKeyResponse>

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
            if (options.url.href.includes(API_URL)) {
              const accessToken = await this.getAccessToken()
              signatureAccesstoken(options, accessToken)
            } else if (options.url.href.includes(WEB_URL)) {
              if (options.url.href.includes('/open')) {
                const appkey = '600100422'
                signatureAppKey(options, appkey)
              }
              const sessionKey = await this.getSessionKey()
              options.url.searchParams.set('sessionKey', sessionKey)
            } else if (options.url.href.includes(UPLOAD_URL)) {
              const sessionKey = await this.getSessionKey()
              const rsaKey = await this.generateRsaKey()
              signatureUpload(options, rsaKey, sessionKey)
            }
          }
        ],
        afterResponse: [
          logHook,
          async (response, retryWithMergedOptions) => {
            if (response.statusCode === 400) {
              try {
                const { errorCode, errorMsg } = JSON.parse(response.body.toString()) as {
                  errorCode: string
                  errorMsg: string
                }
                if (errorCode === 'InvalidAccessToken') {
                  logger.debug(`InvalidAccessToken retry..., errorMsg: ${errorMsg}`)
                  logger.debug('Refresh AccessToken')
                  this.session.accessToken = ''
                  return retryWithMergedOptions({})
                } else if (errorCode === 'InvalidSessionKey') {
                  logger.debug(`InvalidSessionKey retry..., errorMsg: ${errorMsg}`)
                  logger.debug('Refresh InvalidSessionKey')
                  this.session.sessionKey = ''
                  return retryWithMergedOptions({})
                }
              } catch (e) {
                logger.error(e)
              }
            }
            return response
          }
        ]
      }
    })
  }

  #valid = (options: ConfigurationOptions) => {
    if (options.ssonCookie) {
      return
    }
    if (options.token) {
      return
    }
    if (options.username && options.password) {
      return
    }
    logger.error('valid')
    throw new Error('Please provide username and password or token or ssonCooike !')
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
    if (!this.sessionKeyPromise) {
      this.sessionKeyPromise = this.getSession()
        .then((result) => {
          this.session.sessionKey = result.sessionKey
          return result.sessionKey
        })
        .finally(() => {
          this.sessionKeyPromise = null
        })
    }
    const result = await this.sessionKeyPromise
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
    if (!this.accessTokenPromise) {
      this.accessTokenPromise = this.#getAccessTokenBySsKey()
        .then((result) => {
          this.session.accessToken = result.accessToken
          return result
        })
        .finally(() => {
          this.accessTokenPromise = null
        })
    }
    const result = await this.accessTokenPromise
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
    if (!this.generateRsaKeyPromise) {
      this.generateRsaKeyPromise = this.#generateRsaKey()
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
          this.generateRsaKeyPromise = null
        })
    }
    const result = await this.generateRsaKeyPromise
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
   * @deprecated
   */
  familyUserSign(familyId: string): Promise<FamilyUserSignResponse> {
    return this.request
      .get(`${API_URL}/open/family/manage/exeFamilyUserSign.action?familyId=${familyId}`)
      .json()
  }

  /**
   * 获取文件列表
   * @param pageQuery
   * @returns
   */
  getListFiles(pageQuery?: PageQuery, familyId?: string): Promise<FileListResponse> {
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

  #isFamily(request: any): request is FamilyRequest {
    return 'familyId' in request && request.familyId !== undefined
  }

  /**
   * 创建文件夹
   * @param createFolderRequest
   * @returns
   */
  createFolder(createFolderRequest: CreateFolderRequest | CreateFamilyFolderRequest): Promise<{
    id: string
    name: string
    parentId: string
  }> {
    const url = this.#isFamily(createFolderRequest)
      ? `${API_URL}/open/family/file/createFolder.action`
      : `${API_URL}/open/file/createFolder.action`
    return this.request
      .post(url, {
        form: createFolderRequest
      })
      .json()
  }

  /**
   * 重命名文件夹
   * @param folderRequest
   * @returns
   */
  renameFolder(renameFolderRequest: RenameFolderRequest | RenameFamilyFolderRequest) {
    let url = `${API_URL}/open/file/renameFolder.action`
    let form = {
      destFolderName: renameFolderRequest.folderName,
      folderId: renameFolderRequest.folderId
    }
    if (this.#isFamily(renameFolderRequest)) {
      url = `${API_URL}/open/family/file/renameFolder.action`
      form = Object.assign(form, {
        familyId: renameFolderRequest.familyId
      })
    }
    return this.request
      .post(url, {
        form
      })
      .json()
  }

  /**
   * 初始化上传
   * @param initMultiUploadRequest
   * @returns
   */
  async initMultiUpload(
    initMultiUploadRequest: initMultiUploadRequest | initMultiFamilyUploadRequest
  ) {
    const { parentFolderId, fileName, fileSize, sliceSize, fileMd5, sliceMd5 } =
      initMultiUploadRequest
    let initParams = {
      parentFolderId,
      fileName,
      fileSize,
      sliceSize,
      ...(fileMd5 && sliceMd5 ? { fileMd5, sliceMd5 } : { lazyCheck: 1 })
    }
    let url = `${UPLOAD_URL}/person/initMultiUpload`
    if (this.#isFamily(initMultiUploadRequest)) {
      url = `${UPLOAD_URL}/family/initMultiUpload`
      initParams = Object.assign(initParams, {
        familyId: initMultiUploadRequest.familyId
      })
    }
    return await this.request
      .get(url, {
        searchParams: {
          ...initParams
        }
      })
      .json<UploadInitResponse>()
  }

  /**
   * 提交上传
   * @param commitMultiUploadRequest
   * @returns
   */
  commitMultiUpload(
    commitMultiUploadRequest: CommitMultiUploadRequest | CommitMultiFamilyUploadRequest
  ) {
    const url = this.#isFamily(commitMultiUploadRequest)
      ? `${UPLOAD_URL}/family/commitMultiUploadFile`
      : `${UPLOAD_URL}/person/commitMultiUploadFile`
    return this.request
      .get(url, {
        searchParams: {
          ...commitMultiUploadRequest
        }
      })
      .json<UploadCommitResponse>()
  }

  /**
   * 检测秒传
   * @param params
   * @returns
   */
  checkTransSecond(params: {
    fileMd5: string
    sliceMd5: string
    uploadFileId: string
    familyId?: number
  }) {
    const url = this.#isFamily(params)
      ? `${UPLOAD_URL}/family/checkTransSecond`
      : `${UPLOAD_URL}/person/checkTransSecond`
    return this.request
      .get(url, {
        searchParams: params
      })
      .json<UploadInitResponse>()
  }

  async #partUpload(
    { partNumber, md5, buffer, uploadFileId, familyId },
    callbacks: UploadCallbacks = {}
  ) {
    const partInfo = `${partNumber}-${hexToBase64(md5)}`
    logger.debug(`upload part: ${partNumber}`)
    const multiUploadUrParams = {
      partInfo,
      uploadFileId
    }
    const url = familyId
      ? `${UPLOAD_URL}/family/getMultiUploadUrls`
      : `${UPLOAD_URL}/person/getMultiUploadUrls`
    const urls = await this.request
      .get(url, {
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
    await got
      .put(requestURL, {
        headers,
        body: buffer
      })
      .on('uploadProgress', (progress) => {
        callbacks.onProgress?.((progress.transferred * 100) / progress.total)
      })
  }

  /**
   * 单个小文件上传
   */
  async #singleUpload(
    { parentFolderId, filePath, fileName, fileSize, fileMd5, sliceSize, familyId },
    callbacks: UploadCallbacks = {}
  ) {
    const sliceMd5 = fileMd5
    const initParams = {
      parentFolderId,
      fileName,
      fileSize,
      sliceSize,
      fileMd5,
      sliceMd5,
      familyId
    }
    let fd: FileHandle | null
    try {
      // md5校验
      const res = await this.initMultiUpload(initParams)
      const { uploadFileId, fileDataExists } = res.data
      if (!fileDataExists) {
        fd = await fs.promises.open(filePath, 'r')
        const buffer = Buffer.alloc(fileSize)
        await fd.read(buffer, 0, fileSize)
        await this.#partUpload(
          {
            partNumber: 1,
            md5: fileMd5,
            buffer,
            uploadFileId,
            familyId
          },
          {
            onProgress: callbacks.onProgress,
            onError: callbacks.onError
          }
        )
      } else {
        logger.debug(`单文件 ${filePath} 秒传: ${uploadFileId}`)
        callbacks.onProgress?.(100) // 秒传直接显示100%
      }
      const commitResult = await this.commitMultiUpload({
        fileMd5,
        sliceMd5,
        uploadFileId,
        familyId
      })
      callbacks.onComplete?.(commitResult)
      return commitResult
    } catch (e) {
      callbacks.onError?.(e)
      throw e
    } finally {
      fd?.close()
    }
  }

  /**
   * 大文件分块上传
   */
  async #multiUpload(
    { parentFolderId, filePath, fileName, fileSize, fileMd5, sliceSize, chunkMd5s, familyId },
    callbacks: UploadCallbacks = {}
  ) {
    const sliceMd5 = md5(chunkMd5s.join('\n'))
    const initParams = {
      parentFolderId,
      fileName,
      fileSize,
      sliceSize,
      familyId
    }
    let fd: FileHandle | null
    try {
      const res = await this.initMultiUpload(initParams)
      const { uploadFileId } = res.data
      const checkTransSecondParams = {
        fileMd5,
        sliceMd5,
        uploadFileId,
        familyId
      }
      // md5校验
      const checkRes = await this.checkTransSecond(checkTransSecondParams)
      if (!checkRes.data.fileDataExists) {
        fd = await fs.promises.open(filePath, 'r')
        const chunkCount = chunkMd5s.length
        const progressMap: {
          [key: PartNumberKey]: number
        } = {}
        await asyncPool(5, [...Array(chunkCount).keys()], async (i) => {
          const partNumber = i + 1
          const position = i * sliceSize
          const length = Math.min(sliceSize, fileSize - position)
          const buffer = Buffer.alloc(length)
          await fd.read(buffer, 0, length, position)
          await this.#partUpload(
            {
              partNumber: partNumber,
              md5: chunkMd5s[i],
              buffer,
              uploadFileId,
              familyId
            },
            {
              onProgress: (chunkProgress) => {
                if (callbacks.onProgress) {
                  // 计算整体进度
                  progressMap[`partNumber_${partNumber}`] = chunkProgress
                  const totalProgress =
                    Object.values(progressMap).reduce((sum, p) => sum + p, 0) / chunkCount
                  callbacks.onProgress(totalProgress)
                }
              },
              onError: callbacks.onError
            }
          )
        })
      } else {
        logger.debug(`多块文件 ${filePath} 秒传: ${uploadFileId}`)
        callbacks.onProgress?.(100) // 秒传直接显示100%
      }
      const commitResult = await this.commitMultiUpload({
        fileMd5,
        sliceMd5,
        uploadFileId,
        lazyCheck: 1,
        familyId
      })
      callbacks.onComplete?.(commitResult)
      return commitResult
    } catch (e) {
      callbacks.onError?.(e)
      throw e
    } finally {
      fd?.close()
    }
  }

  /**
   * 文件上传
   * @param param
   * @param callbacks
   * @returns
   */
  async upload(
    param: { parentFolderId: string; filePath: string; familyId?: string },
    callbacks: UploadCallbacks = {}
  ) {
    const { filePath, parentFolderId, familyId } = param
    const { size } = await fs.promises.stat(filePath)
    const fileName = encodeURIComponent(path.basename(filePath))
    const sliceSize = partSize(size)
    const { fileMd5, chunkMd5s } = await calculateFileAndChunkMD5(filePath, sliceSize)
    if (chunkMd5s.length === 1) {
      logger.debug('single file upload')
      return this.#singleUpload(
        {
          parentFolderId,
          filePath,
          fileName,
          fileSize: size,
          sliceSize,
          fileMd5,
          familyId
        },
        callbacks
      )
    } else {
      logger.debug('multi file upload')
      return this.#multiUpload(
        {
          parentFolderId,
          filePath,
          fileName,
          fileSize: size,
          sliceSize,
          fileMd5,
          chunkMd5s,
          familyId
        },
        callbacks
      )
    }
  }

  /**
   * 检测任务状态
   * @param type
   * @param taskId
   * @param maxAttempts
   * @param interval
   * @returns
   */
  async checkTaskStatus(
    type: string,
    taskId: string,
    maxAttempts = 120,
    interval = 500
  ): Promise<{
    successedFileIdList?: number[]
    taskId: string
    taskStatus: number
  }> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const { taskStatus, successedFileIdList } = await this.request
          .post(`${API_URL}/open/batch/checkBatchTask.action`, {
            form: { type, taskId }
          })
          .json<{ taskStatus: number; successedFileIdList: number[] }>()
        if (taskStatus === -1) {
          logger.error('任务异常')
          return {
            taskId,
            taskStatus
          }
        }
        //重名
        if (taskStatus === 2) {
          logger.error('文件重名异常')
          return {
            taskId,
            taskStatus
          }
        }
        //成功
        if (taskStatus === 4) {
          return { successedFileIdList, taskId, taskStatus }
        }
      } catch (e) {
        logger.error(`Check task status attempt ${attempt + 1} failed:` + e)
      }
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
  }

  /**
   * 创建任务
   * @param createBatchTaskRequest
   * @returns
   */
  async createBatchTask(
    createBatchTaskRequest: CreateBatchTaskRequest | CreateFamilyBatchTaskRequest
  ) {
    let form = {
      type: createBatchTaskRequest.type,
      taskInfos: JSON.stringify(createBatchTaskRequest.taskInfos)
    }
    if (createBatchTaskRequest.targetFolderId) {
      form = Object.assign(form, {
        targetFolderId: createBatchTaskRequest.targetFolderId
      })
    }
    if (this.#isFamily(createBatchTaskRequest)) {
      form = Object.assign(form, {
        familyId: createBatchTaskRequest.familyId
      })
    }
    logger.debug('createBatchTask:' + JSON.stringify(form))
    try {
      const { taskId } = await this.request
        .post(`${API_URL}/open/batch/createBatchTask.action`, {
          form
        })
        .json<{ taskId: string }>()

      return await this.checkTaskStatus(createBatchTaskRequest.type, taskId)
    } catch (error) {
      logger.error('Batch task creation failed:' + error)
      throw error
    }
  }

  /**
   * 获取文件下载路径
   * @param params
   * @returns
   */
  getFileDownloadUrl(params: { fileId: string; familyId?: string }) {
    const url = params.familyId
      ? `${API_URL}/open/family/file/getFileDownloadUrl.action`
      : `${API_URL}/open/file/getFileDownloadUrl.action`
    return this.request(url, {
      searchParams: params
    }).json<{
      fileDownloadUrl: string
    }>()
  }
}
