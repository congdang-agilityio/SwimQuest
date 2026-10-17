import Link from "next/link";
import styles from "./leaderboard.module.css";

export type LeaderboardTab = { id: string; label: string; href: string };

/**
 * Tab strip over the leaderboard views. Each tab is a link to `?tab=`, so a tab opens without
 * client code and can be shared; the selected one carries aria-selected.
 */
export function LeaderboardTabs({
  tabs,
  active,
  label,
}: {
  tabs: readonly LeaderboardTab[];
  active: string;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={styles.tablist}>
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          role="tab"
          id={`${tab.id}-tab`}
          aria-selected={tab.id === active}
          aria-controls={`${tab.id}-panel`}
          scroll={false}
          className={styles.tab}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
