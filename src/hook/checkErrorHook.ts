import { Response } from 'got'
import { checkError } from '../error'

export const checkErrorHook = (response: Response, _retryWithMergedOptions) => {
  checkError(response.body.toString())
  return response
}
