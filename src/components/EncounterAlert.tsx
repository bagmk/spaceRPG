import { t, type Lang } from '../i18n';

interface EncounterAlertProps {
  color: string;
  name: string;
  language: Lang;
}

export function EncounterAlert({ color, name, language }: EncounterAlertProps) {
  return (
    <div className="encounter-alert" style={{ color }} aria-hidden="true">
      <div className="ea-tag">{`- ${t(language, 'encounterAlert')} -`}</div>
      <div className="ea-name">{name}</div>
    </div>
  );
}
