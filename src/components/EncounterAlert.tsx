interface EncounterAlertProps {
  color: string;
  name: string;
}

export function EncounterAlert({ color, name }: EncounterAlertProps) {
  return (
    <div className="encounter-alert" style={{ color }} aria-hidden="true">
      <div className="ea-tag">- Encounter -</div>
      <div className="ea-name">{name}</div>
    </div>
  );
}
