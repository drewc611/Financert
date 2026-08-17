/* Thin API client.
   Every call races a short timeout so a missing backend degrades to the
   embedded snapshot rather than hanging the page. */

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const TIMEOUT_MS = 900

async function request(path, { method = 'GET', body, timeout = TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      signal: controller.signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.status === 204) return null
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      const detail = payload?.detail
      throw new ApiError(typeof detail === 'string' ? detail : `Request failed (${res.status})`, res.status)
    }
    return payload
  } finally {
    clearTimeout(timer)
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const api = {
  health: () => request('/healthz'),
  benchmarks: ({ period, investableOnly = true } = {}) => {
    const qs = new URLSearchParams({ investable_only: String(investableOnly) })
    if (period) qs.set('period', period)
    return request(`/api/benchmarks?${qs}`)
  },
  trend: ({ group = 'top1', assetClass }) =>
    request(`/api/benchmarks/trend?${new URLSearchParams({ group, asset_class: assetClass })}`, {
      timeout: 2500,
    }),
  getPortfolio: () => request('/api/portfolio'),
  savePortfolio: (payload) => request('/api/portfolio', { method: 'PUT', body: payload, timeout: 4000 }),
  // Preview lets the user see a comparison before committing holdings.
  preview: (payload, { group = 'top1', investableOnly = true } = {}) =>
    request(
      `/api/analysis/preview?${new URLSearchParams({
        group,
        investable_only: String(investableOnly),
      })}`,
      { method: 'POST', body: payload, timeout: 4000 },
    ),
}
