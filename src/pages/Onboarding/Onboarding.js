import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Onboarding.css';
import { checkOnboardStatus } from '../../services/sellerService';
import { useAuth } from '../../context/AuthContext';
import LogoutConfirmModal from '../../components/common/LogoutConfirmModal/LogoutConfirmModal';
/* ─── Fetch Bank List from Backend API ─────────────────────────── */
async function fetchBankList() {
  try {
    const res = await fetch('https://haatzaseller.com/_functions/bankList', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    let rawList = [];
    if (Array.isArray(data)) {
      rawList = data;
    } else if (data && Array.isArray(data.banks)) {
      rawList = data.banks;
    } else if (data && Array.isArray(data.data)) {
      rawList = data.data;
    } else if (data && Array.isArray(data.message)) {
      rawList = data.message;
    } else if (data && typeof data === 'object') {
      const foundArray = Object.values(data).find(val => Array.isArray(val));
      if (foundArray) rawList = foundArray;
    }

    // Common Indian Bank to IFSC Prefix Map (normalized lowercase keys)
    const bankToIfscPrefix = {
      'abn amro': 'ABNA',
      'abu dhabi commercial bank': 'ADCB',
      'abhyudaya co-op bank ltd': 'ABHY',
      'abhyudaya co-op bank ltd.': 'ABHY',
      'allahabad bank': 'ALLA',
      'american express bank ltd': 'AEIB',
      'american express bank ltd.': 'AEIB',
      'andhra bank': 'ANDB',
      'bnp paribas': 'BNPA',
      'bob capital markets limited': 'BARB',
      'bank of novascotia': 'NOSC',
      'bank of rajsthan': 'BRAJ',
      'bank of america': 'BOFA',
      'bank of bahrain & kuwait': 'BBKM',
      'bank of bahrain and kuwait': 'BBKM',
      'bank of baroda': 'BARB',
      'bank of india': 'BKID',
      'bank of maharashtra': 'MAHB',
      'bank of punjab': 'BKPU',
      'bank of tokyo mitsubishi ltd': 'BOTM',
      'bank of tokyo mitsubishi ltd.': 'BOTM',
      'barclays bank plc': 'BARC',
      'barclays bank': 'BARC',
      'bharat co-op bank ltd': 'BCBM',
      'bharat co-op bank ltd.': 'BCBM',
      'bharat overseas bank ltd': 'BHOB',
      'bharat overseas bank ltd.': 'BHOB',
      'catholic syrian bank ltd': 'CSBK',
      'catholic syrian bank ltd.': 'CSBK',
      'cosmos bank': 'COSB',
      'canara bank': 'CNRB',
      'ceylon bank': 'BCEY',
      'central bank of india': 'CBIN',
      'centurion bank': 'CENT',
      'chinatrust commercial bank ltd': 'CTCB',
      'chinatrust commercial bank ltd.': 'CTCB',
      'cho-hung bank': 'CHBK',
      'citi bank n.a.': 'CITI',
      'citi bank': 'CITI',
      'citibank': 'CITI',
      'citicorp capital markets': 'CITI',
      'citizencredit co-op bank ltd': 'CCBL',
      'citizencredit co-op bank ltd.': 'CCBL',
      'city union bank ltd': 'CIUB',
      'city union bank ltd.': 'CIUB',
      'corpbank securities ltd': 'CORP',
      'corpbank securities ltd.': 'CORP',
      'corporation bank': 'CORP',
      'dombivli nagri sahakari bank ltd': 'DNSB',
      'dombivli nagri sahakari bank ltd.': 'DNSB',
      'dsp merrill lynch limited': 'DSPM',
      'dena bank': 'BKDN',
      'deutsche bank': 'DEUT',
      'deutsche securities': 'DEUT',
      'development bank of singapore': 'DBSS',
      'development credit bank': 'DCBL',
      'dhanalakshmi bank': 'DLXB',
      'federal bank': 'FDRL',
      'greater bombay co-op bank': 'GBCB',
      'hdfc bank': 'HDFC',
      'hsbc': 'HSBC',
      'hsbc bank': 'HSBC',
      'icici bank': 'ICIC',
      'idbi': 'IBKL',
      'idbi bank': 'IBKL',
      'ing vysya bank': 'VYSA',
      'indian bank': 'IDIB',
      'indian overseas bank': 'IOBA',
      'indusind bank': 'INDB',
      'jp morgan chase bank': 'CHAS',
      'jpmorgan chase': 'CHAS',
      'jammu & jk bank': 'JAKA',
      'jammu & kashmir bank': 'JAKA',
      'jammu and kashmir bank': 'JAKA',
      'jankalyan sahakari bank': 'JSBL',
      'karur vysya bank': 'KVBL',
      'krung thai bank': 'KRTB',
      'karnataka bank': 'KARB',
      'kotak mahindra bank': 'KKBK',
      'laxmi vilas bank': 'LAVB',
      'lord krishna bank': 'LKBL',
      'mandavi co-operative bank': 'MDCB',
      'mashreq bank': 'MSHQ',
      'maharashtra state co-operative bank': 'MSCI',
      'mizuho corporate bank': 'MHCB',
      'new india co-op bank': 'NICB',
      'north kanara gsb co-op bank': 'NKGS',
      'oriental bank of commerce': 'ORBC',
      'punjab & sind bank': 'PSIB',
      'punjab and sind bank': 'PSIB',
      'punjab & maharashtra co-op bank': 'PMCB',
      'punjab and maharashtra co-op bank': 'PMCB',
      'punjab national bank': 'PUNB',
      'ratnakar bank (rbl bank)': 'RATN',
      'ratnakar bank': 'RATN',
      'rbl bank': 'RATN',
      'reserve bank of india': 'RBIS',
      'saraswat co-operative bank': 'SRCB',
      'shamrao vithal co-op bank': 'SVCB',
      'south indian bank': 'SIBL',
      'standard chartered bank': 'SCBL',
      'standard chartered': 'SCBL',
      'state bank of india': 'SBIN',
      'state bank of hyderabad': 'SBHY',
      'state bank of mysore': 'SBMY',
      'state bank of patiala': 'STBP',
      'state bank of bikaner & jaipur': 'SBBJ',
      'state bank of bikaner and jaipur': 'SBBJ',
      'state bank of saurashtra': 'SBSY',
      'state bank of travancore': 'SBTR',
      'state bank indore': 'SBIN',
      'state bank of mauritius': 'STCB',
      'syndicate bank': 'SYNB',
      'tamilnad mercantile bank': 'TMBL',
      'tamilnadu state apex co-operative bank': 'TNSC',
      'thane janta sahakari bank': 'TJSB',
      'the kapol co-operative bank': 'KCBL',
      'the sangli bank': 'SANG',
      'ufj bank ltd': 'BOTM',
      'ufj bank ltd.': 'BOTM',
      'united western bank': 'UWBI',
      'uti bank (axis bank)': 'UTIB',
      'uti bank': 'UTIB',
      'uco bank': 'UCBA',
      'union bank of india': 'UBIN',
      'united bank of india': 'UTBI',
      'vijaya bank': 'VIJB',
      'yes bank': 'YESB'
    };

    return rawList.map(item => {
      if (!item) return null;
      let name = '';
      let code = '';
      if (typeof item === 'string') {
        name = item.trim();
      } else if (typeof item === 'object') {
        name = (item.name || item.bankName || item.bank || '').trim();
        code = (item.code || item.ifscPrefix || item.bankCode || item.ifscCode || '').trim().toUpperCase();
      }

      if (!name) return null;

      if (!code) {
        const normalized = name.toLowerCase().replace(/\s+/g, ' ');
        if (bankToIfscPrefix[normalized]) {
          code = bankToIfscPrefix[normalized];
        } else {
          const matchedKey = Object.keys(bankToIfscPrefix).find(k => normalized.includes(k) || k.includes(normalized));
          if (matchedKey) {
            code = bankToIfscPrefix[matchedKey];
          } else {
            code = '';
          }
        }
      }

      return { name, code };
    }).filter(Boolean);
  } catch (err) {
    console.error('[fetchBankList] Error fetching bank list:', err);
    return [];
  }
}

/* ─── GSTIN API ───────────────────────────────────────────────── */
const GST_API_URL = 'https://haatzaseller.com/_functions/checksellergst';
async function checkGSTINExists(gstin) {
  const url = `${GST_API_URL}?gstin=${encodeURIComponent(gstin)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let data;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    data = await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }

  // eslint-disable-next-line no-console
  console.log('[checkGSTINExists] Raw API response:', JSON.stringify(data));

  const EXISTS_KEYWORDS = ['already exist', 'already registered', 'already register', 'duplicate', 'already in use', 'already taken'];
  const NOT_EXISTS_KEYWORDS = ['not found', 'not registered', 'not exist', 'available', 'no seller', 'no record'];

  const stringVerdict = (str) => {
    const s = String(str).toLowerCase();
    if (NOT_EXISTS_KEYWORDS.some((k) => s.includes(k))) return false;
    if (EXISTS_KEYWORDS.some((k) => s.includes(k))) return true;
    return null; // unknown — don't guess
  };

  const candidates = [
    data,
    data?.message,
    data?.data,
    data?.message?.body,
    data?.message?.data,
    data?.result,
    data?.body,
  ];

  for (const c of candidates) {
    if (c === undefined || c === null) continue;

    if (typeof c === 'string') {
      const v = stringVerdict(c);
      if (v !== null) return v;
      continue;
    }
    if (typeof c !== 'object') continue;

    if (typeof c.exists === 'boolean') return c.exists;
    if (typeof c.registered === 'boolean') return c.registered;
    if (typeof c.found === 'boolean') return c.found;
    if (typeof c.isRegistered === 'boolean') return c.isRegistered;
    if (typeof c.alreadyExists === 'boolean') return c.alreadyExists;
    if (typeof c.duplicate === 'boolean') return c.duplicate;
    if (typeof c.isDuplicate === 'boolean') return c.isDuplicate;
    if (typeof c.gstExists === 'boolean') return c.gstExists;
    if (typeof c.userExists === 'boolean') return c.userExists;
    if (typeof c.sellerExists === 'boolean') return c.sellerExists;
    if (typeof c.gstinExists === 'boolean') return c.gstinExists;
    if (typeof c.status === 'string') {
      const s = c.status.toLowerCase();
      if (['exists', 'registered', 'duplicate', 'found', 'already_registered', 'already_exists'].includes(s)) return true;
      if (['not_found', 'not_registered', 'available'].includes(s)) return false;
      // NOTE: an envelope status of "success"/"error" is intentionally NOT
      // treated as an existence verdict — it just means the HTTP call worked.
    }

    if (typeof c.message === 'string') {
      const v = stringVerdict(c.message);
      if (v !== null) return v;
    }
    if (typeof c.error === 'string') {
      const v = stringVerdict(c.error);
      if (v !== null) return v;
    }
  }

  // If response contains a seller record/array with data in it, treat as exists
  const sellerRecord =
    data?.message?.seller ||
    data?.seller ||
    (Array.isArray(data?.message) ? data.message[0] : null) ||
    (Array.isArray(data?.message?.data) ? data.message.data[0] : null) ||
    (Array.isArray(data?.data) ? data.data[0] : null) ||
    (Array.isArray(data) ? data[0] : null);
  if (sellerRecord && typeof sellerRecord === 'object' && Object.keys(sellerRecord).length > 0) {
    return true;
  }

  // Response shape not recognized — do NOT default to "not registered".
  // That default is what caused already-registered GSTINs to be shown as verified.
  console.warn('[checkGSTINExists] Could not determine exists/not-exists from response shape. Raw response logged above.');
  throw new Error('UNKNOWN_GSTIN_RESPONSE_SHAPE');
}

/* ─── Nominatim rate limiter — max 1 request/sec across ALL Nominatim
   calls (search, reverse, pincode). Nominatim returns 429 without CORS
   headers when this limit is exceeded, which the browser reports as a
   misleading "CORS" error. Retries once on 429. ─────────────────── */
let nominatimQueue = Promise.resolve();
function throttledNominatimFetch(url, options = {}) {
  const run = nominatimQueue.then(async () => {
    let res = await fetch(url, options);
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      res = await fetch(url, options);
    }
    return res;
  });
  nominatimQueue = run.then(
    () => new Promise((r) => setTimeout(r, 1100)),
    () => new Promise((r) => setTimeout(r, 1100))
  );
  return run;
}

/* ─── Pincode API (Nominatim — no expired SSL issues) ────────── */
async function fetchPincodeData(pincode) {
  const res = await throttledNominatimFetch(
    `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=jsonv2&addressdetails=1&limit=1&accept-language=en`,
    {
      headers: {
        'Accept-Language': 'en',
      },
    }
  );
  if (!res.ok) throw new Error('Network error');
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('Invalid pincode');
  const a = data[0].address || {};
  const city = a.city || a.town || a.village || a.county || a.state_district || '';
  const state = a.state || '';
  if (!state) throw new Error('Invalid pincode');
  return { city, state, country: 'India' };
}

/* ─── Icons ──────────────────────────────────────────────────── */
const LocationIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2962ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="10" r="3" />
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
  </svg>
);

const EyeIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const SpinnerIcon = ({ color = '#2962ff' }) => (
  <svg
    width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2.5" strokeLinecap="round"
    style={{ animation: 'spinIcon 0.7s linear infinite', display: 'block' }}
  >
    <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke={color} />
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20,6 9,17 4,12" />
  </svg>
);

/* ─── Leaflet loader ──────────────────────────────────────────── */
let leafletLoadPromise = null;
function loadLeaflet() {
  if (leafletLoadPromise) return leafletLoadPromise;
  if (window.L) { leafletLoadPromise = Promise.resolve(window.L); return leafletLoadPromise; }
  leafletLoadPromise = new Promise((resolve, reject) => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve(window.L);
    script.onerror = () => { leafletLoadPromise = null; reject(new Error('Failed to load Leaflet.')); };
    document.head.appendChild(script);
  });
  return leafletLoadPromise;
}

/* ─── Tile error retry — OSM's free tile servers occasionally return
   503 under burst load (e.g. flyTo animating across many zoom levels).
   Retry a failed tile once after a short backoff instead of leaving a
   permanently blank/broken tile square. ─────────────────────────── */
function attachTileRetry(layer) {
  const retried = new WeakSet();
  layer.on('tileerror', (e) => {
    const tile = e.tile;
    if (!tile || retried.has(tile)) return;
    retried.add(tile);
    const originalSrc = tile.src;
    setTimeout(() => {
      // cache-bust so the browser doesn't just replay the failed response
      const sep = originalSrc.includes('?') ? '&' : '?';
      tile.src = `${originalSrc}${sep}retry=${Date.now()}`;
    }, 800 + Math.random() * 800);
  });
}

/* ─── Reverse geocoding ───────────────────────────────────────── */
async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&namedetails=1&extratags=1&accept-language=en`;
  const res = await throttledNominatimFetch(url, {
    cache: 'no-store',
    headers: {
      'Accept-Language': 'en',
    },
  });
  if (!res.ok) throw new Error('Geocoding failed');
  return res.json();
}


function parseNominatimAddress(data) {
  const a = data.address || {};

  const houseNo = [
    a.house_number,
    a.building,
    a.amenity,
    a.shop,
    a.office,
    a.industrial,
    a.man_made,
  ].filter(Boolean).join(', ');

  const roadParts = [
    a.road || a.pedestrian || a.footway || a.path || a.street,
    a.neighbourhood || a.suburb || a.quarter || a.residential,
  ].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);
  const roadName = roadParts.join(', ');

  const pinCode = a.postcode || '';
  const village = a.village || a.hamlet || '';
  const town = a.town || '';
  const district = a.state_district || a.county || a.city_district || '';
  const city = a.city || town || village || district || '';
  const state = a.state || '';
  const country = a.country || '';
  const landmark = a.tourism || a.historic || a.leisure || '';

  // Fallback: build a complete address from individual components in case
  // Nominatim's display_name omits details, so the address shown always
  // reflects everything known about the exact marker position.
  const componentAddress = [
    houseNo,
    roadName,
    landmark,
    village || town,
    district,
    city,
    state,
    pinCode,
    country,
  ].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(', ');

  const displayAddress = data.display_name || componentAddress;

  return {
    houseNo, roadName, pinCode, city, state, country, landmark, displayAddress,
    district, village: village || town,
  };
}
/* ─── Map tile layers ─────────────────────────────────────────── */
const TILE_LAYERS = {
  map: {
    label: 'Map', icon: '🗺️',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  satellite: {
    label: 'Satellite', icon: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
    subdomains: false,
  },
  terrain: {
    label: 'Terrain', icon: '🏔️',
    url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap contributors',
    maxZoom: 17,
  },
  hybrid: {
    label: 'Hybrid', icon: '🌐',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    maxZoom: 19,
    isOverlay: true,
    baseUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  },
};

/* ─── Map Modal ───────────────────────────────────────────────── */
function MapModal({ onClose, onSelectAddress }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const baseLayerRef = useRef(null);
  const overlayLayerRef = useRef(null);
  const timerRef = useRef(null);
  const doReverseGeocodeRef = useRef(null);
 const isAnimatingRef = useRef(false);
  const crosshairRef = useRef(null);
  const userLocationSetRef = useRef(false);        // true once the user explicitly sets a location
  const suppressNextMoveEndGeocodeRef = useRef(false); // avoid duplicate geocode after programmatic flyTo

  const [addressText, setAddressText] = useState('');
  const [parsedAddr, setParsedAddr] = useState(null);
  const [geocoding, setGeocoding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState('');
 const [locating, setLocating] = useState(false);
  const [activeLayer, setActiveLayer] = useState('map');
  const [dragging, setDragging] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [accuracyWarning, setAccuracyWarning] = useState('');
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const isSelectingRef = useRef(false);
  const searchSeqRef = useRef(0);
  const reverseGeocodeSeqRef = useRef(0);

  const performSearch = async (queryVal) => {
    const q = typeof queryVal === 'string' ? queryVal : searchQuery;
    if (!q.trim()) return;
    const seq = ++searchSeqRef.current;
    setSearchLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=in&addressdetails=1&limit=5&accept-language=en`;
      const res = await throttledNominatimFetch(url, {
        headers: {
          'Accept-Language': 'en',
        },
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      if (seq !== searchSeqRef.current) return; // a newer search superseded this one
      const sorted = Array.isArray(data)
        ? [...data].sort((a, b) => (b.importance || 0) - (a.importance || 0))
        : [];
      setSearchResults(sorted);
      if (sorted.length === 0) {
        setLocationError('No results found for that search. Try a different city, area, or PIN code.');
      } else {
        setLocationError('');
      }
    } catch (e) {
      console.warn("Search geocoding error:", e);
      if (seq === searchSeqRef.current) {
        setSearchResults([]);
        setLocationError('Search failed. Please check your connection and try again.');
      }
    } finally {
      if (seq === searchSeqRef.current) setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      return;
    }
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 800);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performSearch();
    }
  };

  const selectSearchResult = (result) => {
    isSelectingRef.current = true;
    userLocationSetRef.current = true;
    setSearchResults([]);
    setSearchQuery(result.display_name);
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    if (!isNaN(lat) && !isNaN(lng)) {
      if (mapRef.current) {
        suppressNextMoveEndGeocodeRef.current = true;
        mapRef.current.flyTo([lat, lng], 17, { duration: 1.5 });
      }
      doReverseGeocode(lat, lng);
    }
  };
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const DEFAULT_CENTER = [20.5937, 78.9629];

  const doReverseGeocode = useCallback(async (lat, lng) => {
    const seq = ++reverseGeocodeSeqRef.current;
    setGeocoding(true);
    try {
      const data = await reverseGeocode(lat, lng);
      if (seq !== reverseGeocodeSeqRef.current) return; // a newer position superseded this lookup — discard stale result
      const parsed = parseNominatimAddress(data);
      parsed.latitude = lat;
      parsed.longitude = lng;
      parsed.formattedAddress = parsed.displayAddress;
      setParsedAddr(parsed);
      setAddressText(parsed.displayAddress || 'Address found');
    } catch {
      if (seq !== reverseGeocodeSeqRef.current) return;
      setParsedAddr(null);
      setAddressText('Could not fetch address — try moving the map.');
    } finally {
      if (seq === reverseGeocodeSeqRef.current) setGeocoding(false);
    }
  }, []);

  const onMoveStart = useCallback(() => {
    isAnimatingRef.current = true;
    setDragging(true);
    setParsedAddr(null);
    setAddressText('');
    setLocationError('');
  }, []);

  const onMoveEnd = useCallback(() => {
    setDragging(false);
    if (!mapRef.current) return;
    clearTimeout(timerRef.current);
    if (suppressNextMoveEndGeocodeRef.current) {
      suppressNextMoveEndGeocodeRef.current = false;
      return;
    }
    const c = mapRef.current.getCenter();
    doReverseGeocode(c.lat, c.lng);
  }, [doReverseGeocode]);

  const onMapClick = useCallback((e) => {
    if (!mapRef.current) return;
    userLocationSetRef.current = true;
    mapRef.current.flyTo([e.latlng.lat, e.latlng.lng], 18, { duration: 0.8 });
  }, []);
  const applyLayer = useCallback((layerKey) => {
    const map = mapRef.current;
    if (!map || !window.L) return;
    const L = window.L;
    const cfg = TILE_LAYERS[layerKey];

    // Shared options that cut down on tile-request bursts:
    // - updateWhenZooming:false waits until a zoom finishes instead of
    //   requesting tiles at every intermediate animation frame.
    // - keepBuffer keeps recently-seen tiles cached so panning/zooming
    //   back doesn't immediately re-request them.
    const throttledTileOptions = {
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 4,
    };

    if (baseLayerRef.current) { map.removeLayer(baseLayerRef.current); baseLayerRef.current = null; }
    if (overlayLayerRef.current) { map.removeLayer(overlayLayerRef.current); overlayLayerRef.current = null; }

    if (cfg.isOverlay) {
      baseLayerRef.current = L.tileLayer(cfg.baseUrl, {
        attribution: cfg.attribution, maxZoom: cfg.maxZoom, ...throttledTileOptions,
      }).addTo(map);
      overlayLayerRef.current = L.tileLayer(cfg.url, {
        attribution: '', maxZoom: cfg.maxZoom, opacity: 0.85, ...throttledTileOptions,
      }).addTo(map);
      attachTileRetry(baseLayerRef.current);
      attachTileRetry(overlayLayerRef.current);
    } else {
      const options = { attribution: cfg.attribution, maxZoom: cfg.maxZoom, ...throttledTileOptions };
      if (cfg.subdomains === false) options.subdomains = '';
      baseLayerRef.current = L.tileLayer(cfg.url, options).addTo(map);
      attachTileRetry(baseLayerRef.current);
    }
    setActiveLayer(layerKey);
  }, []);
  const goToCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Your browser does not support location detection.');
      return;
    }
    setShowLocationPrompt(true);
  }, []);

  const confirmLocationAccess = useCallback(() => {
    setShowLocationPrompt(false);
    userLocationSetRef.current = true;
    setLocationError('');
    setAccuracyWarning('');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        console.log('[Geolocation] accuracy (meters):', coords.accuracy);
        if (coords.accuracy > 100) {
          setAccuracyWarning(`GPS accuracy is low (±${Math.round(coords.accuracy)}m). Please verify the pinned location.`);
        }
        if (mapRef.current) {
          suppressNextMoveEndGeocodeRef.current = true;
          mapRef.current.flyTo([coords.latitude, coords.longitude], 18, { duration: 1.2 });
        }
        doReverseGeocode(coords.latitude, coords.longitude);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location permission denied. Please enable location access in your browser settings.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocationError('Unable to determine your location right now. Please try again.');
        } else if (err.code === err.TIMEOUT) {
          setLocationError('Location request timed out. Please try again.');
        } else {
          setLocationError('Something went wrong while detecting your location.');
        }
      },
    { timeout: 15000, maximumAge: 0, enableHighAccuracy: true },
    );
  }, [doReverseGeocode]);

  const declineLocationAccess = useCallback(() => {
    setShowLocationPrompt(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !mapDivRef.current || mapRef.current) return;

      const map = L.map(mapDivRef.current, {
        center: DEFAULT_CENTER, zoom: 5,
        zoomControl: false, attributionControl: true,
      });
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const cfg = TILE_LAYERS['map'];
      baseLayerRef.current = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: cfg.maxZoom,
        updateWhenZooming: false,
        updateWhenIdle: true,
        keepBuffer: 4,
      }).addTo(map);
      attachTileRetry(baseLayerRef.current);

      map.on('movestart', onMoveStart);
      map.on('moveend', onMoveEnd);
      map.on('click', onMapClick);
      mapRef.current = map;
      if (!cancelled) setLoading(false);

      if (navigator.geolocation) {
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => {
            // Bail out if the user already searched/clicked/used-location
            // while this GPS lookup was still in flight — never let a
            // late-arriving initial fix clobber the user's own choice.
            if (cancelled || userLocationSetRef.current) { setLocating(false); return; }
            setLocating(false);
            console.log('[Geolocation] initial accuracy (meters):', coords.accuracy);
            if (coords.accuracy > 100) {
              setAccuracyWarning(`GPS accuracy is low (±${Math.round(coords.accuracy)}m). Please verify the pinned location.`);
            }
            suppressNextMoveEndGeocodeRef.current = true;
            map.flyTo([coords.latitude, coords.longitude], 18, { duration: 1.5, easeLinearity: 0.3 });
            doReverseGeocode(coords.latitude, coords.longitude);
          },
          (err) => {
            if (cancelled || userLocationSetRef.current) { setLocating(false); return; }
            setLocating(false);
            if (err.code === err.PERMISSION_DENIED) {
              setLocationError('Location permission denied. You can search or move the map manually.');
            } else if (err.code === err.TIMEOUT) {
              setLocationError('Location request timed out. You can search or move the map manually.');
            }
            doReverseGeocode(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
          },
          { timeout: 15000, maximumAge: 0, enableHighAccuracy: true },
        );
      } else {
        setLocationError('Your browser does not support location detection.');
        doReverseGeocode(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
      }
    }).catch((err) => {
      if (!cancelled) { setLoading(false); setMapError(err.message); }
    });

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
      if (mapRef.current) {
        mapRef.current.off('movestart', onMoveStart);
        mapRef.current.off('moveend', onMoveEnd);
        mapRef.current.off('click', onMapClick);
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="map-modal-overlay" onClick={onClose}>
      <div className="map-modal" onClick={(e) => e.stopPropagation()}>
        <div className="map-modal-header">
          <span>📍 Select Pickup Location</span>
          <button className="map-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="map-wrap">
          {loading && !mapError && <div className="map-loading">Loading map…</div>}
          {mapError && <div className="map-error">⚠️ {mapError}</div>}

          {!loading && !mapError && (
            <div className="map-search-container" onClick={(e) => e.stopPropagation()}>
              <div className="map-search-input-wrapper">
                <input
                  type="text"
                  className="map-search-input"
                  placeholder="Search Bangalore, Hyderabad, MG Road, PIN code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
                {searchQuery && (
                  <button className="map-search-clear-btn" onClick={clearSearch}>✕</button>
                )}
                <button className="map-search-btn" onClick={performSearch} disabled={searchLoading}>
                  {searchLoading ? <div className="map-search-spinner" /> : '🔍'}
                </button>
              </div>
              {searchResults.length > 0 && (
                <ul className="map-search-results">
                  {searchResults.map((res, idx) => (
                    <li
                      key={idx}
                      className="map-search-result-item"
                      onClick={() => selectSearchResult(res)}
                    >
                      <span className="map-result-icon">📍</span>
                      <span className="map-result-text">{res.display_name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div ref={mapDivRef} className="map-container" />

          {!loading && !mapError && (
            <div
              ref={crosshairRef}
              className={`map-crosshair${dragging ? ' map-crosshair--dragging' : ''}`}
              aria-hidden="true"
            >
              <svg
                width="40" height="52" viewBox="0 0 40 52"
                xmlns="http://www.w3.org/2000/svg"
                style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.45))', display: 'block' }}
              >
                <path
                  d="M20 1C10.06 1 2 9.06 2 19C2 32 20 51 20 51C20 51 38 32 38 19C38 9.06 29.94 1 20 1Z"
                  fill="#2962ff"
                />
                <circle cx="20" cy="19" r="8" fill="white" />
                <circle cx="20" cy="19" r="4" fill="#2962ff" />
              </svg>
            </div>
          )}

          {!loading && !mapError && (
            <div className="map-layer-switcher">
              {Object.entries(TILE_LAYERS).map(([key, cfg]) => (
                <button
                  key={key}
                  className={`map-layer-btn${activeLayer === key ? ' map-layer-btn--active' : ''}`}
                  onClick={() => applyLayer(key)}
                  title={cfg.label}
                >
                  <span className="map-layer-icon">{cfg.icon}</span>
                  <span>{cfg.label}</span>
                </button>
              ))}
            </div>
          )}

          {!loading && !mapError && (
            <button
              className={`map-locate-btn${locating ? ' map-locate-btn--spinning' : ''}`}
              onClick={goToCurrentLocation}
              disabled={locating}
              title="Use my current location"
            >
              {locating ? (
                <SpinnerIcon color="#2962ff" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2962ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                  <circle cx="12" cy="12" r="8" strokeOpacity="0.3" />
                </svg>
              )}
            </button>
          )}
        </div>

        {locationError && (
          <div className="map-address-bar" style={{ background: '#fff1f2', color: '#dc2626' }}>
            <span className="map-address-text">⚠️ {locationError}</span>
          </div>
        )}
        {accuracyWarning && !locationError && (
          <div className="map-address-bar" style={{ background: '#fffbeb', color: '#b45309' }}>
            <span className="map-address-text">⚠️ {accuracyWarning}</span>
          </div>
        )}
        <div className="map-address-bar">
          <LocationIcon />
          <span className="map-address-text">
            {geocoding ? 'Finding address…' : (addressText || 'Move the map to select a location')}
          </span>
        </div>

        <button
          className="map-confirm-btn"
          onClick={() => { if (parsedAddr) { onSelectAddress(parsedAddr); onClose(); } }}
          disabled={!parsedAddr || geocoding}
        >
          {geocoding ? 'Finding address…' : 'Confirm Location'}
        </button>

        {showLocationPrompt && (
          <div className="location-permission-overlay" onClick={declineLocationAccess}>
            <div className="location-permission-dialog" onClick={(e) => e.stopPropagation()}>
              <LocationIcon />
              <h3>Allow location access?</h3>
              <p>Haatza would like to use your current location to fill in your pickup address automatically. Your browser will also ask you to confirm this.</p>
              <div className="location-permission-actions">
                <button className="location-permission-deny" onClick={declineLocationAccess}>Not now</button>
                <button className="location-permission-allow" onClick={confirmLocationAccess}>Allow</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── FormField ───────────────────────────────────────────────── */
function FormField({ label, required, children, error }) {
  return (
    <div className="form-field">
      <label className="field-label">
        {label}{required && <span className="required-star">*</span>}
      </label>
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

/* ─── GSTIN Status Badge ──────────────────────────────────────── */
function GstinStatusBadge({ status }) {
  if (status === 'idle' || status === 'checking') return null;
  const configs = {
    verified: {
      bg: '#f0fdf4', border: '#86efac', color: '#16a34a',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20,6 9,17 4,12" />
        </svg>
      ),
      text: 'GST verified successfully. You may proceed.',
    },
    exists: {
      bg: '#fff1f2', border: '#fca5a5', color: '#dc2626',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
      text: 'This GSTIN is already registered. Please use a different GSTIN or sign in with the existing account.',
    },
    error: {
      bg: '#fffbeb', border: '#fcd34d', color: '#b45309',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      text: 'Unable to verify the GST number at the moment. Please try again.',
    },
  };
  const cfg = configs[status];
  if (!cfg) return null;
  return (
    <div className="gstin-badge" style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
      {cfg.icon}<span>{cfg.text}</span>
    </div>
  );
}

/* ─── Stepper ─────────────────────────────────────────────────── */
const STEPS = ['Business Details', 'Pickup Address', 'Bank Details'];
function Stepper({ current }) {
  return (
    <div className="ob-stepper">
      {STEPS.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'pending';
        return (
          <React.Fragment key={label}>
            <div className={`ob-step ${state}`}>
              <div className="ob-step-circle">
                {state === 'done' ? <CheckIcon /> : i + 1}
              </div>
              <span className="ob-step-label">{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`ob-step-line${i < current ? ' filled' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─── FAQ Accordion ───────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: 'How do I update the details linked to my GSTIN?',
    a: 'You can update your details by visiting the Government portal and modifying the information on your GSTIN. Your business details will automatically be fetched from your GSTIN.',
  },
  {
    q: 'Where will this information be used?',
    a: 'Your GSTIN and signature will be used to issue an invoice to the buyer.',
  },
  {
    q: 'Can I create a seller account with a composite GSTIN?',
    a: 'As per Government regulations, sellers with a composite GSTIN cannot sell on e-commerce platforms. Our partner TaxBuddy can help you in getting a regular GSTIN, or you can apply for one directly from the Government portal.',
  },

];

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <div className="faq-section">
      <h3 className="faq-title">Frequently Asked Questions</h3>
      <div className="faq-list">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i} className={`faq-item${isOpen ? ' faq-item--open' : ''}`}>
              <button
                className="faq-question"
                onClick={() => setOpenIndex(isOpen ? -1 : i)}
                aria-expanded={isOpen}
              >
                <span>{item.q}</span>
                <svg
                  className={`faq-chevron${isOpen ? ' faq-chevron--open' : ''}`}
                  width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>
              {isOpen && (
                <div className="faq-answer">
                  <p>{item.a}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Onboarding Page ────────────────────────────────────── */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    logout();
    navigate("/signin", { replace: true });
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  useEffect(() => {
    const checkActiveStatus = async () => {
      const email = location.state?.email || sessionStorage.getItem("pendingEmail") || localStorage.getItem("userEmail") || "";
      if (!email) return;
      try {
        const isActive = await checkOnboardStatus(email);
        if (isActive) {
          console.log("[OnboardingPage] Seller is already active. Redirecting to dashboard.");
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        console.error("[OnboardingPage] Failed to verify onboard status on mount:", err);
      }
    };
    checkActiveStatus();
  }, [location.state?.email, navigate]);

  const [step, setStep] = useState(0);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── CHANGED: noGstin defaults to false so GSTIN field shows first ──
  const [form, setForm] = useState({
    gstin: '', noGstin: false, tradeName: '', panCard: '',
    houseNo: '', roadName: '', pinCode: '', city: '', state: '', country: '', landmark: '',
    latitude: '', longitude: '', formattedAddress: '',
    bankName: '', accountHolderName: '', accountNumber: '', reAccountNumber: '', ifscCode: '',
  });
  const [errors, setErrors] = useState({});

  /* ── GSTIN ── */
  const [gstinStatus, setGstinStatus] = useState('idle');
  const gstinDebounceRef = useRef(null);

  /* ── Pincode ── */
  const [pincodeStatus, setPincodeStatus] = useState('idle');
  const [pincodeMsg, setPincodeMsg] = useState('');
  const pincodeDebounceRef = useRef(null);

  /* ── Bank dropdown ── */
  const [bankSearch, setBankSearch] = useState('');
  const [showBankList, setShowBankList] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const bankDropdownRef = useRef(null);
  const bankInputRef = useRef(null);

  /* ── Map / address ── */
  const [showMapModal, setShowMapModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [autofilled, setAutofilled] = useState(false);
  const [detectingLoc, setDetectingLoc] = useState(false);

  /* ── Account visibility ── */
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showReAccountNumber, setShowReAccountNumber] = useState(false);

  const [bankList, setBankList] = useState([]);
  const [bankLoading, setBankLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadBanks = async () => {
      try {
        setBankLoading(true);
        const list = await fetchBankList();
        if (active) {
          setBankList(list.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (err) {
        console.error("Failed to load bank list:", err);
      } finally {
        if (active) setBankLoading(false);
      }
    };
    loadBanks();
    return () => { active = false; };
  }, []);

  const filteredBanks = bankSearch.trim() === ''
    ? bankList.map(b => b.name)
    : bankList.map(b => b.name).filter((b) => b.toLowerCase().includes(bankSearch.toLowerCase().trim()));

  /* ── Bank dropdown outside-click ── */
  useEffect(() => {
    const handler = (e) => {
      if (
        bankDropdownRef.current && !bankDropdownRef.current.contains(e.target) &&
        bankInputRef.current && !bankInputRef.current.contains(e.target)
      ) {
        setShowBankList(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── GSTIN debounce + API call ── */
 /* ── GSTIN debounce + API call ── */
  const lastCheckedGstinRef = useRef('');
  const gstinCheckSeqRef = useRef(0);

  useEffect(() => {
    if (form.noGstin) { setGstinStatus('idle'); return; }
    const gstin = form.gstin.trim().toUpperCase();
    const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

    if (!gstin || gstin.length !== 15 || !GSTIN_REGEX.test(gstin)) {
      setGstinStatus('idle');
      clearTimeout(gstinDebounceRef.current);
      lastCheckedGstinRef.current = '';
      return;
    }

    if (gstin === lastCheckedGstinRef.current && gstinStatus !== 'idle') {
      return;
    }

    setGstinStatus('checking');
    clearTimeout(gstinDebounceRef.current);

    gstinDebounceRef.current = setTimeout(async () => {
      const seq = ++gstinCheckSeqRef.current;
      try {
        const exists = await checkGSTINExists(gstin);
        if (seq !== gstinCheckSeqRef.current) return;
        lastCheckedGstinRef.current = gstin;
        setGstinStatus(exists ? 'exists' : 'verified');
        setErrors((prev) => {
          const next = { ...prev };
          if (exists) {
            next.gstin = 'This GSTIN is already registered. Please use a different GSTIN or sign in with the existing account.';
          } else if (
            next.gstin === 'This GST number is already registered. Please use a different GST Number.' ||
            next.gstin === 'This GSTIN is already registered as a seller.'
          ) {
            delete next.gstin;
          }
          return next;
        });
      } catch (err) {
        if (seq !== gstinCheckSeqRef.current) return;
        console.error('[GSTIN check] Failed:', err);
        setGstinStatus('error');
        setErrors((prev) => ({
          ...prev,
          gstin: 'Unable to verify the GST number at the moment. Please try again.',
        }));
      }
    }, 700);

    return () => clearTimeout(gstinDebounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.gstin, form.noGstin]);

  /* ── Pincode API ── */
  useEffect(() => {
    const pin = form.pinCode.trim();
    if (pin.length !== 6 || !/^[1-9][0-9]{5}$/.test(pin)) {
      setPincodeStatus('idle');
      setPincodeMsg('');
      return;
    }
    setPincodeStatus('loading');
    setPincodeMsg('');
    clearTimeout(pincodeDebounceRef.current);
    pincodeDebounceRef.current = setTimeout(async () => {
      try {
        const result = await fetchPincodeData(pin);
        setPincodeStatus('success');
        setPincodeMsg(`${result.city}, ${result.state}`);
        setForm((prev) => ({ ...prev, city: result.city, state: result.state, country: result.country }));
        setErrors((prev) => {
          const next = { ...prev };
          ['city', 'state', 'country'].forEach((f) => delete next[f]);
          return next;
        });
      } catch {
        setPincodeStatus('error');
        setPincodeMsg('Invalid pincode — please check and re-enter.');
      }
    }, 500);
    return () => clearTimeout(pincodeDebounceRef.current);
  }, [form.pinCode]);

  /* ── Scroll active bank option into view ── */
  useEffect(() => {
    if (activeIndex >= 0 && bankDropdownRef.current) {
      const item = bankDropdownRef.current.querySelector(`[data-index="${activeIndex}"]`);
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  /* ── Validators ── */
  const validateGSTIN = (g) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(g);
  const validatePAN = (pan) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
  const validateIFSC = (c) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(c);
  const validatePIN = (p) => /^[1-9][0-9]{5}$/.test(p);
  const validateAccNo = (a) => /^[0-9]{9,18}$/.test(a);

  /* ── Inline real-time validation ── */
  const getInlineError = (field, value, currentForm) => {
    const v = typeof value === 'string' ? value.trim() : value;
    switch (field) {
      case 'gstin':
        if (!v) return '';
        if (v.length < 15) return `GSTIN must be 15 characters (${v.length}/15)`;
        if (!validateGSTIN(v.toUpperCase())) return 'Invalid GSTIN — format: 22ABCDE1234F1Z5';
        return '';
      case 'panCard':
        if (!v) return '';
        if (v.length < 10) return `PAN must be 10 characters (${v.length}/10)`;
        if (!validatePAN(v.toUpperCase())) return 'Invalid PAN — format: ABCDE1234F';
        return '';
      case 'pinCode':
        if (!v) return '';
        if (v.length < 6) return `Pin Code must be 6 digits (${v.length}/6)`;
        if (!validatePIN(v)) return 'Invalid Pin Code — must start with a non-zero digit';
        return '';
      case 'ifscCode': {
        if (!v) return '';
        if (v.length < 11) return `IFSC must be 11 characters (${v.length}/11)`;
        if (!validateIFSC(v.toUpperCase())) return 'Invalid IFSC — format: SBIN0001234';
        const selectedBank = currentForm?.bankName;
        if (selectedBank) {
          const bankObj = bankList.find(b => b.name === selectedBank);
          if (bankObj && bankObj.code && !v.toUpperCase().startsWith(bankObj.code)) {
            return `IFSC code does not match ${selectedBank}. Please enter a valid IFSC code.`;
          }
        }
        return '';
      }
      case 'accountNumber':
        if (!v) return '';
        if (v.length < 9) return `Account number too short — min 9 digits (${v.length} entered)`;
        if (v.length > 18) return 'Account number too long — max 18 digits';
        if (!validateAccNo(v)) return 'Account number must contain digits only';
        return '';
      case 'reAccountNumber':
        if (!v) return '';
        if (v !== (currentForm?.accountNumber ?? '')) return 'Account numbers do not match.';
        return '';
      default:
        return '';
    }
  };

  const handleChange = (field, value) => {
    let cleaned = value;

    if (field === 'gstin' || field === 'panCard' || field === 'ifscCode') {
      cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    } else if (field === 'pinCode' || field === 'accountNumber' || field === 'reAccountNumber') {
      cleaned = value.replace(/\D/g, '');
    } else if (field === 'tradeName') {
      cleaned = value.replace(/[^a-zA-Z0-9\s.\-,/&]/g, '');
    } else if (field === 'accountHolderName') {
      cleaned = value.replace(/[^a-zA-Z0-9\s.\-]/g, '');
    } else if (field === 'city' || field === 'state' || field === 'country') {
      cleaned = value.replace(/[^a-zA-Z\s.\-]/g, '');
    } else if (field === 'houseNo' || field === 'roadName' || field === 'landmark') {
      cleaned = value.replace(/[^a-zA-Z0-9\s.\-,\/#()]/g, '');
    }

    setForm((prev) => {
      const next = { ...prev, [field]: cleaned };
      if (field === 'bankName') {
        next.ifscCode = '';
      }
      const inlineErr = getInlineError(field, cleaned, next);
      
      let reAccErr = undefined;
      if (field === 'accountNumber' || field === 'reAccountNumber') {
        reAccErr = getInlineError('reAccountNumber', next.reAccountNumber, next);
      }

      setErrors((e) => {
        const updated = { ...e, [field]: inlineErr };
        if (!inlineErr) delete updated[field];
        if (field === 'bankName') {
          delete updated.ifscCode;
        }
        if (reAccErr !== undefined) {
          if (reAccErr) {
            updated.reAccountNumber = reAccErr;
          } else {
            delete updated.reAccountNumber;
          }
        }
        return updated;
      });

      return next;
    });
  };

  /* ── Step validation ── */
  const validateStep = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.noGstin) {
        if (!form.gstin.trim()) {
          e.gstin = 'GSTIN is required';
        } else if (!validateGSTIN(form.gstin.toUpperCase())) {
          e.gstin = 'Invalid GSTIN — format: 22ABCDE1234F1Z5';
        } else if (gstinStatus === 'exists') {
          e.gstin = 'This GSTIN is already registered. Please use a different GSTIN or sign in with the existing account.';
        } else if (gstinStatus === 'checking') {
          e.gstin = 'Please wait — verifying GSTIN…';
        } else if (gstinStatus === 'error') {
          e.gstin = 'Unable to verify the GST number at the moment. Please try again.';
        } else if (gstinStatus !== 'verified') {
          e.gstin = 'Please wait for GSTIN verification to complete.';
        }
      }
      if (!form.tradeName.trim()) e.tradeName = 'Trade Name is required';
      if (form.noGstin) {
        if (!form.panCard.trim()) e.panCard = 'PAN Card is required';
        else if (!validatePAN(form.panCard.toUpperCase())) e.panCard = 'Invalid PAN — format: ABCDE1234F';
      }
    }
    if (s === 1) {
      if (!form.houseNo.trim()) e.houseNo = 'House No. / Building Name is required';
      if (!form.roadName.trim()) e.roadName = 'Road Name / Area / Colony is required';
      if (!form.pinCode.trim()) e.pinCode = 'Pin Code is required';
      else if (!validatePIN(form.pinCode)) e.pinCode = 'Invalid Pin Code (6 digits, non-zero start)';
      if (!form.city.trim()) e.city = 'City is required';
      if (!form.state.trim()) e.state = 'State is required';
      if (!form.country.trim()) e.country = 'Country is required';
    }
    if (s === 2) {
      if (!form.bankName || !bankList.some(b => b.name === form.bankName)) {
        e.bankName = 'Please select a valid bank from the list.';
      }
      if (!form.accountHolderName.trim()) e.accountHolderName = 'Account Holder Name is required';
      if (!form.accountNumber) e.accountNumber = 'Account Number is required';
      else if (!validateAccNo(form.accountNumber)) e.accountNumber = 'Account number must be 9–18 digits';
      if (!form.reAccountNumber) e.reAccountNumber = 'Please re-enter account number';
      else if (form.accountNumber !== form.reAccountNumber) e.reAccountNumber = 'Account numbers do not match.';

      if (!form.ifscCode.trim()) {
        e.ifscCode = 'IFSC Code is required';
      } else if (!validateIFSC(form.ifscCode.toUpperCase())) {
        e.ifscCode = 'Invalid IFSC — format: SBIN0001234';
      } else if (form.bankName) {
        const bankObj = bankList.find(b => b.name === form.bankName);
        if (bankObj && bankObj.code && !form.ifscCode.toUpperCase().trim().startsWith(bankObj.code)) {
          e.ifscCode = `IFSC code does not match ${form.bankName}. Please enter a valid IFSC code.`;
        }
      }
    }
    return e;
  };

  /* ── Continue / Submit ── */
  const handleContinue = async () => {
    const e = validateStep(step);
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    if (step < 2) {
      setStep((s) => s + 1);
      setErrors({});
      return;
    }

    /* ── Final step: call Seller Onboarding API ── */
    setSubmitLoading(true);
    setSubmitError('');
    // ── Retrieve the logged-in user's email (adjust the key to match your auth storage)
    const userEmail =
      location.state?.email ||
      sessionStorage.getItem('pendingEmail') ||
      localStorage.getItem('pendingEmail') ||
      '';

    if (!userEmail) {
      setSubmitError('Session expired — your email could not be found. Please sign in again.');
      setSubmitLoading(false);
      return;
    } const payload = {
      email: userEmail,
      updateFields: {
        gstin: form.noGstin ? 'optional' : form.gstin.trim().toUpperCase(),
        panNumber: form.noGstin ? form.panCard.trim().toUpperCase() : undefined,
        companyName: form.tradeName.trim(),
        bankName: form.bankName,
        accountHolder: form.accountHolderName.trim(),
        accountNumber: Number(form.accountNumber),
        ifscCode: form.ifscCode.trim().toUpperCase(),
        storageType: 'Seller',
        address: [form.houseNo.trim(), form.roadName.trim()].filter(Boolean).join(', '),
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        pincode: form.pinCode.trim(),
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        formattedAddress: form.formattedAddress || undefined,
        status: 'Active',
        onboardDateTime: new Date().toISOString(),
        accountManager: 'Haatza Support Team',
      },
    };

    console.group("[Onboarding] Data being saved to DB");
    console.log("Full payload:", JSON.stringify(payload, null, 2));
    console.groupEnd();
    try {
      const res = await fetch('https://www.haatzaseller.com/_functions/Selleronboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data = {};
      try { data = await res.json(); } catch { /* non-JSON response */ }

      console.group("[Onboarding] API response");
      console.log("HTTP status:", res.status);
      console.log("Full response:", JSON.stringify(data, null, 2));
      console.groupEnd();
      if (!res.ok) {
        const serverMsg = data?.message || data?.error || `Server error ${res.status}`;
        setSubmitError(typeof serverMsg === 'string' ? serverMsg : JSON.stringify(serverMsg));
        return;
      }

      // Backend can return `message` as an array of records rather than a
      // single object — unwrap it first so field lookups below don't
      // silently fail against an array.
      let messageRoot = data?.message;
      if (Array.isArray(messageRoot)) messageRoot = messageRoot[0] || {};
      if (typeof messageRoot !== 'object' || messageRoot === null) messageRoot = {};

      const isSuccess =
        data?.status === 'success' ||
        (typeof data?.message?.message === 'string' && data.message.message.toLowerCase().includes('success'));

      if (isSuccess) {
        // Extract sellerId from onboarding response
        const sellerId =
          messageRoot.sellerId ||
          messageRoot.body?.sellerId ||
          messageRoot.SellerID ||
          messageRoot.body?.SellerID ||
          data?.data?.sellerId ||
          data?.data?.SellerID ||
          data?.seller?.sellerId ||
          data?.SellerID ||
          data?.sellerId ||
          "";

        console.log("[Onboarding] Full response:", data);
        console.log("[Onboarding] Resolved sellerId:", sellerId || "❌ NOT FOUND IN RESPONSE");

        if (sellerId) {
          localStorage.setItem("sellerId", String(sellerId));
          sessionStorage.setItem("sellerId", String(sellerId));
          localStorage.setItem("__haatza_sellerId", String(sellerId));
          sessionStorage.setItem("__haatza_sellerId", String(sellerId));
          console.log("[Onboarding] ✅ Stored sellerId:", sellerId);
        } else {
          console.warn("[Onboarding] ⚠️ sellerId not in response — check above log for correct path");
        }

        // ── Capture sellerPinCode from onboarding response ──────────────────
        const sellerPinCodeFromApi =
          messageRoot.sellerPinCode ||
          messageRoot.body?.sellerPinCode ||
          messageRoot.pinCode ||
          messageRoot.body?.pinCode ||
          messageRoot.pincode ||
          data?.sellerPinCode ||
          data?.pinCode ||
          "";

        if (sellerPinCodeFromApi && /^\d{6}$/.test(String(sellerPinCodeFromApi).trim())) {
          const pin = String(sellerPinCodeFromApi).trim();
          sessionStorage.setItem("__haatza_sellerPinCode", pin);
          localStorage.setItem("__haatza_sellerPinCode", pin);
          sessionStorage.setItem("sellerPinCode", pin);
          localStorage.setItem("sellerPinCode", pin);
          console.log("[Onboarding] ✅ Stored sellerPinCode from API:", pin);
        } else {
          // Fallback: use the pinCode the seller entered in the form
          const formPin = form.pinCode.trim();
          if (formPin && /^\d{6}$/.test(formPin)) {
            sessionStorage.setItem("__haatza_sellerPinCode", formPin);
            localStorage.setItem("__haatza_sellerPinCode", formPin);
            sessionStorage.setItem("sellerPinCode", formPin);
            localStorage.setItem("sellerPinCode", formPin);
            console.log("[Onboarding] ✅ Stored sellerPinCode from form input:", formPin);
          }
        }

        // Store pinCode so settlement + listing payload can find it
        const pinCode = form.pinCode.trim();
        if (pinCode) {
          localStorage.setItem("sellerPinCode", pinCode);
          sessionStorage.setItem("sellerPinCode", pinCode);
          console.log("[Onboarding] ✅ Stored sellerPinCode:", pinCode);
        }
        const CANONICAL_PIN_KEY = "__haatza_sellerPinCode";
        const CANONICAL_SELLER_KEY = "__haatza_sellerId";

        if (pinCode) {
          sessionStorage.setItem(CANONICAL_PIN_KEY, pinCode);
          localStorage.setItem(CANONICAL_PIN_KEY, pinCode);
          // Also write to legacy keys so any fallback reads still work
          sessionStorage.setItem("sellerPinCode", pinCode);
          localStorage.setItem("sellerPinCode", pinCode);
          console.log("[Onboarding] ✅ Wrote pinCode to canonical + legacy keys:", pinCode);
        }

        // If the onboarding response included a sellerId, write it to canonical key too
        if (sellerId) {
          sessionStorage.setItem(CANONICAL_SELLER_KEY, String(sellerId));
          localStorage.setItem(CANONICAL_SELLER_KEY, String(sellerId));
          console.log("[Onboarding] ✅ Wrote sellerId to canonical key:", sellerId);
        }

        // Re-fetch profile so canonical cache is authoritative for QC payload

        // ✅ ADD THIS: cache under the canonical key and re-fetch full profile

        // Store email under all keys the listing flow checks
        if (userEmail) {
          localStorage.setItem("userEmail", userEmail);
          sessionStorage.setItem("userEmail", userEmail);
        }

        // Cache tradeName as companyName
        const companyName = form.tradeName.trim();
        if (companyName) {
          localStorage.setItem("companyName", companyName);
          sessionStorage.setItem("companyName", companyName);
          try {
            const currentUser = JSON.parse(sessionStorage.getItem("haatza_user") || localStorage.getItem("haatza_user") || "{}");
            currentUser.companyName = companyName;
            currentUser.email = currentUser.email || userEmail;
            sessionStorage.setItem("haatza_user", JSON.stringify(currentUser));
            localStorage.setItem("haatza_user", JSON.stringify(currentUser));
          } catch { }
          console.log("[Onboarding] ✅ companyName saved to storage:", companyName);
        }

        localStorage.setItem("__haatza_just_onboarded", "true");
        navigate('/dashboard');
      } else {
        setSubmitError(data?.message || 'Submission failed. Please try again.');
      }
    } catch (err) {
      console.error('Onboarding fetch error:', err);
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 0) { setStep((s) => s - 1); setErrors({}); }
  };

  const handleLocationSelect = (parsed) => {
    setForm((prev) => ({
      ...prev,
      houseNo: parsed.houseNo || prev.houseNo,
      roadName: parsed.roadName || prev.roadName,
      pinCode: parsed.pinCode || prev.pinCode,
      city: parsed.city || prev.city,
      state: parsed.state || prev.state,
      country: parsed.country || prev.country,
      landmark: parsed.landmark || prev.landmark,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      formattedAddress: parsed.formattedAddress,
    }));
    setErrors((prev) => {
      const next = { ...prev };
      ['houseNo', 'roadName', 'pinCode', 'city', 'state', 'country', 'landmark'].forEach((f) => delete next[f]);
      return next;
    });
    setAutofilled(true);
    setShowToast(true);
    setTimeout(() => setAutofilled(false), 1700);
    setTimeout(() => setShowToast(false), 2700);
  };

  const handleLocationButtonClick = () => {
    setShowMapModal(true);
  };

  const selectBank = (bankName) => {
    handleChange('bankName', bankName);
    setBankSearch('');
    setShowBankList(false);
    setActiveIndex(-1);
  };

  const handleBankKeyDown = (e) => {
    if (!showBankList) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filteredBanks.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIndex >= 0 && filteredBanks[activeIndex]) selectBank(filteredBanks[activeIndex]); }
    else if (e.key === 'Escape') { setShowBankList(false); setActiveIndex(-1); }
  };

  /* ─── Brand bar ── */
  const BrandBar = () => (
    <div className="ob-brand">
      <div className="ob-brand-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 01-8 0" />
        </svg>
      </div>
      <h1>Complete your onboarding</h1>
      <p>Provide details to start listing products on Haatza</p>
    </div>
  );

  /* ─── Render ── */
  return (
    <>
      <div className="ob-shell">
        <div className="ob-card">
          <BrandBar />
          <Stepper current={step} />

          {/* ── Step 0: Business Details ── */}
          {step === 0 && (
            <div className="ob-body">
              <h2 className="ob-section-title">Business Details</h2>
              <p className="ob-section-sub">Do you have a GSTIN Number?</p>

              {/* GSTIN field — always visible */}
              {(() => {
                const isValid = !errors.gstin && form.gstin.length === 15 && gstinStatus !== 'exists';
                return (
                  <FormField label="GSTIN" required={!form.noGstin} error={!form.noGstin ? errors.gstin : undefined}>
                    <div style={{ position: 'relative' }}>
                      <input
                        className={`form-input ${!form.noGstin && errors.gstin ? 'input-error' : !form.noGstin && isValid ? 'input-valid' : ''}`}
                        style={{ paddingRight: 40, opacity: form.noGstin ? 0.45 : 1 }}
                        type="text" placeholder="GSTIN" maxLength={15}
                        value={form.gstin}
                        disabled={form.noGstin}
                        onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
                      />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                        {!form.noGstin && gstinStatus === 'checking' ? (
                          <SpinnerIcon />
                        ) : !form.noGstin && isValid ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20,6 9,17 4,12" />
                          </svg>
                        ) : null}
                      </span>
                    </div>
                    {!form.noGstin && !errors.gstin && (
                      <span className="field-hint">

                      </span>
                    )}
                    {!form.noGstin && <GstinStatusBadge status={gstinStatus} />}
                  </FormField>
                );
              })()}

              {/* Checkbox */}
              <label className="checkbox-label">
                <input
                  type="checkbox" className="checkbox-input" checked={form.noGstin}
                  onChange={(e) => {
                    handleChange('noGstin', e.target.checked);
                    if (e.target.checked) { handleChange('gstin', ''); setGstinStatus('idle'); }
                    else { handleChange('panCard', ''); }
                  }}
                />
                <span className="checkbox-text">Don't have a GSTIN Number?</span>
              </label>

              {/* No-GST nudge message */}
              {form.noGstin && (
                <div className="no-gstin-nudge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span>No GST? No problem! Start selling with just your EID in minutes.</span>
                </div>
              )}

              {/* Trade Name — shown when noGstin is checked */}
              {form.noGstin && (
                <FormField label="Trade Name" required error={errors.tradeName}>
                  <input
                    className={`form-input ${errors.tradeName ? 'input-error' : ''}`}
                    type="text" placeholder="Trade Name"
                    value={form.tradeName}
                    onChange={(e) => handleChange('tradeName', e.target.value)}
                  />
                </FormField>
              )}

              {/* Trade Name — shown when noGstin is NOT checked (GSTIN flow) */}
              {!form.noGstin && (
                <FormField label="Trade Name" required error={errors.tradeName}>
                  <input
                    className={`form-input ${errors.tradeName ? 'input-error' : ''}`}
                    type="text" placeholder="Trade Name"
                    value={form.tradeName}
                    onChange={(e) => handleChange('tradeName', e.target.value)}
                  />
                </FormField>
              )}

              {/* PAN field — shown only when noGstin is checked */}
              {form.noGstin && (() => {
                const isValid = !errors.panCard && form.panCard.length === 10 && validatePAN(form.panCard);
                return (
                  <FormField label="PAN Card Number" required error={errors.panCard}>
                    <div style={{ position: 'relative' }}>
                      <input
                        className={`form-input ${errors.panCard ? 'input-error' : isValid ? 'input-valid' : ''}`}
                        style={{ paddingRight: 40 }}
                        type="text" placeholder="PAN Card"
                        value={form.panCard} maxLength={10}
                        onChange={(e) => handleChange('panCard', e.target.value.toUpperCase())}
                      />
                      {isValid && (
                        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20,6 9,17 4,12" />
                          </svg>
                        </span>
                      )}
                    </div>
                    {!errors.panCard && (
                      <span className="field-hint">

                      </span>
                    )}
                  </FormField>
                );
              })()}
            </div>
          )}

          {/* ── Step 1: Pickup Address ── */}
          {step === 1 && (
            <div className="ob-body">
              <div className="address-row">
                <div>
                  <h2 className="ob-section-title">Pickup Address</h2>
                  <p className="ob-section-sub" style={{ marginBottom: 0 }}>Where will your products be picked up from?</p>
                </div>
                <button
                  className="location-btn"
                  onClick={handleLocationButtonClick}
                  disabled={detectingLoc}
                >
                  <LocationIcon /><span>{detectingLoc ? 'Detecting...' : 'Use My Location'}</span>
                </button>
              </div>

              <FormField label="House no. / Building Name" required error={errors.houseNo}>
                <input
                  className={`form-input ${errors.houseNo ? 'input-error' : ''} ${autofilled && form.houseNo ? 'autofilled' : ''}`}
                  type="text" placeholder="House no. / Building Name"
                  value={form.houseNo}
                  onChange={(e) => handleChange('houseNo', e.target.value)}
                />
              </FormField>

              <FormField label="Road Name/Area/Colony" required error={errors.roadName}>
                <input
                  className={`form-input ${errors.roadName ? 'input-error' : ''} ${autofilled && form.roadName ? 'autofilled' : ''}`}
                  type="text" placeholder="Road Name / Area / Colony"
                  value={form.roadName}
                  onChange={(e) => handleChange('roadName', e.target.value)}
                />
              </FormField>

              <div className="two-col">
                <FormField label="Pin Code" required error={errors.pinCode}>
                  <div style={{ position: 'relative' }}>
                    <input
                      className={`form-input ${errors.pinCode ? 'input-error' : pincodeStatus === 'success' ? 'input-valid' : ''} ${autofilled && form.pinCode ? 'autofilled' : ''}`}
                      style={{ paddingRight: pincodeStatus === 'loading' ? 40 : 14 }}
                      type="text" placeholder="Pin Code"
                      value={form.pinCode} maxLength={6}
                      onChange={(e) => {
                        setPincodeStatus('idle');
                        setPincodeMsg('');
                        handleChange('pinCode', e.target.value.replace(/\D/g, ''));
                      }}
                    />
                    {pincodeStatus === 'loading' && (
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                        <SpinnerIcon />
                      </span>
                    )}
                  </div>
                  {!errors.pinCode && pincodeStatus === 'loading' && (
                    <span className="pincode-status loading">
                      <SpinnerIcon color="#2962ff" /> Looking up pincode…
                    </span>
                  )}
                  {!errors.pinCode && pincodeStatus === 'success' && (
                    <span className="pincode-status success">✓ {pincodeMsg}</span>
                  )}
                  {!errors.pinCode && pincodeStatus === 'error' && (
                    <span className="pincode-status error">⚠ {pincodeMsg}</span>
                  )}
                </FormField>

                <FormField label="City" required error={errors.city}>
                  <input
                    className={`form-input ${errors.city ? 'input-error' : ''} ${autofilled && form.city ? 'autofilled' : ''}`}
                    type="text" placeholder="City"
                    value={form.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    disabled={pincodeStatus === 'loading'}
                  />
                </FormField>
              </div>

              <div className="two-col">
                <FormField label="State" required error={errors.state}>
                  <input
                    className={`form-input ${errors.state ? 'input-error' : ''} ${autofilled && form.state ? 'autofilled' : ''}`}
                    type="text" placeholder="State"
                    value={form.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    disabled={pincodeStatus === 'loading'}
                  />
                </FormField>
                <FormField label="Country" required error={errors.country}>
                  <input
                    className={`form-input ${errors.country ? 'input-error' : ''} ${autofilled && form.country ? 'autofilled' : ''}`}
                    type="text" placeholder="Country"
                    value={form.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                  />
                </FormField>
              </div>

              <FormField label="Landmark (Optional)">
                <input
                  className={`form-input ${autofilled && form.landmark ? 'autofilled' : ''}`}
                  type="text" placeholder="Landmark"
                  value={form.landmark}
                  onChange={(e) => handleChange('landmark', e.target.value)}
                />
              </FormField>
            </div>
          )}

          {/* ── Step 2: Bank Details ── */}
          {step === 2 && (
            <div className="ob-body">
              <h2 className="ob-section-title">Bank Account Information</h2>
              <p className="ob-section-sub">For a successful bank verification, account name must match with the registered GSTIN name or trade name</p>

              <FormField label="Bank Name" required error={errors.bankName}>
                <div className="bank-selector">
                  <div className="bank-input-wrap">
                    <svg className="bank-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      ref={bankInputRef}
                      className={`form-input bank-search-input ${errors.bankName ? 'input-error' : ''}`}
                      type="text" placeholder="Bank Name" autoComplete="off"
                      value={form.bankName ? form.bankName : bankSearch}
                      onFocus={() => {
                        if (form.bankName) setBankSearch('');
                        handleChange('bankName', '');
                        setShowBankList(true);
                        setActiveIndex(-1);
                      }}
                      onChange={(e) => {
                        setBankSearch(e.target.value);
                        handleChange('bankName', '');
                        setShowBankList(true);
                        setActiveIndex(-1);
                      }}
                      onKeyDown={handleBankKeyDown}
                    />
                    {(bankSearch || form.bankName) && (
                      <button
                        className="bank-clear-btn"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setBankSearch('');
                          handleChange('bankName', '');
                          setShowBankList(true);
                          if (bankInputRef.current) bankInputRef.current.focus();
                        }}
                        title="Clear"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {showBankList && (
                    <div className="bank-dropdown-wrap">
                      <div className="bank-dropdown-header">
                        {bankSearch.trim() === '' ? (
                          <span>{bankList.length} banks available — type to search</span>
                        ) : (
                          <span>{filteredBanks.length} result{filteredBanks.length !== 1 ? 's' : ''} for "<strong>{bankSearch}</strong>"</span>
                        )}
                      </div>
                      <ul ref={bankDropdownRef} className="bank-dropdown">
                        {filteredBanks.length > 0 ? filteredBanks.map((b, idx) => {
                          const lowerB = b.toLowerCase();
                          const lowerQ = bankSearch.toLowerCase().trim();
                          const start = lowerQ ? lowerB.indexOf(lowerQ) : -1;
                          return (
                            <li
                              key={b} data-index={idx}
                              className={`bank-option${activeIndex === idx ? ' bank-option-active' : ''}`}
                              onMouseDown={() => selectBank(b)}
                              onMouseEnter={() => setActiveIndex(idx)}
                            >
                              {start >= 0 && lowerQ ? (
                                <>
                                  {b.slice(0, start)}
                                  <mark className="bank-highlight">{b.slice(start, start + lowerQ.length)}</mark>
                                  {b.slice(start + lowerQ.length)}
                                </>
                              ) : b}
                            </li>
                          );
                        }) : (
                          <li className="bank-option bank-no-result">No banks found for "{bankSearch}"</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </FormField>

              <FormField label="Account Holder Name" required error={errors.accountHolderName}>
                <input
                  className={`form-input ${errors.accountHolderName ? 'input-error' : ''}`}
                  type="text" placeholder="Account Holder Name"
                  value={form.accountHolderName}
                  onChange={(e) => handleChange('accountHolderName', e.target.value)}
                />
              </FormField>

              {/* Account Number */}
              {(() => {
                const isValid = !errors.accountNumber && form.accountNumber.length >= 9 && form.accountNumber.length <= 18;
                return (
                  <FormField label="Account Number" required error={errors.accountNumber}>
                    <div className="account-input-wrap">
                      <input
                        className={`form-input account-input ${errors.accountNumber ? 'input-error' : isValid ? 'input-valid' : ''}`}
                        type={showAccountNumber ? 'text' : 'password'}
                        placeholder="Account Number"
                        value={form.accountNumber} maxLength={18}
                        onChange={(e) => handleChange('accountNumber', e.target.value.replace(/\D/g, ''))}
                        onCopy={(e) => e.preventDefault()}
                        onPaste={(e) => e.preventDefault()}
                        onCut={(e) => e.preventDefault()}
                        onDrop={(e) => e.preventDefault()}
                      />
                      <button type="button" className="eye-toggle-btn" onClick={() => setShowAccountNumber((v) => !v)}>
                        {showAccountNumber ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                    {!errors.accountNumber && (
                      <span className="field-hint"></span>
                    )}
                  </FormField>
                );
              })()}

              {/* Re-enter Account Number */}
              {(() => {
                const match = form.reAccountNumber && form.reAccountNumber === form.accountNumber;
                return (
                  <FormField label="Re-enter Account Number" required error={errors.reAccountNumber}>
                    <div className="account-input-wrap">
                      <input
                        className={`form-input account-input ${errors.reAccountNumber ? 'input-error' : match ? 'input-valid' : ''}`}
                        type={showReAccountNumber ? 'text' : 'password'}
                        placeholder="Re-enter Account Number"
                        value={form.reAccountNumber} maxLength={18}
                        onChange={(e) => handleChange('reAccountNumber', e.target.value.replace(/\D/g, ''))}
                        onCopy={(e) => e.preventDefault()}
                        onPaste={(e) => e.preventDefault()}
                        onCut={(e) => e.preventDefault()}
                        onDrop={(e) => e.preventDefault()}
                      />
                      <button type="button" className="eye-toggle-btn" onClick={() => setShowReAccountNumber((v) => !v)}>
                        {showReAccountNumber ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </FormField>
                );
              })()}

              {/* IFSC */}
              {(() => {
                const isValid = !errors.ifscCode && form.ifscCode.length === 11 && validateIFSC(form.ifscCode);
                return (
                  <FormField label="IFSC Code" required error={errors.ifscCode}>
                    <div style={{ position: 'relative' }}>
                      <input
                        className={`form-input ${errors.ifscCode ? 'input-error' : isValid ? 'input-valid' : ''}`}
                        style={{ paddingRight: 40 }}
                        type="text" placeholder="IFSC Code"
                        value={form.ifscCode} maxLength={11}
                        onChange={(e) => handleChange('ifscCode', e.target.value.toUpperCase())}
                      />
                      {isValid && (
                        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20,6 9,17 4,12" />
                          </svg>
                        </span>
                      )}
                    </div>
                    {!errors.ifscCode && (
                      <span className="field-hint"></span>
                    )}
                  </FormField>
                );
              })()}

              {/* ── FAQ Section ── */}
              <FaqAccordion />
            </div>
          )}

          {/* Submit error banner — only shown on step 2 */}
          {submitError && step === 2 && (
            <p className="error-message" style={{ margin: '0 0 12px', textAlign: 'center' }}>
              {submitError}
            </p>
          )}

          {/* Nav buttons */}
          <div className="ob-nav">
            {step > 0 ? (
              <button className="btn-back" onClick={handleBack} disabled={submitLoading}>Back</button>
            ) : (
              <div className="btn-spacer" />
            )}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button className="btn-logout" type="button" onClick={handleLogoutClick}>Logout</button>
              <button className="btn-continue" onClick={handleContinue} disabled={submitLoading}>
                {step < 2 ? 'Continue' : 'Submit'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {showMapModal && (
        <MapModal onClose={() => setShowMapModal(false)} onSelectAddress={handleLocationSelect} />
      )}

      {showToast && (
        <div className="location-toast"><span>✓</span> Address filled from map</div>
      )}

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onYes={handleLogoutConfirm}
        onNo={handleLogoutCancel}
      />
    </>
  );
}