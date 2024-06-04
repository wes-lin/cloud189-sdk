import url from "url";
import JSEncrypt from "node-jsencrypt";
import crypto from "crypto";
import got from "got";
import { CookieJar } from "tough-cookie";

const cookieJar = new CookieJar();
const config = {
  clientId: "538135150693412",
  model: "KB2000",
  version: "9.0.6",
};

const headers = {
  "User-Agent": `Mozilla/5.0 (Linux; U; Android 11; ${config.model} Build/RP1A.201005.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/74.0.3729.136 Mobile Safari/537.36 Ecloud/${config.version} Android/30 clientId/${config.clientId} clientModel/${config.model} clientChannelId/qq proVersion/1.0.6`,
  Referer:
    "https://m.cloud.189.cn/zhuanti/2016/sign/index.jsp?albumBackupOpened=1",
  "Accept-Encoding": "gzip, deflate",
  Host: "cloud.189.cn",
};

interface CacheQuery {
  REQID;
  lt;
}

interface FamilyListResponse {
  familyInfoResp: [
    {
      familyId;
    }
  ];
}

interface APIResponse {
  result: number;
  msg: string;
}

interface LoginResponse extends APIResponse {
  toUrl: string;
}

interface UserBriefInfoResponse extends APIResponse {
  sessionKey: string;
}

interface AccessTokenResponse extends APIResponse {
  accessToken: string;
}

interface FamilyUserSignResponse extends APIResponse {
  bonusSpace: number;
  signFamilyId: number;
  signStatus: number;
  signTime: string;
  userId: string;
}

interface UserSizeInfoResponse extends APIResponse {
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

class CloudClient {
  #accessToken = "";
  username: string;
  password: string;
  cacheQuery: CacheQuery;

  constructor(username, password) {
    this.username = username;
    this.password = password;
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

  appConf = (query): Promise<any> =>
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
          this.cacheQuery = query;
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
                REQID: this.cacheQuery.REQID,
                lt: this.cacheQuery.lt,
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
            return got
              .get(res.toUrl, { headers, cookieJar })
              .then((r) => resolve(r.statusCode));
          }
        })
        .catch((e) => reject(e));
    });

  fetchAPI = (task): Promise<any> => {
    const q = url.parse(task, true);
    return got
      .get(task, {
        headers: {
          ...headers,
          Host: q.host,
        },
        cookieJar,
      })
      .json();
  };

  getUserSizeInfo = (): Promise<UserSizeInfoResponse> => {
    return got
      .get("https://cloud.189.cn/api/portal/getUserSizeInfo.action")
      .json();
  };

  userSign = (): Promise<UserSignResponse> => {
    return this.fetchAPI(
      `https://cloud.189.cn/mkt/userSign.action?rand=${new Date().getTime()}&clientType=TELEANDROID&version=${
        config.version
      }&model=${config.model}`
    );
  };

  taskSign = (): Promise<TaskResponse> => {
    return this.fetchAPI(
      "https://m.cloud.189.cn/v2/drawPrizeMarketDetails.action?taskId=TASK_SIGNIN&activityId=ACT_SIGNIN"
    );
  };

  taskPhoto = (): Promise<TaskResponse> => {
    return this.fetchAPI(
      "https://m.cloud.189.cn/v2/drawPrizeMarketDetails.action?taskId=TASK_2022_FLDFS_KJ&activityId=ACT_SIGNIN"
    );
  };

  taskKJ = (): Promise<TaskResponse> => {
    return this.fetchAPI(
      "https://m.cloud.189.cn/v2/drawPrizeMarketDetails.action?taskId=TASK_2022_FLDFS_KJ&activityId=ACT_SIGNIN"
    );
  };

  getUserBriefInfo = (): Promise<UserBriefInfoResponse> =>
    got
      .get("https://cloud.189.cn/api/portal/v2/getUserBriefInfo.action", {
        cookieJar,
      })
      .json();

  getAccessTokenBySsKey = (sessionKey): Promise<AccessTokenResponse> => {
    const appkey = "600100422";
    const time = String(Date.now());
    const signature = this.#getSignature({
      sessionKey,
      Timestamp: time,
      AppKey: appkey,
    });
    return got
      .get(
        `https://cloud.189.cn/api/open/oauth2/getAccessTokenBySsKey.action?sessionKey=${sessionKey}`,
        {
          headers: {
            "Sign-Type": "1",
            Signature: signature,
            Timestamp: time,
            Appkey: appkey,
          },
          cookieJar,
        }
      )
      .json();
  };

  fetchFamilyAPI = async (path): Promise<any> => {
    const { query } = url.parse(path, true);
    const time = String(Date.now());
    if (!this.#accessToken) {
      const { sessionKey } = await this.getUserBriefInfo();
      const { accessToken } = await this.getAccessTokenBySsKey(sessionKey);
      this.#accessToken = accessToken;
    }
    const signature = this.#getSignature({
      ...query,
      Timestamp: time,
      AccessToken: this.#accessToken,
    });
    return got
      .get(path, {
        headers: {
          "Sign-Type": "1",
          Signature: signature,
          Timestamp: time,
          Accesstoken: this.#accessToken,
          Accept: "application/json;charset=UTF-8",
        },
        cookieJar,
      })
      .json();
  };

  getFamilyList = (): Promise<FamilyListResponse> =>
    this.fetchFamilyAPI(
      "https://api.cloud.189.cn/open/family/manage/getFamilyList.action"
    );

  familyUserSign = (familyId: string): Promise<FamilyUserSignResponse> => {
    const gturl = `https://api.cloud.189.cn/open/family/manage/exeFamilyUserSign.action?familyId=${familyId}`;
    return this.fetchFamilyAPI(gturl);
  };
}

export default CloudClient;
