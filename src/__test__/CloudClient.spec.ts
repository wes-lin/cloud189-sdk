import { CloudClient } from "../lib/index";
import { assert, expect } from "chai";
import nock from "nock";
import encryptConf from "./data/encryptConf";
import { RequestError } from "got";

describe("登录", async () => {
  it("登录成功", async () => {
    nock("https://open.e.189.cn")
      .post("/api/logbox/config/encryptConf.do")
      .reply(200, {
        data: encryptConf,
      })
      .post("/api/logbox/oauth2/appConf.do")
      .query(true)
      .reply(200, {
        data: {
          returnUrl: "ttt",
          paramId: "234",
        },
      })
      .post("/api/logbox/oauth2/loginSubmit.do")
      .reply(200, {
        result: 0,
        toUrl:
          "https://open.e.189.cn/api/logbox/separate/web/index.html?appId=cloud&lt=6DB8811D26AA44F7DFCBF68542A4313659953263855E20F88F4FCE6372CB95A3881C422C557D94A973DFDA6B9F483ECFB867C778BBEDD4BD99F450EAEE499E00CF0156DDA500ED823771311A567E3D1D461C23DB&reqId=c9d56c206aa84d469dbe3853964a3fdf",
        msg: "Login Success",
      })
      .get("/api/logbox/oauth2/unifyAccountLogin.do")
      .query(true)
      .reply(200)
      .get("/api/logbox/separate/web/index.html")
      .query(true)
      .reply(200);
    nock("https://cloud.189.cn")
      .get("/api/portal/loginUrl.action")
      .query(true)
      .reply(301, undefined, {
        Location:
          "https://open.e.189.cn/api/logbox/oauth2/unifyAccountLogin.do?appId=cloud&version=v1.1&clientType=1&format=redirect&paras=28FDDF64F09388FE84AA77DB73CEA3E75B69AB7F406D56F4C27CAD1A99E720FC357C8A60311FE4D3141D6F620149B2CD10FC89F9BAC937138B5C55713B2093C3B010CD3D606ADF44914755ABA154EFCF255C50941A104ADA49F49E8CD427B4A01B40060B239F7D5A2623B58590E492F38672577AEA3D0FF1EFD281C12AF57DA148C4BE2805B694CE3375240EF4CB20A31DC011F53FB76A39F5EF64FBBFA43954BE2EE7A86698691CD217A29A56567F3A89DF34C245FFC1BB5AC0E6BA3E28B316F08882CBFC7D0DF78EEC89677D6B96E4468A4E466191B7C9DFAD8D09406B95A0CC0820C3F623DE136225F2FC71D0615C456064463668E7C2FAA429197ED949F627FE1DBE2EC3E331AAF0B62F2705F2E4411B4B8D3D3E0575BE6A837AC919C7EB&sign=3366D585F7F1BA5396ACE62C66B417212E8415C0",
      });

    const client = new CloudClient("test", "password");
    const statusCode = await client.login();
    assert.equal(statusCode, 200);
  });
  it("登录失败", async () => {
    nock("https://open.e.189.cn")
      .post("/api/logbox/config/encryptConf.do")
      .replyWithError("encryptConf fail");
    const client = new CloudClient("test", "password");
    try {
      await client.login();
    } catch (e) {
      expect(e).instanceOf(RequestError);
    }
  });
  it("账号或者密码错误", async () => {
    nock("https://open.e.189.cn")
      .post("/api/logbox/config/encryptConf.do")
      .reply(200, {
        data: encryptConf,
      })
      .post("/api/logbox/oauth2/appConf.do")
      .query(true)
      .reply(200, {
        data: {
          returnUrl: "ttt",
          paramId: "234",
        },
      })
      .post("/api/logbox/oauth2/loginSubmit.do")
      .reply(200, {
        result: -1,
        msg: "账号或者密码错误",
      })
      .get("/api/logbox/oauth2/unifyAccountLogin.do")
      .query(true)
      .reply(200);
    nock("https://cloud.189.cn")
      .get("/api/portal/loginUrl.action")
      .query(true)
      .reply(301, undefined, {
        Location:
          "https://open.e.189.cn/api/logbox/oauth2/unifyAccountLogin.do?appId=cloud&version=v1.1&clientType=1&format=redirect&paras=28FDDF64F09388FE84AA77DB73CEA3E75B69AB7F406D56F4C27CAD1A99E720FC357C8A60311FE4D3141D6F620149B2CD10FC89F9BAC937138B5C55713B2093C3B010CD3D606ADF44914755ABA154EFCF255C50941A104ADA49F49E8CD427B4A01B40060B239F7D5A2623B58590E492F38672577AEA3D0FF1EFD281C12AF57DA148C4BE2805B694CE3375240EF4CB20A31DC011F53FB76A39F5EF64FBBFA43954BE2EE7A86698691CD217A29A56567F3A89DF34C245FFC1BB5AC0E6BA3E28B316F08882CBFC7D0DF78EEC89677D6B96E4468A4E466191B7C9DFAD8D09406B95A0CC0820C3F623DE136225F2FC71D0615C456064463668E7C2FAA429197ED949F627FE1DBE2EC3E331AAF0B62F2705F2E4411B4B8D3D3E0575BE6A837AC919C7EB&sign=3366D585F7F1BA5396ACE62C66B417212E8415C0",
      });
    const client = new CloudClient("test", "password");
    try {
      await client.login();
    } catch (e) {
      expect(e).eq("账号或者密码错误");
    }
  });
});

