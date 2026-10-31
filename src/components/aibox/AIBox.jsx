import { useCallback, useEffect, useRef, useState } from 'react';
import './AIBox.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import kervynLogo from '../../assets/favicon-48x48.png'


import {
  downloadElementAsPng,
  downloadCsv,
  downloadConversationPdf,
} from './exportUtils';


const ANALYTICS_URL = '/api/analytics';
const CHAT_URL = '/api/ai/chat';

const SUGGESTIONS = [
  {
    icon: '◈',
    title: 'Analyze production quality',
    prompt: 'Analyze overall PCBA production quality, identify the biggest quality issues, and recommend improvements.',
  },
  {
    icon: '⌁',
    title: 'Find defect trends',
    prompt: 'Analyze defect trends by type and production stage. Identify the most problematic stages.',
  },
  {
    icon: '↗',
    title: 'Production performance',
    prompt: 'Evaluate production performance, work order completion, throughput, and bottlenecks.',
  },
  {
    icon: '◎',
    title: 'Recommend actions',
    prompt: 'Based on the available manufacturing data, identify the three highest-priority improvements.',
  },
];

const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') return '—';

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    : String(value);
};

const getErrorMessage = (error) =>
  error instanceof Error ? error.message : 'An unexpected error occurred.';

function normalizeAnalytics(data) {
  if (!data || typeof data !== 'object') return {};

  return {
    metrics: data.metrics ?? {},
    stages: Array.isArray(data.stages) ? data.stages : [],
    defects: Array.isArray(data.defects) ? data.defects : [],
    updatedAt: data.updatedAt ?? null,
  };
}


function MetricCard({ item }) {
    
    const exportRef = useRef(null);

  return (
    <div className="ai-metric-card" ref={exportRef}>
      <span className="ai-metric-title">{item.title}</span>

      
    <div className="ai-export-actions">
    <button
        type="button"
        className="ai-export-button"
        title="Download metric card as PNG"
        onClick={() =>
        downloadElementAsPng(exportRef.current, item.title || 'metric-card')
        }
    >
        <icon name="image" size="xs" />
        PNG
    </button>

    <button
        type="button"
        className="ai-export-button"
        title="Download metric value as CSV"
        onClick={() =>
        downloadCsv(
            ['Metric', 'Value', 'Unit', 'Change', 'Description'],
            [[item.title, item.value, item.unit, item.change, item.changeLabel]],
            item.title || 'metric-card'
        )
        }
    >
        <icon name="download" size="xs" />
        CSV
    </button>
    </div>


      <strong className="ai-metric-value">
        {formatNumber(item.value)}
        {item.unit && item.unit !== 'percent' ? ` ${item.unit}` : ''}
        {item.unit === 'percent' ? '%' : ''}
      </strong>

      {item.change !== undefined && item.change !== null && (
        <span className="ai-metric-change">
          {Number(item.change) > 0 ? '+' : ''}
          {formatNumber(item.change)}
          {item.changeLabel ? ` ${item.changeLabel}` : ''}
        </span>
      )}

      {!Number.isFinite(Number(item.change)) && item.changeLabel && (
        <span className="ai-metric-change">{item.changeLabel}</span>
      )}
    </div>
  );
}




