import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import dashboard1 from "../../assets/Images/dashboard1.png";
import dashboard2 from "../../assets/Images/dashboard2.png";
import dashboard3 from "../../assets/Images/dashboard3.png";
import {
  ShoppingBag,
  Wallet,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  List,
  FileEdit,
  Clock3,
  RotateCw,
  PackageCheck,
  PackageX,
  CheckCircle2,
  Clock,
  Play,
  X,
} from "lucide-react";
import { getSellerId } from "../../utils/sellerSession";
import { sellerService, fetchSellerOrders, IN_PROGRESS_STATUSES, walletService } from "../../services/sellerService";
import { useAuth } from "../../context/AuthContext";
import "./DashboardPage.css";

const TUTORIAL_VIDEOS = [
  {
    id: "XZKYAJTId6U",
    title: "How to List Products on Haatza | Step-by-Step Seller Guide",
    duration: "5:12",
    thumbnail: "https://img.youtube.com/vi/XZKYAJTId6U/mqdefault.jpg",
    url: "https://youtu.be/XZKYAJTId6U?si=Dm_24_Eiq9TRGUfQ",
    description: "Get registered and set up your shop on Haatza.",
  },
  {
    id: "a6tEKsom-dA",
    title: "Sell Smarter, Earn Faster 💡📲 | Haatza Seller App Launch",
    duration: "3:45",
    thumbnail: "https://img.youtube.com/vi/a6tEKsom-dA/mqdefault.jpg",
    url: "https://youtu.be/a6tEKsom-dA?si=PDoYAFwQJfIBq97R",
    description: "Learn to read views, orders, and listing charts.",
  },
  {
    id: "Wh-nXR7rxjs",
    title: "How Quality Insights Help You Sell Better on Haatza | Seller Growth Guide 🌟📊",
    duration: "6:20",
    thumbnail: "https://img.youtube.com/vi/Wh-nXR7rxjs/mqdefault.jpg",
    url: "https://youtu.be/Wh-nXR7rxjs?si=t89JErvmNTw-fFBD",
    description: "Step-by-step instructions to create listings.",
  },
  {
    id: "lBrLd0mHpss",
    title: "How Price Recommendation Works on Haatza | Smart Pricing Tips for Sellers 💡💰",
    duration: "4:15",
    thumbnail: "https://img.youtube.com/vi/lBrLd0mHpss/mqdefault.jpg",
    url: "https://youtu.be/lBrLd0mHpss?si=3nfWbOAjKqI6g3Sz",
    description: "Organize categories and subcategories.",
  },
  {
    id: "fRfJmeYmTH0",
    title: "How to Promote Your Products on Haatza | Boost Sales & Reach More Customers 🚀",
    duration: "5:50",
    thumbnail: "https://img.youtube.com/vi/fRfJmeYmTH0/mqdefault.jpg",
    url: "https://youtu.be/fRfJmeYmTH0?si=KDu-YCTUZ91QrpTU",
    description: "Fulfill orders, track shipments, and update status.",
  },
  {
    id: "wRJBS49wzz0",
    title: "How to Do Next Day Dispatch on Haatza | Fast Shipping Guide 🚀📦",
    duration: "4:30",
    thumbnail: "https://img.youtube.com/vi/wRJBS49wzz0/mqdefault.jpg",
    url: "https://youtu.be/wRJBS49wzz0?si=O14D4NZJSrOJGLYK",
    description: "Process customer returns and exchange requests.",
  },
  {
    id: "AiTuAr0ciGo",
    title: "How to Verify Orders & Ship Products on Haatza | Seller Step-by-Step Guide 🚚",
    duration: "3:25",
    thumbnail: "https://img.youtube.com/vi/AiTuAr0ciGo/mqdefault.jpg",
    url: "https://youtu.be/AiTuAr0ciGo?si=xirdBUD2yIMl5FvQ",
    description: "Optimize product performance with analytics.",
  },
  {
    id: "UZ_AUtlAMC0",
    title: "How to Receive Settlements on Haatza | Seller Payment Guide 💰",
    duration: "4:05",
    thumbnail: "https://img.youtube.com/vi/UZ_AUtlAMC0/mqdefault.jpg",
    url: "https://youtu.be/UZ_AUtlAMC0?si=0igH3Hhu3nyL2xCt",
    description: "Manage warehouse location and inventory.",
  },
  {
    id: "dpaOFunbGW4",
    title: "Best Tools for Online Sellers to Grow Their Business",
    duration: "5:00",
    thumbnail: "https://img.youtube.com/vi/dpaOFunbGW4/mqdefault.jpg",
    url: "https://youtu.be/dpaOFunbGW4?si=yHHx2BC0l4Vi7IkD",
    description: "Branding checklist to collaborate with influencers.",
  },
];



const INR = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const formatDateForApi = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
// Mirrors MyListings.js's own pagination loop
// Mirrors MyListings.js's own pagination loop
const fetchAllSellerListings = async (email) => {
  const first = await sellerService.fetchSellerListings({ email, page: 1, limit: 100 });
  let all = [...first.products];
  if (first.totalPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: first.totalPages - 1 }, (_, i) =>
        sellerService.fetchSellerListings({ email, page: i + 2, limit: 100 })
      )
    );
    rest.forEach((r) => { all = all.concat(r.products); });
  }
  return all;
};

// Mirrors InProgressListings.js's own pagination loop
const fetchAllInProgressListings = async (email) => {
  const first = await sellerService.fetchInProgressListings({ email, page: 1, limit: 100 });
  let all = [...first.products];
  if (first.totalPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: first.totalPages - 1 }, (_, i) =>
        sellerService.fetchInProgressListings({ email, page: i + 2, limit: 100 })
      )
    );
    rest.forEach((r) => { all = all.concat(r.products); });
  }
  return all;
};

// Fetches every page of seller inventory and flattens variants into rows
// so dashboard counts match InventoryPage's per-variant In Stock / Out of
// Stock logic. Previously this read `products` instead of the real
// `inventoryItems` field, and only fetched page 1.
const fetchAllSellerInventory = async (sellerId) => {
  const extractInventoryPage = (response) => {
    const body = response?.message?.body ?? response?.data ?? response ?? {};
    const items = body.inventoryItems || response?.inventoryItems || [];
    const totalPages = Number(body.totalPages || response?.totalPages || 1);
    return { items, totalPages };
  };

  const first = await sellerService.getSellerProductInventory({ sellerId, page: 1, searchText: "" });
  const { items: firstItems, totalPages } = extractInventoryPage(first);
  let allItems = [...firstItems];

  if (totalPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        sellerService.getSellerProductInventory({ sellerId, page: i + 2, searchText: "" })
      )
    );
    rest.forEach((r) => {
      allItems = allItems.concat(extractInventoryPage(r).items);
    });
  }

  const rows = [];
  allItems.forEach((item) => {
    const variants = item.variants || [];
    if (variants.length === 0) {
      const qty = Number(item.stock?.quantity ?? item.quantity ?? item.stock ?? 0);
      rows.push({ qty });
    } else {
      variants.forEach((variant) => {
        const qty = Number(variant.stock?.quantity ?? variant.quantity ?? 0);
        rows.push({ qty });
      });
    }
  });

  return rows;
};

