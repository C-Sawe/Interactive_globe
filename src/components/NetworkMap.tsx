import { useState, useEffect, useMemo, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { 
  GeoJsonLayer, 
  ScatterplotLayer, 
  SolidPolygonLayer, 
  ArcLayer, 
  PathLayer, 
  TextLayer 
} from '@deck.gl/layers';
import { 
  _GlobeView as GlobeView, 
  FlyToInterpolator, 
  AmbientLight, 
  //DirectionalLight, 
  LightingEffect 
} from '@deck.gl/core';
import * as turf from '@turf/turf';
import { 
  ZoomIn, ZoomOut, Home, Globe, Target, Layers, 
   Minimize2,  MapPin, 
  Satellite, Network, X, ChevronDown, ChevronUp 
} from 'lucide-react';

// --- CONFIGURATION ---
type Color = [number, number, number];

interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
  transitionDuration?: number | 'auto';
  transitionInterpolator?: any;
  transitionEasing?: (t: number) => number;
}

const TARGET_LOCATION: [number, number] = [37.9062, 0.0236];
const RANCO_PLAZA_HQ: [number, number] = [36.8200, -1.2858];
const HYBRID_MAP_URL = "/countries.geo.json";
const ZOOM_THRESHOLD = 6.0;
const LABEL_APPEAR_ZOOM = 5.8;
const LABEL_FULL_OPACITY_ZOOM = 6.2;

const ELEVATION_ACTIVE = 70000; 
const ELEVATION_WORLD = 70000; 

const GL_PARAMETERS = {
  clearColor: [0, 0, 0, 0], 
  depthTest: true
} as unknown as Record<string, unknown>;

const NETWORK_STYLES: Record<string, Color> = {
  ACTIVE_REGION: [100, 181, 246], 
  ACTIVE_REGION_HIGHLIGHT: [33, 150, 243],
  LAND_COLOR: [234, 234, 234],    
  OCEAN_COLOR: [151, 151, 151],
  BORDER_COLOR: [80, 90, 100], 
  HQ_COLOR: [41, 98, 255],
  ARC_COLOR: [0, 0, 204],
  SITE_POINT_COLOR: [255, 20, 147],
  INTRACOUNTY_MESH_COLOR: [0, 0, 204], 
  INTERCOUNTY_MESH_COLOR: [255, 109, 0],
  PULSE_COLOR: [0, 0, 255] 
};

const REGION_LOCATIONS: Record<string, [number, number]> = {
  "NAIROBI": [36.8219, -1.2921],
  "KAJIADO": [36.7820, -1.8524],
  "KAKAMEGA": [34.7519, 0.2827],
  "ISIOLO": [37.5822, 0.3546],
  "TRANS NZOIA": [35.0000, 1.1000],
  "UASIN GISHU": [35.2698, 0.5143],
  "TURKANA": [35.8667, 3.1167],
  "NAKURU": [36.0667, -0.2833],
  "MERU": [37.6500, 0.0500],
  "KIAMBU": [36.8333, -1.1667],
  "MOMBASA": [39.6682, -4.0435],
  "BUNGOMA": [34.5606, 0.5635],
  "KWALE": [39.4521, -4.1737],
  "KILIFI": [39.9093, -3.5107],
  "KISUMU": [34.7680, -0.0917],
  "MACHAKOS": [37.2634, -1.5177],
  "LAMU": [40.9006, -2.2696],
  // Uganda , Congo  and Rwanda regions
  "KAMPALA": [32.5825, 0.3476],
  "KIGALI": [30.0619, -1.9441],
  "GOMA": [29.2205, -1.6585],
  
};

const ambientLight = new AmbientLight({ color: [255, 255, 255], intensity: 3.0});
const lightingEffect = new LightingEffect({ ambientLight});

const ACTIVE_REGIONS: Record<string, any> = {
  // ... Kenya regions ...
  "NAIROBI": { name: "NAIROBI", fileName: "NAIROBI.geojson" },
  "KAJIADO": { name: "KAJIADO", fileName: "KAJIADO.geojson" },
  "KAKAMEGA": { name: "KAKAMEGA", fileName: "KAKAMEGA.geojson" },
  "ISIOLO": { name: "ISIOLO", fileName: "ISIOLO.geojson" },
  "TRANS NZOIA": { name: "TRANS NZOIA", fileName: "KITALE.geojson" }, 
  "UASIN GISHU": { name: "UASIN GISHU", fileName: "ELDORET.geojson" }, 
  "TURKANA": { name: "TURKANA", fileName: "TURKANA.geojson" },
  "NAKURU": { name: "NAKURU", fileName: "NAKURU.geojson" },
  "MERU": { name: "MERU", fileName: "MERU.geojson" },
  "KIAMBU": { name: "KIAMBU", fileName: "KIAMBU.geojson" },
  "MOMBASA": { name: "MOMBASA", fileName: "MOMBASA.geojson" },
  "BUNGOMA": { name: "BUNGOMA", fileName: "BUNGOMA.geojson" },
  "KWALE": { name: "KWALE", fileName: "KWALE.geojson" },
  "KILIFI": { name: "KILIFI", fileName: "KILIFI.geojson" },
  "KISUMU": { name: "KISUMU", fileName: "KISUMU.geojson" },
  "MACHAKOS": { name: "MACHAKOS", fileName: "MACHAKOS.geojson" },
  "LAMU": { name: "LAMU", fileName: "LAMU.geojson" },

  // Uganda, Rwanda and Congo regions
  "KAMPALA": { name: "KAMPALA", fileName: "geoBoundaries-UGA-ADM1.geojson" },
  "KIGALI": { name: "KIGALI", fileName: "geoBoundaries-RWA-ADM2.geojson" },
  "GOMA": { name: "GOMA", fileName: "geoBoundaries-COD-ADM1.geojson" }
};

