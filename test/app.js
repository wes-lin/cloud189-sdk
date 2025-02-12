const { CookieJar } = require("tough-cookie");
const { CloudClient } = require("../dist");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  const cookies = [
    "JSESSIONID=*******; Path=/; HttpOnly; hostOnly=true; aAge=2ms; cAge=20ms",
    "COOKIE_LOGIN_USER=*******; Domain=cloud.189.cn; Path=/; HttpOnly; hostOnly=false; aAge=2ms; cAge=19ms",
  ];
  const cookieJar = new CookieJar();
  cookies.forEach((cookie) =>
    cookieJar.setCookieSync(cookie, "https://cloud.189.cn")
  );

  const client = new CloudClient("******", "******", {
    accessToken: "******",
    cookieJar,
  });
  // await client.login();
  const t1 = await client.userSign();
  console.log(t1);
  const { familyInfoResp } = await client.getFamilyList();
  console.log(familyInfoResp);
  // if (familyInfoResp) {
  //   for (let index = 0; index < familyInfoResp.length; index += 1) {
  //     const { familyId } = familyInfoResp[index];
  //     try {
  //       const res = await client.familyUserSign(familyId);
  //       console.log(res);
  //     } catch (e) {
  //       console.error(e);
  //     }
  //   }
  // }
  const info = await client.getUserSizeInfo();
  console.log(info);
})();
