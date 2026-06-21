import { useEffect, useState } from 'react';
import { listProjects } from '../lib/loadProject.js';

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function OpenProjectModal({ onSelect, onClose, projectType }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    listProjects({ projectType }).then((result) => {
      if (result.ok) {
        setProjects(result.projects);
      } else {
        setError(result.error);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Open Project</span>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {loading && <div className="modal-empty">Loading…</div>}
          {error && <div className="modal-empty modal-error">{error}</div>}
          {!loading && !error && projects.length === 0 && (
            <div className="modal-empty">No saved projects found.</div>
          )}
          {!loading && !error && projects.length > 0 && (
            <ul className="project-list">
              {projects.map((p) => (
                <li
                  key={p.id}
                  className="project-list-item"
                  onClick={() => onSelect(p.id)}
                >
                  <div className="project-list-name">{p.project_name || 'Untitled'}</div>
                  <div className="project-list-meta">
                    {p.client_name && <span>{p.client_name}</span>}
                    <span>{fmtDate(p.updated_at || p.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-footer">
          <button className="panel-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