const USER_STATS: Record<string, number> = {
  "NAIROBI": 4520, "KAJIADO": 850, "KAKAMEGA": 1200, "ISIOLO": 340,
  "TRANS NZOIA": 920, "UASIN GISHU": 2100, "TURKANA": 150, "NAKURU": 1800,
  "MERU": 670, "KIAMBU": 3100, "MOMBASA": 2800, "BUNGOMA": 1100,"KWALE": 890,
  "KILIFI": 1250,
  "KISUMU": 2100,
  "MACHAKOS": 1600,
  "LAMU": 430,

// Uganda, Rwanda and Congo stats
  "KAMPALA": 1540, 
  "KIGALI": 980, 
  "GOMA": 620
};

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 20, latitude: -1,
   zoom: 2.5,
    pitch: 25, 
   bearing: 0 ,
   transitionDuration: 0,
  transitionInterpolator: undefined
};

const CONTROLLER_CONFIG = {
  inertia: true,
  inertiaFriction: 0.3,
  inertiaDeceleration: 10,
  inertiaMaxSpeed: 500, 
  dragRotate: true,
  scrollZoom: { speed: 0.01, smooth: true },
  doubleClickZoom: true,
  touchZoom: true,
  touchRotate: true,
  keyboard: true,
  dragPan: true,
  minZoom: 1,
  maxZoom: 20,
  transition: {
    transitionDuration: 300,
    transitionInterpolator: new FlyToInterpolator(),
    easing: (t: number) => t * (2 - t)
  }
};

type SiteData = {
  id: string;
  name: string;
  coordinates: [number, number];
  type?: string;
  status?: string;
  users?: number;
};

type CountyData = {
  name: string;
  sites: SiteData[];
  centroid: [number, number];
  boundary?: any;
};

// --- THEME CONSTANTS ---
const THEME = {
  blueDark: '#0d47a1',
  blueLight: '#1565c0',
  orangeDark: '#e65100',
  orangeLight: '#ff6d00',
  glassWhite: 'rgba(255, 255, 255,0.9)',
  glassStroke: 'rgba(13, 71, 161, 0.2)', 
  textDark: '#1a237e'
};

// --- CUSTOM CURSOR ---
const VilcomCursor = ({ mapHovered }: { mapHovered: boolean }) => {
  const mouseRef = useRef({ x: -100, y: -100 });
  const leadRef = useRef({ x: -100, y: -100 });
  const dotRef = useRef({ x: -100, y: -100 });
  const ringRef = useRef({ x: -100, y: -100 });
  
  const leadEl = useRef<HTMLDivElement>(null);
  const dotEl = useRef<HTMLDivElement>(null);
  const ringEl = useRef<HTMLDivElement>(null);
  
  const [domHovered, setDomHovered] = useState(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      
      const target = e.target as HTMLElement;
      const isInteractive = 
        target.tagName === 'BUTTON' || 
        target.closest('button') ||
        target.tagName === 'A' || 
        target.closest('a') ||
        target.tagName === 'INPUT' ||
        target.getAttribute('role') === 'button' ||
        window.getComputedStyle(target).cursor === 'pointer';
      
      setDomHovered(!!isInteractive);
    };

    window.addEventListener("mousemove", onMouseMove);

    const animate = () => {
      const leadSpeed = 1.0; 
      const dotSpeed = 0.15;  
      const ringSpeed = 0.08; 
     
      leadRef.current.x += (mouseRef.current.x - leadRef.current.x) * leadSpeed;
      leadRef.current.y += (mouseRef.current.y - leadRef.current.y) * leadSpeed;
    
      dotRef.current.x += (leadRef.current.x - dotRef.current.x) * dotSpeed;
      dotRef.current.y += (leadRef.current.y - dotRef.current.y) * dotSpeed;

      ringRef.current.x += (dotRef.current.x - ringRef.current.x) * ringSpeed;
      ringRef.current.y += (dotRef.current.y - ringRef.current.y) * ringSpeed;

      if (leadEl.current) {
        leadEl.current.style.transform = `translate3d(${leadRef.current.x}px, ${leadRef.current.y}px, 0)`;
      }
      if (dotEl.current) {
        dotEl.current.style.transform = `translate3d(${dotRef.current.x}px, ${dotRef.current.y}px, 0) translate(-50%, -50%)`;
      }
      if (ringEl.current) {
        ringEl.current.style.transform = `translate3d(${ringRef.current.x}px, ${ringRef.current.y}px, 0) translate(-50%, -50%)`;
      }

      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  const isHovering = domHovered || mapHovered;

  return (
    <>
      <style>{`
        body, button, a, input, [role="button"], canvas { 
          cursor: none !important; 
        }
      `}</style>
      
      {/* 3. TAIL (Orange Ring) */}
      <div 
        ref={ringEl}
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: isHovering ? 45 : 30, 
          height: isHovering ? 45 : 30,
          border: `2px solid ${isHovering ? THEME.orangeLight : THEME.orangeDark}`,
          backgroundColor: isHovering ? 'rgba(255, 109, 0, 0.1)' : 'transparent',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 9997,
          transition: 'width 0.3s, height 0.3s, border-color 0.3s, background-color 0.3s',
          willChange: 'transform'
        }} 
      />

      {/* 2. MIDDLE (Blue Dot) */}
      <div 
        ref={dotEl}
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: isHovering ? 8 : 10,
          height: isHovering ? 8 : 10,
          backgroundColor: isHovering ? THEME.blueLight : THEME.blueDark,
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 9998,
          boxShadow: isHovering ? `0 0 10px ${THEME.blueLight}` : 'none',
          transition: 'width 0.2s, height 0.2s, background-color 0.2s',
          willChange: 'transform'
        }} 
      />

      {/* 1. LEAD (Static Black SVG Cursor) */}
      <div 
        ref={leadEl}
        style={{
          position: 'fixed',
          top: 0, left: 0,
          pointerEvents: 'none',
          zIndex: 9999,
          transformOrigin: 'top left',
        }} 
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.2))' }}>
          <path 
            d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z" 
            fill="black" 
            stroke="white" 
            strokeWidth="1.5" 
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </>
  );
};

