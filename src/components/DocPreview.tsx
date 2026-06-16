/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { FileText, Image, Paperclip, X, Eye, FilePieChart } from "lucide-react";

interface DocumentAttachment {
  name: string;
  type: string; // "pdf" | "docx" | "image" | "txt"
  size: string;
  dataUrl?: string; // base64
  textPreview?: string;
}

interface DocPreviewProps {
  attachment: DocumentAttachment | null;
  onUpload: (file: DocumentAttachment) => void;
  onClear: () => void;
  dragActive: boolean;
  setDragActive: (active: boolean) => void;
}

export function DocPreview({
  attachment,
  onUpload,
  onClear,
  dragActive,
  setDragActive,
}: DocPreviewProps) {
  // Translate system byte count
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    const fileType = file.name.split(".").pop()?.toLowerCase() || "";
    let systemType = "txt";

    if (["jpg", "jpeg", "png", "webp", "gif"].includes(fileType)) {
      systemType = "image";
    } else if (["pdf"].includes(fileType)) {
      systemType = "pdf";
    } else if (["docx", "doc"].includes(fileType)) {
      systemType = "docx";
    } else if (["ppt", "pptx"].includes(fileType)) {
      systemType = "ppt";
    }

    const reader = new FileReader();

    if (systemType === "image") {
      reader.onload = (e) => {
        onUpload({
          name: file.name,
          type: systemType,
          size: formatBytes(file.size),
          dataUrl: e.target?.result as string,
        });
      };
      reader.readAsDataURL(file);
    } else {
      // PDF or text doc content parsing simulation
      reader.onload = (e) => {
        const textStr = (e.target?.result as string) || "";
        onUpload({
          name: file.name,
          type: systemType,
          size: formatBytes(file.size),
          textPreview: textStr.substring(0, 15000), // pass structured text preview as context
        });
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  if (!attachment) {
    return null;
  }

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      className={`w-full transition-all duration-200 select-none ${
        dragActive
          ? "border-2 border-[#C96A3D] bg-[#C96A3D]/5 rounded-3xl"
          : "border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/20 dark:bg-[#11192e]/10 hover:bg-slate-50/50 dark:hover:bg-[#11192e]/20"
      }`}
      id="nexa-doc-upload-dropzone"
    >
      <div className="flex items-center justify-between p-4 bg-white dark:bg-[#11192e] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800 shrink-0">
            {attachment.type === "image" ? (
              <Image className="w-5 h-5 text-[#C96A3D]" />
            ) : attachment.type === "pdf" ? (
              <FileText className="w-5 h-5 text-rose-500" />
            ) : (
              <FilePieChart className="w-5 h-5 text-indigo-500" />
            )}
          </div>
          <div className="min-w-0 text-left">
            <h5 className="text-sm font-bold text-[#14213D] dark:text-slate-200 truncate pr-4">
              {attachment.name}
            </h5>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md uppercase">
                {attachment.type}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">{attachment.size}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {attachment.type === "image" && attachment.dataUrl && (
            <div
              className="p-1 rounded-full text-slate-400 hover:bg-slate-55 hover:text-slate-600 dark:hover:bg-slate-800 shrink-0 select-none overflow-hidden"
              title="Preview Visual"
            >
              <img
                src={attachment.dataUrl}
                alt="Thumbnail"
                className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
              />
            </div>
          )}
          <button
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
            className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
            title="Delete File"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
