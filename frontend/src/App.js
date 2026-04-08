import React, { useState, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { jsPDF } from "jspdf";
import "./App.css";

const API = "https://career-copilot-backend-x5zt.onrender.com";

const BUILDER_TABS = [
  { id: "resume",   label: "Resume"         },
  { id: "match",    label: "Match Job"      },
  { id: "linkedin", label: "LinkedIn"       },
  { id: "pitch",    label: "Elevator Pitch" },
  { id: "github",   label: "GitHub README"  },
];

const OPTIMIZER_TABS = [
  { id: "improve", label: "Improve" },
  { id: "roast",   label: "Roast"   },
];

function App() {
  const [mode, setMode]               = useState("builder");
  const [activeTab, setActiveTab]     = useState("resume");
  const [loading, setLoading]         = useState(false);
  const [output, setOutput]           = useState("");
  const [outputLabel, setOutputLabel] = useState("Output");
  const [copied, setCopied]           = useState(false);
  const [dark, setDark]               = useState(true); // ← theme toggle

  const [uploadedFile, setUploadedFile]         = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [resumeText, setResumeText]             = useState("");
  const [extracting, setExtracting]             = useState(false);
  const [showFallback, setShowFallback]         = useState(false);
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    name: "", education: "", skills: "",
    experience: "", projects: "", target_job: "",
    job_description: "",
  });
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  // ── Reset everything (logo click) ───────────────────────────────────────────
  const resetAll = () => {
    setMode("builder");
    setActiveTab("resume");
    setOutput("");
    setOutputLabel("Output");
    setLoading(false);
    setCopied(false);
    setUploadedFile(null);
    setUploadedFileName("");
    setResumeText("");
    setShowFallback(false);
    setForm({ name:"", education:"", skills:"", experience:"", projects:"", target_job:"", job_description:"" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── File upload ─────────────────────────────────────────────────────────────
  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploadedFile(file);
    setUploadedFileName(file.name);
    setResumeText("");
    setShowFallback(false);
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API}/extract-resume`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.text && res.data.text.trim().length > 0) {
        setResumeText(res.data.text);
        setShowFallback(false);
      } else {
        setShowFallback(true);
        setResumeText("");
      }
    } catch {
      setShowFallback(true);
      setResumeText("");
    }
    setExtracting(false);
  };

  const clearFile = () => {
    setUploadedFile(null);
    setUploadedFileName("");
    setResumeText("");
    setShowFallback(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const hasResume = resumeText.trim().length > 0;

  // ── API caller ──────────────────────────────────────────────────────────────
  const call = async (endpoint, body, resultKey) => {
    setLoading(true);
    setOutput("");
    try {
      const res = await axios.post(`${API}${endpoint}`, body);
      setOutput(res.data[resultKey] || "Empty response from server.");
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      setOutput(`Error: ${msg}`);
    }
    setLoading(false);
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const actions = {
    resume:   () => { setOutputLabel("Generated Resume");   call("/generate-resume", form, "resume"); },
    match:    () => { setOutputLabel("Job Match Analysis"); call("/match-job", { ...form, target_job: form.job_description }, "output"); },
    linkedin: () => { setOutputLabel("LinkedIn Posts");     call("/linkedin-post", form, "post"); },
    pitch:    () => { setOutputLabel("Elevator Pitch");     call("/elevator-pitch", form, "pitch"); },
    github:   () => { setOutputLabel("GitHub README");      call("/github-readme", form, "readme"); },
    improve:  () => {
      if (!hasResume) { alert("Please provide your resume text first."); return; }
      setOutputLabel("Improved Resume");
      call("/improve-resume", { resume_text: resumeText, job_description: form.job_description }, "improvement");
    },
    roast: () => {
      if (!hasResume) { alert("Please provide your resume text first."); return; }
      setOutputLabel("Resume Roast");
      call("/roast-resume", { resume_text: resumeText }, "roast");
    },
  };

  const switchTab  = (id) => { setActiveTab(id); setOutput(""); setOutputLabel("Output"); };
  const switchMode = (m)  => {
    setMode(m); setOutput(""); setOutputLabel("Output");
    setActiveTab(m === "builder" ? "resume" : "improve");
  };

  const copyText = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPDF = () => {
    if (!output) { alert("No content to download!"); return; }
    const plain = output
      .replace(/#{1,6}\s+/g, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`(.+?)`/g, "$1")
      .replace(/^[-*+]\s+/gm, "- ")
      .replace(/\n{3,}/g, "\n\n");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(plain, 180);
    let y = 15;
    const pageH = doc.internal.pageSize.getHeight();
    lines.forEach((line) => {
      if (y + 7 > pageH - 15) { doc.addPage(); y = 15; }
      doc.text(line, 15, y);
      y += 6;
    });
    doc.save(`${outputLabel.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`);
  };

  const tabs = mode === "builder" ? BUILDER_TABS : OPTIMIZER_TABS;
  const builderBtnLabel = {
    resume: "Generate Resume", match: "Analyse Match",
    linkedin: "Generate Posts", pitch: "Write Pitch", github: "Generate README",
  };

  return (
    <div className={`app ${dark ? "dark" : "light"}`}>

      {/* Header */}
      <header className="header">
        {/* ── Logo — click to reset ── */}
        <div className="logo" onClick={resetAll} title="Click to restart">
          <div className="logo-mark">C</div>
          <span className="logo-text">
            CareerCopilot <span className="logo-ai">AI</span>
          </span>
        </div>

        <div className="header-right">
          {/* ── Theme toggle ── */}
          <button
            className="theme-toggle"
            onClick={() => setDark(!dark)}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? "☀ Light" : "☾ Dark"}
          </button>

          {/* ── Mode toggle ── */}
          <div className="mode-toggle">
            <button className={mode === "builder"   ? "active" : ""} onClick={() => switchMode("builder")}>Builder</button>
            <button className={mode === "optimizer" ? "active" : ""} onClick={() => switchMode("optimizer")}>Optimizer</button>
          </div>
        </div>
      </header>

      <div className="workspace">

        {/* Sidebar */}
        <aside className="sidebar">
          <nav className="tab-nav">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`tab-btn ${activeTab === t.id ? "active" : ""}`}
                onClick={() => switchTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Builder */}
          {mode === "builder" && (
            <div className="form-panel">
              <label>Full Name</label>
              <input value={form.name} onChange={set("name")} />
              <label>Education</label>
              <input value={form.education} onChange={set("education")} />
              <label>Skills</label>
              <textarea rows={3} value={form.skills} onChange={set("skills")} />
              <label>Experience</label>
              <textarea rows={3} value={form.experience} onChange={set("experience")} />
              <label>Projects</label>
              <textarea rows={2} value={form.projects} onChange={set("projects")} />
              <label>Target Role</label>
              <input value={form.target_job} onChange={set("target_job")} />
              {activeTab === "match" && (
                <>
                  <label>Job Description</label>
                  <textarea rows={4} value={form.job_description} onChange={set("job_description")} />
                </>
              )}
              <button className="btn-primary" onClick={actions[activeTab]} disabled={loading}>
                {loading ? "Generating..." : builderBtnLabel[activeTab]}
              </button>
            </div>
          )}

          {/* Optimizer */}
          {mode === "optimizer" && (
            <div className="form-panel">
              <label>Resume</label>

              {!uploadedFile ? (
                <div
                  className="upload-zone"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files[0]); }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.pdf"
                    style={{ display: "none" }}
                    onChange={(e) => handleFileUpload(e.target.files[0])}
                  />
                  <div className="upload-prompt">
                    <div className="upload-icon-box">↑</div>
                    <p className="upload-main">Click or drag file here</p>
                    <p className="upload-sub">.txt  .md  .pdf</p>
                  </div>
                </div>

              ) : extracting ? (
                <div className="upload-zone upload-zone--reading">
                  <div className="upload-prompt">
                    <div className="upload-spinner" />
                    <p className="upload-main">Reading file...</p>
                  </div>
                </div>

              ) : (
                <div className={`upload-zone ${hasResume ? "upload-zone--done" : "upload-zone--warn"}`}>
                  <div className="upload-done">
                    <span className="upload-check">{hasResume ? "✓" : "!"}</span>
                    <span className="upload-done-name">{uploadedFileName}</span>
                    <button className="upload-clear" onClick={clearFile}>✕</button>
                  </div>
                  {!hasResume && (
                    <p className="upload-warn-msg">Could not read PDF automatically.<br />Paste your resume below.</p>
                  )}
                </div>
              )}

              {showFallback && (
                <div className="fallback-wrap">
                  <label>Paste Resume Text</label>
                  <textarea
                    className="fallback-textarea"
                    rows={8}
                    placeholder="Copy and paste your resume content here..."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                  />
                </div>
              )}

              {activeTab === "improve" && (
                <>
                  <label>Job Description</label>
                  <textarea rows={4} value={form.job_description} onChange={set("job_description")} />
                </>
              )}

              <button
                className="btn-primary"
                onClick={actions[activeTab]}
                disabled={loading || !hasResume}
              >
                {loading ? "Processing..." : activeTab === "roast" ? "Roast Resume" : "Improve Resume"}
              </button>

              {!hasResume && !extracting && (
                <p className="upload-hint">
                  {uploadedFile && showFallback
                    ? "Paste your resume text above to continue"
                    : "Upload a resume file to continue"}
                </p>
              )}
            </div>
          )}
        </aside>

        {/* Output */}
        <main className="output-panel">
          <div className="output-header">
            <h2 className="output-title">{outputLabel}</h2>
            <div className="output-actions">
              <button className="btn-ghost" onClick={copyText} disabled={!output}>
                {copied ? "Copied" : "Copy"}
              </button>
              <button className="btn-ghost" onClick={downloadPDF} disabled={!output}>
                Download PDF
              </button>
            </div>
          </div>

          <div className="output-body">
            {loading ? (
              <div className="loader-wrap">
                <div className="loader" />
                <p className="loader-text">Generating response...</p>
              </div>
            ) : output ? (
              <div className="markdown-output">
                <ReactMarkdown>{output}</ReactMarkdown>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon-box">C</div>
                <p>Fill in your details and click Generate</p>
              </div>
            )}
          </div>
        </main>

      </div>
    </div>
  );
}

export default App;