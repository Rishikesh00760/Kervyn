
import { useCallback, useEffect, useMemo, useState } from 'react';
import './Datasheet.css';

const API_URL = '/api/analytics';

const number = (value) =>
  Number(value ?? 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });

const percent = (value) => `${number(value)}%`;

const initialData = {
  updatedAt: null,
  metrics: {},
  stages: [],
  defects: [],
  trend: [],
  records: [],
};


const metricDefinitions = [
  { key: 'totalBoards', label: 'Boards Produced', format: number, color: 'blue' },
  { key: 'totalInspected', label: 'Boards Inspected', format: number, color: 'blue' },
  { key: 'passRate', label: 'Inspection Pass Rate', format: percent, color: 'green' },
  { key: 'firstPassYield', label: 'First-Pass Yield', format: percent, color: 'purple' },
  { key: 'totalDefects', label: 'Defect Count', format: number, color: 'red' },
  { key: 'defectEvents', label: 'Defect Events', format: number, color: 'orange' },
  { key: 'criticalDefects', label: 'Critical Defect Events', format: number, color: 'red' },
  { key: 'outOfSpecRate', label: 'Out-of-Spec Rate', format: percent, color: 'orange' },
  { key: 'reworkedBoards', label: 'Boards Reworked', format: number, color: 'orange' },
  { key: 'reworkCost', label: 'Rework Cost ($)', format: (v) => number(v), color: 'purple' },
  { key: 'orderCompletionRate', label: 'Completed Work Orders', format: percent, color: 'green' },
  { key: 'avgCycleTime', label: 'Avg. Process Duration', format: (v) => `${number(v)} min`, color: 'blue' },
];


