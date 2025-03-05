export const WEB_URL = 'https://cloud.189.cn'
export const AUTH_URL = 'https://open.e.189.cn'
export const API_URL = 'https://api.cloud.189.cn'
export const ClientType = '10020'
export const UserAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36'
const Version = '6.2',
  PC = 'TELEPC',
  ChannelID = 'web_cloud.189.cn'

export const clientSuffix = () => ({
  clientType: PC,
  version: Version,
  channelId: ChannelID,
  rand: Date.now()
})