// --- VILCOM HEADER ---
const VilcomHeader = ({ zoom }: { zoom: number }) => {
  const fadeStart = 4.0;
  const fadeEnd = 5.5;
  
  let opacity = 1;
  if (zoom > fadeStart) {
    opacity = 1 - (zoom - fadeStart) / (fadeEnd - fadeStart);
    opacity = Math.max(0, Math.min(1, opacity));
  }
  
  if (opacity <= 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 40,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 900,
      opacity: opacity,
      transition: 'opacity 0.2s ease-out',
      pointerEvents: 'none',
      textAlign: 'center'
    }}>
      <div style={{
        background: THEME.glassWhite,
        backdropFilter: 'blur(8px)',
        padding: '12px 32px',
        borderRadius: '0px', 
        boxShadow: '0 8px 32px rgba(13, 71, 161, 0.1)',
        border: `1px solid ${THEME.glassStroke}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2
      }}>
        <div style={{
          fontFamily: '"Inter", "Roboto", sans-serif',
          fontSize: '28px',
          fontWeight: 800,
          letterSpacing: '-0.5px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          lineHeight: 1
        }}>
          <span style={{ color: THEME.blueDark, textShadow: '0px 0px 1px rgba(13, 71, 161, 0.2)' }}>
            VILCOM
          </span>
          <div style={{ width: 2, height: 24, background: '#ccc', margin: '0 4px' }}></div>
          <span style={{ color: THEME.orangeLight, textShadow: '0px 0px 1px rgba(255, 109, 0, 0.2)' }}>
            OPS NETWORK
          </span>
        </div>
        <div style={{
          width: '100%',
          height: '3px',
          marginTop: '6px',
          background: `linear-gradient(90deg, ${THEME.blueDark} 0%, ${THEME.orangeLight} 100%)`,
          borderRadius: '0px',
          opacity: 0.8
        }}></div>
        <div style={{
          fontSize: '10px',
          fontWeight: 600,
          color: '#666',
          marginTop: '4px',
          letterSpacing: '2px',
          textTransform: 'uppercase'
        }}>
          Global Infrastructure View
        </div>
      </div>
    </div>
  );
};

// --- CAMERA CONTROLS ---
  const zoomStep = 0.5;

  const CameraControls = ({ viewState, setViewState, setAutoRotate }: any) => {
  const flyTo = (target: keyof typeof CAMERA_TARGETS) => {
    setAutoRotate(false);
    setViewState({
      ...viewState,
      ...CAMERA_TARGETS[target],
      transitionDuration: 2000,
      transitionInterpolator: new FlyToInterpolator()

      
    });


  };

  const CAMERA_TARGETS = {
  GLOBE: { longitude: 20, latitude: 0, zoom: 0.8, pitch: 0, bearing: 0 },
  EAST_AFRICA: { longitude: 34.0, latitude: -1.5, zoom: 4.5, pitch: 45, bearing: 10 },
  KENYA: { longitude: 37.9062, latitude: 0.0236, zoom: 6.0, pitch: 40, bearing: 0 },
  UGANDA: { longitude: 32.2903, latitude: 1.3733, zoom: 6.5, pitch: 40, bearing: 0 },
  KIGALI: { longitude: 30.0619, latitude: -1.9441, zoom: 7.5, pitch: 40, bearing: 0 },
  NORTH_KIVU: { longitude: 29.2205, latitude: -1.6585, zoom: 8.5, pitch: 45, bearing: 0 }
};
 
  
  const updateView = (updates: any) => {
    setAutoRotate(false);
    setViewState((v: any) => ({
      ...v,
      ...updates,
      transitionDuration: 300,
      transitionInterpolator: new FlyToInterpolator()
    }));
  };

  const handleHome = () => {
    setAutoRotate(true);
    setViewState(INITIAL_VIEW_STATE);
   
  };

  const buttonStyle = {
    padding: '10px',
    background: 'rgba(255, 255, 255, 0.8)',
    border: `1px solid ${THEME.glassStroke}`,
    borderRadius: 0,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    color: THEME.blueDark
  };

  const activeButtonStyle = {
    ...buttonStyle,
    background: `linear-gradient(135deg, ${THEME.orangeLight} 0%, ${THEME.orangeDark} 100%)`,
    color: 'white',
    border: 'none',
    boxShadow: '0 2px 8px rgba(255, 109, 0, 0.3)'
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    background: `linear-gradient(135deg, ${THEME.blueLight} 0%, ${THEME.blueDark} 100%)`,
    color: 'white',
    border: 'none',
    boxShadow: '0 2px 8px rgba(13, 71, 161, 0.3)'
  };

  const navButtonStyle = (flagUrl?: string) => ({
    padding: '12px 8px',
    borderRadius: 0, // Sharp corners as requested
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 800,
    color: flagUrl ? 'white' : THEME.blueDark,
    border: `1px solid ${THEME.glassStroke}`,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    transition: 'all 0.2s',
    textShadow: flagUrl ? '1px 1px 2px rgba(0,0,0,0.8)' : 'none',
    background: flagUrl 
      ? `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${flagUrl}) center/cover no-repeat`
      : 'white',
  }); 

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      right: 20,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: 0, 
      padding: 12,
      boxShadow: '0 4px 20px rgba(13, 71, 161, 0.1)',
      backdropFilter: 'blur(10px)',
      border: `1px solid ${THEME.glassStroke}`
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: THEME.blueDark, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Camera Controls
      </div>
      <div style={{ height: 1, background: 'rgba(0,0,0,0.05)', margin: '0 0 4px 0' }} />
      
      {/* Zoom */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => updateView({ zoom: Math.max(viewState.zoom - zoomStep, 1) })}
          style={{ ...primaryButtonStyle, flex: 1, gap: 6 }}
        >
          <ZoomOut size={16} /> Zoom Out
        </button>
        <button
          onClick={() => updateView({ zoom: Math.min(viewState.zoom + zoomStep, 20) })}
          style={{ ...primaryButtonStyle, flex: 1, gap: 6 }}
        >
          <ZoomIn size={16} /> Zoom In
        </button>
      </div>
      
      {/* Global Actions */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={handleHome}
          style={{ ...buttonStyle, flex: 1, gap: 6 }}
        >
          <Home size={16} /> Globe view
        </button>
        <button
         onClick={()=> flyTo('EAST_AFRICA')}
          style={{ 
            ...activeButtonStyle, 
            flex: 1, gap: 6 
          }}
        >
          <Target size={16} /> East Africa
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <button 
          onClick={() => flyTo('KENYA')} 
          style={navButtonStyle('https://flagcdn.com/w160/ke.png')}
        >
          KENYA
        </button>
        <button 
          onClick={() => flyTo('UGANDA')} 
          style={navButtonStyle('https://flagcdn.com/w160/ug.png')}
        >
          UGANDA
        </button>
        <button 
          onClick={() => flyTo('KIGALI')} 
          style={navButtonStyle('https://flagcdn.com/w160/rw.png')}
        >
          RWANDA
        </button>
        <button 
          onClick={() => flyTo('NORTH_KIVU')} 
          style={navButtonStyle('https://flagcdn.com/w160/cd.png')}
        >
          DRC CONGO
        </button>
      </div> 
      </div>
      
      {/* Info Bar */}
      <div style={{
        marginTop: 4,
        padding: '6px',
        background: 'rgba(13, 71, 161, 0.05)',
        borderRadius: 0, 
        fontSize: 10,
        color: THEME.blueDark,
        textAlign: 'center',
        border: `1px solid ${THEME.glassStroke}`,
        fontWeight: 600
      }}>
        Zoom: {viewState.zoom.toFixed(1)}x • Pitch: {viewState.pitch.toFixed(0)}°
      </div>
    </div>
  );
};

// --- MAP LEGEND ---

const MapLegend = ({ 
 
}: any) => {
  const [expanded, setExpanded] = useState(true);

  const legendItems = [
    { label: 'Active Regions', color: 'rgb(100, 181, 246)', icon: <Globe size={14} /> },
    { label: 'Selected Region', color: 'rgb(33, 150, 243)', icon: <Target size={14} /> },
    { label: 'HQ Location', color: 'rgb(41, 98, 255)', icon: <MapPin size={14} /> },
    { label: 'Network Routes', color: 'rgb(0, 0, 204)', icon: <Network size={14} /> },
    { label: 'Sites/Points', color: 'rgb(255, 20, 147)', icon: <Layers size={14} /> },
    { label: 'Live Pulse', color: `rgb(${NETWORK_STYLES.PULSE_COLOR.join(',')})`, icon: <Satellite size={14} /> },
  ];

  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: 20,
      zIndex: 1000,
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: 0, 
      padding: expanded ? 16 : 10,
      boxShadow: '0 4px 20px rgba(13, 71, 161, 0.1)',
      backdropFilter: 'blur(10px)',
      border: `1px solid ${THEME.glassStroke}`,
      minWidth: expanded ? 240 : 40,
      transition: 'all 0.3s ease'
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: expanded ? 'space-between' : 'center',
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: THEME.blueDark,
          padding: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={20} color={THEME.orangeLight} />
          {expanded && (
            <span style={{ fontSize: 14, fontWeight: 700, color: THEME.blueDark }}>
              MAP LAYERS
            </span>
          )}
        </div>
        {expanded && (
          expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />
        )}
      </button>

      {expanded && (
        <>
          <div style={{ height: 1, background: 'rgba(0,0,0,0.05)', margin: '12px 0' }} />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {legendItems.map((item, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 18, height: 18,
                  borderRadius: 0, 
                  background: item.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 10
                }}>{item.icon}</div>
                <span style={{ fontSize: 12, color: '#444', fontWeight: 500 }}>{item.label}</span>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: 'rgba(0,0,0,0.05)', margin: '12px 0' }} />

          
          {/* --- UPDATED STATS BLOCK --- */}
          <div style={{ 
            marginTop: 16, 
            padding: '12px',
            background: `linear-gradient(135deg, ${THEME.blueLight} 0%, ${THEME.blueDark} 100%)`, 
            borderRadius: 0, 
            color: 'white'
          }}>
            <div style={{ fontSize: 10, opacity: 0.8, textTransform: 'uppercase' }}>Network Coverage</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', marginTop: 2 }}>4 East African Countries</div>
             <div style={{ fontSize: 15, fontWeight: 'bold', marginTop: 2 }}>19 Kenyan Counties </div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              133,316 Users
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// --- QUICK NAV ---
const QuickCountyNav = ({ countyData, setViewState, setZoomedCounty, setSelectedCounty, setAutoRotate }: any) => {
  const [showQuickNav, setShowQuickNav] = useState(false);

  const handleCountyFly = (countyName: string) => {
    setAutoRotate(false); 
    const county = countyData[countyName];
    if (county) {
      setZoomedCounty(countyName);
      setSelectedCounty({
        name: countyName,
        users: USER_STATS[countyName] || "N/A",
        sites: county.sites?.length || 0
      });
      setViewState({
        longitude: county.centroid[0],
        latitude: county.centroid[1],
        zoom: 9, pitch: 0, bearing: 0,
        transitionDuration: 1500,
        transitionInterpolator: new FlyToInterpolator()
      });
    }
  };

  return (
    <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 1000 }}>
      <button
        onClick={() => setShowQuickNav(!showQuickNav)}
        style={{
          padding: '10px 16px',
          background: `linear-gradient(135deg, ${THEME.orangeLight} 0%, ${THEME.orangeDark} 100%)`,
          border: 'none',
          borderRadius: 0, 
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 4px 15px rgba(255, 109, 0, 0.3)',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
      >
        <MapPin size={16} /> Quick Navigation {showQuickNav ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
      </button>

      {showQuickNav && (
        <div style={{
          marginTop: 8,
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: 0, 
          padding: 12,
          boxShadow: '0 8px 30px rgba(13, 71, 161, 0.15)',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${THEME.glassStroke}`,
          minWidth: 200,
          maxHeight: 300,
          overflowY: 'auto'
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: THEME.blueDark, marginBottom: 8, textTransform: 'uppercase' }}>
            Select Region
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.keys(ACTIVE_REGIONS).map((countyName) => (
              <button
                key={countyName}
                onClick={() => handleCountyFly(countyName)}
                style={{
                  padding: '8px 12px',
                  background: 'white',
                  border: '1px solid #eee',
                  borderRadius: 0, 
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: '#444'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = THEME.blueLight;
                  e.currentTarget.style.color = THEME.blueLight;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#eee';
                  e.currentTarget.style.color = '#444';
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500 }}>{countyName}</span>
                <span style={{ fontSize: 10, color: '#888' }}>→</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- SELECTED COUNTY PANEL ---
const SelectedCountyPanel = ({ selectedCounty, setSelectedCounty, setViewState, setZoomedCounty, setAutoRotate }: any) => {
  if (!selectedCounty) return null;
  
  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      right: 20,
      zIndex: 1000,
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: 0, 
      padding: 16,
      boxShadow: '0 4px 20px rgba(13, 71, 161, 0.15)',
      backdropFilter: 'blur(10px)',
      border: `1px solid ${THEME.glassStroke}`,
      maxWidth: 300,
      minWidth: 260
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: THEME.orangeLight, fontWeight: 700, textTransform: 'uppercase' }}>Active Region</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: THEME.blueDark }}>
            {selectedCounty.name}
          </div>
        </div>
        <button
          onClick={() => setSelectedCounty(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
        >
          <X size={20} />
        </button>
      </div>
      
      <div style={{ 
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12
      }}>
        <div style={{ 
          padding: '12px', 
          background: `linear-gradient(135deg, ${THEME.blueLight} 0%, ${THEME.blueDark} 100%)`, 
          borderRadius: 0,
          color: 'white', textAlign: 'center' 
        }}>
          <div style={{ fontSize: 20, fontWeight: 'bold' }}>{selectedCounty.users?.toLocaleString() || '0'}</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>ACTIVE USERS</div>
        </div>
        <div style={{ 
          padding: '12px', 
          background: 'white', border: `1px solid ${THEME.glassStroke}`,
          borderRadius: 0, 
          color: THEME.blueDark, textAlign: 'center' 
        }}>
          <div style={{ fontSize: 20, fontWeight: 'bold' }}>{selectedCounty.sites || '0'}</div>
          <div style={{ fontSize: 10, color: '#666' }}>SITE NODES</div>
        </div>
      </div>
      
      <button
        onClick={() => {
          setViewState(INITIAL_VIEW_STATE);
          setSelectedCounty(null);
          setZoomedCounty(null);
          setAutoRotate(true); 
        }}
        style={{
          width: '100%',
          padding: '10px',
          background: 'transparent',
          border: `1px solid ${THEME.orangeLight}`,
          borderRadius: 0, 
          color: THEME.orangeLight,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = THEME.orangeLight;
          e.currentTarget.style.color = 'white';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = THEME.orangeLight;
        }}
      >
        <Minimize2 size={14} /> Reset View
      </button>
    </div>
  );
};

