import url from "url";
import JSEncrypt from "node-jsencrypt";
import crypto from "crypto";
import got, { Got } from "got";
import { CookieJar } from "tough-cookie";

const config = {
  clientId: "538135150693412",
  model: "KB2000",
  version: "9.0.6",
};

interface CacheQuery {
  appId: string;
  reqId: string;
  lt: string;
}

interface FamilyListResponse {
  familyInfoResp: [
    {
      familyId: number;
      remarkName: string;
      type: number;
      userRole: number;
    }
  ];
}

interface LoginResponse {
  result: number;
  msg: string;
  toUrl: string;
}

interface UserBriefInfoResponse {
  sessionKey: string;
}

interface AccessTokenResponse {
  accessToken: string;
  expiresIn: number;
}

interface FamilyUserSignResponse {
  bonusSpace: number;
  signFamilyId: number;
  signStatus: number;
  signTime: string;
  userId: string;
}

interface UserSizeInfoResponse {
  cloudCapacityInfo: {
    totalSize: number;
  };
  familyCapacityInfo: {
    totalSize: number;
  };
}

interface UserSignResponse {
  isSign: boolean;
  netdiskBonus: number;
}

interface TaskResponse {
  errorCode: string;
  prizeName: string;
}

interface UserSizeInfoResponse {
  account: string;
  cloudCapacityInfo: {
    totalSize: number;
  };
  familyCapacityInfo: {
    totalSize: number;
  };
}

class CloudClient {
  accessToken = "";
  username: string;
  password: string;
  #cacheQuery: CacheQuery;
  cookieJar: CookieJar;
  client: Got;

  constructor(
    username: string,
    password: string,
    session?: {
      accessToken?: string;
      cookieJar?: CookieJar;
    }
  ) {
    this.username = username;
    this.password = password;
    this.#init(session);
  }

  #init(session?: { accessToken?: string; cookieJar?: CookieJar }) {
    if (session?.cookieJar) {
      this.cookieJar = session.cookieJar;
    } else {
      this.cookieJar = new CookieJar();
    }
    if (session?.accessToken) {
      this.accessToken = session.accessToken;
    }

