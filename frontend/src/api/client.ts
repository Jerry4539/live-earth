import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Auth token injection
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('wl_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 401 → clear token
apiClient.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('wl_token')
    }
    return Promise.reject(err)
  }
)
