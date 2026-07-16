// Endpoints du Laboratoire. Surchargez via .env (VITE_API_URL / VITE_MOBILE_WEB_URL).
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export const MOBILE_WEB_URL = import.meta.env.VITE_MOBILE_WEB_URL || 'http://localhost:8081';
