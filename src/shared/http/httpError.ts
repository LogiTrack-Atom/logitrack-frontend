/** Error de una respuesta HTTP no exitosa, con el estado y el cuerpo devuelto por el backend. */
export class HttpError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.body = body
  }
}
