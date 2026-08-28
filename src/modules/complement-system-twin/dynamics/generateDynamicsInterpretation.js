export function generateDynamicsInterpretation(result, selectedTime) {
  const current = nearestTimePoint(result.timePoints, selectedTime);
  const previous = nearestTimePoint(result.timePoints, Math.max(0, selectedTime - inferStep(result.timePoints) * 5));
  const c = current.concentrations;
  const p = previous.concentrations;
  const rising = Object.keys(c)
    .filter((key) => (c[key] ?? 0) > (p[key] ?? 0) * 1.02 + 0.01)
    .slice(0, 5);
  const falling = Object.keys(c)
    .filter((key) => (c[key] ?? 0) < (p[key] ?? 0) * 0.98 - 0.01)
    .slice(0, 5);
  const macRisk = c.MAC > 60 ? "MAC formation is elevated, suggesting higher terminal pathway pressure." : "MAC formation remains relatively contained at this time point.";
  const c3Activity = c.C3bBb > 40 || c.C3a > 250 ? "C3 activation is strongly influenced by alternative amplification." : "C3 activation is present but not yet dominated by high convertase output.";
  const intervention = result.events.find((event) => event.label === "Drug intervention applied" && selectedTime >= event.time)
    ? "The configured drug intervention has already been applied, so post-intervention rates are reflected in the current slopes."
    : "No configured drug intervention has taken effect yet at this selected time.";

  return `At ${formatTime(selectedTime)}, ${c3Activity} ${macRisk} Rising signals: ${rising.join(", ") || "none"}. Consumed or declining components: ${falling.join(", ") || "none"}. ${intervention}`;
}

export function nearestTimePoint(timePoints, selectedTime) {
  return timePoints.reduce((best, point) => Math.abs(point.time - selectedTime) < Math.abs(best.time - selectedTime) ? point : best, timePoints[0]);
}

function inferStep(timePoints) {
  if (timePoints.length < 2) return 1;
  return Math.max(0.01, timePoints[1].time - timePoints[0].time);
}

function formatTime(time) {
  if (time >= 1440) return `${(time / 1440).toFixed(1)} days`;
  if (time >= 60) return `${(time / 60).toFixed(1)} h`;
  return `${Math.round(time)} min`;
}
