/** Runtime configuration shared by every frontend (web, desktop, mobile). */
let apiBaseUrl = 'http://localhost:4000';

export function configureApi(options: { baseUrl: string }) {
  apiBaseUrl = options.baseUrl.replace(/\/$/, '');
}

export function getApiBaseUrl() {
  return apiBaseUrl;
}
