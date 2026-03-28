"use client";

import { useEffect, useRef, useState } from "react";

export type MapPoint = {
  latitude: number;
  longitude: number;
};

type LeafletMapInstance = {
  setView: (coords: [number, number], zoom: number) => void;
  fitBounds: (bounds: [[number, number], [number, number]], options?: { padding?: [number, number] }) => void;
  remove: () => void;
};

type LeafletMarkerInstance = {
  setLatLng: (coords: [number, number]) => void;
  bindPopup: (content: string) => void;
  addTo: (map: LeafletMapInstance) => LeafletMarkerInstance;
  remove?: () => void;
};

type LeafletNamespace = {
  map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMapInstance;
  tileLayer: (
    url: string,
    options?: { attribution?: string; maxZoom?: number }
  ) => { addTo: (map: LeafletMapInstance) => void };
  marker: (coords: [number, number], options?: { icon?: unknown }) => LeafletMarkerInstance;
  divIcon: (options: { className: string; html: string; iconSize: [number, number]; iconAnchor: [number, number] }) => unknown;
};

declare global {
  interface Window {
    L?: LeafletNamespace;
  }
}

let leafletAssetsPromise: Promise<LeafletNamespace> | null = null;

function loadLeafletAssets() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Leaflet can only load in the browser."));
  }

  if (window.L) {
    return Promise.resolve(window.L);
  }

  if (!leafletAssetsPromise) {
    leafletAssetsPromise = new Promise((resolve, reject) => {
      const existingStylesheet = document.querySelector('link[data-leaflet="true"]');

      if (!existingStylesheet) {
        const stylesheet = document.createElement("link");
        stylesheet.rel = "stylesheet";
        stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        stylesheet.crossOrigin = "";
        stylesheet.dataset.leaflet = "true";
        document.head.appendChild(stylesheet);
      }

      const existingScript = document.querySelector('script[data-leaflet="true"]') as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener("load", () => {
          if (window.L) {
            resolve(window.L);
          } else {
            reject(new Error("Leaflet script loaded without exposing window.L"));
          }
        });
        existingScript.addEventListener("error", () => reject(new Error("Leaflet script failed to load.")));
        return;
      }

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.crossOrigin = "";
      script.dataset.leaflet = "true";
      script.onload = () => {
        if (window.L) {
          resolve(window.L);
        } else {
          reject(new Error("Leaflet script loaded without exposing window.L"));
        }
      };
      script.onerror = () => reject(new Error("Leaflet script failed to load."));
      document.body.appendChild(script);
    });
  }

  return leafletAssetsPromise;
}

function createMarkerIcon(color: string, ringColor: string, L: LeafletNamespace) {
  return L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 0 0 2px ${ringColor};"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

type LiveRideMapProps = {
  riderLocation?: MapPoint | null;
  driverLocation?: MapPoint | null;
  title?: string;
  emptyLabel?: string;
  footerLabel?: string;
  maxWidth?: number;
};

export default function LiveRideMap({
  riderLocation,
  driverLocation,
  title = "Live Map",
  emptyLabel = "Pickup coordinates are not available yet, so the live map cannot be drawn.",
  footerLabel,
  maxWidth = 560,
}: LiveRideMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const riderMarkerRef = useRef<LeafletMarkerInstance | null>(null);
  const driverMarkerRef = useRef<LeafletMarkerInstance | null>(null);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!mapContainerRef.current || !riderLocation) {
      return;
    }

    loadLeafletAssets()
      .then((L) => {
        if (cancelled || !mapContainerRef.current) return;

        if (!mapRef.current) {
          const map = L.map(mapContainerRef.current, {
            zoomControl: true,
          });

          L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }).addTo(map);

          mapRef.current = map;
          const riderIcon = createMarkerIcon("#f97316", "rgba(154,52,18,0.35)", L);
          riderMarkerRef.current = L.marker([riderLocation.latitude, riderLocation.longitude], { icon: riderIcon }).addTo(map);
          riderMarkerRef.current.bindPopup("Pickup");

          if (driverLocation) {
            const driverIcon = createMarkerIcon("#2563eb", "rgba(30,64,175,0.35)", L);
            driverMarkerRef.current = L.marker([driverLocation.latitude, driverLocation.longitude], { icon: driverIcon }).addTo(map);
            driverMarkerRef.current.bindPopup("Driver");
          }
        } else {
          riderMarkerRef.current?.setLatLng([riderLocation.latitude, riderLocation.longitude]);

          if (driverLocation) {
            if (!driverMarkerRef.current) {
              const driverIcon = createMarkerIcon("#2563eb", "rgba(30,64,175,0.35)", L);
              driverMarkerRef.current = L.marker([driverLocation.latitude, driverLocation.longitude], { icon: driverIcon }).addTo(mapRef.current);
              driverMarkerRef.current.bindPopup("Driver");
            } else {
              driverMarkerRef.current.setLatLng([driverLocation.latitude, driverLocation.longitude]);
            }
          } else if (driverMarkerRef.current?.remove) {
            driverMarkerRef.current.remove();
            driverMarkerRef.current = null;
          }
        }

        if (mapRef.current) {
          if (driverLocation) {
            mapRef.current.fitBounds(
              [
                [riderLocation.latitude, riderLocation.longitude],
                [driverLocation.latitude, driverLocation.longitude],
              ],
              { padding: [40, 40] }
            );
          } else {
            mapRef.current.setView([riderLocation.latitude, riderLocation.longitude], 15);
          }
        }
      })
      .catch((error) => {
        console.error(error);
        setMapError("We could not load the live map right now.");
      });

    return () => {
      cancelled = true;
    };
  }, [driverLocation, riderLocation]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (!riderLocation) {
    return (
      <div
        style={{
          marginTop: 16,
          borderRadius: 12,
          padding: 16,
          backgroundColor: "#f8fafc",
          color: "#334155",
          border: "1px solid #cbd5e1",
          maxWidth,
        }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 16,
        maxWidth,
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid #bfdbfe",
        backgroundColor: "#ffffff",
      }}
    >
      <div style={{ padding: "12px 14px", color: "#0f172a", backgroundColor: "#eff6ff" }}>
        <strong>{title}</strong>
      </div>

      <div ref={mapContainerRef} style={{ width: "100%", height: 320 }} />

      <div style={{ padding: 14, color: "#0f172a", backgroundColor: "#f8fafc" }}>
        {mapError ||
          footerLabel ||
          (driverLocation ? "Blue is the driver. Orange is the pickup spot." : "Waiting for driver location to appear.")}
      </div>
    </div>
  );
}
