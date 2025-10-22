import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LoadingScreen } from "./components/LoadingScreen";
import { db } from "./services/db";
import "./index.css";
import "leaflet/dist/leaflet.css";
import Dexie from "dexie";
import { connectLiveSocket } from "./services/socket";

// Type for database status
type DbStatus = "checking" | "available" | "unavailable" | "migrating";

const Main = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [indexedDbAvailable, setIndexedDbAvailable] = useState(false);
  const [hasCachedData, setHasCachedData] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [dbStatus, setDbStatus] = useState<DbStatus>("checking");
  const [liveAvailable, setLiveAvailable] = useState<boolean | null>(null);

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

    // Define socket connectivity check function
    const checkSocketConnectivity = () =>
      new Promise<boolean>((resolve) => {
        let cleanup = () => {};
        const timer = setTimeout(() => {
          try { cleanup(); } catch {}
          resolve(false);
        }, 3000);
        cleanup = connectLiveSocket(
          () => {},
          {
            onConnect: () => {
              clearTimeout(timer);
              try { cleanup(); } catch {}
              resolve(true);
            },
            onError: () => {
              clearTimeout(timer);
              try { cleanup(); } catch {}
              resolve(false);
            },
          }
        );
      });

    // Run database and service worker checks in parallel, then check socket
    Promise.all([checkDatabase(), checkServiceWorkerCache()]).then(
      async ([dbHasData, swHasData]) => {
        const hasData = dbHasData || swHasData;

        // Simplified loading time calculation
        const baseLoadingTime = hasData ? 800 : firstVisit ? (hasIndexedDB ? 2000 : 3500) : (hasIndexedDB ? 1200 : 2000);
        const loadingTime = baseLoadingTime + (dbStatus === "migrating" ? 1000 : 0) + Math.random() * 300;

        // Check socket connectivity in parallel with loading timer
        const socketPromise = checkSocketConnectivity();
        const loadingPromise = new Promise<void>((resolve) => setTimeout(resolve, loadingTime));

        const [socketAvailable] = await Promise.all([socketPromise, loadingPromise]);
        setLiveAvailable(socketAvailable);

        setIsLoading(false);
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
          liveAvailable={liveAvailable}
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