describe("个人签到任务", async () => {
  it("签到任务", async () => {
    nock("https://cloud.189.cn")
      .get("/mkt/userSign.action")
      .query(true)
      .reply(200, { isSign: true, netdiskBonus: 100 });

    const client = new CloudClient("test", "password");
    const res = await client.userSign();
    expect(res.isSign).eq(true);

    nock("https://m.cloud.189.cn")
      .get("/v2/drawPrizeMarketDetails.action")
      .query(true)
      .reply(200, { errorCode: "", prizeName: "124" });
    const res1 = await client.taskPhoto();
    expect(res1.errorCode).eq("");

    nock("https://m.cloud.189.cn")
      .get("/v2/drawPrizeMarketDetails.action")
      .query(true)
      .reply(200, { errorCode: "", prizeName: "124" });
    const res2 = await client.taskSign();
    expect(res2.errorCode).eq("");

    nock("https://m.cloud.189.cn")
      .get("/v2/drawPrizeMarketDetails.action")
      .query(true)
      .reply(200, { errorCode: "", prizeName: "124" });
    const res3 = await client.taskKJ();
    expect(res3.errorCode).eq("");
  });
});

describe("家庭签到任务", async () => {
  beforeEach(() => {
    nock("https://cloud.189.cn")
      .get("/api/portal/v2/getUserBriefInfo.action")
      .query(true)
      .reply(200, { sessionKey: "1234" })
      .get("/api/open/oauth2/getAccessTokenBySsKey.action")
      .query(true)
      .reply(200, {
        accessToken: "accessToken",
      });
  });
  it("获取家庭列表", async () => {
    nock("https://api.cloud.189.cn")
      .get("/open/family/manage/getFamilyList.action")
      .query(true)
      .reply(200, {
        familyInfoResp: [
          {
            bonusSpace: 1233,
            signFamilyId: 123,
            signStatus: 123,
            signTime: "20023",
            userId: "123",
          },
        ],
      });
    const client = new CloudClient("test", "password");
    const { familyInfoResp } = await client.getFamilyList();
    expect(familyInfoResp.length).greaterThan(0);
  });
  it("家庭签到任务", async () => {
    nock("https://api.cloud.189.cn")
      .get("/open/family/manage/exeFamilyUserSign.action")
      .query(true)
      .reply(200, {
        bonusSpace: 200,
        signFamilyId: 123,
        signStatus: 1,
        signTime: "20023",
        userId: "23",
      });
    const client = new CloudClient("test", "password");
    const res = await client.familyUserSign("1234");
    expect(res.signStatus).eq(1);
  });
});

describe("网盘信息", async () => {
  it("网盘容量", async () => {
    nock("https://cloud.189.cn")
      .get("/api/portal/getUserSizeInfo.action")
      .query(true)
      .reply(200, {
        cloudCapacityInfo: {
          totalSize: 1234,
        },
        familyCapacityInfo: {
          totalSize: 123,
        },
      });
    const client = new CloudClient("test", "password");
    const res = await client.getUserSizeInfo();
    expect(res.cloudCapacityInfo.totalSize).eq(1234);
  });
});
