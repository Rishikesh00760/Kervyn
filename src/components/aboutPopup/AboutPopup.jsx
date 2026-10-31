
import { useEffect } from "react";
import "./AboutPopup.css";

export default function AboutPopup({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const features = [
    {
      icon: "◉",
      title: "Production Monitoring",
      description:
        "Monitor key parameters and performance across PCBA production stages."
    },
    {
      icon: "▥",
      title: "Quality Analytics",
      description:
        "Explore inspection results, defect rates, quality metrics, and production trends."
    },
    {
      icon: "✳",
      title: "AI-Powered Analysis",
      description:
        "Analyse manufacturing data, identify potential anomalies, and uncover actionable insights."
    }
  ];

  return (
    <div
      className="kervyn-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="kervyn-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kervyn-about-title"
      >
        <header className="kervyn-modal-header">
          <div className="kervyn-brand">
            <div className="kervyn-logo"></div>
            <div>
              <h2 id="kervyn-about-title">About Kervyn</h2>
              <p>PCBA Manufacturing Intelligence</p>
            </div>
          </div>

          <button
            className="kervyn-close"
            onClick={onClose}
            aria-label="Close about popup"
            type="button"
          >
            ×
          </button>
        </header>

        <div className="kervyn-modal-body">
          <div className="kervyn-eyebrow">
            PRODUCTION QUALITY PLATFORM
          </div>

          <h3>
            Smarter manufacturing.
            <br />
            <span>Better quality.</span>
          </h3>

          <p className="kervyn-intro">
            Kervyn is a web-based production line monitoring and
            product quality analysis platform built for Printed
            Circuit Board Assembly (PCBA) manufacturing. It brings
            production data, inspection results, and intelligent
            analytics together in one centralized dashboard.
          </p>

          <div className="kervyn-features">
            {features.map((feature) => (
              <article className="kervyn-feature" key={feature.title}>
                <div className="kervyn-feature-icon">
                  {feature.icon}
                </div>
                <div>
                  <h4>{feature.title}</h4>
                  <p>{feature.description}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="kervyn-highlight">
            <div className="kervyn-highlight-icon">✦</div>
            <div>
              <h4>Intelligence beyond inspection</h4>
              <p>
                Turn manufacturing data into meaningful insights
                to support faster decisions, early defect detection,
                and continuous quality improvement.
              </p>
            </div>
          </div>
        </div>

        <footer className="kervyn-modal-footer">
          <span>
            <span className="kervyn-status-dot" />
            PCBA Quality Intelligence
          </span>
          <button
            className="kervyn-done"
            onClick={onClose}
            type="button"
          >
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}
