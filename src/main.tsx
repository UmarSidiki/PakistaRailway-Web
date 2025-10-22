import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LoadingScreen } from "./components/LoadingScreen";
import { db } from "./services/db";
import "./index.css";
import "leaflet/dist/leaflet.css";
import Dexie from "dexie";

// Type for database status
type DbStatus = "checking" | "available" | "unavailable" | "migrating";

const Main = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [indexedDbAvailable, setIndexedDbAvailable] = useState(false);
  const [hasCachedData, setHasCachedData] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [dbStatus, setDbStatus] = useState<DbStatus>("checking");

  useEffect(() => {
    // Check if IndexedDB is available
    const checkIndexedDB = () => {
      try {
        return "indexedDB" in window && indexedDB !== null;
      } catch (e) {
        return false;
      }
    };

    // Check if this is the first visit
    const checkFirstVisit = () => {
      const hasVisited = localStorage.getItem("hasVisitedBefore");
      if (!hasVisited) {
        localStorage.setItem("hasVisitedBefore", "true");
        return true;
      }
      return false;
    };

    // Add minimum duration for each status state
    const addMinimumDuration = (status: DbStatus, minDuration: number) => {
      return new Promise<void>((resolve) => {
        setDbStatus(status);
        setTimeout(resolve, minDuration);
      });
    };

    // Check database status and data
    const checkDatabase = async () => {
      if (!checkIndexedDB()) {
        await addMinimumDuration("unavailable", 800);
        return false;
      }

      setIndexedDbAvailable(true);
      // Add minimum duration for checking status
      await addMinimumDuration("checking", 1200);

      try {
        // Check if database is accessible
        await db.open();

        // Check if we have data
        const trainCount = await db.trains.count();
        const stationCount = await db.stations.count();

        if (trainCount > 0 || stationCount > 0) {
          // Check when data was last updated
          const lastUpdated = await db.lastUpdated.get("trains");
          const now = Date.now();
          const oneHour = 60 * 60 * 1000;

          // Consider data "fresh" if updated within the last hour
          const hasRecentData =
            !!lastUpdated && now - lastUpdated.timestamp < oneHour;

          setHasCachedData(hasRecentData);
          await addMinimumDuration("available", 500);
          return hasRecentData;
        } else {
          await addMinimumDuration("available", 500);
          return false;
        }
      } catch (error) {
        console.error("Database error:", error);

        // Check if it's a version error (schema migration needed)
        if (
          error instanceof Dexie.MissingAPIError ||
          error instanceof Dexie.SchemaError ||
          (error as any).name === "VersionError"
        ) {
          await addMinimumDuration("migrating", 1500);
          try {
            // Try to open again, which should trigger migration
            await db.open();
            await addMinimumDuration("available", 500);
            return false;
          } catch (migrationError) {
            console.error("Migration failed:", migrationError);
            await addMinimumDuration("unavailable", 800);
            return false;
          }
        } else {
          await addMinimumDuration("unavailable", 800);
          return false;
        }
      }
    };

    // Check service worker and cache status
    const checkServiceWorkerCache = () => {
      return new Promise<boolean>((resolve) => {
        if (
          "serviceWorker" in navigator &&
          navigator.serviceWorker.controller
        ) {
          const messageChannel = new MessageChannel();

          messageChannel.port1.onmessage = (event) => {
            resolve(event.data.hasCachedData);
          };

          navigator.serviceWorker.controller.postMessage(
            { type: "GET_CACHE_STATUS" },
            [messageChannel.port2]
          );

          // Timeout after 1 second
          setTimeout(() => resolve(false), 1000);
        } else {
          resolve(false);
        }
      });
    };

    const hasIndexedDB = checkIndexedDB();
    const firstVisit = checkFirstVisit();

    setIndexedDbAvailable(hasIndexedDB);
    setIsFirstVisit(firstVisit);

    // Run all checks in parallel
    Promise.all([checkDatabase(), checkServiceWorkerCache()]).then(
      ([dbHasData, swHasData]) => {
        // Use the most optimistic result
        const hasData = dbHasData || swHasData;

        // Calculate loading time based on multiple factors
        let loadingTime;

        if (hasData) {
          // Fast loading if we have cached data
          loadingTime = 800;
        } else if (firstVisit) {
          // Longer loading for first visit
          loadingTime = hasIndexedDB ? 2000 : 3500;
        } else {
          // Medium loading for return visits without cache
          loadingTime = hasIndexedDB ? 1200 : 2000;
        }

        // Add extra time if database is migrating
        if (dbStatus === "migrating") {
          loadingTime += 1000;
        }

        // Add small random variation
        loadingTime += Math.random() * 300;

        // Simulate loading time
        const timer = setTimeout(() => {
          setIsLoading(false);
        }, loadingTime);

        return () => clearTimeout(timer);
      }
    );
  }, [dbStatus]);

  return (
    <>
      {isLoading && (
        <LoadingScreen
          onComplete={() => setIsLoading(false)}
          indexedDbAvailable={indexedDbAvailable}
          hasCachedData={hasCachedData}
          isFirstVisit={isFirstVisit}
          dbStatus={dbStatus}
        />
      )}
      <div
        style={{
          opacity: isLoading ? 0 : 1,
          transition: "opacity 0.5s ease-in-out",
        }}
      >
        <App />
      </div>
    </>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Main />
    </BrowserRouter>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          console.log(
            "Service Worker registered with scope:",
            registration.scope
          );
        })
        .catch((error) =>
          console.error("Service worker registration failed:", error)
        );
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
  }
}