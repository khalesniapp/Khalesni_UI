import { PlanDetail } from "@/components/plans/PlanDetail";

/**
 * Plan detail — UI_Plan.md §7.6.
 *
 * `params` is a Promise in Next 16. The plan id is safe in the URL; the user id
 * is not, and never goes there (§11.1) — it comes from the identity store on
 * the client.
 */
export default async function PlanDetailPage({ params }: PageProps<"/plans/[planId]">) {
  const { planId } = await params;

  return <PlanDetail planId={planId} />;
}
