import { Store } from './store'

/**
 * 账户家庭信息
 * @public
 */
export interface FamilyListResponse {
  familyInfoResp: [
    {
      /**
       * 家庭id
       */
      familyId: number
      /**
       * 家庭名称
       */
      remarkName: string
      /**
       * 类型
       */
      type: number
      /**
       * 用户角色 如果是1 表明当前账户是该账户的主家庭 否则当前账户是其他家庭的成员账户
       */
      userRole: number
    }
  ]
}

/**
 * accessToken 结果
 * @public
 */
export interface AccessTokenResponse {
  /**
   * accessToken
   */
  accessToken: string
  /**
   * accessToken 的有效期 单位秒
   */
  expiresIn: number
}

/**
 * 家庭签到任务结果
 * @public
 */
export interface FamilyUserSignResponse {
  /**
   * 签到的奖励容量 单位MB
   */
  bonusSpace: number
  /**
   * 签到的家庭id
   */
  signFamilyId: number
  /**
   * 签到的状态
   */
  signStatus: number
  /**
   * 签到的时间
   */
  signTime: string
  /**
   * 签到的用户
   */
  userId: string
}

/**
 * 文件类型
 */
export enum MediaType {
  ALL,
  IMAGE,
  MUSIC,
  VIDEO,
  TXT
}
/**
 * 排序类型
 */
export enum OrderByType {
  NAME = 1,
  SIZE = 2,
  LAST_OP_TIME = 3
}
/**
 * 分页参数
 * @public
 */
export interface PageQuery {
  /**
   * 分页大小 默认60
   */
  pageSize?: number
  /**
   * 页码 默认1
   */
  pageNum?: number
  /**
   * 文件类型
   * 0 全部 1 图片 2 视频 3 文档
   */
  mediaType?: MediaType
  /**
   * 文件夹Id
   */
  folderId?: number
  /**
   * 未知参数 5
   */
  iconOption?: number
  /**
   * 排序类型
   * 1 文件名称 2 文件大小 3 文件修改时间
   */
  orderBy?: OrderByType
  /**
   * 是否倒序
   */
  descending?: boolean
}

/**
 * 文件列表API响应数据结构
 * @public
 */
export interface FileListResponse {
  /** 文件列表数据对象 */
  fileListAO: FileListAO

  /**
   * 最后修订版本号
   * @description 用于增量同步的时间戳或版本标识
   */
  lastRev: number
}

/**
 * 文件列表数据对象
 * @public
 */
export interface FileListAO {
  /** 文件总数 */
  count: number

  /** 文件项列表 */
  fileList: FileItem[]

  /** 文件夹项列表 */
  folderList: FolderItem[]
}

/**
 * 文件项详细信息
 * @public
 */
export interface FileItem {
  /** 文件创建时间，格式：YYYY-MM-DD HH:mm:ss */
  createDate: string

  /**
   * 收藏标签
   * @value 0-未收藏 | 1-已收藏
   */
  favoriteLabel: number

  /** 文件图标信息 */
  icon: {
    /** 大尺寸图标URL */
    largeUrl: string

    /** 小尺寸图标URL */
    smallUrl: string
  }

  /** 文件唯一标识ID */
  id: string

  /** 最后操作时间，格式：YYYY-MM-DD HH:mm:ss */
  lastOpTime: string

  /** 文件MD5哈希值，用于文件校验 */
  md5: string

  /**
   * 媒体类型
   * @value 1-图片 | 2-视频 | 3-音频 | 4-文档
   */
  mediaType: number

  /** 文件名 */
  name: string

  /**
   * 图片方向
   * @value 0-正常 | 1-90° | 2-180° | 3-270°
   */
  orientation: number

  /** 父目录ID */
  parentId: string

  /** 文件版本标识，格式：YYYYMMDDHHmmss */
  rev: string

  /** 文件大小（字节） */
  size: number

  /**
   * 星标标签
   * @value 1-普通 | 2-标星
   */
  starLabel: number
}

/**
 * 文件夹项详细信息
 * @public
 */
export interface FolderItem {
  /** 文件夹创建时间，格式：YYYY-MM-DD HH:mm:ss */
  createDate: string

  /** 文件夹内文件数量 */
  fileCount: number

  /** 文件夹唯一标识ID */
  id: string

  /** 最后操作时间，格式：YYYY-MM-DD HH:mm:ss */
  lastOpTime: string

  /** 文件夹名称 */
  name: string

  /** 父目录ID */
  parentId: string

  /** 文件夹版本标识，格式：YYYYMMDDHHmmss */
  rev: string

  /**
   * 星标标签
   * @value 1-普通 | 2-标星
   */
  starLabel: number
}

