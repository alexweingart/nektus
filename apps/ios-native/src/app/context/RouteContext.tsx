import { createContext, useContext } from "react";

// Context for sharing current route name with LayoutBackground
export const RouteContext = createContext<string | null>(null);

export const useCurrentRoute = () => useContext(RouteContext);
