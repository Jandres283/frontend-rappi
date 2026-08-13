import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiFilter, FiBookmark, FiClock, FiTag, FiChevronDown, 
  FiChevronUp, FiArrowLeft, FiFileText, FiSearch, FiZap, FiGift, FiShare2, FiCheckCircle 
} from 'react-icons/fi';

import './NewsDetailPage.scss';

const SERVER_HOST = import.meta.env.VITE_SERVER_HOST || 'http://localhost:3977';
const API_URL = import.meta.env.VITE_API_URL || `${SERVER_HOST}/api/v1`;

const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const formatImage = (path) => {
  if (!path || typeof path !== 'string') return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  
  let cleanPath = path.replace(/\\/g, '/').replace(/^\/+/, '');
  const host = SERVER_HOST.replace(/\/$/, '');

  if (cleanPath.startsWith('uploads/')) {
    return `${host}/${cleanPath}`;
  }
  return `${host}/uploads/${cleanPath}`;
};

export default function NewsDetailPage({ articles = [], onBack, onToggleBookmark }) {
  const navigate = useNavigate();

  const [fetchedNews, setFetchedNews] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const propList = useMemo(() => {
    if (Array.isArray(articles)) return articles;
    if (articles?.data && Array.isArray(articles.data)) return articles.data;
    if (articles?.docs && Array.isArray(articles.docs)) return articles.docs;
    return [];
  }, [articles]);

  const [isLoading, setIsLoading] = useState(() => propList.length === 0);

  useEffect(() => {
    if (propList.length > 0) return;
    
    let isMounted = true;

    fetch(`${API_URL}/news`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        const list = Array.isArray(data) ? data : data?.docs || data?.data || data?.news || [];
        setFetchedNews(list);
      })
      .catch((err) => console.warn('Error al conectar con la API de noticias:', err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [propList.length]);

  const activeNewsList = useMemo(() => {
    const rawList = propList.length > 0 ? propList : fetchedNews;
    return rawList.filter((item) => {
      return item.active === true || item.active === "true" || item.active === undefined;
    });
  }, [propList, fetchedNews]);

  const categories = useMemo(() => {
    const list = activeNewsList
      .map((item) => (item?.category ? capitalize(String(item.category).trim()) : null))
      .filter(Boolean);
    return ['Todas', ...Array.from(new Set(list))];
  }, [activeNewsList]);

  const filteredNews = useMemo(() => {
    return activeNewsList.filter((item) => {
      const itemCat = capitalize(String(item?.category || ''));
      const matchCat = selectedCategory === 'Todas' || itemCat.toLowerCase() === selectedCategory.toLowerCase();
      const titleMatch = (item?.title || '').toLowerCase().includes(searchTerm.toLowerCase());
      const contentMatch = (item?.content || item?.description || '').toLowerCase().includes(searchTerm.toLowerCase());

      return matchCat && (titleMatch || contentMatch);
    });
  }, [activeNewsList, selectedCategory, searchTerm]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const formatDate = (rawDate) => {
    if (!rawDate) return '';
    try {
      const date = new Date(rawDate);
      return isNaN(date.getTime())
        ? String(rawDate)
        : date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return String(rawDate);
    }
  };

  return (
    <div className="news-container">
      <div className="header-bar">
        <button onClick={() => (onBack ? onBack() : navigate(-1))} className="back-button">
          <FiArrowLeft /> Volver
        </button>
      </div>

      <div className="hero-banner">
        <div className="hero-content">
          <div>
            <span className="live-badge">
              <span className="pulse-dot"></span> Actualizado
            </span>
            <h1>
              <FiZap /> Centro de Noticias & Novedades
            </h1>
            <p>
              Mantente al día con las últimas actualizaciones, ofertas y nuevos restaurantes registrados.
            </p>
          </div>
        </div>
      </div>

      <div className="main-layout">
        <main className="main-content">
          {categories.length > 1 && (
            <div className="filter-section">
              <div className="category-group">
                <FiFilter style={{ color: '#64748b' }} />
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`category-btn ${
                      selectedCategory.toLowerCase() === cat.toLowerCase() ? 'active' : ''
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="articles-list">
            {isLoading ? (
              <div className="loading-news">Cargando publicaciones...</div>
            ) : filteredNews.length === 0 ? (
              <div className="no-news">
                <FiFileText size={48} style={{ color: '#94a3b8', marginBottom: '1rem' }} />
                <h3>No hay publicaciones disponibles</h3>
                <p>Las novedades y ofertas ingresadas por el administrador aparecerán aquí.</p>
              </div>
            ) : (
              filteredNews.map((item, idx) => {
                const id = item._id || item.id || `news-${idx}`;
                const isExpanded = expandedId === id;
                const imgUrl = formatImage(item.miniature || item.file || item.image);
                const isSaved = item.isBookmarked || false;
                const contentText = item.content || item.description || '';

                return (
                  <article key={id} className="news-card">
                    <div className="card-body">
                      <div className="card-content">
                        <div className="meta-info">
                          <span className="tag-badge">
                            <FiTag /> {capitalize(item.category) || 'Novedad'}
                          </span>
                          <span>
                            <FiClock /> {formatDate(item.createdAt || item.date)}
                          </span>
                        </div>

                        <h2
                          className="news-title"
                          onClick={() => setExpandedId(isExpanded ? null : id)}
                        >
                          {item.title}
                        </h2>

                        <p className="news-excerpt">{contentText}</p>

                        <div className="card-actions">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : id)}
                            className="toggle-btn"
                          >
                            {isExpanded ? <>Leer menos <FiChevronUp /></> : <>Leer completo <FiChevronDown /></>}
                          </button>
                          <button
                            onClick={() => {
                              if (navigator.clipboard) {
                                navigator.clipboard.writeText(window.location.href);
                              }
                              showToast('¡Enlace copiado!');
                            }}
                            className="share-btn"
                          >
                            <FiShare2 /> Compartir
                          </button>
                        </div>
                      </div>

                      <div className="image-wrapper">
                        {imgUrl ? (
                          <img src={imgUrl} alt={item.title || 'Noticia'} className="news-image" />
                        ) : (
                          <div className="fallback-image">
                            <FiFileText size={32} />
                          </div>
                        )}

                        <button
                          onClick={() => {
                            if (onToggleBookmark) onToggleBookmark(item);
                            showToast(isSaved ? 'Eliminado de guardados' : 'Guardado con éxito');
                          }}
                          className="bookmark-btn"
                        >
                          <FiBookmark
                            fill={isSaved ? '#ff441f' : 'none'}
                            color={isSaved ? '#ff441f' : '#64748b'}
                            size={16}
                          />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="expanded-detail">
                        <p>{contentText}</p>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </main>

        <aside className="sidebar">
          <div className="widget">
            <h4 className="widget-title">🔍 Buscar</h4>
            <div className="search-input">
              <FiSearch style={{ color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Buscar noticia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="promo-widget">
            <div className="promo-badge">
              <FiGift /> PROMOCIÓN ESPECIAL
            </div>
            <h3>20% de Descuento</h3>
            <p>Usa este código en tu próximo pedido:</p>
            <div className="coupon-box">
              <code>PROMO2026</code>
              <button
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText('PROMO2026');
                  }
                  setCopied(true);
                  showToast('¡Cupón copiado!');
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? '¡Listo!' : 'Copiar'}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {toastMessage && (
        <div className="toast-notification">
          <FiCheckCircle color="#00ff88" /> {toastMessage}
        </div>
      )}
    </div>
  );
}