import React, { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { StoreData } from '../types';

interface CarteTourneeViewProps {
  data: StoreData;
}

export const CarteTourneeView: React.FC<CarteTourneeViewProps> = ({ data }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    // Dynamically load leaflet on client side
    import('leaflet').then(L => {
      if (!mapRef.current) return;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Default center: Alger (36.7538, 3.0588)
      const map = L.map(mapRef.current).setView([36.7538, 3.0588], 11);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Add markers for clients with lat/lng
      data.clients.forEach(c => {
        if (c.latitude && c.longitude) {
          const marker = L.marker([c.latitude, c.longitude]).addTo(map);
          marker.bindPopup(`
            <div style="font-family:sans-serif; font-size:12px">
              <b>${c.nom}</b><br/>
              Ville: ${c.ville}<br/>
              Solde: ${c.solde.toLocaleString()} DA<br/>
              <a href="https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}" target="_blank" style="color:blue; text-decoration:underline;">Itinéraire Google Maps</a>
            </div>
          `);
        }
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [data]);

  return (
    <div className="space-y-6 animate-in fade-in h-[calc(100vh-7rem)] flex flex-col">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Carte Interactive des Tournées GPS & Clients</h2>
          <p className="text-sm text-slate-500 mt-1">Visualisation géographique des clients actifs, encours et itinéraires OpenStreetMap.</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden relative">
        <div ref={mapRef} className="w-full h-full z-10" />
      </div>
    </div>
  );
};
