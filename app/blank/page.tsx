import type { Metadata } from "next";
import BlankRecorder from "@/components/blank/BlankRecorder";

export const metadata: Metadata = {
  title: "בלאנק מוקלט | ספריית מסמכים",
  description: "הקלטת משפטים בעברית והצבתם על בלאנק מחר אחר, כל משפט בגוון כהה משלו",
};

export default function BlankPage() {
  return <BlankRecorder />;
}
