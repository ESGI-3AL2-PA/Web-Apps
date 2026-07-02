import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@repo/hooks";
import { useDistrictScope } from "../app/DistrictScopeProvider";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: "icon-[tabler--layout-dashboard]" }],
  },
  {
    section: "Community",
    items: [
      { to: "/users", label: "Users", icon: "icon-[tabler--users]" },
      { to: "/districts", label: "Districts", icon: "icon-[tabler--map-2]" },
      { to: "/tags", label: "Tags", icon: "icon-[tabler--tags]" },
      { to: "/incidents", label: "Incidents", icon: "icon-[tabler--alert-triangle]" },
    ],
  },
  {
    section: "Moderation",
    items: [
      { to: "/listings", label: "Listings", icon: "icon-[tabler--clipboard-list]" },
      { to: "/events", label: "Events", icon: "icon-[tabler--calendar-event]" },
      { to: "/votes", label: "Votes", icon: "icon-[tabler--checkbox]" },
    ],
  },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const scope = useDistrictScope();

  return (
    <div className="flex min-h-screen bg-base-200/40">
      <aside className="w-64 shrink-0 bg-base-100 border-e border-base-content/10 flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-base-content/10">
          <span className="icon-[tabler--building-community] size-6 text-primary" />
          <span className="ms-2 font-semibold">Admin Console</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {NAV.map((group) => (
            <div key={group.section}>
              <p className="px-3 mb-1 text-xs font-medium uppercase tracking-wide text-base-content/50">
                {group.section}
              </p>
              <ul className="menu p-0 gap-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      className={({ isActive }) =>
                        `flex items-center gap-2 rounded-btn px-3 py-2 text-sm ${
                          isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-base-200"
                        }`
                      }
                    >
                      <span className={`${item.icon} size-5`} />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 bg-base-100 border-b border-base-content/10 flex items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2">
            {scope.canSwitch ? (
              <>
                <span className="text-xs uppercase tracking-wide text-base-content/50">Auditing</span>
                <select
                  className="select select-sm max-w-xs"
                  value={scope.districtId ?? ""}
                  onChange={(e) => scope.setDistrictId(e.target.value)}
                  aria-label="District to audit"
                >
                  {scope.districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </>
            ) : scope.districtName ? (
              <span className="badge badge-soft badge-primary gap-1">
                <span className="icon-[tabler--map-pin] size-4" />
                {scope.districtName}
              </span>
            ) : (
              !scope.loading && <span className="text-xs text-warning">No district assigned</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-end leading-tight">
              <p className="text-sm font-medium">{user ? `${user.firstName} ${user.lastName}` : "—"}</p>
              <p className="text-xs text-base-content/60">{user?.role}</p>
            </div>
            <button className="btn btn-sm btn-soft btn-error" onClick={() => logout()}>
              <span className="icon-[tabler--logout] size-4" />
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
