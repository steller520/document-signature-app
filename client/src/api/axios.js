import axios from "axios";

const API = axios.create({
  baseURL: "https://document-signature-app-hx9h.onrender.com/api",
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default API;