// Fetches every settlement payment for the seller across all history, not
// just the most recent 50. The backend requires fromDate/toDate to return
// results (blank dates return nothing), so we send a wide range covering
// account lifetime through today, and page using lastFetched until a
// short batch signals no more data.
const fetchAllSellerPayments = async (email) => {
  const fromStr = "2000-01-01";
  const toStr = formatDateForApi(new Date());
  const count = 100;
  let lastFetched = 0;
  let all = [];

  for (let i = 0; i < 50; i++) { // safety cap against infinite loops
    const res = await sellerService.getSellerPayments({
      email,
      fromDate: fromStr,
      toDate: toStr,
      count,
      lastFetched,
    });
    const payBody =
      res?.message?.payments ||
      res?.message?.body?.payments ||
      res?.message?.body ||
      res?.message?.data ||
      res?.data ||
      res ||
      [];
    const batch = Array.isArray(payBody) ? payBody : [];
    all = all.concat(batch);
    if (batch.length < count) break;
    lastFetched += batch.length;
  }

  return all;
};
// ─── Reusable donut chart (pure SVG, no chart library needed) ─────────────
const Donut = ({ data, size = 170, thickness = 14, radius = 42, centerValue, centerLabel }) => {
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0) || 1;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <g transform="rotate(-90 50 50)">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#f1f3f6" strokeWidth={thickness} />
          {data.map((d, i) => {
            const value = Number(d.value) || 0;
            const fraction = value / total;
            const dash = fraction * circumference;
            const gap = circumference - dash;
            const offset = -((cumulative / total) * circumference);
            cumulative += value;
            if (value <= 0) return null;
            return (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </g>
      </svg>
      <div className="donut-center">
        <span className="donut-center-value">{centerValue}</span>
        <span className="donut-center-label">{centerLabel}</span>
      </div>
    </div>
  );
};

const Legend = ({ data, total }) => (
  <div className="donut-legend">
    {data.map((d, i) => (
      <div className="legend-row" key={i}>
        <span className="legend-dot" style={{ backgroundColor: d.color }} />
        <span className="legend-label">{d.label}</span>
        <span className="legend-value">{d.value}</span>
      </div>
    ))}
  </div>
);

// Builds a 6-month trend of return+exchange request counts, mirroring the
// same monthly-bucket approach used for the settlements mountain chart.
const buildReturnsMonthlyTrend = (rows) => {
  const now = new Date();
  const monthSlots = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthSlots.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: `${d.toLocaleString("en-US", { month: "short" })} '${String(d.getFullYear()).slice(-2)}`,
    });
  }
  const monthlyMap = {};
  monthSlots.forEach((mk) => { monthlyMap[mk.key] = 0; });

  rows.forEach((item) => {
    const rawDate =
      item.date || item.createdDate || item.createdAt ||
      item.requestDate || item.orderDate || item.returnDate || null;
    const d = new Date(rawDate || Date.now());
    if (isNaN(d)) return;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (monthlyMap[key] === undefined) return;
    monthlyMap[key] += 1;
  });

  return monthSlots.map((mk) => ({ month: mk.label, amount: monthlyMap[mk.key] }));
};

const colorMap = {
  indigo: { fill: "#4f46e5", lineStart: "#6366f1", lineEnd: "#4338ca" },
  teal: { fill: "#0d9488", lineStart: "#2dd4bf", lineEnd: "#0f766e" },
  blue: { fill: "#2563eb", lineStart: "#3b82f6", lineEnd: "#1d4ed8" },
};

