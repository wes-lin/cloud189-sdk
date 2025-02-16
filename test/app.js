const { CookieJar } = require("tough-cookie");
const { CloudClient } = require("../dist");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  const cookies = [
    "JSESSIONID=B131B35DCAAE41BF48E4FF6C52C9D42E; Path=/; HttpOnly; hostOnly=true; aAge=2ms; cAge=20ms",
    "COOKIE_LOGIN_USER=C65957A45672B7229197992B6741859A760B7BEFE493D5A647AAE2CE45E4514A27885E745AFE0DD45101176EDF94BAF5; Domain=cloud.189.cn; Path=/; HttpOnly; hostOnly=false; aAge=2ms; cAge=19ms",
  ];
  const cookieJar = new CookieJar();
  cookies.forEach((cookie) =>
    cookieJar.setCookieSync(cookie, "https://cloud.189.cn")
  );

  const client = new CloudClient("17350173062", "Lzw@1496533379", {
    sessionKey: "1",
  });
  // await client.login();
  // const t1 = await client.userSign();
  // console.log(t1);
  try {
    // const info = await client.getUserSizeInfo();
    // console.log(info);
    const { familyInfoResp } = await client.getFamilyList();
    console.log(familyInfoResp);
  } catch (e) {
    // console.log(e.response);
  }
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
})();
