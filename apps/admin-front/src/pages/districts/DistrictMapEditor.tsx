// Éditeur de tracé de quartier : carte Leaflet + Geoman permettant de dessiner, éditer,
// déplacer, découper et supprimer un polygone unique délimitant un quartier. Émet la géométrie
// GeoJSON à chaque modification. Composant non contrôlé : `value` sert de géométrie initiale
// seulement, l'éditeur gère ensuite son état en interne.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GeoJson } from "@repo/contracts";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "@geoman-io/leaflet-geoman-free";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Les chemins d'icônes de marqueur par défaut de Leaflet sont cassés sous un bundler — on les
// repointe vers les URLs d'assets résolues par Vite.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Aucune notion de « ville desservie par défaut » n'existe encore — Paris sert de centre
// provisoire pour les quartiers tout neufs.
const DEFAULT_CENTER: L.LatLngTuple = [48.8566, 2.3522];
const DEFAULT_ZOOM = 12;

interface DistrictMapEditorProps {
  /** Géométrie initiale. Traitée comme état de départ de la carte uniquement — les changements
   *  ultérieurs de cette prop sont ignorés, car l'éditeur possède son état de géométrie en interne
   *  une fois monté et une resynchronisation entrerait en conflit avec les modifications de l'utilisateur. */
  value: GeoJson | null;
  onChange: (geoJson: GeoJson | null) => void;
  className?: string;
}

/** Éditeur cartographique de polygone de quartier ({@link DistrictMapEditorProps}). */

export function DistrictMapEditor({ value, onChange, className }: DistrictMapEditorProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [warning, setWarning] = useState<string | null>(null);

  // Garde onChange dans une ref pour que les handlers Leaflet (attachés une seule fois au montage)
  // appellent toujours la dernière closure sans avoir à réinitialiser la carte.
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Initialise la carte, les contrôles de dessin et les écouteurs une seule fois (montage).
  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // On n'autorise que le polygone (+ édition/déplacement/suppression/découpe) : un quartier est
    // une zone, pas un point ni une ligne.
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

    // Remonte la géométrie du polygone au parent sous forme GeoJSON.
    const emitChange = (layer: L.Polygon) => {
      const geometry = layer.toGeoJSON().geometry as { type: string; coordinates: unknown[] };
      onChangeRef.current({ type: geometry.type, coordinates: geometry.coordinates });
    };

    // Attache à une couche éditable les écouteurs qui réémettent la géométrie à chaque modification :
    // édition de sommet, fin de déplacement, suppression (émet null) et découpe (suit la nouvelle couche).
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

    // À la création d'un nouveau polygone : on efface toute couche préexistante (lecture seule ou
    // éditable) — un seul polygone à la fois — puis on active l'édition et on suit la nouvelle couche.
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

    // Hydrate la carte depuis la géométrie initiale : un Polygon devient éditable et cadré ;
    // un MultiPolygon est affiché en lecture seule avec un avertissement (non éditable ici) ;
    // tout autre type ou un GeoJSON invalide déclenche un avertissement.
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
          setWarning(t("districts.warnMultiPolygon"));
        } else {
          setWarning(t("districts.warnUnsupported", { type: value.type }));
        }
      } catch {
        setWarning(t("districts.warnInvalid"));
      }
    }

    return () => {
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `value` n'est que la géométrie initiale, volontairement non ré-exécuté à son changement
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
        aria-label={t("districts.mapLabel")}
        className="flex-1 min-h-0 rounded-box overflow-hidden"
      />
    </div>
  );
}
