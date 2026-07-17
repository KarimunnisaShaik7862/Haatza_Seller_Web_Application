import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Bell, Check, Trash2, Clock, RefreshCw } from "lucide-react";
import { getSellerId } from "../../utils/sellerSession";
import { sellerService } from "../../services/sellerService";
import "./NotificationsPage.css";

const NotificationsPage = () => {
  const sellerId = getSellerId();
  const navigate = useNavigate();
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load notifications from API
  const loadNotifications = useCallback(async () => {
    if (!sellerId) {
      setError("Seller session not found. Please login again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await sellerService.getNotifications(sellerId);
      const rawNotif = response?.message?.data || response?.data || [];
      
      const mapped = rawNotif.map((n) => ({
        id: n._id || n.id || String(Math.random()),
        title: n.title || "Notification Alert",
        message: n.message || n.body || "",
        time: n.time || "Recently",
        read: Boolean(n.read || n.status === "read"),
        type: n.type || "system",
        createdAt: n.createdAt || n.createdDate || n.time || 0
      }));

      // Sort notifications descending by received date
      mapped.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeB - timeA;
      });

      setNotifications(mapped);
    } catch (err) {
      console.error("[NotificationsPage] Error loading alerts:", err);
      setError(err.message || "Failed to load notifications from the server.");
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Mark single as read
  const handleMarkRead = async (id) => {
    try {
      setError(null);
      await sellerService.markNotificationAsRead(sellerId, id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error("[NotificationsPage] Mark read failed:", err);
      setError("Failed to update notification status.");
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      setError(null);
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length > 0) {
        await sellerService.markAllNotificationsAsRead(sellerId, unreadIds);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error("[NotificationsPage] Mark all read failed:", err);
      setError("Failed to update all notifications.");
    }
  };

  // Delete single notification
  const handleDelete = async (id) => {
    try {
      setError(null);
      await sellerService.updateNotificationStatus(sellerId, id, "deleted");
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error("[NotificationsPage] Delete failed:", err);
      setError("Failed to delete notification.");
    }
  };

  // Clear all notifications
  const handleClearAll = async () => {
    try {
      setError(null);
      const allIds = notifications.map((n) => n.id);
      await Promise.all(
        allIds.map((id) => sellerService.updateNotificationStatus(sellerId, id, "deleted"))
      );
      setNotifications([]);
    } catch (err) {
      console.error("[NotificationsPage] Clear all failed:", err);
      setError("Failed to clear notifications.");
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="notifications-page-root">
      {/* White Header Top Bar */}
      <div className="notifications-header-bar">
        <button className="header-icon-btn back-btn" onClick={() => navigate(-1)} aria-label="Go Back">
          <ChevronLeft size={24} />
        </button>
        <h1 className="notifications-title">Notifications</h1>
        <div className="header-spacer" />
      </div>

      <div className="notifications-content-area">
        {/* Actions panel */}
        {notifications.length > 0 && !loading && (
          <div className="notifications-actions-panel">
            {unreadCount > 0 && (
              <button type="button" className="notif-btn secondary" onClick={handleMarkAllRead}>
                <Check size={14} />
                <span>Mark all read</span>
              </button>
            )}
            <button type="button" className="notif-btn danger" onClick={handleClearAll}>
              <Trash2 size={14} />
              <span>Clear All</span>
            </button>
          </div>
        )}

        {error && (
          <div className="notif-error-banner">
            <div className="error-message">
              <span>{error}</span>
              <button className="btn-retry" onClick={loadNotifications}>
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
            <button type="button" className="error-close" onClick={() => setError(null)}>&times;</button>
          </div>
        )}

        {loading ? (
          <div className="notif-loading-state">
            <div className="notif-loading-spinner" />
            <p>Fetching notifications from server...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notif-empty-state-v2">
            <p className="empty-state-text">No Notifications Found....!</p>
          </div>
        ) : (
          <div className="notif-list-container">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`notif-item-row-v2 ${n.read ? "read" : "unread"}`}
              >
                <div className="notif-item-left">
                  <div className={`notif-indicator-circle ${n.read ? "read" : "unread"}`}>
                    <Bell size={16} />
                  </div>
                </div>
                
                <div className="notif-item-middle">
                  <div className="notif-title-row">
                    <h4>{n.title}</h4>
                    {!n.read && <span className="unread-dot-indicator" />}
                  </div>
                  <p className="notif-message-text">{n.message}</p>
                  <div className="notif-time-row">
                    <Clock size={12} />
                    <span>{n.time}</span>
                  </div>
                </div>

                <div className="notif-item-right">
                  {!n.read && (
                    <button
                      type="button"
                      className="notif-action-btn check-btn"
                      title="Mark as read"
                      onClick={() => handleMarkRead(n.id)}
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="notif-action-btn delete-btn"
                    title="Delete notification"
                    onClick={() => handleDelete(n.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;