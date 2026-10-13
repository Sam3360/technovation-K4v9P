import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  FiUploadCloud, FiAlertTriangle, FiCpu, FiMail, FiVideo, FiVideoOff, FiCamera, FiDatabase,
  FiActivity, FiClipboard, FiLogOut, FiMapPin, FiDownload, FiCheckCircle, FiClock, FiCrosshair,
  FiImage, FiBell, FiTrash2, FiExternalLink,
} from 'react-icons/fi';
import * as tmImage from '@teachablemachine/image';
import '@tensorflow/tfjs';
import exifr from 'exifr';
import Login from './Login';
import DatabaseView from './DatabaseView';
import { saveCrack, sendAlert as sendAlertRequest } from './api';
import { useInstall, showInstallPrompt } from './pwa';

const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/JILKj4N_4/';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showDatabase, setShowDatabase] = useState(false);
  const [model, setModel] = useState(null);
  const [isLoadingModel, setIsLoadingModel] = useState(true);
  const [results, setResults] = useState([]);
  const [alertSent, setAlertSent] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [deviceGps, setDeviceGps] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('Requesting...');

  // Webcam state
  const [webcamActive, setWebcamActive] = useState(false);
  const [livePrediction, setLivePrediction] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const alertSentRef = useRef(false);

  useEffect(() => {
    async function loadModel() {
      try {
        const t = Date.now();
        const loaded = await tmImage.load(
          `${MODEL_URL}model.json?t=${t}`,
          `${MODEL_URL}metadata.json?t=${t}`
        );
        setModel(loaded);
        setIsLoadingModel(false);
      } catch (err) {
        console.error('Failed to load model', err);
        setIsLoadingModel(false);
      }
    }
    loadModel();
  }, []);

  useEffect(() => {
    if (currentUser?.email) {
      setTargetEmail(currentUser.email);
    }
  }, [currentUser]);

  // ── Browser Geolocation ──
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('Not supported');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setDeviceGps({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGpsStatus('Acquired');
      },
      (err) => {
        if (err.code === 1) setGpsStatus('Permission Denied');
        else if (err.code === 2) setGpsStatus('Unavailable');
        else setGpsStatus('Timeout');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ── Webcam logic ──
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setWebcamActive(true); // render <video> first, then attach in useEffect
    } catch (err) {
      alert('Could not access camera. Please allow camera permissions and try again.');
      console.error(err);
    }
  };

  // Attach stream to video element AFTER it is rendered in the DOM
  useEffect(() => {
    if (webcamActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [webcamActive]);

  const stopWebcam = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setWebcamActive(false);
    setLivePrediction(null);
  };

  // Prediction loop on webcam frames
  useEffect(() => {
    if (!webcamActive || !model || !videoRef.current) return;

    const predictLoop = async () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        const prediction = await model.predict(videoRef.current);
        const top = prediction.reduce((a, b) => a.probability > b.probability ? a : b);
        const isUnsafe = top.className === 'Road Deformations';
        const displayClass = top.className;

        setLivePrediction({ prediction, top, isUnsafe, displayClass });

        // Auto-alert on crack/deformation (once per session)
        if (isUnsafe && !alertSentRef.current && targetEmail) {
          alertSentRef.current = true;
          setAlertSent(true);
          try {
            const response = await sendAlertRequest({
                message: 'An unsafe condition (crack or deformation) was detected via live webcam feed.',
                recipientEmail: targetEmail,
                gps: deviceGps || null,
                timestamp: new Date().toISOString(),
                confidence: top.probability * 100,
                topClass: displayClass
            });
            if (!response.success) console.warn(response.message);
          } catch (e) { console.error(e); }
        }
      }
      animFrameRef.current = requestAnimationFrame(predictLoop);
    };

    animFrameRef.current = requestAnimationFrame(predictLoop);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [webcamActive, model, targetEmail]);

  const saveUnsafeToDB = async (unsafeObj) => {
    if (!unsafeObj.isUnsafe) return;
    try {
      const result = await saveCrack(unsafeObj);
      if (!result.success) console.error('Failed to save detection:', result);
    } catch (e) {
      console.error('DB save error', e);
    }
  };

  // Capture snapshot from webcam and add to history
  const captureSnapshot = () => {
    if (!videoRef.current || !livePrediction) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    const preview = canvas.toDataURL('image/jpeg');
    const newRes = {
      id: Math.random().toString(36).substr(2, 9),
      preview,
      predictions: livePrediction.prediction,
      topClass: livePrediction.displayClass,
      rawClass: livePrediction.top.className,
      isUnsafe: livePrediction.isUnsafe,
      timestamp: new Date().toISOString(),
      gps: deviceGps || null,
      confidence: livePrediction.top.probability * 100
    };
    setResults(prev => [newRes, ...prev]);
    saveUnsafeToDB(newRes);
  };

  // Cleanup on unmount
  useEffect(() => () => stopWebcam(), []);

  // ── Upload logic ──
  const sendAlert = useCallback(async (file, gpsData, timestamp, confidence, topClass) => {
    if (alertSent) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      try {
        const result = await sendAlertRequest({
            message: 'An unsafe condition (crack or deformation) was detected in an uploaded image.',
            image: reader.result,
            recipientEmail: targetEmail,
            gps: gpsData,
            timestamp: timestamp,
            confidence: confidence,
            topClass: topClass
        });
        if (result.success) setAlertSent(true);
      } catch (e) { console.error('Failed to send alert email', e); }
    };
  }, [alertSent, targetEmail]);

  const fileToBase64 = (f) => new Promise(res => { const r = new FileReader(); r.onloadend = () => res(r.result); r.readAsDataURL(f); });

  const processImage = useCallback(async (file) => {
    // Try EXIF first, fall back to device GPS
    let gpsData = null;
    try { gpsData = await exifr.gps(file); } catch (_) {}
    if (!gpsData && deviceGps) gpsData = deviceGps;
    const base64Data = await fileToBase64(file);
    
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Data;
      img.onload = async () => {
        if (!model) return;
        const prediction = await model.predict(img);
        const top = prediction.reduce((a, b) => a.probability > b.probability ? a : b);
        const isUnsafe = top.className === 'Road Deformations';
        const displayClass = top.className;
        
        const newRes = {
          id: Math.random().toString(36).substr(2, 9),
          preview: base64Data,
          predictions: prediction,
          topClass: displayClass,
          rawClass: top.className,
          isUnsafe,
          timestamp: new Date().toISOString(),
          gps: gpsData,
          confidence: top.probability * 100
        };
        
        if (isUnsafe) {
          sendAlert(file, gpsData, newRes.timestamp, newRes.confidence, newRes.topClass);
          saveUnsafeToDB(newRes);
        }
        resolve(newRes);
      };
    });
  }, [model, sendAlert, deviceGps]);

  const onDrop = useCallback(async (acceptedFiles) => {
    const newResults = await Promise.all(acceptedFiles.map(f => processImage(f)));
    setResults(prev => [...newResults, ...prev]);
  }, [processImage]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
  });

  // ── UI state (presentation only) ──
  const [tab, setTab] = useState('inspect'); // 'inspect' | 'reports' | 'database'
  const [mode, setMode] = useState('upload'); // 'upload' | 'camera'
  const install = useInstall();

  if (!currentUser) {
    return <Login onLoginSuccess={setCurrentUser} />;
  }

  if (isLoadingModel) {
    return (
      <div className="splash">
        <div className="splash-ring"><FiCpu /></div>
        <div className="splash-title">Starting Nirmaan</div>
        <div className="splash-sub">Loading the detection model. This takes a few seconds on first launch.</div>
      </div>
    );
  }

  const isOfficial = currentUser?.role === 'BMC Official';
  const latest = results[0];
  const activePred = webcamActive ? livePrediction : null;
  const sidebarPred = activePred
    ? { topClass: activePred.displayClass, rawClass: activePred.top.className, isUnsafe: activePred.isUnsafe, predictions: activePred.prediction }
    : latest;

  const getConf = (res) =>
    res.predictions.find(p => p.className === res.rawClass).probability * 100;

  const unsafeCount = results.filter(r => r.isUnsafe).length;
  const safeCount = results.length - unsafeCount;
  const fmtTime = (iso) => new Date(iso).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const shownGps = latest?.gps || deviceGps;

  const goTab = (next) => {
    if (next !== 'inspect' && webcamActive) stopWebcam();
    setTab(next);
  };
  const switchMode = (next) => {
    if (next === 'upload' && webcamActive) stopWebcam();
    setMode(next);
  };
  const logout = () => { if (webcamActive) stopWebcam(); setCurrentUser(null); };

  const nav = [
    { id: 'inspect', label: 'Inspect', icon: <FiCrosshair /> },
    { id: 'reports', label: 'Reports', icon: <FiClipboard />, count: results.length || null },
    ...(isOfficial ? [{ id: 'database', label: 'Database', icon: <FiDatabase /> }] : []),
  ];
  const titles = {
    inspect: ['Inspect', 'Scan a road surface with your camera or a photo'],
    reports: ['Reports', 'Everything scanned in this session'],
    database: ['Deformation Database', 'Logged deformations, restricted to BMC officials'],
  };

  const gpsTone = gpsStatus === 'Acquired' ? 'ok' : gpsStatus === 'Requesting...' ? 'warn' : 'bad';
  const initial = (currentUser.email || '?').charAt(0).toUpperCase();

  return (
    <div className="shell">
      {/* ── Sidebar (desktop) ── */}
      <aside className="side">
        <div className="side-brand">
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width="36" height="36" />
          <div>
            <div className="side-name">Nirmaan</div>
            <div className="side-tag">Road Inspector</div>
          </div>
        </div>

        <nav className="side-nav">
          {nav.map(item => (
            <button key={item.id} className={`nav-item ${tab === item.id ? 'active' : ''}`} onClick={() => goTab(item.id)}>
              {item.icon}<span>{item.label}</span>
              {item.count ? <em className="nav-count">{item.count}</em> : null}
            </button>
          ))}
        </nav>

        <div className="side-foot">
          {install.available && (
            <button className="side-install" onClick={showInstallPrompt}>
              <FiDownload /> Install app
            </button>
          )}
          <div className="side-user">
            <div className="avatar">{initial}</div>
            <div className="side-user-info">
              <div className="side-user-mail" title={currentUser.email}>{currentUser.email}</div>
              <div className="side-user-role">{currentUser.role}</div>
            </div>
            <button className="icon-btn" onClick={logout} title="Sign out" aria-label="Sign out"><FiLogOut /></button>
          </div>
        </div>
      </aside>

      <div className="main">
        {/* ── Top bar ── */}
        <header className="topbar">
          <div className="topbar-title">
            <div className="mobile-brand">
              <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width="28" height="28" />
              <span>Nirmaan</span>
            </div>
            <h1>{titles[tab][0]}</h1>
            <p>{titles[tab][1]}</p>
          </div>
          <div className="topbar-chips">
            <span className={`chip ${model ? 'ok' : 'bad'}`}><i />{model ? 'Model ready' : 'Model offline'}</span>
            <span className={`chip ${gpsTone}`}><FiMapPin />GPS: {gpsStatus === 'Requesting...' ? 'Locating' : gpsStatus}</span>
            <button className="icon-btn mobile-only" onClick={logout} title="Sign out" aria-label="Sign out"><FiLogOut /></button>
          </div>
        </header>

        <main className="page">
          {!model && (
            <div className="banner banner-bad">
              <FiAlertTriangle size={18} />
              <div><strong>Detection model could not be loaded.</strong> Check your internet connection and reload the app.</div>
            </div>
          )}

          {alertSent && (
            <div className="banner banner-warn">
              <FiBell size={18} />
              <div><strong>Alert sent.</strong> An email was dispatched to {targetEmail || 'the configured address'} for the detected unsafe condition.</div>
            </div>
          )}

          {/* ───────── INSPECT ───────── */}
          {tab === 'inspect' && (
            <>
              <section className="stats">
                <div className="stat"><span className="stat-ic"><FiActivity /></span><div><b>{results.length}</b><small>Scans</small></div></div>
                <div className="stat stat-bad"><span className="stat-ic"><FiAlertTriangle /></span><div><b>{unsafeCount}</b><small>Unsafe found</small></div></div>
                <div className="stat stat-ok"><span className="stat-ic"><FiCheckCircle /></span><div><b>{safeCount}</b><small>Clear</small></div></div>
                <div className="stat"><span className="stat-ic"><FiBell /></span><div><b>{alertSent ? 'Sent' : 'Standby'}</b><small>Email alert</small></div></div>
              </section>

              <div className="work">
                {/* Capture */}
                <section className="card capture">
                  <div className="card-head">
                    <div className="seg" role="tablist">
                      <button className={mode === 'upload' ? 'on' : ''} onClick={() => switchMode('upload')}><FiUploadCloud /> Upload photo</button>
                      <button className={mode === 'camera' ? 'on' : ''} onClick={() => switchMode('camera')}><FiVideo /> Live camera</button>
                    </div>
                  </div>

                  {mode === 'upload' && (
                    <>
                      <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
                        <input {...getInputProps()} />
                        <span className="dz-ic"><FiUploadCloud /></span>
                        <h3>{isDragActive ? 'Drop images to scan' : 'Tap to choose photos'}</h3>
                        <p>or drag and drop road surface images here. GPS is read from the photo when available.</p>
                      </div>

                      {latest && (
                        <div className={`latest ${latest.isUnsafe ? 'bad' : 'ok'}`}>
                          <img src={latest.preview} alt="Latest scan" />
                          <div className="latest-tag">
                            {latest.isUnsafe ? <><FiAlertTriangle /> Unsafe · {getConf(latest).toFixed(0)}%</> : <><FiCheckCircle /> Clear · {getConf(latest).toFixed(0)}%</>}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {mode === 'camera' && (
                    <>
                      <div className={`cam ${livePrediction?.isUnsafe ? 'bad' : livePrediction ? 'ok' : ''}`}>
                        {webcamActive ? (
                          <>
                            <video ref={videoRef} autoPlay playsInline muted className="cam-video" />
                            <span className="cam-corner tl" /><span className="cam-corner tr" /><span className="cam-corner bl" /><span className="cam-corner br" />
                            {livePrediction && (
                              <div className={`cam-pill ${livePrediction.isUnsafe ? 'bad' : 'ok'}`}>
                                <i /> {livePrediction.isUnsafe ? 'Unsafe' : 'Clear'} · {(livePrediction.top.probability * 100).toFixed(0)}%
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="cam-off">
                            <span className="dz-ic"><FiVideo /></span>
                            <h3>Camera is off</h3>
                            <p>Point the rear camera at the road. Detection runs live on every frame.</p>
                          </div>
                        )}
                      </div>
                      <div className="cam-actions">
                        {webcamActive && (
                          <button className="btn btn-light" onClick={captureSnapshot} disabled={!livePrediction}>
                            <FiCamera /> Save snapshot
                          </button>
                        )}
                        <button className={`btn ${webcamActive ? 'btn-danger' : 'btn-accent'}`} onClick={webcamActive ? stopWebcam : startWebcam}>
                          {webcamActive ? <><FiVideoOff /> Stop camera</> : <><FiVideo /> Start camera</>}
                        </button>
                      </div>
                    </>
                  )}
                </section>

                {/* Right column */}
                <div className="stack">
                  <section className="card">
                    <div className="card-title">Detection result</div>
                    {sidebarPred ? (
                      <>
                        <div className={`verdict ${sidebarPred.isUnsafe ? 'bad' : 'ok'}`}>
                          <span className="verdict-ic">{sidebarPred.isUnsafe ? <FiAlertTriangle /> : <FiCheckCircle />}</span>
                          <div>
                            <div className="verdict-main">{sidebarPred.isUnsafe ? 'Unsafe condition' : 'Road looks clear'}</div>
                            <div className="verdict-sub">{sidebarPred.topClass} · {getConf(sidebarPred).toFixed(1)}% confidence</div>
                          </div>
                        </div>
                        <div className="probs">
                          {sidebarPred.predictions.filter(p => !p.className.toLowerCase().includes('arnav')).map(p => {
                            const isUnsafeClass = p.className === 'Road Deformations';
                            const isMatch = p.className === sidebarPred.rawClass;
                            return (
                              <div key={p.className} className="prob">
                                <div className="prob-head">
                                  <span className={isMatch ? 'strong' : ''}>{p.className}</span>
                                  <span>{(p.probability * 100).toFixed(1)}%</span>
                                </div>
                                <div className="bar"><div className={`bar-fill ${isUnsafeClass ? 'bad' : ''}`} style={{ width: `${p.probability * 100}%` }} /></div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="empty-mini"><FiImage /><span>No scan yet. Upload a photo or start the camera.</span></div>
                    )}
                  </section>

                  <section className="card">
                    <div className="card-title">Alert email</div>
                    <label className="field">
                      <span className="field-ic"><FiMail /></span>
                      <input
                        type="email"
                        placeholder="engineer@city.gov"
                        value={targetEmail}
                        onChange={e => {
                          setTargetEmail(e.target.value);
                          setAlertSent(false);
                          alertSentRef.current = false;
                        }}
                      />
                    </label>
                    <p className="hint">An email with the photo and location is sent when an unsafe condition is detected.</p>
                  </section>

                  <section className="card">
                    <div className="card-title">Location</div>
                    <dl className="kv">
                      <div><dt>Latitude</dt><dd>{shownGps ? shownGps.latitude.toFixed(6) : '—'}</dd></div>
                      <div><dt>Longitude</dt><dd>{shownGps ? shownGps.longitude.toFixed(6) : '—'}</dd></div>
                      {deviceGps?.accuracy && <div><dt>Accuracy</dt><dd>±{deviceGps.accuracy.toFixed(0)} m</dd></div>}
                      <div><dt>GPS status</dt><dd className={`tone-${gpsTone}`}>{gpsStatus}</dd></div>
                    </dl>
                  </section>
                </div>
              </div>
            </>
          )}

          {/* ───────── REPORTS ───────── */}
          {tab === 'reports' && (
            <section className="card flush">
              <div className="list-head">
                <div>
                  <div className="card-title">Session reports</div>
                  <small className="muted">{results.length} scans · {unsafeCount} unsafe · {safeCount} clear</small>
                </div>
                {results.length > 0 && (
                  <button className="btn btn-light btn-sm" onClick={() => setResults([])}><FiTrash2 /> Clear list</button>
                )}
              </div>
              {results.length === 0 ? (
                <div className="empty">
                  <span className="dz-ic"><FiClipboard /></span>
                  <h3>No reports yet</h3>
                  <p>Scans from this session will appear here.</p>
                  <button className="btn btn-accent" onClick={() => goTab('inspect')}><FiCrosshair /> Start inspecting</button>
                </div>
              ) : (
                <ul className="reports">
                  {results.map(res => (
                    <li key={res.id} className="report">
                      <img src={res.preview} alt="" className={res.isUnsafe ? 'bad' : 'ok'} />
                      <div className="report-body">
                        <div className="report-top">
                          <span className={`badge ${res.isUnsafe ? 'bad' : 'ok'}`}>{res.isUnsafe ? 'Unsafe' : 'Clear'}</span>
                          <b>{res.topClass}</b>
                          <span className="conf">{getConf(res).toFixed(0)}%</span>
                        </div>
                        <div className="report-meta">
                          <span><FiClock /> {fmtTime(res.timestamp)}</span>
                          {res.gps ? (
                            <a href={`https://www.google.com/maps?q=${res.gps.latitude},${res.gps.longitude}`} target="_blank" rel="noreferrer">
                              <FiMapPin /> {res.gps.latitude.toFixed(5)}, {res.gps.longitude.toFixed(5)} <FiExternalLink />
                            </a>
                          ) : <span><FiMapPin /> No location</span>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* ───────── DATABASE (BMC only) ───────── */}
          {tab === 'database' && isOfficial && <DatabaseView />}
        </main>
      </div>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="tabbar">
        {nav.map(item => (
          <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => goTab(item.id)}>
            {item.icon}<span>{item.label}</span>
            {item.count ? <em>{item.count}</em> : null}
          </button>
        ))}
        {install.available && (
          <button onClick={showInstallPrompt}><FiDownload /><span>Install</span></button>
        )}
      </nav>
    </div>
  );
}

export default App;
