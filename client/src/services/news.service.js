import api from "@/api/axios";

const buildFormData = (data) => {
  const formData = new FormData();
  Object.keys(data).forEach((key) => {
    if (key === "file" || key === "miniature") {
      if (data[key] instanceof File) {
        formData.append("miniature", data[key]);
      } else if (typeof data[key] === "string" && data[key].trim() !== "") {
        formData.append("miniature", data[key]);
      }
    } else if (data[key] !== null && data[key] !== undefined) {
      formData.append(key, data[key]);
    }
  });
  return formData;
};

export const newsService = {
  getAll: async (params = {}) => {
    const response = await api.get("/news", { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/news/${id}`);
    return response.data;
  },

  create: async (newsData) => {
    const formData = newsData instanceof FormData ? newsData : buildFormData(newsData);
    const response = await api.post("/news", formData);
    return response.data;
  },

  update: async (id, newsData) => {
    const formData = newsData instanceof FormData ? newsData : buildFormData(newsData);
    const response = await api.patch(`/news/${id}`, formData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/news/${id}`);
    return response.data;
  },
};