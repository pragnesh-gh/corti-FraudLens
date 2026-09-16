import { TryYourselfExperience } from "@/components/tour/try-yourself-experience";

export const metadata = {
  title: "Try for yourself · FraudLens",
  description: "Run the FraudLens pipeline on your own clinical note — run, compare, and investigate.",
};

export default function TryYourselfPage() {
  return <TryYourselfExperience />;
}
