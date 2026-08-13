import { useState, useEffect, useMemo } from "react";
import api from "@/api/axios";
import NewsTable from "@/components/Admin/News/NewsTable";
import NewsModalForm from "@/components/Admin/News/NewsModalForm";
import "./NewsPage.scss";

export const NewsPage = () => {
  const [newsList, setNewsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentNews, setCurrentNews] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const parseNewsData = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.docs)) return data.docs;
    if (Array.isArray(data.news)) return data.news;
    if (Array.isArray(data.data)) return data.data;
    if (data.data && Array.isArray(data.data.docs)) return data.data.docs;
    return [];
  };

  useEffect(() => {
    let isMounted = true;

    const fetchNews = async () => {
      try {
        setIsLoading(true);
        const response = await api.get("/news");
        const list = parseNewsData(response.data);
        if (isMounted) setNewsList(list);
      } catch (error) {
        console.error("Error al cargar noticias:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchNews();

    return () => {
      isMounted = false;
    };
  }, [reloadTrigger]);

  const reloadNews = () => setReloadTrigger((prev) => prev + 1);

  const isItemActive = (item) => {
    return item.active === true || item.active === "true" || item.active === undefined;
  };

  const stats = useMemo(() => {
    const total = newsList.length;
    const active = newsList.filter((n) => isItemActive(n)).length;
    const inactive = total - active;
    const promos = newsList.filter((n) => n.category === "Promociones").length;
    return { total, active, inactive, promos };
  }, [newsList]);

  const filteredNews = useMemo(() => {
    return newsList.filter((item) => {
      const matchesSearch = item.title?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === "all" || item.category === filterCategory;
      const activeState = isItemActive(item);
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && activeState) ||
        (filterStatus === "inactive" && !activeState);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [newsList, searchTerm, filterCategory, filterStatus]);

  const handleOpenCreate = () => {
    setCurrentNews(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (newsItem) => {
    setCurrentNews(newsItem);
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (payload) => {
    try {
      setIsLoading(true);

      const formDataToSend = new FormData();
      formDataToSend.append("title", payload.title);
      formDataToSend.append("category", payload.category);
      formDataToSend.append("content", payload.content);
      formDataToSend.append("description", payload.description || payload.content);
      formDataToSend.append("active", payload.active ? "true" : "false");

      if (payload.file) {
        formDataToSend.append("miniature", payload.file);
      }

      // No sobreescribimos cabeceras manualmente para evitar bloqueos de CORS.
      // La instancia `api` adjuntará 'Authorization: Bearer <token>' mediante su interceptor.
      if (currentNews) {
        const id = currentNews._id || currentNews.id;
        await api.patch(`/news/${id}`, formDataToSend);
      } else {
        await api.post("/news", formDataToSend);
      }

      alert("¡Noticia procesada exitosamente!");
      setIsModalOpen(false);
      setCurrentNews(null);

      setSearchTerm("");
      setFilterCategory("all");
      setFilterStatus("all");

      reloadNews();
    } catch (error) {
      console.error("Error al procesar la noticia:", error);
      const msg =
        error?.response?.data?.msg ||
        error?.response?.data?.message ||
        "Error en el servidor al guardar la noticia.";
      alert(`Error: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteNews = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar esta noticia?")) return;
    try {
      await api.delete(`/news/${id}`);
      reloadNews();
    } catch (error) {
      console.error("Error al eliminar la noticia:", error);
      const msg =
        error?.response?.data?.msg ||
        error?.response?.data?.message ||
        "Error al intentar eliminar la noticia.";
      alert(`Error: ${msg}`);
    }
  };

  return (
    <div className="news-dashboard">
      <header className="dashboard-header">
        <div className="header-title">
          <h1>Panel de Control de Noticias</h1>
          <p>Gestiona los anuncios, promociones y novedades visibles en la App.</p>
        </div>
        <button className="btn-create-news" onClick={handleOpenCreate}>
          <span className="icon">+</span> Crear Noticia
        </button>
      </header>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon total">📰</div>
          <div className="stat-info">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total Noticias</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon active">✅</div>
          <div className="stat-info">
            <span className="stat-value">{stats.active}</span>
            <span className="stat-label">Publicadas (Visibles)</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon inactive">⏸️</div>
          <div className="stat-info">
            <span className="stat-value">{stats.inactive}</span>
            <span className="stat-label">Borradores / Ocultas</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon promos">🔥</div>
          <div className="stat-info">
            <span className="stat-value">{stats.promos}</span>
            <span className="stat-label">Promociones Activas</span>
          </div>
        </div>
      </section>

      <main className="dashboard-content">
        <div className="content-toolbar">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar noticia por título..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filters-box">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="all">Todas las Categorías</option>
              <option value="Novedades">Novedades</option>
              <option value="Promociones">Promociones</option>
              <option value="Ofertas">Ofertas</option>
              <option value="Lanzamientos">Lanzamientos</option>
            </select>

            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">Todos los Estados</option>
              <option value="active">Visibles</option>
              <option value="inactive">Ocultos</option>
            </select>
          </div>
        </div>

        <NewsTable
          newsList={filteredNews}
          onEdit={handleOpenEdit}
          onDelete={handleDeleteNews}
          isLoading={isLoading}
        />
      </main>

      <NewsModalForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitForm}
        currentNews={currentNews}
      />
    </div>
  );
};

export default NewsPage;