// --- DATA LOGIC ---
const extractSitesFromGeoJSON = (geoJson: any, countyName: string): SiteData[] => {
  const sites: SiteData[] = [];
  if (!geoJson || !geoJson.features) return sites;
  
  geoJson.features.forEach((feature: any, index: number) => {
    const properties = feature.properties || {};
    let coordinates: [number, number] = [0, 0];
    
    if (feature.geometry.type === 'Point') {
      coordinates = feature.geometry.coordinates;
    } else if (feature.geometry.type === 'Polygon') {
      const centroid = turf.centroid(feature);
      coordinates = centroid.geometry.coordinates as [number, number];
    } else if (feature.geometry.type === 'MultiPolygon') {
      const centroid = turf.centroid(feature);
      coordinates = centroid.geometry.coordinates as [number, number];
    }
    
    sites.push({
      id: `${countyName}_${index}`,
      name: properties.name || properties.site_name || `Site ${index + 1}`,
      coordinates: coordinates as [number, number],
      type: properties.type || 'site',
      status: properties.status || 'active',
      users: properties.users || Math.floor(Math.random() * 500) + 50 
    });
  });
  return sites;
};


const NetworkMap = () => {
  const [hybridData, setHybridData] = useState<any>(null);
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);
  const [selectedCounty, setSelectedCounty] = useState<any>(null);
  const [labelOpacity, setLabelOpacity] = useState(0);
  const [labelSize, setLabelSize] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [zoomedCounty, setZoomedCounty] = useState<string | null>(null);
  const [countyData, setCountyData] = useState<Record<string, CountyData>>({});
  const [loadingCounties, setLoadingCounties] = useState<boolean>(false);
  const [showIntraCountyMesh, setShowIntraCountyMesh] = useState<boolean>(true);
  const [showInterCountyMesh, setShowInterCountyMesh] = useState<boolean>(false);

  const [autoRotate, setAutoRotate] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [isMapHovered, setIsMapHovered] = useState(false);

  const activeCountyNames = useMemo(() => new Set(Object.values(ACTIVE_REGIONS).map(r => r.name)), []);
  const activeCountyKeys = useMemo(() => Object.keys(ACTIVE_REGIONS), []);

  // --- AUTO ROTATE LOGIC ---
