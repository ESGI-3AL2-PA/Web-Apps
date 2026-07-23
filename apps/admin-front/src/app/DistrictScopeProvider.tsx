import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@repo/hooks";
import type { DistrictResponseDto } from "@repo/contracts";
import { getDistrict, listDistricts } from "../api-service/districts";

// Contexte React : « scope quartier » actif de la console admin.
//
// Toute la console est cadrée sur un quartier actif. Un `admin` standard est verrouillé sur le
// quartier qu'il administre (`user.adminDistrictId`) ; un `superAdmin` en choisit un parmi tous
// les quartiers via le sélecteur de la barre supérieure (toujours exactement un sélectionné).
// Ceci est la moitié front — l'api applique le même cadrage côté serveur
// (voir apps/api/src/middleware/district-scope.ts).

const STORAGE_KEY = "adminDistrictScope";

/** Valeur exposée par le contexte de scope quartier. */
interface DistrictScope {
  districtId: string | null; // quartier actif (pilote les pages de liste cadrées)
  districtName: string | null; // libellé pour la barre supérieure
  districts: DistrictResponseDto[]; // superAdmin : tous les quartiers ; admin : vide
  canSwitch: boolean; // superAdmin avec ≥1 quartier
  setDistrictId: (id: string) => void; // superAdmin uniquement
  reload: (selectId?: string) => Promise<void>; // superAdmin : re-fetch la liste (après création), sélectionne éventuellement un quartier
  loading: boolean;
}

const DistrictScopeContext = createContext<DistrictScope | null>(null);

/** Provider à monter haut dans l'arbre (sous ProtectedRoute) : fournit le scope quartier à toute la console. */
export function DistrictScopeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superAdmin";

  const [districts, setDistricts] = useState<DistrictResponseDto[]>([]);
  const [districtId, setDistrictIdState] = useState<string | null>(null);
  const [adminDistrictName, setAdminDistrictName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Évite d'écraser le quartier fraîchement choisi par l'utilisateur si le fetch initial se résout en retard.
  const pickedRef = useRef(false);

  const setDistrictId = useCallback((id: string) => {
    pickedRef.current = true;
    setDistrictIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // On ignore les échecs de stockage (mode privé, quota) — le scope ne sera simplement pas persisté.
    }
  }, []);

  // superAdmin : charge tous les quartiers, puis sélectionne `selectId` (ex. un quartier tout juste créé),
  // sinon celui persisté (s'il existe encore) / le premier au chargement initial.
  const reload = useCallback(
    async (selectId?: string) => {
      if (!isSuperAdmin) return;
      setLoading(true);
      try {
        const res = await listDistricts({ page: 1, limit: 100 });
        setDistricts(res.data);
        if (selectId) {
          setDistrictId(selectId);
          return;
        }
        if (pickedRef.current) return;
        const stored = (() => {
          try {
            return localStorage.getItem(STORAGE_KEY);
          } catch {
            return null;
          }
        })();
        const initial = res.data.find((d) => d.id === stored)?.id ?? res.data[0]?.id ?? null;
        setDistrictIdState(initial);
      } catch {
        setDistricts([]);
      } finally {
        setLoading(false);
      }
    },
    [isSuperAdmin, setDistrictId],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  // admin : verrouillé sur son propre quartier ; on récupère son nom pour le libellé.
  useEffect(() => {
    if (isSuperAdmin || !user) return;
    const bound = user.adminDistrictId ?? null;
    setDistrictIdState(bound);
    setAdminDistrictName(null);
    if (!bound) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getDistrict(bound)
      .then((district) => {
        if (!cancelled) setAdminDistrictName(district.name);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, user]);

  const value = useMemo<DistrictScope>(() => {
    const districtName = isSuperAdmin ? (districts.find((d) => d.id === districtId)?.name ?? null) : adminDistrictName;
    return {
      districtId,
      districtName,
      districts: isSuperAdmin ? districts : [],
      canSwitch: isSuperAdmin && districts.length > 0,
      setDistrictId,
      reload,
      loading,
    };
  }, [isSuperAdmin, districts, districtId, adminDistrictName, setDistrictId, reload, loading]);

  return <DistrictScopeContext.Provider value={value}>{children}</DistrictScopeContext.Provider>;
}

/** Hook d'accès au scope quartier. Lève une erreur si utilisé hors d'un DistrictScopeProvider. */
// eslint-disable-next-line react-refresh/only-export-components -- provider + son hook colocalisés
export function useDistrictScope(): DistrictScope {
  const ctx = useContext(DistrictScopeContext);
  if (!ctx) throw new Error("useDistrictScope must be used within a DistrictScopeProvider");
  return ctx;
}
