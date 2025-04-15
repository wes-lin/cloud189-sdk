import { LoggerOptions } from '@netdrive-sdk/log'
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
  logConfig?: LoggerOptions
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