function Datasheet() {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [availableStages, setAvailableStages] = useState([]);

  const fetchAnalytics = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const response = await fetch(
        `${API_URL}?stage=${encodeURIComponent(stageFilter)}`,
        {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        }
      );

      if (!response.ok) {
        throw new Error(`Analytics API returned HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.metrics || typeof result.metrics !== 'object') {
        throw new Error('Invalid analytics response: metrics are missing.');
      }

      setData({
        ...initialData,
        ...result,
        metrics: result.metrics,
        stages: Array.isArray(result.stages) ? result.stages : [],
        defects: Array.isArray(result.defects) ? result.defects : [],
        trend: Array.isArray(result.trend) ? result.trend : [],
        records: Array.isArray(result.records) ? result.records : [],
      });

      setLastUpdated(result.updatedAt || new Date().toISOString());
    } catch (err) {
      setError(err.message || 'Unable to load analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stageFilter]);

  const exportDatasheet = () => {
    const exportedAt = new Date();

    const exportPayload = {
      application: 'Kervyn',
      exportType: 'Manufacturing Datasheet',
      exportedAt: exportedAt.toISOString(),
      filters: {
        processStage: stageFilter,
        recordSearch: search.trim() || null,
      },
      data: {
        metrics: data.metrics,
        defects: data.defects,
        stages: data.stages,
        trend: data.trend,
        records: data.records,
      },
    };

    const blob = new Blob(
      [JSON.stringify(exportPayload, null, 2)],
      { type: 'application/json;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = exportedAt.toISOString().replace(/[:.]/g, '-');

    link.href = url;
    link.download = `Kervyn-Datasheet-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchStages() {
      try {
        const response = await fetch('/api/stages', {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        });

        if (!response.ok) {
          throw new Error('Unable to load process stages.');
        }

        const result = await response.json();
        const stages = Array.isArray(result.data) ? result.data : [];

        if (!cancelled) {
          setAvailableStages(
            stages
              .map((stage) => ({
                stageId: stage.stageId,
                stageName: stage.stageName,
              }))
              .sort((a, b) => a.stageId - b.stageId)
          );
        }
      } catch (err) {
        console.error('Stage list error:', err);
      }
    }

    fetchStages();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return data.records.filter((record) =>
      Object.values(record).some((value) =>
        String(value ?? '').toLowerCase().includes(query)
      )
    );
  }, [data.records, search]);

  const maxDefects = Math.max(
    1,
    ...data.defects.map((item) => Number(item.count) || 0)
  );

  const maxStageDefectRate = Math.max(
    1,
    ...data.stages.map((item) => Number(item.defectRate) || 0)
  );

  const formatTimestamp = (value) => {
    if (!value) return 'Not available';

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleString();
  };

  return (
    <section className="datasheet">
      <header className="ds">
        <div className="ds-heading">
          <span className="ds-eyebrow">KERVYN / ANALYTICS</span>
          <h2 className="title">Manufacturing Datasheet</h2>
          <p>PCBA quality, inspection and production intelligence</p>
        </div>

        <div className="ds-actions">
          <button
            className="ds-export"
            onClick={exportDatasheet}
            disabled={loading}
            type="button"
            title="Download all Datasheet data as a JSON file"
          >
            <span className="export-icon" aria-hidden="true">↓</span>
            Export Data
          </button>

          <button
            className="ds-refresh"
            onClick={() => fetchAnalytics(true)}
            disabled={loading || refreshing}
            type="button"
          >
            <span className={refreshing ? 'refresh-icon spinning' : 'refresh-icon'}>
              ↻
            </span>
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </header>

      <div className="ds-status">
        <span className={`status-dot ${error ? 'status-error' : ''}`} />
        {error ? 'Connection issue' : loading ? 'Connecting...' : 'Analytics loaded'}
        <span className="ds-updated">
          Updated: {formatTimestamp(lastUpdated)}
        </span>
      </div>

      {error && (
        <div className="ds-error" role="alert">
          <strong>Unable to fetch Exasol analytics.</strong>
          <span>{error}</span>
          <button type="button" onClick={() => fetchAnalytics()}>
            Try again
          </button>
        </div>
      )}

      <div className="ds-content">
        <section className="ds-section">
          <div className="ds-section-heading">
            <div>
              <h3>Quality overview</h3>
              <p>Key performance indicators from production data</p>
            </div>

            <label className="ds-filter">
              <span>Process stage</span>
              <select
                value={stageFilter}
                onChange={(event) => setStageFilter(event.target.value)}
              >
                <option value="all">All stages</option>
                {availableStages.map((stage) => (
                  <option
                    key={stage.stageId}
                    value={stage.stageName}
                  >
                    {stage.stageName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="ds-metrics">
            {metricDefinitions.map((metric) => {
              const value = data.metrics[metric.key];
              const available = value !== null && value !== undefined;

              return (
                <article
                  className={`ds-metric metric-${metric.color}`}
                  key={metric.key}
                >
                  <div className="metric-top">
                    <span>{metric.label}</span>
                    <span className="metric-indicator" />
                  </div>

                  <strong className="metric-value">
                    {loading && !available
                      ? '—'
                      : available
                        ? metric.format(value)
                        : 'N/A'}
                  </strong>

                  <p>{metric.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="ds-section">
          <div className="ds-section-heading">
            <div>
              <h3>Defect analysis</h3>
              <p>Most frequent recorded defect categories</p>
            </div>
            <span className="ds-count">
              {number(data.defects.length)} categories
            </span>
          </div>

          {data.defects.length ? (
            <div className="ds-defects">
              {data.defects.map((defect) => {
                const count = Number(defect.count) || 0;
                const severity = String(defect.severity || 'Unknown');

                return (
                  <div className="defect-row" key={defect.name}>
                    <div className="defect-info">
                      <div>
                        <span className="defect-name">
                          {defect.name || 'Unspecified'}
                        </span>
                        <span
                          className={`severity severity-${severity.toLowerCase()}`}
                        >
                          {severity}
                        </span>
                      </div>
                      <strong>{number(count)}</strong>
                    </div>

                    <div className="ds-progress">
                      <span
                        style={{
                          width: `${Math.min(100, (count / maxDefects) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="ds-empty">
              {loading ? 'Loading defect analysis…' : 'No defect data available.'}
            </p>
          )}
        </section>

        <section className="ds-section">
          <div className="ds-section-heading">
            <div>
              <h3>Process-stage performance</h3>
              <p>Inspection results and defect rates by stage</p>
            </div>
          </div>

          {data.stages.length ? (
            <div className="ds-table-wrap">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Process stage</th>
                    <th>Inspected</th>
                    <th>Passed</th>
                    <th>Failed</th>
                    <th>Defect rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stages.map((stage) => (
                    <tr key={stage.stageName}>
                      <td>{stage.stageName}</td>
                      <td>{number(stage.inspected)}</td>
                      <td className="value-pass">{number(stage.passed)}</td>
                      <td className="value-fail">{number(stage.failed)}</td>
                      <td>
                        <div className="stage-rate">
                          <span>
                            {percent(stage.defectRate)}
                          </span>
                          <div className="stage-mini-bar">
                            <span
                              style={{
                                width: `${Math.min(
                                  100,
                                  ((Number(stage.defectRate) || 0) /
                                    maxStageDefectRate) *
                                    100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="ds-empty">
              {loading ? 'Loading process stages…' : 'No process-stage data available.'}
            </p>
          )}
        </section>

        <section className="ds-section">
          <div className="ds-section-heading">
            <div>
              <h3>Production trend</h3>
              <p>Inspection volume and defect occurrences over time</p>
            </div>
          </div>

          {data.trend.length ? (
            <div className="ds-trend">
              {data.trend.map((point) => {
                const inspected = Number(point.inspected) || 0;
                const defects = Number(point.defects) || 0;
                const scale = Math.max(1, inspected, defects);

                return (
                  <div className="trend-item" key={point.label}>
                    <div className="trend-values">
                      <span>{number(inspected)}</span>
                      <span>{number(defects)} defects</span>
                    </div>
                    <div className="trend-bars">
                      <span
                        className="trend-inspected"
                        style={{ width: `${(inspected / scale) * 100}%` }}
                      />
                      <span
                        className="trend-defects"
                        style={{ width: `${(defects / scale) * 100}%` }}
                      />
                    </div>
                    <span className="trend-label">{point.label}</span>
                  </div>
                );
              })}
              <div className="trend-legend">
                <span><i className="legend-inspected" /> Inspected</span>
                <span><i className="legend-defects" /> Defects</span>
              </div>
            </div>
          ) : (
            <p className="ds-empty">
              {loading ? 'Loading production trends…' : 'No trend data available.'}
            </p>
          )}
        </section>

        <section className="ds-section">
          <div className="ds-section-heading">
            <div>
              <h3>Inspection records</h3>
              <p>Search the detailed records returned by the API</p>
            </div>
            <label className="ds-search">
              <span className="sr-only">Search records</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search records..."
              />
            </label>
          </div>

          {data.records.length ? (
            <div className="ds-table-wrap">
              <table className="ds-table">
                <thead>
                  <tr>
                    {Object.keys(data.records[0]).map((key) => (
                      <th key={key}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record, index) => (
                    <tr key={record.inspectionId ?? record.INSPECTION_ID ?? index}>
                      {Object.keys(data.records[0]).map((key) => (
                        <td key={key}>{String(record[key] ?? '—')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredRecords.length && (
                <p className="ds-empty">No matching records found.</p>
              )}
            </div>
          ) : (
            <p className="ds-empty">
              {loading ? 'Loading inspection records…' : 'No inspection records returned.'}
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

export default Datasheet;
