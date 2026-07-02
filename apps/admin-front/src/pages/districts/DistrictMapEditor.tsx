import { useEffect, useRef, useState } from "react";
import type { GeoJson } from "@repo/contracts";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "@geoman-io/leaflet-geoman-free";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Leaflet's default marker icon paths break under bundlers — repoint them to Vite's resolved asset URLs.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// No "default served city" concept exists yet — Paris is a placeholder center for brand-new districts.
const DEFAULT_CENTER: L.LatLngTuple = [48.8566, 2.3522];
const DEFAULT_ZOOM = 12;

interface DistrictMapEditorProps {
  /** Initial geometry. Treated as the map's starting state only — later prop changes are ignored, since
   *  this editor owns geometry state internally once mounted and re-syncing would fight user edits. */
  value: GeoJson | null;
  onChange: (geoJson: GeoJson | null) => void;
  className?: string;
}

export function DistrictMapEditor({ value, onChange, className }: DistrictMapEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    map.pm.addControls({
      position: "topleft",
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawCircle: false,
      drawText: false,
      drawPolygon: true,
      editMode: true,
      dragMode: true,
      removalMode: true,
      cutPolygon: true,
      rotateMode: false,
    });

    let editableLayer: L.Polygon | null = null;
    let readonlyLayer: L.GeoJSON | null = null;

    const emitChange = (layer: L.Polygon) => {
      const geometry = layer.toGeoJSON().geometry as { type: string; coordinates: unknown[] };
      onChangeRef.current({ type: geometry.type, coordinates: geometry.coordinates });
    };

    const trackEditableLayer = (layer: L.Polygon) => {
      editableLayer = layer;
      layer.on("pm:edit", () => emitChange(layer));
      layer.on("pm:dragend", () => emitChange(layer));
      layer.on("pm:remove", () => {
        editableLayer = null;
        onChangeRef.current(null);
      });
      layer.on("pm:cut", (e) => {
        const newLayer = e.layer as L.Polygon;
        trackEditableLayer(newLayer);
        emitChange(newLayer);
      });
    };

    map.on("pm:create", (e) => {
      setWarning(null);
      if (readonlyLayer) {
        map.removeLayer(readonlyLayer);
        readonlyLayer = null;
      }
      if (editableLayer) {
        map.removeLayer(editableLayer);
      }
      const layer = e.layer as L.Polygon;
      layer.pm.enable();
      trackEditableLayer(layer);
      emitChange(layer);
    });

    if (value) {
      try {
        const group = L.geoJSON(value as unknown as GeoJSON.Geometry);
        const layers = group.getLayers();
        if (value.type === "Polygon" && layers.length === 1) {
          const layer = layers[0] as L.Polygon;
          layer.addTo(map);
          layer.pm.enable();
          trackEditableLayer(layer);
          map.fitBounds(layer.getBounds());
        } else if (value.type === "MultiPolygon") {
          group.addTo(map);
          readonlyLayer = group;
          map.fitBounds(group.getBounds());
          setWarning(
            "Existing boundary is a MultiPolygon and can't be edited here — drawing a new shape replaces it with a single Polygon.",
          );
        } else {
          setWarning(
            `Existing boundary has an unsupported shape (${value.type}) and can't be displayed — draw a new one to replace it.`,
          );
        }
      } catch {
        setWarning("Existing boundary data is invalid and can't be displayed — draw a new one to replace it.");
      }
    }

    return () => {
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `value` is the initial geometry only, intentionally not re-run on change
  }, []);

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      {warning && (
        <div className="alert alert-warning text-sm" role="alert">
          {warning}
        </div>
      )}
      <div
        ref={containerRef}
        role="application"
        aria-label="District boundary map"
        className="flex-1 min-h-0 rounded-box overflow-hidden"
      />
    </div>
  );
}
