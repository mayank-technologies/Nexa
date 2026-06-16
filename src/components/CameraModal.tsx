/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Camera, X, RefreshCw, Check, RotateCcw, AlertCircle, FlipHorizontal } from "lucide-react";

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (attachment: {
    name: string;
    type: string;
    size: string;
    dataUrl: string;
  }) => void;
}

export function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load and refresh list of cameras/video devices
  const loadDevices = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter((device) => device.kind === "videoinput");
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDeviceId) {
        // Default to first device
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch {
      // Enumerate devices may be blocked wait or fail gracefully
    }
  };

  // Stop camera tracks cleanly
  const stopTracks = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  // Start the camera stream
  const startCamera = async (deviceId?: string) => {
    setIsLoading(true);
    setErrorStatus(null);
    stopTracks();

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" },
        audio: false, // strictly camera no audio
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          setIsLoading(false);
        };
      } else {
        setIsLoading(false);
      }

      // Load other devices lists in case user wants to swap
      await loadDevices();
    } catch (err: any) {
      console.error("Camera Access Error:", err);
      setIsLoading(false);
      if (err.name === "NotAllowedError") {
        setErrorStatus("Camera permission was denied. Please allow camera access in your browser settings.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setErrorStatus("No camera device could be found in your system.");
      } else {
        setErrorStatus("Could not activate camera: " + (err.message || "Unknown error"));
      }
    }
  };

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setErrorStatus(null);
      startCamera(selectedDeviceId || undefined);
    } else {
      stopTracks();
    }
    return () => {
      stopTracks();
    };
  }, [isOpen]);

  // Restart camera stream when selected device changes
  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDeviceId = e.target.value;
    setSelectedDeviceId(newDeviceId);
    startCamera(newDeviceId);
  };

  // Capture a snapshot frame
  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        // Set canvas coordinates matching actual video frame stream resolution
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        canvas.width = width;
        canvas.height = height;

        // Draw image frame on canvas
        ctx.drawImage(video, 0, 0, width, height);

        // Convert data URL
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setCapturedImage(dataUrl);
      }
    }
  };

  // Confirm image usage
  const handleUseImage = () => {
    if (capturedImage) {
      // Calculate human-friendly size from base64 string
      const head = "data:image/jpeg;base64,";
      const sizeInBytes = Math.round((capturedImage.length - head.length) * 3 / 4);
      const kbSize = parseFloat((sizeInBytes / 1024).toFixed(1)) + " KB";

      // Formulate attachment payload
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      onCapture({
        name: `photo_${timestamp}.jpg`,
        type: "image",
        size: kbSize,
        dataUrl: capturedImage,
      });
      
      // Stop and close
      stopTracks();
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(selectedDeviceId || undefined);
  };

  const handleClose = () => {
    stopTracks();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="bg-white dark:bg-[#11192e] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col transition-all duration-300 transform scale-100"
        id="nexa-camera-dialog"
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#C96A3D]" />
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Take Photo</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder block */}
        <div className="relative bg-slate-950 aspect-[4/3] flex items-center justify-center overflow-hidden">
          {errorStatus ? (
            <div className="p-6 text-center text-slate-300 max-w-xs flex flex-col items-center gap-3">
              <AlertCircle className="w-12 h-12 text-rose-500 animate-pulse" />
              <p className="text-sm font-semibold">{errorStatus}</p>
              <button 
                onClick={() => startCamera(selectedDeviceId || undefined)}
                className="mt-2 text-xs font-bold text-white bg-[#C96A3D] px-4 py-2 rounded-xl hover:bg-[#b0582f] active:scale-95 transition-all outline-none"
              >
                Retry Camera
              </button>
            </div>
          ) : capturedImage ? (
            // Frozen frame captured display representation
            <img 
              src={capturedImage} 
              alt="Photo preview" 
              className="w-full h-full object-cover"
            />
          ) : (
            // Live video stream preview representation
            <>
              {isLoading && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center gap-3 z-10">
                  <RefreshCw className="w-8 h-8 text-[#C96A3D] animate-spin" />
                  <p className="text-xs text-slate-300 font-semibold tracking-wide">Initializing Camera Input...</p>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100" // Mirrors front camera for intuitive user feeling
              />
            </>
          )}
        </div>

        {/* Hidden offscreen canvas utilized for capture translation */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Camera Selector and Dashboard Action Footer Controls */}
        <div className="p-5 bg-slate-50 dark:bg-[#0c1222] border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-4">
          {/* Camera switcher row if multiple input sources found */}
          {devices.length > 1 && !capturedImage && !errorStatus && (
            <div className="flex items-center gap-2 justify-between">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 shrink-0">
                <FlipHorizontal className="w-3.5 h-3.5" />
                Select Camera:
              </span>
              <select
                value={selectedDeviceId}
                onChange={handleDeviceChange}
                className="text-xs py-1.5 px-3 bg-white dark:bg-[#11192e] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-lg outline-none max-w-[240px] truncate"
              >
                {devices.map((device, idx) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Operation Triggers footer */}
          <div className="flex justify-center gap-3">
            {capturedImage ? (
              // Actions on temporary captured image state
              <>
                <button
                  onClick={handleRetake}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#11192e] border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 active:scale-95 transition-all overflow-hidden shrink-0"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500" />
                  <span>Retake Photo</span>
                </button>
                <button
                  onClick={handleUseImage}
                  className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl active:scale-95 transition-all overflow-hidden shrink-0"
                >
                  <Check className="w-4 h-4" />
                  <span>Pair into Chat</span>
                </button>
              </>
            ) : (
              // Live camera screen dashboard state actions
              <>
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCapture}
                  disabled={isLoading || !!errorStatus}
                  className="flex items-center gap-2 px-7 py-3 text-xs font-bold text-white bg-[#C96A3D] hover:bg-[#b0582f] disabled:opacity-40 rounded-xl active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capture Photo</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
