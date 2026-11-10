import { userErrorMessage } from '../http/httpError'

/** Presentación común de errores como texto React, sin HTML ni cuerpos sensibles. */
export function RequestErrorNotice({ error }: { error: unknown }) {
  const message = userErrorMessage(error)
  return message ? <p role="alert">{message}</p> : null
}
