import React from "react";
import { useLocation } from "react-router-dom";
import useDeviceRestriction from "@/hooks/useDeviceRestriction";
import TabletOrientationAdvisory from "./TabletOrientationAdvisory";

const CAD_HEAVY_ROUTES = ["/planta-ia", "/panel-generator", "/solar-project"];

/**
 * DeviceGate — A plataforma Nacif Energy é totalmente responsiva em smartphones,
 * tablets e desktops (320px a 1920px). Em editores CAD imersivos em tablets portrait,
 * exibe apenas uma recomendação não-bloqueante de rotação.
 */
export default function DeviceGate({ children }) {
  const location = useLocation();
  const { shouldPromptTabletRotate } = useDeviceRestriction();
  const isCadRoute = CAD_HEAVY_ROUTES.some((route) =>
    location.pathname.startsWith(route)
  );

  return (
    <>
      {shouldPromptTabletRotate && isCadRoute && <TabletOrientationAdvisory />}
      {children}
    </>
  );
}
