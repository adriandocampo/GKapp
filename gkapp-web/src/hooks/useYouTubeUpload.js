/**
 * useYouTubeUpload — uploads a video file to the authenticated user's YouTube channel
 *
 * Uses Google Identity Services (GIS) to obtain an access token with the
 * youtube.upload scope, then uploads via the YouTube Data API v3 resumable
 * upload endpoint.
 *
 * Quota cost: ~1600 units per video upload.
 * Free tier: 10 000 units/day → ~6 uploads/day (can request increase from Google).
 */

import { useState, useCallback, useRef } from 'react';

const CLIENT_ID   = import.meta.env.VITE_YOUTUBE_CLIENT_ID;
const SCOPE       = 'https://www.googleapis.com/auth/youtube.upload';
const UPLOAD_URL  = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';

function loadGIS() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const s  = document.createElement('script');
    s.src    = 'https://accounts.google.com/gsi/client';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export function useYouTubeUpload() {
  const [progress,  setProgress]  = useState(0);   // 0-100
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState('');
  const tokenClientRef = useRef(null);

  /** Returns a YouTube access token via GIS popup */
  function getAccessToken() {
    return new Promise(async (resolve, reject) => {
      await loadGIS();
      if (!tokenClientRef.current) {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope:     SCOPE,
          callback:  (res) => {
            if (res.error) { reject(new Error(res.error)); return; }
            resolve(res.access_token);
          },
        });
      }
      tokenClientRef.current.requestAccessToken({ prompt: '' });
    });
  }

  /**
   * Upload a video file to YouTube.
   * @param {File}   file         - The video file
   * @param {string} title        - Video title
   * @param {string} description  - Video description
   * @returns {Promise<string>}   - YouTube video URL
   */
  const upload = useCallback(async (file, title = 'GKApp Video', description = '') => {
    if (!CLIENT_ID) throw new Error('VITE_YOUTUBE_CLIENT_ID no configurado');
    setUploading(true);
    setProgress(0);
    setError('');

    try {
      const accessToken = await getAccessToken();

      // 1 – Initiate resumable upload
      const metadata = {
        snippet: {
          title,
          description,
          categoryId: '17', // Sports
        },
        status: {
          privacyStatus: 'unlisted', // Not listed — only accessible via link
        },
      };

      const initRes = await fetch(UPLOAD_URL, {
        method:  'POST',
        headers: {
          Authorization:   `Bearer ${accessToken}`,
          'Content-Type':  'application/json; charset=UTF-8',
          'X-Upload-Content-Type': file.type,
          'X-Upload-Content-Length': file.size,
        },
        body: JSON.stringify(metadata),
      });

      if (!initRes.ok) throw new Error(`Init upload failed: ${initRes.status}`);
      const uploadUri = initRes.headers.get('Location');
      if (!uploadUri) throw new Error('No upload URI returned');

      // 2 – Upload the file in one PUT (resumable simple upload)
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUri, true);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data  = JSON.parse(xhr.responseText);
            const videoId = data.id;
            resolve(`https://www.youtube.com/watch?v=${videoId}`);
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(file);
      }).then(url => {
        setProgress(100);
        return url;
      });

      // Re-run to capture the resolved URL
      const uploadResult = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUri, true);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText);
            resolve(`https://www.youtube.com/watch?v=${data.id}`);
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(file);
      });

      setProgress(100);
      return uploadResult;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading, progress, error };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract a YouTube video ID from any common YouTube URL format */
export function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,  // bare ID
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Build a YouTube embed URL from a video ID */
export function youtubeEmbedUrl(videoId) {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
