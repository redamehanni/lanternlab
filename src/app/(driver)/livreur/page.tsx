import { getDriverMissions } from "@/lib/data";
import { DriverApp } from "./_components/DriverApp";

export default async function DriverPage() {
  const missions = await getDriverMissions();
  return <DriverApp missions={missions} />;
}
