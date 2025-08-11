import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

const vehicleIcon = L.icon({
  iconUrl: "img/bus_416739.png",
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -30],
});

function VehicleMarker({ position, mapCenterRef }) {
  const map = useMap();
  const markerRef = useRef(null);

  useEffect(() => {
    if (!markerRef.current) {
      markerRef.current = L.marker(position, { icon: vehicleIcon }).addTo(map);
    }
  }, [map]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng(position);
    }
    map.panTo(position, { animate: true, duration: 1 });
    mapCenterRef.current = { lat: position[0], lng: position[1] };
  }, [position, map, mapCenterRef]);

  return null;
}

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

function App() {
  const [route, setRoute] = useState([]);
  const [positionIndex, setPositionIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [path, setPath] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [loading, setLoading] = useState(true);

  const [speedKmh, setSpeedKmh] = useState(20);

  const frameRef = useRef(null);
  const startTimeRef = useRef(null);
  const mapCenterRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    const createCircularRoute = async () => {
      const points = [
        [19.87682, 75.34351],
        [19.8773, 75.34062],
        [19.8741, 75.3396],
        [19.8719, 75.3431],
      ];

      let fullRoute = [];

      for (let i = 0; i < points.length; i++) {
        const start = points[i];
        const end = points[(i + 1) % points.length];

        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;

        try {
          const res = await fetch(osrmUrl);
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            const segment = data.routes[0].geometry.coordinates.map((coord) => [
              coord[1],
              coord[0],
            ]);
            fullRoute = fullRoute.concat(segment);
          }
        } catch (err) {
          console.error("Error fetching route segment from OSRM:", err);
        }
      }

      setRoute(fullRoute);
      setCurrentPosition(fullRoute[0]);
      setPath([fullRoute[0]]);
      mapCenterRef.current = { lat: fullRoute[0][0], lng: fullRoute[0][1] };
      setLoading(false);
    };

    createCircularRoute();
  }, []);

  useEffect(() => {
    if (!isPlaying || !route.length || loading) {
      cancelAnimationFrame(frameRef.current);
      return;
    }

    function animateMarker(timestamp) {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const currentPoint = route[positionIndex];
      const nextPoint = route[positionIndex + 1];

      if (nextPoint) {
        const speedMps = speedKmh / 3.6;
        const distance = getDistance(
          currentPoint[0],
          currentPoint[1],
          nextPoint[0],
          nextPoint[1]
        );
        const duration = (distance / speedMps) * 200;

        const progress = (timestamp - startTimeRef.current) / duration;

        if (progress < 1) {
          const newLat =
            currentPoint[0] + (nextPoint[0] - currentPoint[0]) * progress;
          const newLng =
            currentPoint[1] + (nextPoint[1] - currentPoint[1]) * progress;
          const newPosition = [newLat, newLng];
          setCurrentPosition(newPosition);
          setPath((p) => [...p.slice(0, p.length - 1), newPosition]);
        } else {
          startTimeRef.current = timestamp;
          setPositionIndex((prev) => prev + 1);
          const newPosition = nextPoint;
          setCurrentPosition(newPosition);
          setPath((p) => [...p, newPosition]);
        }
      } else {
        setIsPlaying(false);
        cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = requestAnimationFrame(animateMarker);
    }

    frameRef.current = requestAnimationFrame(animateMarker);

    return () => cancelAnimationFrame(frameRef.current);
  }, [isPlaying, positionIndex, route, loading, speedKmh]);

  const handlePlayPause = () => setIsPlaying(!isPlaying);

  const handleReset = () => {
    setIsPlaying(false);
    setPositionIndex(0);
    const initialPos = route[0];
    setCurrentPosition(initialPos);
    setPath([initialPos]);
    startTimeRef.current = null;
  };

  const handleSpeedUp = () => {
    setSpeedKmh((prevSpeed) => Math.min(prevSpeed + 10, 100));
  };

  const handleSlowDown = () => {
    setSpeedKmh((prevSpeed) => Math.max(prevSpeed - 10, 10));
  };

  if (loading) {
    return <p>Loading map data...</p>;
  }

  let elapsedTime = 0;
  if (route.length > 1) {
    let totalDistance = 0;
    for (let i = 0; i < positionIndex; i++) {
      totalDistance += getDistance(
        route[i][0],
        route[i][1],
        route[i + 1][0],
        route[i + 1][1]
      );
    }
    elapsedTime = totalDistance / (speedKmh / 3.6);
  }

  return (
    <div className="app-container">
      <div className="controls-container">
        <h2>Vehicle Simulation</h2>
        <div className="button-group">
          <button onClick={handlePlayPause}>
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button onClick={handleReset}>Reset</button>
        </div>
        <div className="button-group">
          <button onClick={handleSlowDown}>Slow Down</button>
          <button onClick={handleSpeedUp}>Speed Up</button>
        </div>
        <div className="metadata">
          <p>
            <strong>Current Coordinate:</strong> {currentPosition[0].toFixed(6)}{" "}
            , {currentPosition[1].toFixed(6)}
          </p>
          <p>
            <strong>Elapsed Time:</strong> {elapsedTime.toFixed(0)} seconds
          </p>
          <p>
            <strong>Speed:</strong> {speedKmh.toFixed(2)} km/h
          </p>
        </div>
      </div>
      <MapContainer
        center={currentPosition}
        zoom={17}
        scrollWheelZoom={false}
        className="map-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <VehicleMarker position={currentPosition} mapCenterRef={mapCenterRef} />
        <Polyline positions={path} color="#FF5733" weight={5} />
      </MapContainer>
    </div>
  );
}

export default App;
