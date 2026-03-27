"use client";

import { ChangeEvent, useState } from "react";

type InboxPostComposerProps = {
  endpoint: string;
  threadId: "notifications" | "admin" | "dev";
  heading: string;
  description: string;
  submitLabel: string;
};

function compressorErrorMessage() {
  return "Could not process the selected image.";
}

async function convertImageToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error(compressorErrorMessage()));
    };
    reader.onerror = () => reject(new Error(compressorErrorMessage()));
    reader.readAsDataURL(file);
  });
}

async function shrinkImage(file: File) {
  const sourceUrl = await convertImageToDataUrl(file);
  const image = new window.Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(compressorErrorMessage()));
    image.src = sourceUrl;
  });

  const maxDimension = 720;
  const scale = Math.min(maxDimension / image.width, maxDimension / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(compressorErrorMessage());
  }

  context.drawImage(image, 0, 0, width, height);

  let quality = 0.84;
  let compressed = canvas.toDataURL("image/jpeg", quality);

  while (compressed.length > 350000 && quality > 0.45) {
    quality -= 0.08;
    compressed = canvas.toDataURL("image/jpeg", quality);
  }

  if (compressed.length > 350000) {
    throw new Error("That photo is still too large. Please choose a smaller image.");
  }

  return compressed;
}

export default function InboxPostComposer({
  endpoint,
  threadId,
  heading,
  description,
  submitLabel,
}: InboxPostComposerProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatusMessage("Please choose an image file.");
      event.target.value = "";
      return;
    }

    try {
      setUploadingPhoto(true);
      setStatusMessage("Preparing image...");
      const compressedPhoto = await shrinkImage(file);
      setPhotoDataUrl(compressedPhoto);
      setStatusMessage("Image ready to attach.");
    } catch (error) {
      console.error(error);
      setStatusMessage(error instanceof Error ? error.message : "Could not process that image.");
    } finally {
      setUploadingPhoto(false);
      event.target.value = "";
    }
  };

  const submitPost = async () => {
    if (!title.trim() || !body.trim()) {
      setStatusMessage("Title and message text are both required.");
      return;
    }

    try {
      setSubmitting(true);
      setStatusMessage("Sending post...");
      const authModule = await import("../../lib/firebase");
      const idToken = await authModule.auth.currentUser?.getIdToken();

      if (!idToken) {
        setStatusMessage("Your session expired. Please sign in again.");
        return;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          threadId,
          title: title.trim(),
          body: body.trim(),
          imageUrl: photoDataUrl || null,
        }),
      });

      const details = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setStatusMessage(details?.error || "Could not send the post.");
        return;
      }

      setTitle("");
      setBody("");
      setPhotoDataUrl("");
      setStatusMessage("Post sent.");
    } catch (error) {
      console.error(error);
      setStatusMessage(error instanceof Error ? error.message : "Could not send the post.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        padding: 18,
        borderRadius: 16,
        border: "1px solid rgba(148, 163, 184, 0.18)",
        backgroundColor: "rgba(9, 15, 25, 0.88)",
        boxShadow: "0 12px 32px rgba(2, 6, 23, 0.18)",
      }}
    >
      <h2 style={{ marginTop: 0 }}>{heading}</h2>
      <p style={{ maxWidth: 620, color: "#94a3b8" }}>{description}</p>

      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Post title"
        style={{ marginBottom: 12, maxWidth: "100%" }}
      />
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Post message"
        rows={5}
        style={{ marginBottom: 12, maxWidth: "100%", minHeight: 132 }}
      />
      <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
      {photoDataUrl ? (
        <div style={{ marginTop: 12 }}>
          <img
            src={photoDataUrl}
            alt="Post preview"
            style={{
              width: 120,
              height: 120,
              objectFit: "cover",
              borderRadius: 14,
              border: "1px solid rgba(148, 163, 184, 0.18)",
            }}
          />
        </div>
      ) : null}
      {statusMessage ? <p style={{ marginBottom: 0, color: "#cbd5e1" }}>{statusMessage}</p> : null}
      <div style={{ marginTop: 14 }}>
        <button type="button" onClick={() => void submitPost()} disabled={submitting || uploadingPhoto}>
          {submitting ? "Sending..." : submitLabel}
        </button>
      </div>
    </div>
  );
}
