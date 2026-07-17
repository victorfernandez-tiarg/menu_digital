import axios from 'axios'

const canteenApi = axios.create({ baseURL: '/api/comedor' })

canteenApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('canteen_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

canteenApi.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('canteen_token')
      localStorage.removeItem('canteen_role')
      localStorage.removeItem('canteen_user')
      window.location.href = '/comedor/login'
    }
    return Promise.reject(err)
  }
)

export default canteenApi
