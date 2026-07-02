// src/pages/Settings/PrivacyPolicyPage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "./PrivacyPolicyPage.css";

const ArrowLeft = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const CloseX = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const Lock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const CheckCircle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const XCircle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);
const AlertTriangle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const Mail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
  </svg>
);
const MapPin = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);
const Bell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const ShieldCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
  </svg>
);
const Users = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const Key = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);
const Globe = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
const UserCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" />
  </svg>
);
const Database = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);
const Cpu = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
  </svg>
);
const Eye = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const Share2 = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

function PrivacyPolicyPage() {
  const navigate = useNavigate();

  // ─── Smart close: go back in history if possible, else fall back ───────
  // Works whether opened from /signin, /signup, or /dashboard/settings.
  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/signin");
    }
  };

  return (
    <div className="pp-root">

      {/* Close */}
      <div className="pp-topbar" style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          className="pp-back-btn"
          onClick={handleClose}
          style={{
            padding: 0,
            borderRadius: "50%",
            width: "38px",
            height: "38px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "38px"
          }}
          aria-label="Close"
        >
          <CloseX />
        </button>
      </div>

      {/* Hero */}
      <div className="pp-hero">
        <div className="pp-hero-inner">
          <div className="pp-hero-badge"><Lock /><span>Data Protected</span></div>
          <h1 className="pp-hero-title">Haatza Seller Privacy Policy</h1>
          <p className="pp-hero-subtitle">
            Learn how Haatza Seller collects, uses, stores, and protects your information as a seller on our platform.
          </p>
        </div>
        <div className="pp-hero-art">
          <svg viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="100" cy="160" rx="65" ry="12" fill="#ffffff" fillOpacity="0.08"/>
            <path d="M100 14 L165 40 L165 96 C165 134 100 160 100 160 C100 160 35 134 35 96 L35 40 Z" fill="url(#sg)"/>
            <path d="M100 26 L153 48 L153 96 C153 127 100 148 100 148 C100 148 47 127 47 96 L47 48 Z" fill="white" fillOpacity="0.12"/>
            <path d="M82 88 L95 101 L120 76" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="148" cy="34" r="12" fill="#4CAF50" fillOpacity="0.9"/>
            <path d="M143 34 L147 38 L154 30" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <defs>
              <linearGradient id="sg" x1="35" y1="14" x2="165" y2="160" gradientUnits="userSpaceOnUse">
                <stop stopColor="rgba(255,255,255,0.35)"/>
                <stop offset="1" stopColor="rgba(255,255,255,0.1)"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="pp-content">

        {/* 1 */}
        <section className="pp-section">
          <div className="pp-section-label">01</div>
          <h2 className="pp-section-title">Introduction &amp; Scope</h2>
          <p className="pp-para">
            Haatza Seller ("we," "us," "our") respects your privacy and is committed to protecting your privacy. This policy applies to all personal data processed via our e-commerce platform, in compliance with the Information Technology Act, 2000, the IT (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and relevant e-commerce statutes like the Consumer Protection (E-Commerce) Rules, 2020.
          </p>
        </section>

        {/* 2 */}
        <section className="pp-section">
          <div className="pp-section-label">02</div>
          <h2 className="pp-section-title">Information We Collect</h2>
          <div className="pp-two-col">
            <div className="pp-card pp-card-blue">
              <div className="pp-card-head"><Users /><strong>Personal Data</strong></div>
              <ul className="pp-list">
                {["Name, email, phone number, shipping/billing address, payment details."].map(i => (
                  <li key={i}><CheckCircle />{i}</li>
                ))}
              </ul>
            </div>
            <div className="pp-card pp-card-orange">
              <div className="pp-card-head"><Key /><strong>Sensitive Data (if applicable)</strong></div>
              <ul className="pp-list">
                {["Payment card details, government ID numbers, passwords."].map(i => (
                  <li key={i}><AlertTriangle />{i}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 3 */}
        <section className="pp-section">
          <div className="pp-section-label">03</div>
          <h2 className="pp-section-title">Purpose and Legal Basis of Collection</h2>
          <p className="pp-para">We collect data to:</p>
          <div className="pp-timeline">
            {[
              { n:"1", label:"Process orders, payments, and deliveries" },
              { n:"2", label:"Communicate updates and support" },
              { n:"3", label:"Comply with legal obligations" },
            ].map(p => (
              <div className="pp-tl-item" key={p.n}>
                <div className="pp-tl-dot">{p.n}</div>
                <div className="pp-tl-body">
                  <strong>{p.label}</strong>
                </div>
              </div>
            ))}
          </div>
          <div className="pp-notice">
            <AlertTriangle />
            <p>Under SPDI Rules, we obtain your consent before collection and ensure it is informed and specific. Although the DPDP Act, 2023 is not yet in force, we anticipate its eventual enforcement and will adapt accordingly.</p>
          </div>
        </section>

        {/* 4 */}
        <section className="pp-section">
          <div className="pp-section-label">04</div>
          <h2 className="pp-section-title">Consent &amp; Children's Data</h2>
          <p className="pp-para">Users must provide clear, affirmative consent for data collection. For minors (under 18), parental or guardian consent will be obtained in line with DPDP guidelines when activated.</p>
        </section>

        {/* 5 */}
        <section className="pp-section">
          <div className="pp-section-label">05</div>
          <h2 className="pp-section-title">Data Minimisation &amp; Retention</h2>
          <p className="pp-para">We collect only essential data and retain it no longer than needed for our services, legal obligations, or dispute resolution. Upon reaching retention limits, data is securely deleted. Reflection on proposed DPDP retention rules (e.g., 3 years for high-volume platforms) is ongoing.</p>
        </section>

        {/* 6 */}
        <section className="pp-section">
          <div className="pp-section-label">06</div>
          <h2 className="pp-section-title">Security Measures</h2>
          <p className="pp-para">We implement reasonable technical and organizational safeguards (e.g., encryption, access controls) to protect data integrity and confidentiality.</p>
        </section>

        {/* 7 */}
        <section className="pp-section">
          <div className="pp-section-label">07</div>
          <h2 className="pp-section-title">Data Disclosure</h2>
          <p className="pp-para">We only share your personal data with:</p>
          <div className="pp-grid-5" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            {[
              { emoji:"💳", label:"Payment processors, logistics partners, or other third-party service providers under contracts that mandate data protection." },
              { emoji:"⚖", label:"Authorities when required by law." },
            ].map(d => (
              <div className="pp-disc-card" key={d.label}>
                <span className="pp-disc-emoji">{d.emoji}</span>
                <p>{d.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 8 */}
        <section className="pp-section">
          <div className="pp-section-label">08</div>
          <h2 className="pp-section-title">Cross-border Transfers</h2>
          <div className="pp-globe-card">
            <div className="pp-globe-icon"><Globe /></div>
            <div className="pp-globe-body">
              <p>Any data transfers outside India will be conducted with safeguards and contractual controls, in anticipation of DPDP cross-border guidelines.</p>
            </div>
          </div>
        </section>

        {/* 9 */}
        <section className="pp-section">
          <div className="pp-section-label">09</div>
          <h2 className="pp-section-title">Grievance Redressal</h2>
          <p className="pp-para">In accordance with Consumer Protection (E-Commerce) Rules, 2020, we have appointed a Grievance Officer. You can reach them at:</p>
          <div className="pp-grievance-card">
            <div className="pp-grievance-rows">
              <div className="pp-grievance-row">
                <div className="pp-grievance-icon"><UserCheck /></div>
                <div><label>Name</label><strong>Ramkumar</strong></div>
              </div>
              <div className="pp-grievance-row">
                <div className="pp-grievance-icon"><Mail /></div>
                <div><label>Email</label><a href="mailto:grievance@haatza.com">grievance@haatza.com</a></div>
              </div>
            </div>
            <p className="pp-grievance-note">We endeavor to resolve complaints within timeframes set by applicable rules.</p>
          </div>
        </section>

        {/* 10 */}
        <section className="pp-section">
          <div className="pp-section-label">10</div>
          <h2 className="pp-section-title">No "Dark Patterns"</h2>
          <p className="pp-para">We adhere to guidelines issued by the Central Consumer Protection Authority (CCPA) to avoid manipulative interface designs (e.g., false urgency, hidden charges, forced actions). Our platform ensures transparent, fair consent manner, grievance rights).</p>
        </section>

        {/* 11 */}
        <section className="pp-section">
          <div className="pp-section-label">11</div>
          <h2 className="pp-section-title">Your Rights</h2>
          <p className="pp-para">As a user of Haatza Seller, you have the following rights with respect to your personal data. You may exercise these rights at any time by contacting us.</p>
          <div className="pp-grid-4">
            {[
              { emoji:"👁",  title:"Access",           desc:"Request a complete copy of all personal data we hold about you." },
              { emoji:"✏️", title:"Correction",        desc:"Update or rectify any inaccurate or incomplete information." },
              { emoji:"🗑",  title:"Deletion",          desc:"Request erasure of your data where no legal obligation requires retention." },
              { emoji:"↩️", title:"Withdraw Consent",  desc:"Revoke your consent for any processing activity at any time." },
            ].map(r => (
              <div className="pp-rights-card" key={r.title}>
                <span className="pp-rights-emoji">{r.emoji}</span>
                <strong>{r.title}</strong>
                <p>{r.desc}</p>
              </div>
            ))}
          </div>
          <div className="pp-notice">
            <Bell />
            <p>We also support future rights arising under the Digital Personal Data Protection (DPDP) Act, 2023, as and when individual provisions are notified and brought into force.</p>
          </div>
        </section>

        {/* 12 */}
        <section className="pp-section">
          <div className="pp-section-label">12</div>
          <h2 className="pp-section-title">Changes to This Policy</h2>
          <p className="pp-para">Updates to this policy will be promptly published on our platform and communicated via email or banner notices. We will adapt the policy as required when new regulations like DPDP become enforceable.</p>
        </section>

        {/* 13 */}
        <section className="pp-section">
          <div className="pp-section-label">13</div>
          <h2 className="pp-section-title">Contact Us</h2>
          <p className="pp-para">For all privacy-related queries, reach out to:</p>
          <div className="pp-contact-card">
            <div className="pp-contact-block">
              <div className="pp-contact-icon"><Mail /></div>
              <div>
                <label>Email</label>
                <a href="mailto:sales@haatza.com">sales@haatza.com</a>
              </div>
            </div>
            <div className="pp-contact-divider" />
            <div className="pp-contact-block">
              <div className="pp-contact-icon"><MapPin /></div>
              <div>
                <label>Address</label>
                <address>
                  #126, RNS Plaza, KIADB Layout, 1st Main,<br />
                  Near Tech Mahindra gate 1, Electronic City Phase 2,<br />
                  Doddanagamangala Road, Bengaluru, Karnataka 560100
                </address>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

export default PrivacyPolicyPage;