import React, { useEffect, useState } from 'react';
import { FiDatabase, FiMapPin, FiClock, FiActivity, FiAlertCircle, FiDownload, FiExternalLink } from 'react-icons/fi';
import { getCracks } from './api';

function DatabaseView() {
  const [cracks, setCracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCracks() {
      try {
        const result = await getCracks();
        if (result.success) {
          setCracks(result.data);
        } else {
          setError('Failed to load database.');
        }
      } catch (err) {
        console.error(err);
        setError('Could not connect to database server.');
      } finally {
        setLoading(false);
      }
    }
    fetchCracks();

    // Poll for new detections every 3 seconds to keep DB synced
    const interval = setInterval(fetchCracks, 3000);
    return () => clearInterval(interval);
  }, []);

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['id', 'timestamp', 'latitude', 'longitude', 'accuracy_m', 'confidence_pct', 'class'],
      ...cracks.map((c) => [
        c.id, c.timestamp, c.gps?.latitude, c.gps?.longitude, c.gps?.accuracy,
        (c.confidence || 99.0).toFixed(1), c.topClass,
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nirmaan-deformations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card flush">
      <div className="list-head">
        <div>
          <div className="card-title"><FiDatabase /> Road deformation records</div>
          <small className="muted">{cracks.length} logged · refreshes automatically</small>
        </div>
        <button className="btn btn-light btn-sm" onClick={exportCsv} disabled={!cracks.length}>
          <FiDownload /> Export CSV
        </button>
      </div>

      {loading ? (
        <div className="empty"><p>Loading database records…</p></div>
      ) : error ? (
        <div className="empty bad"><FiAlertCircle size={22} /><p>{error}</p></div>
      ) : cracks.length === 0 ? (
        <div className="empty">
          <span className="dz-ic"><FiDatabase /></span>
          <h3>No deformations recorded yet</h3>
          <p>Unsafe detections are saved here automatically.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Photo</th>
                <th><FiClock /> Timestamp</th>
                <th><FiMapPin /> Location</th>
                <th><FiActivity /> Confidence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {cracks.map((crack) => (
                <tr key={crack.id}>
                  <td data-label="Photo"><img src={crack.preview} alt="Detected deformation" className="thumb" /></td>
                  <td data-label="Time">{new Date(crack.timestamp).toLocaleString()}</td>
                  <td data-label="Location">
                    {crack.gps ? (
                      <a href={`https://www.google.com/maps?q=${crack.gps.latitude},${crack.gps.longitude}`} target="_blank" rel="noreferrer">
                        {crack.gps.latitude.toFixed(5)}, {crack.gps.longitude.toFixed(5)}
                        {crack.gps.accuracy && ` (±${crack.gps.accuracy.toFixed(0)}m)`} <FiExternalLink />
                      </a>
                    ) : (
                      <span className="muted">Unknown</span>
                    )}
                  </td>
                  <td data-label="Confidence"><span className="pill">{(crack.confidence || 99.0).toFixed(1)}%</span></td>
                  <td data-label="Status"><span className="badge ok">Logged</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default DatabaseView;
