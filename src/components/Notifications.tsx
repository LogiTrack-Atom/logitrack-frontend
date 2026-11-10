import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { readableError } from '../api/errors'

type Kind = 'error' | 'success' | 'info'
type Notice = {id: number; kind: Kind; message: string}
type Notify = {success: (message:string)=>void; info:(message:string)=>void; error:(error:unknown)=>void}
const NoticeContext = createContext<Notify | null>(null)
let sequence = 0
export function Notifications({children}: PropsWithChildren) {
  const [notices, setNotices] = useState<Notice[]>([])
  const add = useCallback((kind:Kind, message:string) => {
    const id = ++sequence
    setNotices(old => [...old.slice(-3), {id, kind, message}])
  }, [])
  const api = useMemo(() => ({
    success: (message:string) => add('success',message),
    info: (message:string) => add('info',message),
    error: (error:unknown) => add('error',readableError(error)),
  }), [add])
  return <NoticeContext.Provider value={api}>
    {children}
    <div className="notice-stack" aria-live="polite" role="status">
      {notices.map(n=><div key={n.id} className={`notice notice-${n.kind}`}><span>{n.kind==='error'?'!':n.kind==='success'?'✓':'i'}</span><p>{n.message}</p><button aria-label="Cerrar aviso" onClick={()=>setNotices(old=>old.filter(x=>x.id!==n.id))}>×</button></div>)}
    </div>
  </NoticeContext.Provider>
}
export function useNotify() {const c=useContext(NoticeContext);if(!c)throw new Error('Notifications requerido');return c}
