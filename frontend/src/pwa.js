import { useEffect, useState } from 'react';

// Capture the install event as early as possible (it can fire before React mounts).
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const isIos = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
  (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

export const SHOW_INSTALL_EVENT = 'nirmaan:show-install';
export const showInstallPrompt = () => window.dispatchEvent(new Event(SHOW_INSTALL_EVENT));

export async function runInstall() {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return outcome;
}

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  const standalone = isStandalone();
  const ios = isIos();
  return {
    standalone,
    ios,
    // Show an "Install" entry point when the browser can install, or on iOS where it is manual.
    available: !standalone && (Boolean(deferredPrompt) || ios),
    canPrompt: Boolean(deferredPrompt),
  };
}
