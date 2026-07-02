import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@repo/hooks";
import type { DistrictResponseDto } from "@repo/contracts";
import { getDistrict, listDistricts } from "../api-service/districts";

// The whole admin console is scoped to one active district. A regular `admin` is locked to the
// district they administer (`user.adminDistrictId`); a `superAdmin` picks one from all districts
// via the top-bar selector (always exactly one selected). This is the front-end half — the api
// enforces the same scoping server-side (see apps/api/src/middleware/district-scope.ts).

const STORAGE_KEY = "adminDistrictScope";

interface DistrictScope {
  districtId: string | null; // active district (drives scoped list pages)
  districtName: string | null; // for the top-bar label
  districts: DistrictResponseDto[]; // superAdmin: all districts; admin: empty
  canSwitch: boolean; // superAdmin with ≥1 district
  setDistrictId: (id: string) => void; // superAdmin only
  loading: boolean;
}

const DistrictScopeContext = createContext<DistrictScope | null>(null);

export function DistrictScopeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superAdmin";

  const [districts, setDistricts] = useState<DistrictResponseDto[]>([]);
  const [districtId, setDistrictIdState] = useState<string | null>(null);
  const [adminDistrictName, setAdminDistrictName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Avoid clobbering a user's freshly-picked district if the initial fetch resolves late.
  const pickedRef = useRef(false);

  const setDistrictId = useCallback((id: string) => {
    pickedRef.current = true;
    setDistrictIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore storage failures (private mode, quota) — scope just won't persist
    }
  }, []);

  // superAdmin: load all districts, then select the persisted one (if still present) or the first.
  useEffect(() => {
    if (!isSuperAdmin) return;
    let cancelled = false;
    setLoading(true);
    listDistricts({ page: 1, limit: 100 })
      .then((res) => {
        if (cancelled) return;
        setDistricts(res.data);
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
      })
      .catch(() => {
        if (!cancelled) setDistricts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  // admin: locked to their own district; fetch its name for the label.
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
      loading,
    };
  }, [isSuperAdmin, districts, districtId, adminDistrictName, setDistrictId, loading]);

  return <DistrictScopeContext.Provider value={value}>{children}</DistrictScopeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + its hook colocated
export function useDistrictScope(): DistrictScope {
  const ctx = useContext(DistrictScopeContext);
  if (!ctx) throw new Error("useDistrictScope must be used within a DistrictScopeProvider");
  return ctx;
}
