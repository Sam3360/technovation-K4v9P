import { useEffect, useState } from 'react';
import { FiDownload, FiShare, FiPlusSquare, FiWifiOff, FiZap, FiX } from 'react-icons/fi';
import { SHOW_INSTALL_EVENT, isStandalone, isIos, runInstall, useInstall } from './pwa';

const SNOOZE_KEY = 'nirmaan-install-snoozed-until';
const SNOOZE_DAYS = 7;
const SHOW_DELAY_MS = 2500;

export default function PwaInstallPrompt() {
  const { canPrompt, ios } = useInstall();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Auto-open once after a short delay, unless installed or recently dismissed.
  useEffect(() => {
    if (isStandalone()) return;
    const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    if (until > Date.now()) return;
    const timer = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Let other parts of the UI (the "Install app" button) re-open the popup.
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(SHOW_INSTALL_EVENT, show);
    return () => window.removeEventListener(SHOW_INSTALL_EVENT, show);
  }, []);

  // Close automatically once installed.
  useEffect(() => {
    const done = () => setOpen(false);
    window.addEventListener('appinstalled', done);
    return () => window.removeEventListener('appinstalled', done);
  }, []);

  const snooze = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86400000));
    setOpen(false);
  };

  const install = async () => {
    setBusy(true);
    const outcome = await runInstall();
    setBusy(false);
    if (outcome === 'accepted') setOpen(false);
    else if (outcome === 'dismissed') snooze();
  };

  // Nothing useful to offer: not installable here and not iOS (e.g. already installed, Firefox desktop).
  if (!open || isStandalone() || (!canPrompt && !isIos())) return null;

  return (
    <div className="install-backdrop" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={snooze}>
      <div className="install-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="install-x" onClick={snooze} aria-label="Close"><FiX size={18} /></button>
        <img className="install-icon" src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width="68" height="68" />
        <h2 id="install-title">Install Nirmaan</h2>
        <p className="install-lead">Add the app to your device for one-tap access while you're out on the road.</p>

        <ul className="install-perks">
          <li><FiZap /> Opens instantly, full screen</li>
          <li><FiWifiOff /> Loads even on weak networks</li>
        </ul>

        {ios && !canPrompt ? (
          <ol className="install-steps">
            <li>Tap the <strong>Share</strong> button <FiShare className="inline-ic" /> in Safari</li>
            <li>Scroll and choose <strong>Add to Home Screen</strong> <FiPlusSquare className="inline-ic" /></li>
            <li>Tap <strong>Add</strong> in the top corner</li>
          </ol>
        ) : (
          <button className="btn btn-accent btn-block" onClick={install} disabled={busy}>
            <FiDownload /> {busy ? 'Waiting…' : 'Install app'}
          </button>
        )}
        <button className="btn btn-quiet btn-block" onClick={snooze}>Not now</button>
      </div>
    </div>
  );
}