    this.client = got.extend({
      cookieJar: this.cookieJar,
      headers: {
        "User-Agent": `Mozilla/5.0 (Linux; U; Android 11; ${config.model} Build/RP1A.201005.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/74.0.3729.136 Mobile Safari/537.36 Ecloud/${config.version} Android/30 clientId/${config.clientId} clientModel/${config.model} clientChannelId/qq proVersion/1.0.6`,
      },
      hooks: {
        beforeRequest: [async (options) => {}],
      },
    });
  }

  getEncrypt = (): Promise<any> =>
    got.post("https://open.e.189.cn/api/logbox/config/encryptConf.do").json();

  redirectURL = () =>
    new Promise((resolve, reject) => {
      got
        .get(
          "https://cloud.189.cn/api/portal/loginUrl.action?redirectURL=https://cloud.189.cn/web/redirect.html?returnURL=/main.action"
        )
        .then((res) => {
          const { query } = url.parse(res.url, true);
          resolve(query);
        })
        .catch((e) => reject(e));
    });

  appConf = (query: CacheQuery): Promise<any> =>
    got
      .post("https://open.e.189.cn/api/logbox/oauth2/appConf.do", {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:74.0) Gecko/20100101 Firefox/76.0",
          Referer: "https://open.e.189.cn/",
          lt: query.lt,
          REQID: query.reqId,
        },
        form: { version: "2.0", appKey: query.appId },
      })
      .json();

  #builLoginForm = (encrypt, appConf) => {
    const jsencrypt = new JSEncrypt();
    const keyData = `-----BEGIN PUBLIC KEY-----\n${encrypt.pubKey}\n-----END PUBLIC KEY-----`;
    jsencrypt.setPublicKey(keyData);
    const usernameEncrypt = Buffer.from(
      jsencrypt.encrypt(this.username),
      "base64"
    ).toString("hex");
    const passwordEncrypt = Buffer.from(
      jsencrypt.encrypt(this.password),
      "base64"
    ).toString("hex");
    const data = {
      appKey: "cloud",
      version: "2.0",
      accountType: "01",
      mailSuffix: "@189.cn",
      validateCode: "",
      captchaToken: "",
      dynamicCheck: "FALSE",
      clientType: "1",
      cb_SaveName: "0",
      isOauth2: false,
      returnUrl: appConf.returnUrl,
      paramId: appConf.paramId,
      userName: `${encrypt.pre}${usernameEncrypt}`,
      password: `${encrypt.pre}${passwordEncrypt}`,
    };
    return data;
  };

  #sortParameter = (data): string => {
    if (!data) {
      return "";
    }
    const e = Object.entries(data).map((t) => t.join("="));
    e.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
    return e.join("&");
  };

  #getSignature = (data) => {
    const parameter = this.#sortParameter(data);
    return crypto.createHash("md5").update(parameter).digest("hex");
  };

  /**
   * 登录流程
   * 1.获取公钥
   * 2.获取登录参数
   * 3.获取登录地址
   * 4.跳转到登录页
   * */
  login = (): Promise<any> =>
    new Promise((resolve, reject) => {
      Promise.all([
        //1.获取公钥
        this.getEncrypt(),
        //2.获取登录参数
        this.redirectURL().then((query: CacheQuery) => {
          this.#cacheQuery = query;
          return this.appConf(query);
        }),
      ])
        .then((res: any[]) => {
          const encrypt = res[0].data;
          const appConf = res[1].data;
          const data = this.#builLoginForm(encrypt, appConf);
          //3.获取登录地址
          return got
            .post("https://open.e.189.cn/api/logbox/oauth2/loginSubmit.do", {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:74.0) Gecko/20100101 Firefox/76.0",
                Referer: "https://open.e.189.cn/",
                lt: this.#cacheQuery.lt,
                REQID: this.#cacheQuery.reqId,
              },
              form: data,
            })
            .json();
        })
        .then((res: LoginResponse) => {
          // 4.跳转到登录页
          if (res.result !== 0) {
            reject(res.msg);
          } else {
            return this.client
              .get(res.toUrl)
              .then((r) => resolve(r.statusCode));
          }
        })
        .catch((e) => reject(e));
    });

  getUserSizeInfo = (): Promise<UserSizeInfoResponse> => {
    return this.client
      .get("https://cloud.189.cn/api/portal/getUserSizeInfo.action", {
        headers: { Accept: "application/json;charset=UTF-8" },
      })
      .json();
  };

  userSign = (): Promise<UserSignResponse> => {
    return this.client
      .get(
        `https://cloud.189.cn/mkt/userSign.action?rand=${new Date().getTime()}&clientType=TELEANDROID&version=${
          config.version
        }&model=${config.model}`
      )
      .json();
  };

  getUserBriefInfo = (): Promise<UserBriefInfoResponse> => {
    return this.client
      .get("https://cloud.189.cn/api/portal/v2/getUserBriefInfo.action")
      .json();
  };

  getAccessTokenBySsKey = (
    sessionKey: string
  ): Promise<AccessTokenResponse> => {
    const appkey = "600100422";
    const time = String(Date.now());
    const signature = this.#getSignature({
      sessionKey,
      Timestamp: time,
      AppKey: appkey,
    });
    return this.client
      .get(
        `https://cloud.189.cn/api/open/oauth2/getAccessTokenBySsKey.action?sessionKey=${sessionKey}`,
        {
          headers: {
            "Sign-Type": "1",
            Signature: signature,
            Timestamp: time,
            Appkey: appkey,
          },
        }
      )
      .json();
  };

  fetchFamilyAPI = async (path: string): Promise<any> => {
    const { query } = url.parse(path, true);
    const time = String(Date.now());
    if (!this.accessToken) {
      const { sessionKey } = await this.getUserBriefInfo();
      const { accessToken } = await this.getAccessTokenBySsKey(sessionKey);
      this.accessToken = accessToken;
    }
    const signature = this.#getSignature({
      ...query,
      Timestamp: time,
      AccessToken: this.accessToken,
    });
    return this.client
      .get(path, {
        headers: {
          "Sign-Type": "1",
          Signature: signature,
          Timestamp: time,
          Accesstoken: this.accessToken,
          Accept: "application/json;charset=UTF-8",
        },
      })
      .json();
  };

  getFamilyList = (): Promise<FamilyListResponse> =>
    this.fetchFamilyAPI(
      "https://api.cloud.189.cn/open/family/manage/getFamilyList.action"
    );

  familyUserSign = (familyId: number): Promise<FamilyUserSignResponse> =>
    this.fetchFamilyAPI(
      `https://api.cloud.189.cn/open/family/manage/exeFamilyUserSign.action?familyId=${familyId}`
    );
}

export default CloudClient;
