import fs from 'fs'
import path from 'path'
import got, { Got } from 'got'
import {
  UserSignResponse,
  UserSizeInfoResponse,
  FamilyListResponse,
  FamilyUserSignResponse,
  ConfigurationOptions,
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
  CreateBatchTaskRequest
} from './types'
import { logger } from './log'
import { asyncPool, calculateFileAndChunkMD5, hexToBase64, md5, partSize } from './util'
import { WEB_URL, API_URL, UserAgent, UPLOAD_URL } from './const'
import { signatureAccesstoken, signatureAppKey, signatureUpload } from './signature'
import { CloudAuthClient } from './CloudAuthClient'
import { logHook } from './hook'

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
  readonly request: Got
  readonly authClient: CloudAuthClient
  private rsaKey: RsaKey
  #generateRsaKeyPromise: Promise<RsaKeyResponse>

  constructor(_options: ConfigurationOptions) {
    this.authClient = new CloudAuthClient(_options)
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
              const accessToken = await this.authClient.getAccessToken()
              signatureAccesstoken(options, accessToken)
            } else if (options.url.href.includes(WEB_URL)) {
              if (options.url.href.includes('/open')) {
                const appkey = '600100422'
                signatureAppKey(options, appkey)
              }
              const sessionKey = await this.authClient.getSessionKey()
              options.url.searchParams.set('sessionKey', sessionKey)
            } else if (options.url.href.includes(UPLOAD_URL)) {
              const sessionKey = await this.authClient.getSessionKey()
              const rsaKey = await this.generateRsaKey()
              signatureUpload(options, rsaKey, sessionKey)
            }
          }
        ],
        afterResponse: [
          logHook,
          async (response, retryWithMergedOptions) => {
            if (response.statusCode === 400) {
              const { errorCode, errorMsg } = JSON.parse(response.body.toString()) as {
                errorCode: string
                errorMsg: string
              }
              if (errorCode === 'InvalidAccessToken') {
                logger.debug('InvalidAccessToken retry...')
                logger.debug('Refresh AccessToken')
                this.authClient.clearAccessToken()
                return retryWithMergedOptions({})
              } else if (errorCode === 'InvalidSessionKey') {
                logger.debug('InvalidSessionKey retry...')
                logger.debug('Refresh InvalidSessionKey')
                this.authClient.clearSessionKey()
                return retryWithMergedOptions({})
              }
            }
            return response
          }
        ]
      }
    })
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
  createFolder(createFolderRequest: CreateFolderRequest): Promise<{
    id: string
    name: string
    parentId: number
  }> {
    if (createFolderRequest.familyId) {
      return this.request
        .post(`${API_URL}/open/family/file/createFolder.action`, {
          form: {
            folderName: createFolderRequest.folderName,
            parentId: createFolderRequest.parentFolderId,
            familyId: createFolderRequest.familyId
          }
        })
        .json()
    } else {
      return this.request
        .post(`${API_URL}/open/file/createFolder.action`, {
          form: {
            folderName: createFolderRequest.folderName,
            parentFolderId: createFolderRequest.parentFolderId
          }
        })
        .json()
    }
  }

  /**
   * 重命名文件夹
   * @param folderRequest
   * @returns
   */
  renameFolder(folderRequest: RenameFolderRequest) {
    if (folderRequest.familyId) {
      return this.request
        .post(`${API_URL}/open/family/file/renameFolder.action`, {
          form: {
            destFolderName: folderRequest.folderName,
            folderId: folderRequest.folderId,
            familyId: folderRequest.familyId
          }
        })
        .json()
    } else {
      return this.request
        .post(`${API_URL}/open/file/renameFolder.action`, {
          form: {
            destFolderName: folderRequest.folderName,
            folderId: folderRequest.folderId
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
    const urls = await this.request
      .get(`${UPLOAD_URL}/${familyId ? 'family' : 'person'}/getMultiUploadUrls`, {
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
    try {
      await got
        .put(requestURL, {
          headers,
          body: buffer
        })
        .on('uploadProgress', (progress) => {
          if (callbacks.onProgress) {
            callbacks.onProgress((progress.transferred * 100) / progress.total)
          }
        })
    } catch (e) {
      if (callbacks.onError) {
        callbacks.onError(e)
      }
      throw e
    }
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
      sliceMd5
    }
    let fd
    try {
      // md5校验
      const res = await this.initMultiUpload(initParams, familyId)
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
            familyId: ''
          },
          {
            onProgress: callbacks.onProgress,
            onError: callbacks.onError
          }
        )
      } else {
        logger.debug(`单文件 ${filePath} 秒传: ${uploadFileId}`)
        if (callbacks.onProgress) {
          callbacks.onProgress(100) // 秒传直接显示100%
        }
      }
      const commitResult = await this.commitMultiUpload(
        {
          fileMd5,
          sliceMd5,
          uploadFileId
        },
        familyId
      )
      if (callbacks.onComplete) {
        callbacks.onComplete(commitResult)
      }
      return commitResult
    } catch (e) {
      if (callbacks.onError) {
        callbacks.onError(e)
      }
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
      sliceSize
    }
    try {
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
        if (callbacks.onProgress) {
          callbacks.onProgress(100) // 秒传直接显示100%
        }
      }
      const commitResult = await this.commitMultiUpload(
        {
          fileMd5,
          sliceMd5,
          uploadFileId,
          lazyCheck: 1
        },
        familyId
      )
      if (callbacks.onComplete) {
        callbacks.onComplete(commitResult)
      }
      return commitResult
    } catch (e) {
      if (callbacks.onError) {
        callbacks.onError(e)
      }
      throw e
    }
  }

  /**
   * 文件上传
   * @param param
   * @returns
   */
  async upload(
    param: { parentFolderId: string; filePath: string; familyId?: number },
    callbacks: UploadCallbacks = {}
  ) {
    const { filePath, parentFolderId, familyId } = param
    const { size } = await fs.promises.stat(filePath)
    const fileName = encodeURIComponent(path.basename(filePath))
    const sliceSize = partSize(size)
    const { fileMd5, chunkMd5s } = await calculateFileAndChunkMD5(filePath, sliceSize)
    if (chunkMd5s.length === 1) {
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

  async checkTaskStatus(
    type: string,
    taskId: string,
    maxAttempts = 120,
    interval = 500
  ): Promise<number[]> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const { taskStatus, successedFileIdList } = await this.request
          .post(`${API_URL}/open/batch/checkBatchTask.action`, {
            form: { type, taskId }
          })
          .json<{ taskStatus: number; successedFileIdList: number[] }>()
        if (taskStatus === -1) {
          logger.error('任务异常')
        }
        //重名
        if (taskStatus === 2) {
          logger.error('文件重名')
          return []
        }
        //成功
        if (taskStatus === 4) {
          return successedFileIdList
        }
      } catch (e) {
        logger.error(`Check task status attempt ${attempt + 1} failed:` + e)
      }

      await new Promise((resolve) => setTimeout(resolve, interval))
    }
    return []
  }

  async createBatchTask(createBatchTaskRequest: CreateBatchTaskRequest) {
    let form = {
      ...(createBatchTaskRequest.familyId
        ? {
            familyId: createBatchTaskRequest.familyId
          }
        : {}),
      ...(createBatchTaskRequest.targetFolderId
        ? {
            targetFolderId: createBatchTaskRequest.targetFolderId
          }
        : {}),
      type: createBatchTaskRequest.type,
      taskInfos: JSON.stringify(createBatchTaskRequest.taskInfos)
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

  getFileDownloadUrl(params: { fileId: string; familyId?: string }) {
    return this.request(
      `${API_URL}/open/${params.familyId ? 'family/' : ''}/file/getFileDownloadUrl.action`,
      {
        searchParams: params
      }
    ).json<{
      fileDownloadUrl: string
    }>()
  }
}
