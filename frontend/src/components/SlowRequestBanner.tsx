import { useSlowRequest } from "../hooks/useSlowRequest";

export default function SlowRequestBanner() {
  const slow = useSlowRequest();
  if (!slow) return null;

  return (
    <div className="slow-request-banner" role="status">
      Still working — if the app's been idle a while, the database is waking up. This can take up
      to a minute.
    </div>
  );
}
