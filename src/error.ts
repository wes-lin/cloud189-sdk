export class InvalidRefreshTokenError extends Error {}
export class AuthApiError extends Error {}

export const checkError = (response: any) => {
  let res
  try {
    res = JSON.parse(response)
  } catch (e) {
    return
  }
  // auth
  if ('result' in res && 'msg' in res) {
    switch (res.result) {
      case 0:
        return
      case -117:
        throw new InvalidRefreshTokenError(res.msg)
      default:
        throw new AuthApiError(res.msg)
    }
  }
}
