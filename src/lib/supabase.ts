const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const authSessionKey = 'stock-supabase-session'
const authEventName = 'stock-auth-changed'

export const supabaseAuthChangeEvent = 'stock-auth-changed'

export type SupabaseAuthSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number | null
  userEmail: string | null
  rememberMe: boolean
}

type PasswordAuthResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  user?: {
    email?: string | null
  } | null
}

type SignupAuthResponse = PasswordAuthResponse & {
  message?: string
}

let currentAuthSession: SupabaseAuthSession | null = null

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

function canUseStorage() {
  return typeof window !== 'undefined'
}

function readSession(storage: Storage | undefined) {
  if (!storage) {
    return null
  }

  const rawSession = storage.getItem(authSessionKey)
  if (!rawSession) {
    return null
  }

  try {
    return JSON.parse(rawSession) as SupabaseAuthSession
  } catch {
    return null
  }
}

function writeSession(session: SupabaseAuthSession, rememberMe: boolean) {
  if (!canUseStorage()) {
    currentAuthSession = session
    return
  }

  const storage = rememberMe ? window.localStorage : window.sessionStorage
  const inactiveStorage = rememberMe ? window.sessionStorage : window.localStorage
  storage.setItem(authSessionKey, JSON.stringify(session))
  inactiveStorage.removeItem(authSessionKey)
  currentAuthSession = session
  window.dispatchEvent(new Event(authEventName))
}

export function getAuthSession() {
  if (currentAuthSession) {
    return currentAuthSession
  }

  if (!canUseStorage()) {
    return null
  }

  const storedSession = readSession(window.localStorage) ?? readSession(window.sessionStorage)
  currentAuthSession = storedSession
  return storedSession
}

export function hasSupabaseSession() {
  return Boolean(getAuthSession()?.accessToken)
}

export function clearAuthSession() {
  if (!canUseStorage()) {
    currentAuthSession = null
    return
  }

  window.localStorage.removeItem(authSessionKey)
  window.sessionStorage.removeItem(authSessionKey)
  currentAuthSession = null
  window.dispatchEvent(new Event(authEventName))
}

function buildAuthSession(
  payload: PasswordAuthResponse,
  rememberMe: boolean,
): SupabaseAuthSession {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_in ? Date.now() + payload.expires_in * 1000 : null,
    userEmail: payload.user?.email ?? null,
    rememberMe,
  }
}

export async function restoreAuthSession() {
  const storedSession = getAuthSession()

  if (!storedSession) {
    return null
  }

  try {
    await request('/auth/v1/user', {
      method: 'GET',
    }, undefined, storedSession.accessToken)
    return storedSession
  } catch {
    clearAuthSession()
    return null
  }
}

export async function signInWithSupabase(input: {
  email: string
  password: string
  rememberMe: boolean
}) {
  const payload = await request<PasswordAuthResponse>(
    '/auth/v1/token',
    {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        password: input.password,
      }),
    },
    { grant_type: 'password' },
  )

  const session = buildAuthSession(payload, input.rememberMe)
  writeSession(session, input.rememberMe)
  return session
}

export async function signUpWithSupabase(input: {
  email: string
  password: string
  fullName: string
  rememberMe: boolean
}) {
  const payload = await request<SignupAuthResponse>('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.fullName,
        },
      },
    }),
  })

  if (!payload.access_token) {
    clearAuthSession()
    return null
  }

  const session = buildAuthSession(payload, input.rememberMe)
  writeSession(session, input.rememberMe)
  return session
}

export async function signOutFromSupabase() {
  const session = getAuthSession()

  if (session) {
    try {
      await request(
        '/auth/v1/logout',
        {
          method: 'POST',
        },
        undefined,
        session.accessToken,
      )
    } catch {
      // Ignore logout transport failures and clear local state anyway.
    }
  }

  clearAuthSession()
}

function buildUrl(path: string, query?: Record<string, string>) {
  if (!supabaseUrl) {
    throw new Error('Supabase URL is not configured')
  }

  const url = new URL(path, `${supabaseUrl.replace(/\/$/, '')}/`)

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return url.toString()
}

async function request<T>(path: string, init: RequestInit = {}, query?: Record<string, string>, accessToken?: string) {
  if (!supabaseAnonKey) {
    throw new Error('Supabase anon key is not configured')
  }

  const session = accessToken ?? currentAuthSession?.accessToken

  const response = await fetch(buildUrl(path, query), {
    ...init,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session ?? supabaseAnonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message = payload?.message || payload?.error || response.statusText
    throw new Error(message)
  }

  return payload as T
}

export async function selectRows<T>(table: string, query = '*') {
  return request<T[]>(`/rest/v1/${table}`, {}, { select: query })
}

export async function insertRows<T>(table: string, rows: Record<string, unknown> | Record<string, unknown>[]) {
  return request<T[]>(`/rest/v1/${table}`, {
    method: 'POST',
    body: JSON.stringify(rows),
  })
}

export async function updateRows<T>(table: string, values: Record<string, unknown>, filter: Record<string, string | number>) {
  const query = new URLSearchParams({ select: '*' })
  Object.entries(filter).forEach(([key, value]) => {
    query.set(key, `eq.${value}`)
  })

  return request<T[]>(`/rest/v1/${table}?${query.toString()}`, {
    method: 'PATCH',
    body: JSON.stringify(values),
  })
}

export async function deleteRows(table: string, filter: Record<string, string | number>) {
  const query = new URLSearchParams({ select: '*' })
  Object.entries(filter).forEach(([key, value]) => {
    query.set(key, `eq.${value}`)
  })

  return request<unknown[]>(`/rest/v1/${table}?${query.toString()}`, {
    method: 'DELETE',
  })
}

export async function rpcCall<T>(functionName: string, payload: Record<string, unknown>) {
  return request<T>(`/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
