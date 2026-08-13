import { ENV } from "@/utils";
import "./NewsTable.scss";

const formatImage = (path) => {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const cleanPath = path.replace(/\\/g, "/").replace(/^\/+/, "");
  const serverHost = ENV?.SERVER_HOST || import.meta.env.VITE_SERVER_HOST || "http://localhost:3977";

  return cleanPath.startsWith("uploads/")
    ? `${serverHost}/${cleanPath}`
    : `${serverHost}/uploads/${cleanPath}`;
};

const NewsTable = ({ newsList = [], onEdit, onDelete, isLoading }) => {
  if (isLoading) {
    return <div className="admin-loading">Cargando noticias...</div>;
  }

  if (!newsList || newsList.length === 0) {
    return (
      <div className="admin-empty" style={{ textAlign: "center", padding: "40px", color: "#777" }}>
        📁 No hay noticias publicadas en el sistema.
      </div>
    );
  }

  return (
    <div className="admin-table-container">
      <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
            <th style={{ padding: "10px" }}>Imagen</th>
            <th style={{ padding: "10px" }}>Título</th>
            <th style={{ padding: "10px" }}>Categoría</th>
            <th style={{ padding: "10px" }}>Estado</th>
            <th style={{ padding: "10px" }}>Fecha</th>
            <th style={{ padding: "10px" }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {newsList.map((item) => {
            const imgUrl = formatImage(item.miniature || item.image || item.file);
            const isActive = item.active !== false;

            return (
              <tr key={item._id || item.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "10px" }}>
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={item.title}
                      className="table-thumbnail"
                      style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "6px" }}
                    />
                  ) : (
                    <span className="no-img" style={{ fontSize: "12px", color: "#aaa" }}>Sin foto</span>
                  )}
                </td>
                <td style={{ padding: "10px" }}>
                  <strong>{item.title}</strong>
                </td>
                <td style={{ padding: "10px" }}>
                  <span className="badge-category">{item.category || "General"}</span>
                </td>
                <td style={{ padding: "10px" }}>
                  <span style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: "bold",
                    backgroundColor: isActive ? "#e8f5e9" : "#ffebee",
                    color: isActive ? "#2e7d32" : "#c62828"
                  }}>
                    {isActive ? "Visible" : "Oculto"}
                  </span>
                </td>
                <td style={{ padding: "10px", fontSize: "13px", color: "#666" }}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "N/A"}
                </td>
                <td style={{ padding: "10px" }}>
                  <button
                    className="btn-action btn-edit"
                    onClick={() => onEdit(item)}
                    style={{ marginRight: "8px", cursor: "pointer" }}
                  >
                    Editar
                  </button>
                  <button
                    className="btn-action btn-delete"
                    onClick={() => onDelete(item._id || item.id)}
                    style={{ cursor: "pointer", color: "#c62828" }}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default NewsTable;