// Unique smooth "mountain" trend chart for settlement revenue — curved
// area/line built with cubic-bezier smoothing (not straight segments),
// full Y-axis amount gridlines on the left, X-axis month labels below,
// and the exact amount called out above each peak.
const MountainChart = ({ data, height = 220, valueFormatter = INR, color = "indigo" }) => {
  if (!data || data.length === 0) return null;

  const viewW = 440;
  const viewH = 220;
  // Dynamically set padLeft to ensure currency labels are not clipped
  const padLeft = valueFormatter === INR ? 70 : 55;
  const padRight = 16;
  const padTop = 30;
  const padBottom = 10;
  const plotW = viewW - padLeft - padRight;
  const plotH = viewH - padTop - padBottom;

  const rawMax = Math.max(...data.map((d) => d.amount), 1);
  const niceMax = (() => {
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax || 1)));
    const step = magnitude / 2 || 1;
    return Math.ceil((rawMax || 1) / step) * step || 1;
  })();

  const gridLines = (() => {
    if (niceMax <= 4) {
      return Array.from({ length: niceMax + 1 }, (_, i) => {
        const val = niceMax - i;
        const f = val / niceMax;
        return {
          value: val,
          y: padTop + plotH * (1 - f),
        };
      });
    } else {
      return [1, 0.75, 0.5, 0.25, 0].map((f) => ({
        value: Math.round(niceMax * f),
        y: padTop + plotH * (1 - f),
      }));
    }
  })();

  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padLeft + (data.length === 1 ? plotW / 2 : i * stepX);
    const y = padTop + plotH * (1 - (d.amount / niceMax || 0));
    return { x, y, amount: d.amount, month: d.month };
  });

  // Smooth curve through points via Catmull-Rom → cubic Bezier conversion,
  // giving a true rolling "mountain" silhouette instead of straight joins.
  const buildSmoothPath = (pts) => {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d;
  };

  const baseY = padTop + plotH;
  const linePath = points.length > 1
    ? buildSmoothPath(points)
    : `M ${points[0].x - 14} ${points[0].y} L ${points[0].x + 14} ${points[0].y}`;

  const areaPath =
    points.length === 1
      ? `M ${points[0].x - 14} ${baseY} L ${points[0].x - 14} ${points[0].y} L ${points[0].x + 14} ${points[0].y} L ${points[0].x + 14} ${baseY} Z`
      : `${linePath} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`;

  return (
    <div className="mountain-chart-root">
      <svg viewBox={`0 0 ${viewW} ${viewH}`} width="100%" height={height} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`mountainFill-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorMap[color].fill} stopOpacity="0.32" />
            <stop offset="100%" stopColor={colorMap[color].fill} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`mountainLine-${color}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={colorMap[color].lineStart} />
            <stop offset="100%" stopColor={colorMap[color].lineEnd} />
          </linearGradient>
        </defs>

        {/* Y-axis gridlines + amount labels */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={padLeft} y1={g.y} x2={viewW - padRight} y2={g.y} stroke="#eef1f5" strokeWidth="1" />
            <text x={padLeft - 10} y={g.y + 4} textAnchor="end" className="chart-axis-text" fill="#9ca3af">
              {g.value}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#mountainFill-${color})`} stroke="none" />
        <path d={linePath} fill="none" stroke={`url(#mountainLine-${color})`} strokeWidth="3" strokeLinecap="round" />

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="#ffffff" stroke={colorMap[color].lineEnd} strokeWidth="2.5" />
            <text x={p.x} y={p.y - 12} textAnchor="middle" className="chart-value-text" fontWeight="700" fill={colorMap[color].lineEnd}>
              {valueFormatter(p.amount)}
            </text>
          </g>
        ))}
      </svg>

      {/* X-axis month labels */}
      <div
        className="mountain-chart-xaxis"
        style={{
          justifyContent: points.length === 1 ? "center" : "space-between",
          paddingLeft: `${(padLeft / viewW) * 100}%`,
          paddingRight: `${(padRight / viewW) * 100}%`,
        }}
      >
        {points.map((p, i) => {
          const parts = p.month.split(" ");
          return (
            <span key={i} className="mountain-chart-month">
              <span className="month-short">{parts[0]}</span>
              {parts[1] && <span className="month-year"> {parts[1]}</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// Simple vertical bar chart with gridlines + value labels, matching the
// same visual language as MountainChart (gridlines, axis labels, colors).
const SimpleBarChart = ({ data, height = 220, colors = [] }) => {
  if (!data || data.length === 0) return null;

  const viewW = 440;
  const viewH = 220;
  const padLeft = 55;
  const padRight = 16;
  const padTop = 30;
  const padBottom = 34;
  const plotW = viewW - padLeft - padRight;
  const plotH = viewH - padTop - padBottom;

  const rawMax = Math.max(...data.map((d) => d.value), 1);
  const niceMax = (() => {
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax || 1)));
    const step = magnitude / 2 || 1;
    return Math.ceil((rawMax || 1) / step) * step || 1;
  })();

  const gridLines = (() => {
    if (niceMax <= 4) {
      return Array.from({ length: niceMax + 1 }, (_, i) => {
        const val = niceMax - i;
        const f = val / niceMax;
        return {
          value: val,
          y: padTop + plotH * (1 - f),
        };
      });
    } else {
      return [1, 0.75, 0.5, 0.25, 0].map((f) => ({
        value: Math.round(niceMax * f),
        y: padTop + plotH * (1 - f),
      }));
    }
  })();

  const gap = 0.6; // fraction of slot width used as spacing between bars
  const slotW = plotW / data.length;
  const maxBarW = 70; // cap so bars stay slim even with few categories
  const barW = Math.min(slotW * (1 - gap), maxBarW);

  const bars = data.map((d, i) => {
    const barH = plotH * ((d.value || 0) / niceMax);
    const x = padLeft + i * slotW + (slotW - barW) / 2;
    const y = padTop + plotH - barH;
    return { ...d, x, y, w: barW, h: barH, centerX: x + barW / 2 };
  });

  return (
    <div className="mountain-chart-root">
      <svg viewBox={`0 0 ${viewW} ${viewH}`} width="100%" height={height} style={{ overflow: "visible" }}>
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={padLeft} y1={g.y} x2={viewW - padRight} y2={g.y} stroke="#eef1f5" strokeWidth="1" />
            <text x={padLeft - 10} y={g.y + 4} textAnchor="end" className="chart-axis-text" fill="#9ca3af">
              {g.value}
            </text>
          </g>
        ))}

        {bars.map((b, i) => (
          <g key={i}>
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={Math.max(b.h, 2)}
              rx="6"
              fill={colors[i] || "#3b82f6"}
            />
            <text x={b.centerX} y={b.y - 10} textAnchor="middle" className="chart-value-text" fontWeight="700" fill="#111827">
              {b.value}
            </text>
            <text
              x={b.centerX}
              y={padTop + plotH + 20}
              textAnchor="middle"
              className="chart-axis-text"
              fontWeight="600"
              fill="#9ca3af"
            >
              {b.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};
const BANNER_IMAGES = [dashboard1, dashboard2, dashboard3];
const DashboardPage = () => {
  const { user } = useAuth();
  const sellerId = getSellerId();
  const sellerEmail =
    user?.email || localStorage.getItem("userEmail") || sessionStorage.getItem("userEmail") || "";
  const navigate = useNavigate();

  // Welcome Reward Scratch Card States
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [scratchComplete, setScratchComplete] = useState(false);
  const [isScratchingStarted, setIsScratchingStarted] = useState(false);
  const [claimPressed, setClaimPressed] = useState(false);

  const [flyingCoins, setFlyingCoins] = useState([]);
  const [particles, setParticles] = useState([]);
  const [scratchSparks, setScratchSparks] = useState([]);
  const [flyingStars, setFlyingStars] = useState([]);
  const [floatingCash, setFloatingCash] = useState({ x: 0, y: 0, active: false });

  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const claimLockRef = useRef(false);

  // Play Synthesized Sounds using Web Audio API to bypass asset file loading
  const playSynthesizedSound = (type) => {
    return; // Audio completely disabled
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      if (type === "scratch") {
        const bufferSize = ctx.sampleRate * 0.05;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1000;
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
      } else if (type === "success") {
        const notes = [261.63, 329.63, 392.00, 523.25]; // C major chord arpeggio
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          
          const startTime = ctx.currentTime + i * 0.12;
          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(0.12, startTime + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.35);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(startTime);
          osc.stop(startTime + 0.4);
        });
      } else if (type === "coin") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(987.77, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      }
    } catch (e) {
      console.warn("Audio failed to synthesize:", e);
    }
  };

  useEffect(() => {
    // Show only for newly registered users who just landed from onboarding
    const justOnboarded = localStorage.getItem("__haatza_just_onboarded") === "true";
    const isClaimed = user?.welcomeRewardClaimed || false;
    if (justOnboarded && !isClaimed) {
      setShowWelcomeModal(true);
    }
  }, [user]);

  // Init canvas once welcome modal opens
  useEffect(() => {
    if (!showWelcomeModal) return;
    
    setIsCanvasReady(false);
    setScratchComplete(false);
    setIsScratchingStarted(false);
    setClaimPressed(false);
    setScratchSparks([]);
    setFlyingStars([]);

    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width || 320;
      canvas.height = rect.height || 200;
      
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Paint metallic silver gradient
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, "#e2e8f0");
      grad.addColorStop(0.15, "#f8fafc");
      grad.addColorStop(0.3, "#cbd5e1");
      grad.addColorStop(0.45, "#f1f5f9");
      grad.addColorStop(0.6, "#cbd5e1");
      grad.addColorStop(0.75, "#94a3b8");
      grad.addColorStop(1, "#cbd5e1");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add fine metallic noise
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 16;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
        data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
      }
      ctx.putImageData(imgData, 0, 0);
      
      // Add glitter sparkles
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      for (let i = 0; i < 45; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 2 + 1;
        ctx.fillRect(x, y, size, size);
      }
      
      // Elegant cover text details
      ctx.font = "bold 16px 'Plus Jakarta Sans', 'Poppins', sans-serif";
      ctx.fillStyle = "#475569";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("HAATZA REWARD 🌟", canvas.width / 2, canvas.height / 2 - 12);
      
      ctx.font = "600 11px 'Plus Jakarta Sans', sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("Scratch to reveal cashback", canvas.width / 2, canvas.height / 2 + 12);
      
      setIsCanvasReady(true);
    }, 150);

    return () => clearTimeout(timer);
  }, [showWelcomeModal]);

  // Programmatically attach touch listeners with { passive: false } to support smooth scratch drag on mobile
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e) => {
      isDrawingRef.current = true;
      const pos = getMousePos(e);
      scratch(pos.x, pos.y, e);
    };

    const onTouchMove = (e) => {
      if (!isDrawingRef.current) return;
      if (e.cancelable) e.preventDefault();
      const pos = getMousePos(e);
      scratch(pos.x, pos.y, e);
    };

    const onTouchEnd = () => {
      isDrawingRef.current = false;
      checkScratchPercentage();
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [showWelcomeModal]);

  // Particles Tick Loop (Confetti)
  useEffect(() => {
    if (particles.length === 0) return;
    let active = true;
    const tick = () => {
      if (!active) return;
      setParticles(prev => {
        const next = prev.map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.6,
          rotation: p.rotation + p.rotationSpeed,
          opacity: Math.max(0, p.opacity - 0.015)
        })).filter(p => p.opacity > 0 && p.y < window.innerHeight);
        
        if (next.length > 0) {
          requestAnimationFrame(tick);
        }
        return next;
      });
    };
    requestAnimationFrame(tick);
    return () => { active = false; };
  }, [particles.length]);

  // Stars claims flight particles loop
  useEffect(() => {
    if (flyingStars.length === 0) return;
    let active = true;
    const tick = () => {
      if (!active) return;
      setFlyingStars(prev => {
        const next = prev.map(s => {
          const dx = s.targetX - s.x;
          const dy = s.targetY - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 18) {
            triggerWalletBounce();
            playSynthesizedSound("coin");
            return null; // reached target
          }
          
          const pullX = dx / dist;
          const pullY = dy / dist;
          
          const nextVx = s.vx * 0.88 + pullX * 2.5;
          const nextVy = s.vy * 0.88 + pullY * 2.5;
          
          return {
            ...s,
            x: s.x + nextVx,
            y: s.y + nextVy,
            vx: nextVx,
            vy: nextVy,
            opacity: Math.max(0.1, s.opacity - 0.003)
          };
        }).filter(Boolean);
        
        if (next.length > 0) {
          requestAnimationFrame(tick);
        } else {
          finalizeClaim();
        }
        return next;
      });
    };
    requestAnimationFrame(tick);
    return () => { active = false; };
  }, [flyingStars.length]);

  const triggerCelebration = () => {
    // Generate Gold, Silver, Blue, and Purple confetti
    const colors = ["#FFD700", "#C0C0C0", "#2563EB", "#8B5CF6"];
    const newParticles = Array.from({ length: 65 }).map((_, i) => ({
      id: i,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2 - 80,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.7) * 20,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 12 + 6,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
      type: Math.random() > 0.5 ? "star" : "circle"
    }));
    setParticles(newParticles);
    playSynthesizedSound("success");
  };

  const triggerFlyingCoins = () => {
    const target = getWalletCoordinates();
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight / 2;
    
    const coins = Array.from({ length: 8 }).map((_, i) => ({
      id: `coin-${i}`,
      startX,
      startY,
      targetX: target.x,
      targetY: target.y,
      delay: i * 150
    }));
    setFlyingCoins(coins);
    
    setTimeout(() => {
      setFlyingCoins([]);
    }, 2500);
  };

  const getWalletCoordinates = () => {
    const navBtn = document.getElementById("navbar-wallet-btn");
    if (navBtn) {
      const rect = navBtn.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    const sidebarBtn = document.getElementById("sidebar-menu-wallet");
    if (sidebarBtn) {
      const rect = sidebarBtn.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return { x: 50, y: window.innerHeight - 150 };
  };

  const triggerWalletBounce = () => {
    const el = document.getElementById("navbar-wallet-btn") || document.getElementById("sidebar-menu-wallet");
    if (el) {
      el.classList.add("wallet-glow-pulse");
      setTimeout(() => el.classList.remove("wallet-glow-pulse"), 800);
    }
  };

  const checkScratchPercentage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    let transparent = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) {
        transparent++;
      }
    }
    const percent = (transparent / (pixels.length / 4)) * 100;
    
    // Auto reveal at 60% scratched area
    if (percent > 60 && !scratchComplete) {
      setScratchComplete(true);
      triggerCelebration();
    }
  };

  const startStarFlight = () => {
    if (claimPressed) return;
    setClaimPressed(true);

    const target = getWalletCoordinates();
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight / 2;
    
    const newStars = Array.from({ length: 45 }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const burstSpeed = Math.random() * 7 + 4;
      return {
        id: `claim-star-${i}`,
        x: startX,
        y: startY,
        vx: Math.cos(angle) * burstSpeed,
        vy: Math.sin(angle) * burstSpeed,
        targetX: target.x,
        targetY: target.y,
        delay: Math.random() * 150,
        opacity: 1,
        size: Math.random() * 8 + 6
      };
    });
    setFlyingStars(newStars);
  };

  const finalizeClaim = async () => {
    const target = getWalletCoordinates();
    setFloatingCash({ x: target.x, y: target.y - 20, active: true });
    
    setTimeout(() => {
      setFloatingCash({ x: 0, y: 0, active: false });
    }, 2000);
    
    await revealRewardAndCredit();
    setShowWelcomeModal(false);
  };

  const revealRewardAndCredit = async () => {
    if (claimLockRef.current) return;
    claimLockRef.current = true;

    try {
      await sellerService.updateSellerOnboarding(sellerEmail, { welcomeRewardClaimed: true });
      await walletService.addFunds({
        sellerId,
        amountAdded: 500,
        paymentId: `WELCOME_REWARD_${sellerId}`,
        razorpayOrderId: "WELCOME",
        description: "New Seller Reward"
      });

      if (user) {
        user.welcomeRewardClaimed = true;
      }
      localStorage.removeItem("__haatza_just_onboarded");

      setTimeout(async () => {
        try {
          const walletRes = await sellerService.checkWalletBalance(sellerId);
          const bal = Number(walletRes?.message?.RemainingBalance || walletRes?.RemainingBalance || 0);
          setWallet(bal);
        } catch {}
      }, 1000);

    } catch (err) {
      console.error("[DashboardPage] Welcome Reward Claim Error:", err);
    }
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handleStart = (e) => {
    isDrawingRef.current = true;
    const pos = getMousePos(e);
    scratch(pos.x, pos.y, e);
  };

  const handleMove = (e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const pos = getMousePos(e);
    scratch(pos.x, pos.y, e);
  };

  const handleEnd = () => {
    isDrawingRef.current = false;
    checkScratchPercentage();
  };

  const scratch = (x, y, e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    setIsScratchingStarted(true);

    playSynthesizedSound("scratch");

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const sparks = Array.from({ length: 3 }).map((_, idx) => ({
      id: Math.random() + idx,
      x: clientX,
      y: clientY,
      size: Math.random() * 4 + 2,
      tx: `${(Math.random() - 0.5) * 80}px`,
      ty: `${(Math.random() - 0.5) * 80}px`,
      color: ["#e2e8f0", "#cbd5e1", "#94a3b8", "#f8fafc"][Math.floor(Math.random() * 4)]
    }));
    setScratchSparks(prev => [...prev, ...sparks].slice(-60));
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quoteIdx, setQuoteIdx] = useState(0);

  const [orders, setOrders] = useState({ total: 0, cancelled: 0, confirmed: 0, shipped: 0 });
  const [returns, setReturns] = useState({ total: 0, returnReq: 0, exchangeReq: 0, monthly: [] });
  const [listings, setListings] = useState({ myListings: 0, draft: 0, underReview: 0, updateRequested: 0, total: 0 });
  const [inventory, setInventory] = useState({ inStock: 0, outOfStock: 0, total: 0 });
  const [wallet, setWallet] = useState(0);
  const [settlements, setSettlements] = useState({
  totalRevenue: 0,
  monthly: [],
  previous: { count: 0, amount: 0 },
  upcoming: { count: 0, amount: 0 },
});
  const [tutorials, setTutorials] = useState(TUTORIAL_VIDEOS);

  const videoScrollRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchActive, setIsTouchActive] = useState(false);
  const touchTimeoutRef = useRef(null);

  // Measure and wrap scroll position seamlessly to create an infinite loop
  const handleScroll = useCallback(() => {
    const el = videoScrollRef.current;
    if (!el || tutorials.length === 0) return;
    const N = tutorials.length;
    if (el.children.length < N * 3) return;

    const card1 = el.children[0];
    const cardN = el.children[N];
    if (!card1 || !cardN) return;

    const dist = cardN.offsetLeft - card1.offsetLeft;

    if (el.scrollLeft >= dist * 2) {
      el.scrollLeft -= dist;
    } else if (el.scrollLeft < dist) {
      el.scrollLeft += dist;
    }
  }, [tutorials]);

  // Listen to scroll events on the carousel container to handle wrapping
  useEffect(() => {
    const el = videoScrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll, loading]);

  // Center the scroll position within the middle set of cards initially
  useEffect(() => {
    const el = videoScrollRef.current;
    if (!el || tutorials.length === 0) return;
    const N = tutorials.length;

    const initScroll = () => {
      if (el.children.length >= N * 3) {
        const card1 = el.children[0];
        const cardN = el.children[N];
        if (card1 && cardN) {
          const dist = cardN.offsetLeft - card1.offsetLeft;
          el.scrollLeft = dist;
        }
      }
    };

    const timer = setTimeout(initScroll, 100);
    return () => clearTimeout(timer);
  }, [tutorials, loading]);

  // Touch event handlers for mobile to pause scrolling during manual swiping
  const handleTouchStart = () => {
    setIsTouchActive(true);
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
      touchTimeoutRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
    }
    // Resume auto scroll after a short delay to let inertia/momentum settle
    touchTimeoutRef.current = setTimeout(() => {
      setIsTouchActive(false);
      touchTimeoutRef.current = null;
    }, 1500);
  };

  // Clean up touch timeout on unmount to prevent state updates on unmounted components
  useEffect(() => {
    return () => {
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
      }
    };
  }, []);

  // ── Auto horizontal scrolling carousel for video tutorials ──────────────────
  useEffect(() => {
    const el = videoScrollRef.current;
    if (!el || isHovered || isTouchActive || tutorials.length === 0) return;

    let animationFrameId;
    let lastTime = performance.now();
    const speed = 0.04; // speed in pixels per millisecond (about 40px per second)

    const step = (time) => {
      const delta = time - lastTime;
      lastTime = time;

      if (!isHovered && !isTouchActive && el) {
        el.scrollLeft += speed * delta;
      }
      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isHovered, isTouchActive, tutorials, loading]);

  useEffect(() => {
  const t = setInterval(() => setQuoteIdx((i) => (i + 1) % BANNER_IMAGES.length), 5000);
  return () => clearInterval(t);
}, []);

  const loadDashboardData = useCallback(async (isSilent = false) => {
    if (!sellerId || !sellerEmail) {
      setError("Seller session not found. Please login again.");
      if (!isSilent) {
        setLoading(false);
      }
      return;
    }

    if (!isSilent) {
      setLoading(true);
      setError(null);
    }

    try {
      const results = await Promise.allSettled([
  fetchSellerOrders(sellerId, undefined, undefined, 1, 1000),
  sellerService.getSellerConfirmedOrdersCount(sellerId),
  sellerService.fetchReturns(sellerId),
  fetchAllSellerListings(sellerEmail),
  fetchAllInProgressListings(sellerEmail),
  fetchAllSellerInventory(sellerId),
  sellerService.checkWalletBalance(sellerId),
  fetchAllSellerPayments(sellerEmail),
  sellerService.getSellerTutorials(),
]);

// TEMP DIAGNOSTIC — remove once fixed
const labels = ["newOrders","confirmedCount","returns","myListings","inProgress","inventory","wallet","payments","tutorials"];
results.forEach((r, i) => {
  if (r.status === "rejected") {
    console.error(`[DASHBOARD DEBUG] ${labels[i]} REJECTED:`, r.reason?.message, r.reason?.response?.status, r.reason?.response?.data);
  } else {
    console.log(`[DASHBOARD DEBUG] ${labels[i]} OK:`, JSON.stringify(r.value, null, 2));
  }
});
console.log("[DASHBOARD DEBUG] sellerId:", sellerId, "sellerEmail:", sellerEmail);
      // ── Orders Overview ─────────────────────────────────────────────
      const rawOrders =
  results[0].status === "fulfilled"
    ? results[0].value?.message?.results ||
      results[0].value?.items ||
      results[0].value?.orders ||
      results[0].value?.data ||
      []
    : [];
      const ordersArr = Array.isArray(rawOrders) ? rawOrders : [];
      const statusOf = (o) => String(o.status || o.orderStatus || "");
      const CONFIRMED_STATUSES = ["Order Placed", "Order Confirmed"];
      const SHIPPED_STATUSES = ["Shipped"];
      const CANCELLED_STATUSES = ["Order Cancelled"];

      setOrders({
        total: ordersArr.length,
        cancelled: ordersArr.filter((o) => CANCELLED_STATUSES.includes(statusOf(o))).length,
        confirmed: ordersArr.filter((o) => CONFIRMED_STATUSES.includes(statusOf(o))).length,
        shipped: ordersArr.filter((o) => SHIPPED_STATUSES.includes(statusOf(o))).length,
      });

      // ── Returns / Exchanges ─────────────────────────────────────────
      // ── Returns / Exchanges ─────────────────────────────────────────
      if (results[2].status === "fulfilled") {
        const body = results[2].value?.message?.data || results[2].value?.data || [];
        const rows = Array.isArray(body) ? body : [];
        let returnReq = 0;
        let exchangeReq = 0;
        rows.forEach((item) => {
          const status = (item.status || "").toLowerCase();
          if (status.includes("exchange") || status.includes("shipped")) {
            exchangeReq++;
          } else if (!status.includes("claim") && !status.includes("payout") && !status.includes("reimburse")) {
            returnReq++;
          }
        });
        setReturns({ total: rows.length, returnReq, exchangeReq, monthly: buildReturnsMonthlyTrend(rows) });
      }

      // ── Product Listings ────────────────────────────────────────────
     // ── Product Listings ────────────────────────────────────────────
      const myListingsAll = results[3].status === "fulfilled" ? results[3].value || [] : [];
      const inProgressAll = results[4].status === "fulfilled" ? results[4].value || [] : [];

      // Same filter as MyListings.js
      const myListingsCount = myListingsAll.filter(
        (p) => (p.status || "").toLowerCase() === "approved"
      ).length;
      const draft = myListingsAll.filter(
        (p) => (p.status || "").toLowerCase() === "draft"
      ).length;

      // Same filter as InProgressListings.js
      const inProgressVisible = inProgressAll.filter((p) => {
        const s = (p.status || "").toLowerCase();
        return (s === "under review" || s === "update requested") && !p.productId;
      });
      const underReview = inProgressVisible.filter(
        (p) => (p.status || "").toLowerCase() === "under review"
      ).length;
      const updateRequested = inProgressVisible.filter(
        (p) => (p.status || "").toLowerCase() === "update requested"
      ).length;

      setListings({
        myListings: myListingsCount,
        draft,
        underReview,
        updateRequested,
        total: myListingsCount + draft + underReview + updateRequested,
      });

      // ── Inventory Status ────────────────────────────────────────────
      // ── Inventory Status ────────────────────────────────────────────
      if (results[5].status === "fulfilled") {
        const invRows = results[5].value || [];
        const inStock = invRows.filter((r) => r.qty > 0).length;
        const outOfStock = invRows.filter((r) => r.qty <= 0).length;
        setInventory({ inStock, outOfStock, total: invRows.length });
      }

      // ── Wallet ───────────────────────────────────────────────────────
      if (results[6].status === "fulfilled") {
        setWallet(Number(results[6].value?.message?.RemainingBalance || results[6].value?.RemainingBalance || 0));
      }

     // ── Settlements (built from payment history) ────────────────────
      // fetchAllSellerPayments already returns the flat, all-time payment
      // array. Each item nests real fields under `payoutDetails`, and the
      // amount field is `totalAmount` (SettlementsPage's own field names) —
      // not a flat `p.amount`.
      // ── Settlements (built from payment history) ────────────────────
      // fetchAllSellerPayments already returns the flat, all-time payment
      // array. Each item nests real fields under `payoutDetails`, and the
      // amount field is `totalAmount` (SettlementsPage's own field names) —
      // not a flat `p.amount`. Status values mirror SettlementsPage too:
      // "Paid" = previous/completed settlement, "Upcoming Payment" = upcoming.
      if (results[7].status === "fulfilled") {
        const rawPayments = results[7].value || [];

        const getPayoutDetails = (item) => item?.payoutDetails || item || {};
        const getAmount = (item) => {
          const payout = getPayoutDetails(item);
          return Number(payout.totalAmount ?? payout.amount ?? payout.settlementAmount ?? 0);
        };
        const getDate = (item) => {
          const payout = getPayoutDetails(item);
          return payout.paymentDate || payout.paidDate || payout.settlementDate || payout.createdAt || null;
        };
        const getStatus = (item) => String(getPayoutDetails(item).status || "").trim().toLowerCase();
        const isPaid = (item) => getStatus(item) === "paid";
        const isUpcoming = (item) => getStatus(item) === "upcoming payment";

        // Always plot the last 6 calendar months (even ones with zero
        // settlements) so the trend chart has a real multi-point shape
        // instead of a single floating bar when there's sparse data.
        const now = new Date();
        const monthSlots = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthSlots.push({
            key: `${d.getFullYear()}-${d.getMonth()}`,
            label: `${d.toLocaleString("en-US", { month: "short" })} '${String(d.getFullYear()).slice(-2)}`,
          });
        }
        const monthlyMap = {};
        monthSlots.forEach((mk) => { monthlyMap[mk.key] = 0; });
        rawPayments.forEach((p) => {
          const d = new Date(getDate(p) || Date.now());
          if (isNaN(d)) return;
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          if (monthlyMap[key] === undefined) return; // outside the 6-month window
          monthlyMap[key] += getAmount(p);
        });
        const monthly = monthSlots.map((mk) => ({ month: mk.label, amount: monthlyMap[mk.key] }));

        const paidRows = rawPayments.filter(isPaid);
        const upcomingRows = rawPayments.filter(isUpcoming);

        setSettlements({
          totalRevenue: rawPayments.reduce((s, p) => s + getAmount(p), 0),
          monthly,
          previous: {
            count: paidRows.length,
            amount: paidRows.reduce((s, p) => s + getAmount(p), 0),
          },
          upcoming: {
            count: upcomingRows.length,
            amount: upcomingRows.reduce((s, p) => s + getAmount(p), 0),
          },
        });
      }
      // ── Tutorial videos ──────────────────────────────────────────────
      setTutorials(TUTORIAL_VIDEOS);
    } catch (err) {
      console.error("[DashboardPage] Fetch data failed:", err);
      if (!isSilent) {
        setError("Failed to load dashboard statistics. Please verify your connection.");
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [sellerId, sellerEmail]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (!sellerId || !sellerEmail) return;
    const interval = setInterval(() => {
      loadDashboardData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [sellerId, sellerEmail, loadDashboardData]);



  if (loading) {
    return (
      <div className="dashboard-loading-container">
        <div className="dashboard-loading-spinner" />
        <p>Loading dashboard metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error-container">
        <div className="dashboard-error-card">
          <AlertCircle size={40} className="error-icon" />
          <h3>Unable to Load Dashboard</h3>
          <p>{error}</p>
          <button className="btn-retry" onClick={loadDashboardData}>
            <RefreshCw size={14} />
            <span>Retry Load</span>
          </button>
        </div>
      </div>
    );
  }

  const sellerName = user?.nickname || user?.firstName || user?.name || user?.fullName || user?.companyName || "";
  const duplicatedTutorials = tutorials.length > 0 ? [...tutorials, ...tutorials, ...tutorials] : [];


  

  return (
    // Vertical scroller: this outer wrapper scrolls independently of any fixed sidebar/header
    <div className="dashboard-scroll-container">
      <div className="dashboard-page-container">
        {/* Hero quote banner */}
        <div className="dashboard-hero-banner">
  <div className="hero-image-wrap">
    <img src={BANNER_IMAGES[quoteIdx]} alt="Seller dashboard banner" className="hero-banner-image" />
  </div>
  <div className="hero-dots">
    {BANNER_IMAGES.map((_, i) => (
      <span key={i} className={`hero-dot ${i === quoteIdx ? "active" : ""}`} onClick={() => setQuoteIdx(i)} />
    ))}
  </div>
</div>

        {/* Orders + Returns */}
        <div className="dashboard-content-layout">
          <div className="dashboard-section-card">
            <h3>Orders Overview</h3>
            <div className="kpi-pill-row">
              <div className="kpi-pill"><ShoppingBag size={16} /> <div><span className="pill-num">{orders.total}</span><span className="pill-lbl">Total Orders</span></div></div>
              <div className="kpi-pill pill-red"><AlertCircle size={16} /> <div><span className="pill-num">{orders.cancelled}</span><span className="pill-lbl">Cancelled</span></div></div>
              <div className="kpi-pill pill-green"><ArrowRight size={16} /> <div><span className="pill-num">{orders.confirmed}</span><span className="pill-lbl">Confirmed</span></div></div>
              <div className="kpi-pill pill-purple"><ShoppingBag size={16} /> <div><span className="pill-num">{orders.shipped}</span><span className="pill-lbl">Shipped</span></div></div>
            </div>
            <div className="donut-section">
              <Donut
                centerValue={orders.total}
                centerLabel="Total Orders"
                size={200}
                thickness={14}
                radius={42}
                data={[
                  { label: "Total Orders", value: orders.total, color: "#3b82f6" },
                  { label: "Cancelled", value: orders.cancelled, color: "#ef4444" },
                  { label: "Confirmed", value: orders.confirmed, color: "#22c55e" },
                  { label: "Shipped", value: orders.shipped, color: "#a855f7" },
                ]}
              />
              <Legend
                total={orders.total}
                data={[
                  { label: "Total Orders", value: orders.total, color: "#3b82f6" },
                  { label: "Cancelled", value: orders.cancelled, color: "#ef4444" },
                  { label: "Confirmed", value: orders.confirmed, color: "#22c55e" },
                  { label: "Shipped", value: orders.shipped, color: "#a855f7" },
                ]}
              />
            </div>
          </div>

          <div className="dashboard-section-card">
            <h3>Returns / Exchanges</h3>
            <div className="kpi-pill-row">
              <div className="kpi-pill"><ArrowRight size={16} /> <div><span className="pill-num">{returns.returnReq}</span><span className="pill-lbl">Return Requests</span></div></div>
              <div className="kpi-pill pill-green"><ArrowRight size={16} /> <div><span className="pill-num">{returns.exchangeReq}</span><span className="pill-lbl">Exchange Requests</span></div></div>
            </div>
            <div className="settlement-chart-wrap">
              {returns.monthly.every((m) => m.amount === 0) ? (
                <div className="dashboard-empty-substate">
                  <AlertCircle size={28} />
                  <p>No return or exchange history yet.</p>
                </div>
              ) : (
                <MountainChart
                  data={returns.monthly}
                  color="indigo"
                  valueFormatter={(n) => `${n}`}
                />
              )}
            </div>
            <p className="section-footnote">Keep your customers happy with easy returns and exchanges.</p>
          </div>
        </div>

        {/* Listings + Inventory */}
        {/* Inventory + Listings */}
        <div className="dashboard-content-layout">
          <div className="dashboard-section-card">
            <h3>Inventory Status</h3>
            <div className="kpi-pill-row">
              <div className="kpi-pill pill-green"><PackageCheck size={16} /> <div><span className="pill-num">{inventory.inStock}</span><span className="pill-lbl">In Stock</span></div></div>
              <div className="kpi-pill pill-red"><PackageX size={16} /> <div><span className="pill-num">{inventory.outOfStock}</span><span className="pill-lbl">Out of Stock</span></div></div>
            </div>
            <div className="settlement-chart-wrap">
              {inventory.total === 0 ? (
                <div className="dashboard-empty-substate">
                  <PackageX size={28} />
                  <p>No inventory data yet.</p>
                </div>
              ) : (
                <SimpleBarChart
                  data={[
                    { label: "In Stock", value: inventory.inStock },
                    { label: "Out of Stock", value: inventory.outOfStock },
                  ]}
                  colors={["#22c55e", "#ef4444"]}
                />
              )}
            </div>
            <button className="btn-view-all" onClick={() => navigate("/inventory")}>
              Manage Inventory <ArrowRight size={14} />
            </button>
          </div>

          <div className="dashboard-section-card">
            <h3>Product Listings</h3>
            <div className="kpi-pill-row">
              <div className="kpi-pill"><List size={16} /> <div><span className="pill-num">{listings.myListings}</span><span className="pill-lbl">My Listings</span></div></div>
              <div className="kpi-pill pill-purple"><FileEdit size={16} /> <div><span className="pill-num">{listings.draft}</span><span className="pill-lbl">Draft</span></div></div>
              <div className="kpi-pill pill-green"><Clock3 size={16} /> <div><span className="pill-num">{listings.underReview}</span><span className="pill-lbl">Under Review</span></div></div>
              <div className="kpi-pill pill-red"><RotateCw size={16} /> <div><span className="pill-num">{listings.updateRequested}</span><span className="pill-lbl">Update Requested</span></div></div>
            </div>
            <div className="donut-section">
              <Donut
                centerValue={listings.total}
                centerLabel="Total Listings"
                size={160}
                data={[
                  { label: "My Listings", value: listings.myListings, color: "#3b82f6" },
                  { label: "Draft", value: listings.draft, color: "#f59e0b" },
                  { label: "Under Review", value: listings.underReview, color: "#a855f7" },
                  { label: "Update Requested", value: listings.updateRequested, color: "#ef4444" },
                ]}
              />
              <Legend
                total={listings.total}
                data={[
                  { label: "My Listings", value: listings.myListings, color: "#3b82f6" },
                  { label: "Draft", value: listings.draft, color: "#f59e0b" },
                  { label: "Under Review", value: listings.underReview, color: "#a855f7" },
                  { label: "Update Requested", value: listings.updateRequested, color: "#ef4444" },
                ]}
              />
            </div>
            <button className="btn-view-all" onClick={() => navigate("/listing")}>
              View All Listings <ArrowRight size={14} />
            </button>
          </div>
        </div>
        {/* Settlements + Follow Us */}
        <div className="dashboard-content-layout">
          <div className="dashboard-section-card">
            <h3>Settlements Overview</h3>
            <div className="settlement-total">
              <span className="settlement-label">Total Revenue</span>
              <span className="settlement-value">{INR(settlements.totalRevenue)}</span>
            </div>
            <div className="settlement-chart-wrap">
              {settlements.monthly.length === 0 ? (
                <div className="dashboard-empty-substate">
                  <Wallet size={28} />
                  <p>No settlement history yet.</p>
                </div>
              ) : (
                <MountainChart data={settlements.monthly} />
              )}
            </div>
            <div className="kpi-pill-row settlement-kpi-row">
              <div className="kpi-pill pill-green">
                <CheckCircle2 size={16} />
                <div>
                  <span className="pill-num">{INR(settlements.previous?.amount)}</span>
                  <span className="pill-lbl">
                    Previous · {settlements.previous?.count || 0} settlement{(settlements.previous?.count || 0) === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="kpi-pill pill-purple">
                <Clock size={16} />
                <div>
                  <span className="pill-num">{INR(settlements.upcoming?.amount)}</span>
                  <span className="pill-lbl">
                    Upcoming · {settlements.upcoming?.count || 0} settlement{(settlements.upcoming?.count || 0) === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-section-card follow-us-card">
            <h3>Follow Us</h3>
            <div className="follow-us-content">
              <p className="follow-us-quote">
                "Grow with us — join the Haatza Seller community and never miss an update!"
              </p>
              <div className="follow-us-icons">
                <a
                  href="https://whatsapp.com/channel/0029VbBP7ApFHWptFheof83Q"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="follow-icon-link whatsapp"
                  aria-label="Follow us on WhatsApp"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12.004 2C6.477 2 2 6.477 2 12.004c0 2.116.616 4.084 1.68 5.744L2 22l4.36-1.65a9.94 9.94 0 0 0 5.644 1.654h.005c5.527 0 10.004-4.478 10.004-10.004C22 6.477 17.531 2 12.004 2zm0 18.267a8.24 8.24 0 0 1-4.198-1.14l-.301-.179-3.111 1.178.83-3.156-.196-.323a8.244 8.244 0 0 1-1.246-4.643c0-4.554 3.706-8.26 8.226-8.26 4.552 0 8.257 3.706 8.257 8.26 0 4.553-3.705 8.263-8.261 8.263z"/>
                  </svg>
                </a>
                <a
                  href="https://www.instagram.com/haatzaseller?igsh=cDdxMjJrM205Z21h"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="follow-icon-link instagram"
                  aria-label="Follow us on Instagram"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM12 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                  </svg>
               </a>
              </div>

              <div className="follow-us-perks">
                <div className="follow-us-perk">
                  <span className="perk-dot" />
                  <span>Get notified about new sale events and festive offers you can list your products for</span>
                </div>
                <div className="follow-us-perk">
                  <span className="perk-dot" />
                  <span>Learn tips and tricks to get more orders and grow your store</span>
                </div>
                <div className="follow-us-perk">
                  <span className="perk-dot" />
                  <span>Get official announcements straight from the Haatza team, before anyone else</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Haatza With You — horizontal video scroller */}
        <div className="dashboard-section-card">
          <div className="videos-header">
            <h3 style={{ border: "none", margin: 0, padding: 0 }}>Haatza With You</h3>
          </div>
          <p className="section-footnote" style={{ marginTop: 0 }}>Learn, grow and succeed with our latest videos</p>
          <div 
            className="video-row" 
            ref={videoScrollRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {duplicatedTutorials.length === 0 ? (
              <div className="dashboard-empty-substate">
                <p>No tutorial videos available right now.</p>
              </div>
            ) : (
              duplicatedTutorials.map((v, i) => (
                <div 
                  className="video-card" 
                  key={v.id ? `${v.id}-${i}` : i}
                  onClick={() => {
                    const videoLink = v.url || v.videoUrl || v.link;
                    if (videoLink) window.open(videoLink, "_blank");
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <div className="video-thumb-wrap">
                    <img src={v.thumbnail || v.thumbnailUrl || v.image} alt={v.title || "tutorial"} />
                    <div className="video-play-overlay">
                      <Play size={20} fill="currentColor" />
                    </div>
                    <span className="video-duration">{v.duration || ""}</span>
                  </div>
                  <div className="video-info-wrap">
                    <p className="video-title">{v.title || v.name}</p>
                    <p className="video-description">{v.description || "Watch tutorial video to learn more."}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Welcome Scratch Card Reward Modal Backdrop */}
        {showWelcomeModal && (
          <div className="scratch-modal-backdrop">
            {/* Sparkles background layer behind content */}
            <div className="scratch-bg-sparkles-container">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="scratch-bg-sparkle" style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  transform: `scale(${Math.random() * 0.5 + 0.5})`
                }}>★</div>
              ))}
            </div>

            <div className="scratch-modal-content">
              <button 
                className="scratch-modal-close-btn"
                onClick={() => {
                  setShowWelcomeModal(false);
                  localStorage.removeItem("__haatza_just_onboarded");
                }}
              >
                <X size={20} />
              </button>
              <div className="scratch-card-header">
                <h2>🎉 Welcome Reward!</h2>
                <p>Scratch your card to reveal your welcome reward!</p>
              </div>
              
              <div className="scratch-card-main-container">
                {/* Back layer: Reward Details */}
                <div 
                  className={`scratch-card-reward-back ${scratchComplete ? "reward-reveal-active" : ""}`}
                  style={{ opacity: isScratchingStarted || scratchComplete ? 1 : 0.01 }}
                >
                  <span className="reward-congrats animate-bounce">🎉 Congratulations!</span>
                  <span className="reward-cashback-value">₹500</span>
                  <span className="reward-cashback-label">Welcome Cashback</span>
                </div>
                
                {/* Front Layer: Canvas Container with metallic shine sweep overlay */}
                <div className={`scratch-canvas-container ${scratchComplete ? "scratch-canvas-fadeout" : ""}`}>
                  <canvas
                    ref={canvasRef}
                    className="scratch-canvas"
                    onMouseDown={handleStart}
                    onMouseMove={handleMove}
                    onMouseUp={handleEnd}
                    onMouseLeave={handleEnd}
                  />
                  <div className="scratch-canvas-shine" />
                </div>
              </div>
              
              {/* Claim Reward Button */}
              {scratchComplete && !claimPressed && (
                <button 
                  className="claim-reward-btn pulse-button"
                  onClick={startStarFlight}
                >
                  <span className="btn-shimmer" />
                  Claim Reward 🌟
                </button>
              )}

              {claimPressed && (
                <div className="scratch-claim-success-info">
                  Sending reward to your wallet...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scratch Sparks flying overlay */}
        {scratchSparks.map(s => (
          <div 
            key={s.id}
            className="scratch-spark"
            style={{
              left: s.x,
              top: s.y,
              width: s.size,
              height: s.size,
              backgroundColor: s.color,
              "--tx": s.tx,
              "--ty": s.ty
            }}
          />
        ))}

        {/* Star Collection Flight Animation */}
        {flyingStars.map(s => (
          <div
            key={s.id}
            className="glowing-star-claim"
            style={{
              left: s.x,
              top: s.y,
              width: s.size,
              height: s.size,
              opacity: s.opacity,
            }}
          >
            ★
          </div>
        ))}

        {/* Floating +₹500 Cashback Bubble Animation */}
        {floatingCash.active && (
          <div
            className="floating-cash-bubble"
            style={{
              "--x": `${floatingCash.x}px`,
              "--y": `${floatingCash.y}px`
            }}
          >
            +₹500
          </div>
        )}

        {/* Floating Particles Overlay */}
        {particles.map(p => (
          <div 
            key={p.id}
            className="scratch-particle"
            style={{
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              opacity: p.opacity,
              borderRadius: p.type === "circle" ? "50%" : "20%",
              transform: `rotate(${p.rotation}deg)`
            }}
          />
        ))}

        {/* Flying Gold Coins Animation */}
        {flyingCoins.map(coin => (
          <div
            key={coin.id}
            className="flying-coin"
            style={{
              "--start-x": `${coin.startX}px`,
              "--start-y": `${coin.startY}px`,
              "--target-x": `${coin.targetX}px`,
              "--target-y": `${coin.targetY}px`,
              animationDelay: `${coin.delay}ms`
            }}
          >
            ₹
          </div>
        ))}
        </div>
      </div>
  );
};

export default DashboardPage;