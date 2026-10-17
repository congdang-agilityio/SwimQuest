"use client";

import { useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui";
import styles from "./finish-card.module.css";

type Props = {
  /** Path of the public finish page, e.g. `/finish/<token>`; its picture is `<path>/image`. */
  path: string;
  /** Share sheet title and text, from messages. */
  title: string;
  text: string;
  labels: { button: string; save: string; copied: string; failed: string };
};

/**
 * "Chia sẻ thành tích" (S-82): opens the phone's share menu (Web Share API) with the finish
 * picture and the public link; without file sharing it shares the link, and without the Web Share
 * API it copies the link and says so. "Lưu ảnh" downloads the picture.
 */
export function ShareFinishButton({ path, title, text, labels }: Props) {
  const [status, setStatus] = useState("");
  const [picture, setPicture] = useState<File | null>(null);
  const imagePath = `${path}/image`;

  // Load the picture ahead of the tap: the share menu must open straight from the click.
  useEffect(() => {
    if (typeof navigator.canShare !== "function") return;
    let live = true;
    fetch(imagePath)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!live || !blob) return;
        const file = new File([blob], "swimquest-finish.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) setPicture(file);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [imagePath]);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    setStatus("");
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(
          picture ? { title, text, url, files: [picture] } : { title, text, url },
        );
        return;
      } catch (error) {
        // The player closed the share menu: nothing to report.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus(labels.copied);
    } catch {
      setStatus(labels.failed);
    }
  }

  return (
    <div className={styles.share}>
      <Button variant="primary" block onClick={share} data-testid="finish-share">
        {labels.button}
      </Button>
      <a
        href={imagePath}
        download="swimquest-finish.png"
        className={buttonClass({ variant: "ghost", block: true, size: "sm" }, styles.save)}
      >
        {labels.save}
      </a>
      <p className={styles.status} role="status">
        {status}
      </p>
    </div>
  );
}
