import axios from "axios";

// Create a centralized Axios instance configured for the application
const apiClient = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: can be used for injecting auth tokens, logging, etc.
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: centralized error intercepting and global response logging
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error("[API Client Error]:", error.response || error.message);
    return Promise.reject(error);
  }
);

export default apiClient;
