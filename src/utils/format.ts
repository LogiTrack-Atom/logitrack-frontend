export const dateText = (value?: string | null) => value ? new Intl.DateTimeFormat('es-AR', {dateStyle:'medium', timeStyle:'short'}).format(new Date(value)) : '—'
export const shortId = (id?: string | null) => id ? `${id.slice(0,8)}…` : 'Sin asignar'
export const addressText = (a?: {calle:string;numero:string;ciudad:string}) => a ? `${a.calle} ${a.numero}, ${a.ciudad}` : '—'
export const statusText = (status: string) => status.replaceAll('_',' ')
export const uuidValid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim())
