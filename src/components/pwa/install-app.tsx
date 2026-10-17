"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Card } from "@/components/ui";
import styles from "./install-app.module.css";

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

/** Profile row: opens the browser install prompt when there is one, else shows add-to-home-screen steps. */
export function InstallApp() {
  const t = useTranslations("pwa.install");
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [zalo, setZalo] = useState(false);
  const [ios, setIos] = useState(false);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setZalo(/Zalo/i.test(ua));
    setIos(/iPhone|iPad|iPod/i.test(ua));
    setReady(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!ready || installed) return null;

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    setPrompt(null);
  }

  const steps = (kind: "ios" | "other") => (
    <div className={styles.group}>
      <h3 className={styles.groupTitle}>{t(`${kind}Title`)}</h3>
      <ol className={styles.steps}>
        <li>{t(`${kind}1`)}</li>
        <li>{t(`${kind}2`)}</li>
        <li>{t(`${kind}3`)}</li>
      </ol>
    </div>
  );

  return (
    <Card className={styles.card}>
      <div className={styles.head}>
        <Image
          src="/art/mockup/brand/app-icon.webp"
          alt=""
          width={48}
          height={48}
          className={styles.icon}
        />
        <div className={styles.text}>
          <p className={styles.title}>{t("title")}</p>
          <p className={styles.subtitle}>{t("subtitle")}</p>
        </div>
      </div>
      {prompt ? (
        <Button block onClick={install}>
          {t("button")}
        </Button>
      ) : (
        <Button block variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? t("hideSteps") : t("showSteps")}
        </Button>
      )}
      {!prompt && open ? (
        <div className={styles.hints}>
          {zalo ? <p className={styles.zalo}>{t("zalo")}</p> : null}
          {ios ? steps("ios") : steps("other")}
          {!ios ? null : steps("other")}
        </div>
      ) : null}
    </Card>
  );
}
