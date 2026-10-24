import { useState, useEffect } from "react";
import { classifyDevice } from "@/lib/deviceDetection";

/**
 * Hook reativo para restrição e adaptação de dispositivos no Nacif Energy
 * Reage imediatamente a resize, rotação e mudanças de orientação do aparelho.
 */
export function useDeviceRestriction() {
  const [deviceInfo, setDeviceInfo] = useState(() => classifyDevice());

  useEffect(() => {
    const handleUpdate = () => {
      setDeviceInfo(classifyDevice());
    };

    window.addEventListener("resize", handleUpdate, { passive: true });
    window.addEventListener("orientationchange", handleUpdate, { passive: true });

    const orientation = window.screen?.orientation;
    if (orientation && orientation.addEventListener) {
      orientation.addEventListener("change", handleUpdate);
    }

    // Chamada imediata para garantir sincronia pós-montagem
    handleUpdate();

    return () => {
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("orientationchange", handleUpdate);
      if (orientation && orientation.removeEventListener) {
        orientation.removeEventListener("change", handleUpdate);
      }
    };
  }, []);

  return deviceInfo;
}

export default useDeviceRestriction;
