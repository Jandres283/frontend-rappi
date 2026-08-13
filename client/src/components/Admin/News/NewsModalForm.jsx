/* eslint-disable */
import { useState, useEffect } from "react";
import "./NewsModalForm.scss";

export const NewsModalForm = ({ isOpen, onClose, onSubmit, currentNews }) => {
  const [formData, setFormData] = useState({
    title: "",
    category: "Novedades",
    content: "",
    active: true,
    file: null,
  });

  useEffect(() => {
    if (isOpen) {
      if (currentNews) {
        setFormData({
          title: currentNews.title || "",
          category: currentNews.category || "Novedades",
          content: currentNews.content || currentNews.description || "",
          active: currentNews.active ?? true,
          file: null,
        });
      } else {
        setFormData({
          title: "",
          category: "Novedades",
          content: "",
          active: true,
          file: null,
        });
      }
    }
  }, [isOpen, currentNews]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, files, type, checked } = e.target;
    if (type === "file") {
      setFormData((prev) => ({ ...prev, file: files && files[0] ? files[0] : null }));
    } else if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!onSubmit) return;

    onSubmit({
      title: formData.title.trim(),
      category: formData.category,
      content: formData.content.trim(),
      description: formData.content.trim(),
      active: formData.active,
      file: formData.file,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{currentNews ? "Editar Noticia" : "Nueva Noticia"}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="news-title">Título del Anuncio</label>
            <input
              id="news-title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Ej. ¡2x1 en Promociones de Fin de Semana!"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="news-category">Categoría</label>
            <select
              id="news-category"
              name="category"
              value={formData.category}
              onChange={handleChange}
            >
              <option value="Novedades">Novedades</option>
              <option value="Promociones">Promociones</option>
              <option value="Ofertas">Ofertas</option>
              <option value="Lanzamientos">Lanzamientos</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="news-content">Contenido / Descripción</label>
            <textarea
              id="news-content"
              name="content"
              rows="3"
              value={formData.content}
              onChange={handleChange}
              placeholder="Detalle de la noticia que leerán los usuarios..."
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="news-file">Imagen promocional</label>
            <input
              id="news-file"
              type="file"
              name="file"
              accept="image/*"
              onChange={handleChange}
            />
          </div>

          <div className="form-group checkbox-group">
            <input
              id="news-active"
              type="checkbox"
              name="active"
              checked={formData.active}
              onChange={handleChange}
            />
            <label htmlFor="news-active">
              Publicar inmediatamente (Visible para el Cliente)
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              {currentNews ? "Guardar Cambios" : "Publicar Noticia"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewsModalForm;