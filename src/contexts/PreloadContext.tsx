"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { preloadAllAssets } from '@/lib/preloadAssets';

interface PreloadContextType {
  isPreloading: boolean;
}

const PreloadContext = createContext<PreloadContextType>({
  isPreloading: true,
});

export const usePreload = () => useContext(PreloadContext);

export const PreloadProvider = ({ children }: { children: ReactNode }) => {
  const [isPreloading, setIsPreloading] = useState(true);

  useEffect(() => {
    const startPreloading = async () => {
      try {
        await preloadAllAssets();
      } catch (error) {
        console.error("Failed to preload some assets, but continuing...", error);
      } finally {
        // Add a small delay to prevent flashing
        setTimeout(() => {
          setIsPreloading(false);
        }, 500);
      }
    };

    startPreloading();
  }, []);

  return (
    <PreloadContext.Provider value={{ isPreloading }}>
      {children}
    </PreloadContext.Provider>
  );
};
