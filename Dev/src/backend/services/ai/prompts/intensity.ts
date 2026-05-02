import type { AIDebateIntensity } from "shared/types/core";

export const INTENSITY_INSTRUCTIONS: Record<AIDebateIntensity, string> = {
  conservative:
    "\nDEBATE STYLE: Present balanced arguments. Acknowledge opposing points fairly and avoid dismissing counterarguments. Maintain a collaborative, measured tone throughout.",
  moderate:
    "\nDEBATE STYLE: Argue your position firmly while acknowledging key counterpoints. Push back on weak arguments but concede strong ones.",
  aggressive:
    "\nDEBATE STYLE: Take the STRONGEST possible position. Challenge every counterpoint raised by the opposing side. Leave no argument uncontested. Be forceful, direct, and uncompromising in your advocacy — your job is to stress-test the thesis to its limits.",
};
