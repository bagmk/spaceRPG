import type { UpgradeDefinition } from '../game/types';

interface UpgradePanelProps {
  clickUpgrade: UpgradeDefinition;
  autoUpgrade: UpgradeDefinition;
  critUpgrade: UpgradeDefinition;
  canCondense: boolean;
  entropyPreview: number;
  onBuyClick: () => void;
  onBuyAuto: () => void;
  onBuyCrit: () => void;
  onCondense: () => void;
}

function UpgradeButton({
  upgrade,
  onClick,
}: {
  upgrade: UpgradeDefinition;
  onClick: () => void;
}) {
  return (
    <button className="upgrade" type="button" disabled={upgrade.disabled} onClick={onClick}>
      <span className="upg-name">{upgrade.label}</span>
      <span className="upg-cost">{upgrade.cost}</span>
      <span className="upg-effect">{upgrade.description}</span>
      <span className="upg-level">{`LV ${upgrade.level}`}</span>
    </button>
  );
}

export function UpgradePanel({
  clickUpgrade,
  autoUpgrade,
  critUpgrade,
  canCondense,
  entropyPreview,
  onBuyClick,
  onBuyAuto,
  onBuyCrit,
  onCondense,
}: UpgradePanelProps) {
  return (
    <section className="upgrades">
      {canCondense ? (
        <button className="condense" type="button" onClick={onCondense}>
          {`CONDENSE → +${entropyPreview} ENTROPY`}
        </button>
      ) : null}
      <UpgradeButton upgrade={clickUpgrade} onClick={onBuyClick} />
      <UpgradeButton upgrade={autoUpgrade} onClick={onBuyAuto} />
      <UpgradeButton upgrade={critUpgrade} onClick={onBuyCrit} />
    </section>
  );
}