useEffect(() => {
  let animationFrame: number;
  
  // Only rotate if autoRotate is enabled AND we are not currently in a transition
  if (autoRotate && !viewState.transitionDuration) {
    const animate = () => {
      setViewState((v: any) => ({
        ...v,
        longitude: v.longitude + 0.05,
        transitionDuration: 0, // Keep this at 0 for smooth frame-by-frame rotation
        transitionInterpolator: null
      }));
      animationFrame = requestAnimationFrame(animate);
    };
    animate();
  }
  return () => cancelAnimationFrame(animationFrame);
}, [autoRotate, !!viewState.transitionDuration]); // Re-run if transition state changes

  // --- PULSATING LOGIC ---
  useEffect(() => {
    const isKenyaView = viewState.zoom > 3.5 && viewState.zoom < 8 && !zoomedCounty;
    if (isKenyaView) {
      const interval = setInterval(() => {
        setHighlightIndex(prev => (prev + 1) % activeCountyKeys.length);
      }, 800); 
      return () => clearInterval(interval);
    } else {
      setHighlightIndex(-1);
    }
  }, [viewState.zoom, zoomedCounty, activeCountyKeys.length]);

  useEffect(() => {
    const loadCountyData = async () => {
      setLoadingCounties(true);
      const loadedData: Record<string, CountyData> = {};
      
      try {
        for (const [countyName, countyInfo] of Object.entries(ACTIVE_REGIONS)) {
          try {
            const response = await fetch(`/vilcom_presence/${countyInfo.fileName}`);
            if (!response.ok) {
              const mockSites: SiteData[] = [];
              const baseLocation = REGION_LOCATIONS[countyName] || RANCO_PLAZA_HQ;
              const numSites = Math.floor(Math.random() * 6) + 3;
              for (let i = 0; i < numSites; i++) {
                mockSites.push({
                  id: `${countyName}_mock_${i}`,
                  name: `${countyName} Site ${i + 1}`,
                  coordinates: [
                    baseLocation[0] + (Math.random() - 0.5) * 0.5,
                    baseLocation[1] + (Math.random() - 0.5) * 0.3
                  ],
                  
                  status: Math.random() > 0.2 ? 'active' : 'inactive',
                  users: Math.floor(Math.random() * 500) + 50
                });
              }
              loadedData[countyName] = { name: countyName, sites: mockSites, centroid: baseLocation };
              continue;
            }
            const geoJson = await response.json();
            const sites = extractSitesFromGeoJSON(geoJson, countyName);
            const countyLocation = REGION_LOCATIONS[countyName] || RANCO_PLAZA_HQ;
            let centroid = countyLocation;
            if (sites.length > 0) {
              const points = sites.map(site => turf.point(site.coordinates));
              centroid = turf.center(turf.featureCollection(points)).geometry.coordinates as [number, number];
            }
            loadedData[countyName] = { name: countyName, sites: sites, centroid: centroid, boundary: geoJson };
          } catch (err) { console.error(`Error loading ${countyInfo.fileName}:`, err); }
        }
        setCountyData(loadedData);
      } catch (err) { console.error("Error loading county data:", err); } 
      finally { setLoadingCounties(false); }
    };
    loadCountyData();
  }, [activeCountyNames]);


  const generatedRoutes = useMemo(() => {
    const nodes = Object.keys(ACTIVE_REGIONS);
    if (nodes.length === 0) return [];

    const getDist = (nameA: string, nameB: string) => {
      const [lon1, lat1] = REGION_LOCATIONS[nameA] || RANCO_PLAZA_HQ;
      const [lon2, lat2] = REGION_LOCATIONS[nameB] || RANCO_PLAZA_HQ;
      return Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));
    };

    const connected = new Set<string>(["NAIROBI"]);
    const routes: any[] = [];
    while (connected.size < nodes.length) {
      let minDist = Infinity;
      let bestFrom = "", bestTo = "";
      nodes.forEach(candidate => {
        if (!connected.has(candidate)) {
          connected.forEach(existing => {
            const d = getDist(existing, candidate);
            if (d < minDist) { minDist = d; bestFrom = existing; bestTo = candidate; }
          });
        }
      });
      if (bestFrom && bestTo) {
        connected.add(bestTo);
        const fromCoords = REGION_LOCATIONS[bestFrom] || RANCO_PLAZA_HQ;
        const toCoords = REGION_LOCATIONS[bestTo] || RANCO_PLAZA_HQ;
        routes.push({
          from: [fromCoords[0], fromCoords[1], ELEVATION_ACTIVE], 
          to: [toCoords[0], toCoords[1], ELEVATION_ACTIVE],
          sourceName: bestFrom, targetName: bestTo
        });
      } else { break; }
    }
    return routes;
  }, []); 

  useEffect(() => {
    const zoom = viewState.zoom;
    if (zoom < LABEL_APPEAR_ZOOM) {
      setLabelOpacity(0); setLabelSize(0);
    } else if (zoom >= LABEL_APPEAR_ZOOM && zoom <= LABEL_FULL_OPACITY_ZOOM) {
      const progress = (zoom - LABEL_APPEAR_ZOOM) / (LABEL_FULL_OPACITY_ZOOM - LABEL_APPEAR_ZOOM);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setLabelOpacity(easedProgress); setLabelSize(6 + (easedProgress * 6));
    } else {
      setLabelOpacity(1); setLabelSize(12);
    }
  }, [viewState.zoom]);

 useEffect(() => {
    const loadData = async () => {
      try {
        const hybridRes = await fetch(HYBRID_MAP_URL).then(r => r.json());
        setHybridData(hybridRes);
        
        // --- ANIMATION SEQUENCE ---
        
        // 1. First, Zoom OUT to see the whole globe (Cinematic pullback)
        setTimeout(() => {
           setViewState(curr => ({
             ...curr,
             zoom: 0.8,         // Pull back far
             latitude: 0,
             longitude: 20,     // Center loosely on Africa/Europe
             pitch: 0,          // Reset pitch for the overview
             transitionDuration: 2000,
             transitionInterpolator: new FlyToInterpolator()
           }));
        }, 500); // Start shortly after load

        // 2. Then, Fly IN to East Africa Focus
        setTimeout(() => {
          setViewState(curr => ({
            ...curr, 
            // Center roughly between DRC, Uganda, and Kenya
            longitude: 34.0, 
            latitude: -1.5,   
            zoom: 4.5,          // Perfect regional zoom
            pitch: 45,          // Angled 3D view
            bearing: 10,        // Slight rotation for style
            transitionDuration: 5000, // Long, smooth approach
            transitionInterpolator: new FlyToInterpolator({ speed: 1.2 })
          }));
        }, 3000); // Wait for the zoom out to finish (500ms + 2000ms + buffer)

      } catch (err) { console.error("Error loading map data:", err); }
    };
    loadData();
  }, []);

  const isZoomedIn = viewState.zoom > ZOOM_THRESHOLD;
  useEffect(() => {
    if (isZoomedIn && !zoomedCounty && viewState.pitch < 30) {
       setViewState(v => ({ ...v, pitch: 50, transitionDuration: 1000, transitionInterpolator: new FlyToInterpolator() }));
    }
  }, [isZoomedIn, viewState.pitch, zoomedCounty]);

  const handleInteractionStateChange = (interactionState: any) => {
    const currentlySpinning = interactionState.isDragging || interactionState.inertia;
    if (currentlySpinning !== isSpinning) setIsSpinning(currentlySpinning);
    if (interactionState.isDragging) {
      setAutoRotate(false);
    }
  };

  const getRegionColor = (regionName: string): Color => {
    if (regionName === zoomedCounty) return NETWORK_STYLES.ACTIVE_REGION_HIGHLIGHT;
    if (highlightIndex !== -1 && activeCountyKeys[highlightIndex] === regionName) {
      return NETWORK_STYLES.PULSE_COLOR; 
    }
    if (activeCountyNames.has(regionName)) return NETWORK_STYLES.ACTIVE_REGION; 
    return NETWORK_STYLES.LAND_COLOR;
  };

  const getElevationForRegion = (name: string) => {
    if (name === zoomedCounty) return ELEVATION_ACTIVE * 1.5;
    if (activeCountyNames.has(name)) return ELEVATION_ACTIVE; 
    return ELEVATION_WORLD;    
  };

  const borderData = useMemo(() => {
    if (!hybridData) return [];
    const paths: any[] = [];
    hybridData.features.forEach((feature: any) => {
      const name = feature.properties.name || feature.properties.county_name;
      const geometry = feature.geometry;
      const addPath = (coords: any[]) => paths.push({ path: coords, name });
      if (geometry.type === 'Polygon') {
        addPath(geometry.coordinates[0]);
      } else if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach((polygon: any) => addPath(polygon[0]));
      }
    });
    return paths;
  }, [hybridData]);

  const onLayerClick = (info: any) => {
    if (info.object) {
      const name = info.object.properties?.name || info.object.name || info.object.properties?.county_name;
      if (activeCountyNames.has(name)) {
        const countyLocation = REGION_LOCATIONS[name] || RANCO_PLAZA_HQ;
        const countyInfo = countyData[name];
        
        setZoomedCounty(name);
        setAutoRotate(false); 
        setShowIntraCountyMesh(true);
        
        const targetLocation = countyInfo?.centroid || countyLocation;
        
        setViewState({
          longitude: targetLocation[0], 
          latitude: targetLocation[1],
          zoom: countyInfo?.sites?.length > 1 ? 10 : 9,
          pitch: 0, 
          bearing: 0, 
          transitionDuration: 1500, 
          transitionInterpolator: new FlyToInterpolator()
        });
        
        setSelectedCounty({
          name: name, users: USER_STATS[name] || "N/A",
          x: info.x, y: info.y, sites: countyInfo?.sites?.length || 0
        });
      } else {
        setSelectedCounty(null); setZoomedCounty(null); setShowIntraCountyMesh(false);
      }
    }
  };

   const sitePointsLayer = useMemo(() => {
    if (!zoomedCounty || !countyData[zoomedCounty]) return null;
    const sites = countyData[zoomedCounty].sites;
    if (sites.length === 0) return null;
    return new ScatterplotLayer({
      id: 'county-sites',
      data: sites,
      getPosition: (d: SiteData) => [d.coordinates[0], d.coordinates[1], ELEVATION_ACTIVE + 3000],
      getFillColor: NETWORK_STYLES.SITE_POINT_COLOR,
      getRadius: (d: SiteData) => Math.min(8, Math.max(3, Math.log((d.users || 50) / 10) * 2)),
      radiusUnits: 'pixels',
      stroked: true,
      getLineColor: [255, 255, 255], getLineWidth: 1, pickable: true,
      onClick: (info: any) => {
        if (info.object) {
          const site = info.object as SiteData;
          setSelectedCounty({
            name: `${site.name} (${zoomedCounty})`,
            users: site.users, type: site.type, status: site.status,
            x: info.x, y: info.y
          });
        }
      }
    });
  }, [zoomedCounty, countyData]);


  const detailedBoundariesLayer = useMemo(() => {
    // 1. Extract valid GeoJSON features from our loaded data
    const features = Object.values(countyData)
      .map((data: any) => data.boundary)
     .filter(data => data && data.boundary && data.boundary.features)  // remove empty entries 

    if (features.length === 0) return null;

    return new GeoJsonLayer({
      id: 'detailed-boundaries-overlay',
      data: features,
      filled: true,
      stroked: true,
      // Use the same styling logic as the base map
      getFillColor: (d: any) => {
        // Since we are iterating raw GeoJSON features, we need to find the name
        // The properties key might vary depending on your GeoJSON source
        const name = d.properties?.name || d.properties?.county_name; 
        return getRegionColor(name);
      },
      getLineColor: NETWORK_STYLES.BORDER_COLOR,
      getLineWidth: 200,
      getElevation: (d: any) => {
        const name = d.properties?.name || d.properties?.county_name;
        return getElevationForRegion(name) + 500; // Slight lift to prevent Z-fighting
      },
      extruded: true,
      pickable: true,
      onClick: onLayerClick,
      updateTriggers: {
        getFillColor: [zoomedCounty, highlightIndex]
      }
    });
  }, [countyData, zoomedCounty, highlightIndex]);

  const layers = [
    new SolidPolygonLayer({
      id: 'ocean',
      data: [[[-180, 90], [0, 90], [180, 90], [180, -90], [0, -90], [-180, -90]]],
      getPolygon: (d: any) => d,
      getFillColor: NETWORK_STYLES.OCEAN_COLOR,
      filled: true, extruded: false,
      getPolygonOffset: () => [5, 5000],
     material: { ambient: 9.0, diffuse: 0.9, shininess: 1.0 }
    }),
    new GeoJsonLayer({
      id: 'land-masses-fill',
      data: hybridData,
      filled: true, stroked: false, extruded: true, wireframe: false,
      getFillColor: (d: any): Color => {
        const name = d.properties.name || d.properties.county_name;
        return getRegionColor(name);
      },
      getElevation: (d: any) => {
        const name = d.properties.name || d.properties.county_name;
        return getElevationForRegion(name);
      },
      getPolygonOffset: () => [1, 1],
      material: { ambient: 0.35, diffuse: 0.1, shininess: 1.0 },
      pickable: true, onClick: onLayerClick,
      updateTriggers: {
        getFillColor: [zoomedCounty, highlightIndex]
      }
    }),

    ...(detailedBoundariesLayer ? [detailedBoundariesLayer] : []),
    new PathLayer({
      id: 'land-masses-borders',
      data: borderData,
      pickable: false,
      getPath: (d: any) => {
        const h = getElevationForRegion(d.name);
        return d.path.map((p: any) => [p[0], p[1], h + 200]);
      },
      getColor: NETWORK_STYLES.BORDER_COLOR,
      getWidth: isZoomedIn ? 200 : 2000, 
      widthMinPixels: 1,
      getPolygonOffset: () => [0, -2000], parameters: { depthTest: true }
    }),
    new ArcLayer({
      id: 'network-routes',
      data: generatedRoutes,
      getSourcePosition: (d: any) => d.from,
      getTargetPosition: (d: any) => d.to,
      getSourceColor: [0, 0, 204, 200], getTargetColor: [0, 0, 204, 200],
      getWidth: 3, getHeight: 1.0, pickable: true,
      updateTriggers: { getWidth: [viewState.zoom] },
    }),
    new ScatterplotLayer({
      id: 'hq-node',
      data: [{ position: [...RANCO_PLAZA_HQ, ELEVATION_ACTIVE + 500], name: 'RAMCO PLAZA HQ' }],
      getPosition: (d: any) => d.position,
      getFillColor: NETWORK_STYLES.HQ_COLOR,
      radiusUnits: 'pixels', getRadius: 6, stroked: true,
      getLineColor: [255, 255, 255], getLineWidth: 2, pickable: true
    }),
    new ScatterplotLayer({
      id: 'route-endpoints',
      data: Object.values(ACTIVE_REGIONS).map(r => ({ position: REGION_LOCATIONS[r.name] || RANCO_PLAZA_HQ })),
      getPosition: (d: any) => [d.position[0], d.position[1], ELEVATION_ACTIVE + 500],
      getFillColor: zoomedCounty ? [255, 105, 180] : [255, 215, 0],
      radiusUnits: 'pixels', getRadius: viewState.zoom < 5 ? 2.5 : 6,
      stroked: true, getLineColor: [0, 0, 0], getLineWidth: 1, pickable: false
    }),
    ...(labelOpacity > 0 ? [
      new TextLayer({
        id: 'county-labels',
        data: Object.values(ACTIVE_REGIONS).map(r => ({
          position: [...(REGION_LOCATIONS[r.name] || RANCO_PLAZA_HQ), ELEVATION_ACTIVE + 2000],
          name: r.name
        })),
        getPosition: (d: any) => d.position, getText: (d: any) => d.name,
        getSize: labelSize,
        getColor: zoomedCounty ? [255, 20, 147, Math.floor(labelOpacity * 255)] : [50, 50, 50, Math.floor(labelOpacity * 255)],
        getPixelOffset: [0, -15], background: true,
        getBackgroundColor: [255, 255, 255, Math.floor(labelOpacity * 200)],
        backgroundPadding: [4, 2], fontFamily: 'Arial, sans-serif', fontWeight: 'bold'
      }),
    ] : []),
    ...(sitePointsLayer ? [sitePointsLayer] : []),
  ];

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      position: 'relative', 
      background: 'radial-gradient(circle at center, #e1f5fe 10%, #ffffff 70%)',
      overflow: 'hidden'
    }}>
      <DeckGL
        views={new GlobeView()}
        effects={[lightingEffect]}
        viewState={viewState}
       onViewStateChange={({ viewState }) => {  
      const { transitionDuration, transitionInterpolator, ...cleanViewState } = viewState;
      setViewState(cleanViewState as any);
       }}
        onInteractionStateChange={handleInteractionStateChange}
        controller={CONTROLLER_CONFIG}
        layers={layers}
        parameters={GL_PARAMETERS}
        onHover={({object}) => setIsMapHovered(!!object)}
        getTooltip={({object}) => {
          if (object) {
            if (object.id && object.name) return `${object.name} (${object.users || 0} users)`;
            const name = object.properties?.name || object.properties?.county_name || object.name;
            return name;
          }
          return null;
        }}
      />
      
      <VilcomHeader zoom={viewState.zoom} />
      
      <CameraControls 
        viewState={viewState}
        setViewState={setViewState}
        zoomedCounty={zoomedCounty}
        setZoomedCounty={setZoomedCounty}
        setAutoRotate={setAutoRotate} 
      />
      
      <MapLegend 
        showIntraCountyMesh={showIntraCountyMesh}
        setShowIntraCountyMesh={setShowIntraCountyMesh}
        showInterCountyMesh={showInterCountyMesh}
        setShowInterCountyMesh={setShowInterCountyMesh}
      />
      
      <QuickCountyNav 
        countyData={countyData}
        viewState={viewState}
        setViewState={setViewState}
        setZoomedCounty={setZoomedCounty}
        setSelectedCounty={setSelectedCounty}
        setAutoRotate={setAutoRotate}
      />
      
      <SelectedCountyPanel 
        selectedCounty={selectedCounty} 
        setSelectedCounty={setSelectedCounty} 
        setViewState={setViewState} 
        setZoomedCounty={setZoomedCounty} 
        setAutoRotate={setAutoRotate}
      />
      
      {loadingCounties && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '20px 30px',
          borderRadius: 0, 
          boxShadow: '0 8px 32px rgba(13, 71, 161, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          border: `1px solid ${THEME.glassStroke}`
        }}>
          <div style={{
            width: 20,
            height: 20,
            border: '3px solid #f3f3f3',
            borderTop: `3px solid ${THEME.blueDark}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span style={{ fontSize: 14, color: THEME.blueDark, fontWeight: 600 }}>Loading network data...</span>
        </div>
      )}
      
      {/* ADDED CURSOR */}
      <VilcomCursor mapHovered={isMapHovered} />

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default NetworkMap;