export interface FamilyRequest {
  familyId: number
}

/**
 * 创建文件夹
 * @public
 */
export interface CreateFolderRequest {
  parentFolderId: string
  folderName: string
}

export interface CreateFamilyFolderRequest extends FamilyRequest, CreateFolderRequest {}

export interface RenameFolderRequest {
  folderId: string
  folderName: string
}

export interface RenameFamilyFolderRequest extends FamilyRequest, RenameFolderRequest {}

export interface RsaKeyResponse extends RsaKey {
  res_code: number
  res_message: string
}

export interface initMultiUploadRequest {
  parentFolderId: string
  fileName: string
  fileSize: number
  sliceSize: number
  fileMd5?: string
  sliceMd5?: string
}

export interface initMultiFamilyUploadRequest extends FamilyRequest, initMultiUploadRequest {}

export interface CommitMultiUploadRequest {
  fileMd5: string
  sliceMd5: string
  uploadFileId: string
  lazyCheck?: number
}

export interface CommitMultiFamilyUploadRequest extends FamilyRequest, CommitMultiUploadRequest {}

/**
 * 容量信息
 * @public
 */
export interface CapacityInfo {
  /**
   * 总空间 单位KB
   */
  totalSize: number
  /**
   * 已使用空间 单位KB
   */
  usedSize: number
  /**
   * 剩余空间 单位KB
   */
  freeSize: number
}

/**
 * 账户容量信息
 * @public
 */
export interface UserSizeInfoResponse {
  /**
   * 个人容量信息
   */
  cloudCapacityInfo: CapacityInfo
  /**
   * 家庭容量信息
   */
  familyCapacityInfo: CapacityInfo
}

/**
 * 个人签到结果
 * @public
 */
export interface UserSignResponse {
  /**
   * 是否已经签到过
   */
  isSign: boolean
  /**
   * 签到获取的容量奖励 单位MB
   */
  netdiskBonus: number
}

/**
 * 个人任务执行结果
 * @public
 */
export interface UserTaskResponse {
  /**
   * 错误码
   */
  errorCode: string
  /**
   * 奖励容量 单位MB
   */
  prizeName: string
}

/**
 * @public
 */
export interface CacheQuery {
  captchaToken: string
  reqId: string
  lt: string
  paramId: string
}

/**
 * 客户端初始化参数
 * @public
 */
export interface ConfigurationOptions {
  /** 登录名 */
  username?: string
  /** 密码 */
  password?: string
  /** token */
  token?: Store
  ssonCookie?: string
}

/**
 * @public
 * accessToken 有效期7天，可以通过refreshToken取新的accessToken
 */
export interface TokenSession {
  res_code: number
  res_message: string
  accessToken: string
  familySessionKey: string
  familySessionSecret: string
  refreshToken: string
  loginName: string
  sessionKey: string
}

/**
 * @public
 */
export interface RefreshTokenSession {
  expiresIn: number
  accessToken: string
  refreshToken: string
}

/**
 * @public
 */
export interface ClientSession {
  accessToken: string
  sessionKey: string
}

export interface RsaKey {
  expire: number
  pkId: string
  pubKey: string
  ver: string
}

interface UploadResponse {
  code: string
}

export interface UploadInitResponse extends UploadResponse {
  data: {
    uploadType: number
    uploadHost: string
    uploadFileId: string
    fileDataExists: number
  }
}

export interface UploadCommitResponse extends UploadResponse {
  file: {
    userFileId: string
    fileName: string
    fileSize: number
    fileMd5: string
    createDate: string
    rev: number
    userId: number
  }
}

export interface UploadPartsInfoResponse extends UploadResponse {
  data: {
    uploadFileId: string
    uploadedPartList: string
  }
}

export type PartNumberKey = `partNumber_${number}`

export interface MultiUploadUrlsResponse extends UploadResponse {
  uploadUrls: {
    [key: PartNumberKey]: {
      requestURL: string
      requestHeader: string
    }
  }
}

export interface UploadCallbacks {
  onProgress?: (progress: number) => void // 上传进度回调 (0-100)
  onComplete?: (response: any) => void // 上传完成回调
  onError?: (error: Error) => void // 上传失败回调
}

type TaskType = 'DELETE' | 'MOVE' | 'COPY'

export interface CreateBatchTaskRequest {
  type: TaskType
  taskInfos: [
    {
      fileId: string
      fileName?: string
      isFolder: number
      srcParentId?: number
    }
  ]
  targetFolderId?: string
}

export interface CreateFamilyBatchTaskRequest extends FamilyRequest, CreateBatchTaskRequest {}