function ChartBlock({ item }) {
    
const exportRef = useRef(null);

  const data = Array.isArray(item.data)
    ? item.data
        .map((point) => ({
          label: String(point.label ?? ''),
          value: Number(point.value),
        }))
        .filter((point) => point.label && Number.isFinite(point.value))
    : [];

  if (!data.length) {
    return (
      <section className="ai-chart">
        <strong>{item.title || 'Analysis Chart'}</strong>
        <p className="ai-table-empty">No chart data is available.</p>
      </section>
    );
  }

  const chartType = String(item.chartType || 'bar').toLowerCase();
  const isPie = chartType === 'pie' || chartType === 'doughnut';
  const isLine = chartType === 'line';

  const palette = [
    '#65d6ad',
    '#69a7ff',
    '#f4c768',
    '#c39bff',
    '#ff8f8f',
    '#61d4df',
    '#f6a76b',
    '#a8d879',
  ];

  const total = data.reduce(
    (sum, point) => sum + Math.max(0, point.value),
    0
  );

  const pieGradient = (() => {
    let current = 0;

    const stops = data.map((point, index) => {
      const start = current;
      current += total > 0 ? (Math.max(0, point.value) / total) * 100 : 0;

      return `${palette[index % palette.length]} ${start}% ${current}%`;
    });

    return `conic-gradient(${stops.join(', ')})`;
  })();

  const width = Math.max(600, data.length * 82);
  const height = 340;
  const margin = { top: 24, right: 20, bottom: 82, left: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const maxValue = Math.max(1, ...data.map((point) => point.value));
  const tickStep = maxValue / 4;
  const slotWidth = plotWidth / data.length;
  const barWidth = Math.min(42, slotWidth * 0.58);

  const points = data.map((point, index) => {
    const x = margin.left + slotWidth * (index + 0.5);
    const y =
      margin.top +
      plotHeight -
      (point.value / maxValue) * plotHeight;

    return { ...point, x, y };
  });

  const linePoints = points
    .map((point) => `${point.x},${point.y}`)
    .join(' ');

  const shortLabel = (label, maxLength = 15) =>
    label.length > maxLength
      ? `${label.slice(0, maxLength - 1)}…`
      : label;

  return (
    <section className="ai-chart" ref={exportRef}>
      <div className="ai-chart-heading">
        <strong>{item.title || 'Analysis Chart'}</strong>
        <span>{item.description || ''}</span>
      </div>

      
<div className="ai-export-actions">
  <button
    type="button"
    className="ai-export-button"
    onClick={() =>
      downloadElementAsPng(exportRef.current, item.title || 'kervyn-chart')
    }
  >
    Download PNG
  </button>

  <button
    type="button"
    className="ai-export-button"
    onClick={() =>
      downloadCsv(
        ['Category', 'Value'],
        (item.data || []).map((point) => [point.label, point.value]),
        item.title || 'kervyn-chart'
      )
    }
  >
    Download CSV
  </button>
</div>


      {isPie ? (
        <div className="ai-pie-layout">
          <div
            className="ai-pie"
            style={{ background: pieGradient }}
            role="img"
            aria-label={`Pie chart: ${item.title}`}
          />

          <div className="ai-pie-legend">
            {data.map((point, index) => (
              <div
                className="ai-pie-legend-item"
                key={`${point.label}-${index}`}
              >
                <span
                  className="ai-pie-swatch"
                  style={{
                    backgroundColor: palette[index % palette.length],
                  }}
                />
                <span className="ai-pie-label" title={point.label}>
                  {point.label}
                </span>
                <strong>{formatNumber(point.value)}</strong>
                <small>
                  {total > 0
                    ? `${((Math.max(0, point.value) / total) * 100).toFixed(1)}%`
                    : '—'}
                </small>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="ai-chart-scroll">
            <svg
              className="ai-chart-svg"
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`${chartType} chart: ${item.title}`}
            >
              {[0, 1, 2, 3, 4].map((tick) => {
                const y = margin.top + (plotHeight * tick) / 4;
                const value = maxValue * (1 - tick / 4);

                return (
                  <g key={`tick-${tick}`}>
                    <line
                      x1={margin.left}
                      y1={y}
                      x2={width - margin.right}
                      y2={y}
                      stroke="currentColor"
                      opacity="0.12"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={margin.left - 9}
                      y={y + 4}
                      textAnchor="end"
                      fill="currentColor"
                      opacity="0.65"
                      fontSize="11"
                    >
                      {formatNumber(value)}
                    </text>
                  </g>
                );
              })}

              {isLine ? (
                <>
                  <polyline
                    points={linePoints}
                    fill="none"
                    stroke="#65d6ad"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />

                  {points.map((point, index) => (
                    <circle
                      key={`point-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r="4"
                      fill="#65d6ad"
                    >
                      <title>
                        {point.label}: {formatNumber(point.value)}
                      </title>
                    </circle>
                  ))}
                </>
              ) : (
                points.map((point, index) => {
                  const barHeight = Math.max(
                    0,
                    margin.top + plotHeight - point.y
                  );

                  return (
                    <g key={`bar-${index}`}>
                      <rect
                        x={point.x - barWidth / 2}
                        y={point.y}
                        width={barWidth}
                        height={barHeight}
                        rx="4"
                        fill="#65d6ad"
                      >
                        <title>
                          {point.label}: {formatNumber(point.value)}
                        </title>
                      </rect>

                      <text
                        x={point.x}
                        y={Math.max(margin.top + 12, point.y - 8)}
                        textAnchor="middle"
                        fill="currentColor"
                        fontSize="11"
                      >
                        {formatNumber(point.value)}
                      </text>
                    </g>
                  );
                })
              )}

              {points.map((point, index) => (
                <text
                  key={`label-${index}`}
                  x={point.x}
                  y={margin.top + plotHeight + 19}
                  textAnchor="end"
                  transform={`rotate(-38 ${point.x} ${margin.top + plotHeight + 19})`}
                  fill="currentColor"
                  opacity="0.8"
                  fontSize="10"
                >
                  <title>{point.label}</title>
                  {shortLabel(point.label)}
                </text>
              ))}
            </svg>
          </div>

          <div className="ai-chart-axis-labels">
            <span>{item.xAxis || 'Category'}</span>
            <span>{item.yAxis || 'Value'}</span>
          </div>
        </>
      )}
    </section>
  );
}




function TableBlock({ item }) {
    const exportRef = useRef(null);
  const columns = Array.isArray(item.columns) ? item.columns : [];
  const sourceRows = Array.isArray(item.rows) ? item.rows : [];

  const getCell = (row, column, columnIndex) => {
    if (Array.isArray(row)) {
      return row[columnIndex] ?? '—';
    }

    if (row && typeof row === 'object') {
      const key = Object.keys(row).find(
        (candidate) =>
          candidate.trim().toLowerCase() ===
          String(column).trim().toLowerCase()
      );

      return key !== undefined && row[key] != null && row[key] !== ''
        ? row[key]
        : '—';
    }

    return '—';
  };

  const displayValue = (value) => {
    if (value === null || value === undefined || value === '') return '—';

    if (typeof value === 'number') {
      return Number.isFinite(value)
        ? value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
        : '—';
    }

    return String(value);
  };

  return (
    <section className="ai-table-block" ref={exportRef}>
      <div className="ai-chart-heading">
        <strong>{item.title || 'Analysis Table'}</strong>
        <span>{sourceRows.length} rows</span>

        


<button
  type="button"
  className="ai-export-button"
  onClick={() => {
    console.log('CSV button clicked');
    console.log('Columns:', columns);
    console.log('Rows:', sourceRows);

    try {
      downloadCsv(
        columns,
        sourceRows,
        item?.title || 'kervyn-table'
      );

      console.log('CSV export function called');
    } catch (error) {
      console.error('CSV export failed:', error);
      alert(`CSV export failed: ${error.message}`);
    }
  }}
>
  Download CSV
</button>



      </div>

      {item.description && (
        <p className="ai-table-description">{item.description}</p>
      )}

      {columns.length > 0 && sourceRows.length > 0 ? (
        <div className="ai-table-scroll">
          <table className="ai-data-table">
            <thead>
              <tr>
                {columns.map((column, index) => (
                  <th key={`${column}-${index}`} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {sourceRows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {columns.map((column, columnIndex) => (
                    <td key={`${column}-${columnIndex}`}>
                      {displayValue(getCell(row, column, columnIndex))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="ai-table-empty">
          No tabular data was returned for this analysis.
        </p>
      )}
    </section>
  );
}


function Visualizations({ visuals }) {
  if (!Array.isArray(visuals) || visuals.length === 0) return null;

  return (
    <div className="ai-visualizations">
      {visuals.map((item, index) => {
        if (item.type === 'metric') {
          return <MetricCard key={index} item={item} />;
        }

        if (item.type === 'chart') {
          return <ChartBlock key={index} item={item} />;
        }

        if (item.type === 'table') {
          return <TableBlock key={index} item={item} />;
        }

        return null;
      })}
    </div>
  );
}

function WelcomeScreen({ onPrompt }) {
  return (
    <div className="ai-welcome">
      <div className="ai-orb"><img src={kervynLogo} alt="Kervyn AI" /></div>
      <h2>Your manufacturing intelligence.</h2>
      <p>
        Ask questions about PCBA quality, production performance, defects,
        work orders, or anything in your available manufacturing data.
      </p>

      <div className="ai-suggestions">
        {SUGGESTIONS.map((suggestion) => (
          <button
            type="button"
            className="ai-suggestion"
            key={suggestion.title}
            onClick={() => onPrompt(suggestion.prompt)}
          >
            <span className="ai-suggestion-icon">{suggestion.icon}</span>
            <span>
              <strong>{suggestion.title}</strong>
              <small>{suggestion.prompt}</small>
            </span>
            <span className="ai-suggestion-arrow">↗</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AIBox() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [databaseStatus, setDatabaseStatus] = useState('loading');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const conversationRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const sendingRef = useRef(false);
  const sessionIdRef = useRef(null);
  
    const chatExportRef = useRef(null);
    const [exportingPdf, setExportingPdf] = useState(false);

    const handleExportPdf = async () => {
    if (!chatExportRef.current || exportingPdf) return;

    setExportingPdf(true);

    try {
        await downloadConversationPdf(chatExportRef.current);
    } catch (error) {
        console.error('Failed to export Kervyn conversation:', error);
        setError('Could not export the conversation. Please try again.');
    } finally {
        setExportingPdf(false);
    }
    };


  const loadAnalytics = useCallback(async (signal) => {
    setDatabaseStatus('loading');

    try {
      const response = await fetch(ANALYTICS_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal,
      });

      if (!response.ok) {
        throw new Error(`Analytics request failed (${response.status}).`);
      }

      const data = await response.json();
      setAnalytics(normalizeAnalytics(data));
      setDatabaseStatus('connected');
    } catch (err) {
      if (err.name === 'AbortError') return;

      setDatabaseStatus('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    loadAnalytics(controller.signal);

    return () => {
      controller.abort();
      abortRef.current?.abort();
    };
  }, [loadAnalytics]);

useEffect(() => {
  const conversation = conversationRef.current;

  if (!conversation) return;

  conversation.scrollTo({
    top: conversation.scrollHeight,
    behavior: 'smooth',
  });
}, [messages, sending]);

  const sendMessage = useCallback(
    async (overrideText) => {
      const text = (overrideText ?? input).trim();

      if (!text || sendingRef.current) return;

      sendingRef.current = true;

      setInput('');
      setError('');
      setSending(true);

      const userMessage = {
        id: `${Date.now()}-user`,
        role: 'user',
        content: text,
        visuals: [],
      };

      setMessages((previous) => [...previous, userMessage]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            message: text,
            sessionId: sessionIdRef.current,
          }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            result.error || `AI request failed (${response.status}).`,
          );
        }

        if (typeof result.reply !== 'string') {
          throw new Error('The AI server returned an invalid response.');
        }

        if (result.sessionId) {
          sessionIdRef.current = result.sessionId;
        }

        const assistantMessage = {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          content: result.reply,
          visuals: Array.isArray(result.visuals) ? result.visuals : [],
          createdAt: new Date().toISOString(),
        };

        setMessages((previous) => [...previous, assistantMessage]);
      } catch (err) {
        if (err.name === 'AbortError') return;

        const message = getErrorMessage(err);
        setError(message);

        setMessages((previous) => [
          ...previous,
          {
            id: `${Date.now()}-error`,
            role: 'assistant',
            content:
              'I could not complete that analysis. Check the AI API connection and try again.',
            visuals: [],
            failed: true,
          },
        ]);
      } finally {
          if (abortRef.current === controller) {
            abortRef.current = null;
          }

          sendingRef.current = false;
          setSending(false);
          inputRef.current?.focus();
        }
    },
    [input],
  );

  const clearChat = () => {
    if (sendingRef.current) return;

    setMessages([]);
    setError('');

    sessionIdRef.current = null;

    inputRef.current?.focus();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage();
  };

  const databaseLabel = {
    loading: 'Checking database',
    connected: 'Analytics connected',
    error: 'Analytics unavailable',
  }[databaseStatus];

  return (
    <section className="aibox" aria-label="Kervyn AI assistant">
      <header className="ai-header">
        <div className="ai-brand">
          <div className="ai-brand-icon"><img src={kervynLogo} alt="Kervyn AI" /></div>
          <div className="ai-brand-text">
            <div className="ai-title-row">
              <h2>Kervyn AI</h2>
              <span className="ai-version">ANALYST</span>
            </div>
            <p>Manufacturing intelligence copilot</p>
          </div>
        </div>

        <div className="ai-header-actions">
          <div
            className={`ai-db-status ai-db-${databaseStatus}`}
            title={databaseLabel}
          >
            <span className="ai-status-dot" />
            <span>{databaseLabel}</span>
          </div>

          <button
            type="button"
            className="ai-icon-button"
            onClick={() => loadAnalytics()}
            title="Refresh analytics"
            aria-label="Refresh analytics"
            disabled={databaseStatus === 'loading'}
          >
            ↻
          </button>

          <button
            type="button"
            className="ai-icon-button"
            onClick={clearChat}
            title="New conversation"
            aria-label="New conversation"
            disabled={sending}
          >
            ＋
          </button>
        </div>
      </header>

      <div className="ai-conversation" ref={conversationRef} aria-live="polite">
        {messages.length === 0 ? (
          <WelcomeScreen onPrompt={(prompt) => sendMessage(prompt)} />
        ) : (
          <div className="ai-message-list">
            {messages.map((message) => (
              <article
                key={message.id}
                ref={chatExportRef}
                className={`ai-message ai-message-${message.role}`}
              >
                
                {message.role === 'assistant' && (
                  <div className="ai-avatar"><img src={kervynLogo} alt="Kervyn AI" /></div>
                )}

                <div className="ai-message-body">
                    
                  <div className="ai-message-meta">
                    <strong>
                      {message.role === 'user' ? 'You' : 'Kervyn AI'}
                    </strong>
                    {message.failed && <span className="ai-error-label">Error</span>}
                  </div>
                    

                  <div className="ai-message-content">
                    {message.role === 'assistant' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {String(message.content ?? '')}
                      </ReactMarkdown>
                    ) : (
                      message.content
                    )}
                  </div>

                  <Visualizations visuals={message.visuals} />
                  {message.role === "user" ? '' : (
                    <button
                    type="button"
                    className="ai-export-button ai-export-pdf"
                    onClick={handleExportPdf}
                    disabled={exportingPdf || !messages.length}
                    title="Export conversation to PDF"
                    >
                    {exportingPdf ? 'Preparing PDF…' : 'Export PDF'}
                    </button>
                  )}
                </div>
              </article>
            ))}

            {sending && (
              <div className="ai-thinking">
                <div className="ai-avatar"><img src={kervynLogo} alt="Kervyn AI" /></div>
                <div className="ai-thinking-content">
                  <strong>Analyzing your request</strong>
                  <div className="ai-thinking-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <small>Querying insights and preparing your response</small>
                </div>
              </div>
            )}

            <div />
          </div>
        )}
      </div>

      {error && (
        <div className="ai-inline-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}

      <footer className="ai-composer-area">
        {analytics && (
          <div className="ai-context-line">
            <span className="ai-context-dot" />
            <span>
              {Object.keys(analytics.metrics).length} dashboard metrics available
            </span>
            <span className="ai-context-separator">·</span>
            <span>Ask in natural language</span>
          </div>
        )}

        <form className="ai-composer" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask Kervyn about your manufacturing data..."
            aria-label="Message Kervyn AI"
            rows={2}
            maxLength={8000}
            disabled={sending}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />

          <div className="ai-composer-bottom">
            <span className="ai-input-hint">
              Enter to send · Shift + Enter for a new line
            </span>

            <button
              type="submit"
              className="ai-send-button"
              disabled={sending || !input.trim()}
              aria-label="Send message"
            >
              {sending ? '…' : '↑'}
            </button>
          </div>
        </form>

        <p className="ai-disclaimer">
          AI-generated analysis may contain errors. Verify important findings
          against your source data.
        </p>
      </footer>
    </section>
  );
}

export default AIBox;
