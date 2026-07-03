import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  RefreshCw,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Clock,
  Video,
  FileText
} from "lucide-react";
import { getSellerId, resolveSellerEmail } from "../../utils/sellerSession";
import { sellerService } from "../../services/sellerService";
import "./HelpPage.css";

// ── date helpers ──────────────────────────────────────────────────────────────
const formatApiDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getDefaultTicketDateRange = () => {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 60);
  return { fromDate: formatApiDate(from), toDate: formatApiDate(today) };
};

// ── assignedTo logic ─────────────────────────────────────────────────────────
const resolveAssignedTeam = (category) => {
  const cat = String(category || "").toLowerCase();
  if (cat === "payment" || cat === "refund") return "Billing Team";
  if (cat === "shipping") return "Logistic Team";
  return "Support Team"; // Order, Product Enquire, Seller Training, Other, default
};

const HelpPage = () => {
  const sellerId = getSellerId();
  const sellerEmail = (resolveSellerEmail() || "").trim();

  const [activeTab, setActiveTab] = useState("tickets"); // "tickets" | "tutorials"

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Tutorials state
  const [tutorials, setTutorials] = useState([]);
  const [tutorialsLoading, setTutorialsLoading] = useState(false);
  const [tutorialsError, setTutorialsError] = useState(null);

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Form state
  const [formSubject, setFormSubject] = useState("");
  const [formCategory, setFormCategory] = useState("Order");
  const [formPriority, setFormPriority] = useState("Medium");
  const [formDescription, setFormDescription] = useState("");
  const [formError, setFormError] = useState("");

  // Toast
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch Tickets
  const fetchTickets = useCallback(async () => {
    if (!sellerEmail) {
      setError("Seller email not found. Please login again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { fromDate, toDate } = getDefaultTicketDateRange();

      if (process.env.NODE_ENV !== "production") {
        console.log("[HelpPage] getTickets params:", { email: sellerEmail, fromDate, toDate, count: 50, lastFetched: 0 });
      }

      const res = await sellerService.getTickets({
        email: sellerEmail,
        fromDate,
        toDate,
        count: 50,
        lastFetched: 0,
      });

      if (process.env.NODE_ENV !== "production") {
        console.log("[HelpPage] getTickets response:", res);
      }

      // Parse payments array from backend response shape
      const rawTickets =
        res?.message?.payments ||
        res?.message?.tickets ||
        res?.message?.data ||
        res?.data?.message?.payments ||
        res?.data?.message?.tickets ||
        (Array.isArray(res) ? res : null) ||
        res?.tickets ||
        res?.data?.tickets ||
        res?.data ||
        res?.message ||
        [];

      const normalizedTickets = (Array.isArray(rawTickets) ? rawTickets : []).map((t) => ({
        id: t.ticketId || t._id || t.id || null,
        ticketId: t.ticketId || t._id || t.id || null,
        subject: t.subject || "No Subject",
        category: t.category || "General Support",
        priority: t.priority || "Medium",
        status: t.status || "Open",
        description: t.description || "",
        createdDate: t.createdDate || t.createdAt || new Date().toISOString(),
      }));

      // Dedupe by ticketId/id
      const seen = new Set();
      const deduped = normalizedTickets.filter((t) => {
        if (!t.id) return true; // keep if no id (shouldn't happen)
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });

      if (process.env.NODE_ENV !== "production") {
        console.log("[HelpPage] normalized tickets:", deduped);
      }

      setTickets(deduped);
    } catch (err) {
      console.error("[HelpPage] Error fetching tickets:", err);
      setError("Failed to load support tickets. Please verify connection.");
    } finally {
      setLoading(false);
    }
  }, [sellerEmail]);

  // Fetch Tutorials
  const fetchTutorials = useCallback(async () => {
    setTutorialsLoading(true);
    setTutorialsError(null);
    try {
      const res = await sellerService.getSellerTutorials();
      const rawTutorials = res?.data || res?.message?.tutorials || res?.tutorials || res?.message || [];
      setTutorials(Array.isArray(rawTutorials) ? rawTutorials : []);
    } catch (err) {
      console.error("[HelpPage] Error fetching tutorials:", err);
      setTutorialsError("Failed to fetch tutorials from server.");
      setTutorials([]);
    } finally {
      setTutorialsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "tickets") {
      fetchTickets();
    } else {
      fetchTutorials();
    }
  }, [activeTab, fetchTickets, fetchTutorials]);

  // Handle Create Ticket Submit
  const handleCreateTicketSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!sellerId) {
      setFormError("Seller session not found. Please login again.");
      return;
    }
    if (!formSubject.trim()) {
      setFormError("Subject is required.");
      return;
    }
    if (!formDescription.trim()) {
      setFormError("Description is required.");
      return;
    }

    const assignedTeam = resolveAssignedTeam(formCategory);

    setSubmitting(true);
    try {
      const ticketData = {
        priority: formPriority,
        subject: formSubject.trim(),
        description: formDescription.trim(),
        status: "Open",
        createdAt: new Date().toISOString(),
        category: formCategory,
        userId: sellerId,
        assignedTo: assignedTeam,
      };

      if (process.env.NODE_ENV !== "production") {
        console.log("[HelpPage] createTicket payload:", ticketData);
      }
      const response = await sellerService.createTicket(ticketData);
      if (process.env.NODE_ENV !== "production") {
        console.log("[HelpPage] createTicket response:", response);
      }

      showToast("Ticket created successfully!");
      setIsCreateModalOpen(false);

      setFormSubject("");
      setFormCategory("Order");
      setFormPriority("Medium");
      setFormDescription("");

      fetchTickets();
    } catch (err) {
      console.error("[HelpPage] Create ticket failed:", err);
      setFormError("Failed to submit support ticket to backend. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filters logic
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchesSearch =
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || t.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesPriority = priorityFilter === "all" || t.priority.toLowerCase() === priorityFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesPriority;
    }).sort((a, b) => {
      if (sortBy === "date-desc") return new Date(b.createdDate) - new Date(a.createdDate);
      if (sortBy === "date-asc") return new Date(a.createdDate) - new Date(b.createdDate);
      if (sortBy === "priority-high") {
        const order = { high: 3, medium: 2, low: 1 };
        return (order[b.priority.toLowerCase()] || 0) - (order[a.priority.toLowerCase()] || 0);
      }
      return 0;
    });
  }, [tickets, searchQuery, statusFilter, priorityFilter, sortBy]);

  // Pagination logic
  const paginatedTickets = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTickets.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTickets, currentPage]);

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage) || 1;

  // Format dates
  const formatDate = (isoString) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return "Recent";
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "Recent";
    }
  };

  return (
    <div className="help-tickets-root">
      {toastMessage && (
        <div className="help-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb & Page title header */}
      <div className="help-page-header-v2">
        <div className="header-info-left">
          <nav className="help-breadcrumb" aria-label="breadcrumb">
            <span>Dashboard</span> &gt; <span>Support</span> &gt; <span className="active">{activeTab === "tickets" ? "Tickets" : "Help & Tutorials"}</span>
          </nav>
          <h1 className="help-page-title">{activeTab === "tickets" ? "My Tickets" : "Help & Tutorials"}</h1>
        </div>
        {activeTab === "tickets" && (
          <button
            className="btn-create-ticket-main"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus size={16} />
            <span>Create Ticket</span>
          </button>
        )}
      </div>

      {/* Tabs for Tickets vs Tutorials */}
      <div className="help-tabs-container">
        <button
          className={`help-tab-btn ${activeTab === "tickets" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("tickets");
            setCurrentPage(1);
          }}
        >
          Support Tickets
        </button>
        <button
          className={`help-tab-btn ${activeTab === "tutorials" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("tutorials");
            setCurrentPage(1);
          }}
        >
          Help & Tutorials
        </button>
      </div>

      {/* Main content grid */}
      <div className="help-content-v2">
        {/* Ticket Tab Content */}
        {activeTab === "tickets" && (
          <>
            {error && (
              <div className="help-alert-info">
                <AlertCircle size={16} />
                <span>{error}</span>
                <button className="btn-alert-close" onClick={() => setError(null)}>&times;</button>
              </div>
            )}

            {loading ? (
              <div className="help-loading-state">
                <div className="help-loading-spinner" />
                <p>Loading your support tickets...</p>
              </div>
            ) : tickets.length === 0 ? (
              /* Empty state Card */
              <div className="help-empty-card-container">
                <div className="help-empty-state-card">
                  <div className="empty-icon-wrapper">
                    <MessageSquare size={40} />
                  </div>
                  <h3>No Tickets Found</h3>
                  <p>You have not created any support tickets yet. Create a new ticket to get assistance from our support team.</p>
                  <button
                    className="btn-empty-create"
                    onClick={() => setIsCreateModalOpen(true)}
                  >
                    Create New Ticket
                  </button>
                </div>
              </div>
            ) : (
              /* Ticket Table & Filters */
              <div className="help-dashboard-card">
                <div className="help-toolbar-v2">
                  <div className="toolbar-search-wrap">
                    <Search size={16} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search tickets by ID, subject..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="search-input"
                    />
                  </div>

                  <div className="toolbar-filters-wrap">
                    <div className="filter-select-wrapper">
                      <span className="filter-label">Status</span>
                      <select
                        value={statusFilter}
                        onChange={(e) => {
                          setStatusFilter(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="filter-select"
                      >
                        <option value="all">All Statuses</option>
                        <option value="open">Open</option>
                        <option value="in progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>

                    <div className="filter-select-wrapper">
                      <span className="filter-label">Priority</span>
                      <select
                        value={priorityFilter}
                        onChange={(e) => {
                          setPriorityFilter(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="filter-select"
                      >
                        <option value="all">All Priorities</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>

                    <div className="filter-select-wrapper">
                      <span className="filter-label">Sort By</span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="filter-select"
                      >
                        <option value="date-desc">Newest First</option>
                        <option value="date-asc">Oldest First</option>
                        <option value="priority-high">Highest Priority</option>
                      </select>
                    </div>

                    <button
                      className="btn-toolbar-refresh"
                      onClick={fetchTickets}
                      title="Refresh tickets logs"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                <div className="help-table-wrapper">
                  <table className="help-table">
                    <thead>
                      <tr>
                        <th>Ticket ID</th>
                        <th>Subject</th>
                        <th>Category</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Created Date</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTickets.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="table-empty-row">
                            No support tickets match the selected filters.
                          </td>
                        </tr>
                      ) : (
                        paginatedTickets.map((t) => (
                          <tr key={t.id} className="help-table-row">
                            <td className="font-semibold text-blue">{t.id}</td>
                            <td className="table-subject-cell" title={t.subject}>
                              <div className="subject-text">{t.subject}</div>
                            </td>
                            <td>
                              <span className="category-tag">{t.category}</span>
                            </td>
                            <td>
                              <span className={`priority-tag ${t.priority.toLowerCase()}`}>
                                {t.priority}
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge-v2 ${t.status.replace(" ", "-").toLowerCase()}`}>
                                <span className="status-dot" />
                                {t.status}
                              </span>
                            </td>
                            <td className="text-muted text-sm">{formatDate(t.createdDate)}</td>
                            <td className="text-right">
                              <button
                                className="btn-table-view"
                                onClick={() => setSelectedTicket(t)}
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredTickets.length > 0 && (
                  <div className="help-table-pagination">
                    <span className="pagination-count-label">
                      Showing <strong>{((currentPage - 1) * itemsPerPage) + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredTickets.length)}</strong> of <strong>{filteredTickets.length}</strong> tickets
                    </span>
                    <div className="pagination-buttons">
                      <button
                        className="btn-paginator"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="pagination-pages-label">Page {currentPage} of {totalPages}</span>
                      <button
                        className="btn-paginator"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Tutorials Tab Content */}
        {activeTab === "tutorials" && (
          <>
            {tutorialsError && (
              <div className="help-alert-info">
                <AlertCircle size={16} />
                <span>{tutorialsError}</span>
                <button className="btn-alert-close" onClick={() => setTutorialsError(null)}>&times;</button>
              </div>
            )}

            {tutorialsLoading ? (
              <div className="help-loading-state">
                <div className="help-loading-spinner" />
                <p>Loading help tutorials & guides...</p>
              </div>
            ) : tutorials.length === 0 ? (
              <div className="help-empty-card-container">
                <div className="help-empty-state-card">
                  <div className="empty-icon-wrapper">
                    <FileText size={40} />
                  </div>
                  <h3>No Tutorials Found</h3>
                  <p>There are no tutorials or help guides available at this moment. Please check back later.</p>
                  <button className="btn-empty-create" onClick={fetchTutorials}>
                    Refresh Tutorials
                  </button>
                </div>
              </div>
            ) : (
              <div className="tutorials-grid">
                {tutorials.map((item, idx) => {
                  const title = item.title || item.name || "Help Guide";
                  const desc = item.description || item.desc || "Learn how to manage your seller account features.";
                  const mediaUrl = item.videoUrl || item.videoLink;
                  const docUrl = item.docUrl || item.url || "#";
                  const isVideo = item.type === "video" || !!mediaUrl;
                  const thumbnail = item.thumbnail || item.coverImage || "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=500&auto=format&fit=crop";

                  return (
                    <div key={item.id || item._id || idx} className="tutorial-card">
                      {isVideo ? (
                        <div className="tutorial-media-wrapper">
                          <img
                            src={thumbnail}
                            alt={title}
                            className="tutorial-video-thumbnail"
                            onError={(e) => {
                              e.target.src = "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=500&auto=format&fit=crop";
                            }}
                          />
                          <a
                            href={mediaUrl || docUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tutorial-video-play-btn"
                            title="Watch video tutorial"
                          >
                            <Video size={20} />
                          </a>
                        </div>
                      ) : (
                        <div className="tutorial-doc-wrapper">
                          <FileText size={40} />
                        </div>
                      )}
                      <div className="tutorial-card-body">
                        <h3 className="tutorial-card-title">{title}</h3>
                        <p className="tutorial-card-desc">{desc}</p>
                        <a
                          href={mediaUrl || docUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tutorial-card-btn"
                        >
                          {isVideo ? "Watch Tutorial" : "Read Article"}
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* CREATE TICKET MODAL */}
      {isCreateModalOpen && (
        <div className="help-modal-overlay" onClick={() => !submitting && setIsCreateModalOpen(false)}>
          <div className="help-ticket-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create a New Ticket</h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={submitting}
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="modal-error-alert">
                <AlertCircle size={14} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTicketSubmit} className="modal-form-body">
              <div className="form-grid-2-col">
                <div className="form-group-v2">
                  <label htmlFor="ticket-subject">Subject</label>
                  <input
                    id="ticket-subject"
                    type="text"
                    placeholder="e.g., Commission rate dispute on listing..."
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    disabled={submitting}
                    required
                  />
                </div>

                <div className="form-row-2-fields">
                  <div className="form-group-v2">
                    <label htmlFor="ticket-category">Category</label>
                    <select
                      id="ticket-category"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="Order">Order Support</option>
                      <option value="Settlements">Settlement / Payouts</option>
                      <option value="Listing">Product Listing</option>
                      <option value="Inventory">Inventory Management</option>
                      <option value="Technical">Technical Glitch</option>
                      <option value="General">General Inquiry</option>
                    </select>
                  </div>

                  <div className="form-group-v2">
                    <label htmlFor="ticket-priority">Priority</label>
                    <select
                      id="ticket-priority"
                      value={formPriority}
                      onChange={(e) => setFormPriority(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-group-v2 mt-4">
                <label htmlFor="ticket-description">Describe the issue</label>
                <textarea
                  id="ticket-description"
                  placeholder="Provide details about the issue. Include listing IDs, order IDs, or settlement dates for faster resolution."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={5}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="modal-actions-footer">
                <button
                  type="button"
                  className="btn-form-cancel"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-form-submit"
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {selectedTicket && (
        <div className="help-modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="help-ticket-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="details-header-title">
                <span className="ticket-id-badge">{selectedTicket.id}</span>
                <h3>Ticket Details</h3>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setSelectedTicket(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="details-modal-body">
              <div className="details-meta-grid">
                <div className="meta-item">
                  <span className="meta-label">Category</span>
                  <span className="meta-val">{selectedTicket.category}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Priority</span>
                  <span className={`meta-val priority-tag-inline ${selectedTicket.priority.toLowerCase()}`}>
                    {selectedTicket.priority}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Status</span>
                  <span className={`meta-val status-badge-inline ${selectedTicket.status.replace(" ", "-").toLowerCase()}`}>
                    {selectedTicket.status}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Submitted On</span>
                  <span className="meta-val">{formatDate(selectedTicket.createdDate)}</span>
                </div>
              </div>

              <div className="details-section mt-4">
                <h4>Subject</h4>
                <p className="details-subject-text">{selectedTicket.subject}</p>
              </div>

              <div className="details-section mt-4">
                <h4>Description</h4>
                <p className="details-desc-text">{selectedTicket.description}</p>
              </div>

              <div className="details-status-timeline mt-6">
                <h4>Ticket Timeline</h4>
                <div className="timeline-trail">
                  <div className="timeline-node active">
                    <div className="node-circle"><CheckCircle2 size={14} /></div>
                    <div className="node-info">
                      <p className="node-title">Ticket Registered</p>
                      <p className="node-time">{formatDate(selectedTicket.createdDate)}</p>
                    </div>
                  </div>
                  <div className={`timeline-node ${selectedTicket.status !== "Open" ? "active" : ""}`}>
                    <div className="node-circle"><Clock size={14} /></div>
                    <div className="node-info">
                      <p className="node-title">Under Investigation</p>
                      <p className="node-time">Assigning support agent...</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="ticket-detail-modal-footer">
              <button
                type="button"
                className="btn-close-view"
                onClick={() => setSelectedTicket(null)}
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpPage;