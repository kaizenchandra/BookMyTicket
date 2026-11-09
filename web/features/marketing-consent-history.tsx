import { ConsentHistory } from "./consent-history.tsx";
export function MarketingConsentHistory({ revision }: { revision: number }) {
  return (
    <ConsentHistory
      revision={revision}
      endpoint="/profile/communications/history"
      title="Marketing email consent history"
      purpose="Marketing email"
      description="Recorded grants and withdrawals of optional marketing email permission. These records do not change required transactional communications or prove that an email was sent."
    />
  );
}
