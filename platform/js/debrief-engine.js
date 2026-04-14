/**
 * debrief-engine.js — Rule-based post-scenario coaching debrief.
 *
 * Input:  scenario ID, per-step answers (index, correctness, latency)
 * Output: structured debrief JSON rendered in a modal and saved to Supabase.
 *
 * Requires: debrief-data.js loaded first (window.DEBRIEF_DATA)
 */
(function () {
  'use strict';

  const DATA = window.DEBRIEF_DATA;
  if (!DATA) return;

  const SLOW_THRESHOLD = 30; // seconds — answers slower than this are "struggled"

  // ── Core analysis ──────────────────────────────────────────────────────

  function analyzeAttempt(scenarioId, stepResults) {
    const scenData = DATA[scenarioId];
    if (!scenData) return null;

    const domainScores = {};
    const weakDomains  = [];
    const strongDomains = [];

    stepResults.forEach((step, idx) => {
      const domains = scenData.stepDomains[idx] || [];
      domains.forEach(domain => {
        if (!domainScores[domain]) {
          domainScores[domain] = { correct: 0, wrong: 0, totalLatency: 0, count: 0 };
        }
        domainScores[domain].count++;
        domainScores[domain].totalLatency += step.latency;
        if (step.correct) {
          domainScores[domain].correct++;
        } else {
          domainScores[domain].wrong++;
        }
      });
    });

    Object.entries(domainScores).forEach(([domain, s]) => {
      const avgLat = s.totalLatency / s.count;
      if (s.wrong > 0 || avgLat > SLOW_THRESHOLD) {
        weakDomains.push(domain);
      } else {
        strongDomains.push(domain);
      }
    });

    return { domainScores, weakDomains, strongDomains };
  }

  // ── Build debrief output ───────────────────────────────────────────────

  function generateDebrief(scenarioId, stepResults) {
    const scenData = DATA[scenarioId];
    if (!scenData) return null;

    const analysis = analyzeAttempt(scenarioId, stepResults);
    if (!analysis) return null;

    const allCorrect = stepResults.every(s => s.correct);
    const allWrong   = stepResults.every(s => !s.correct);
    const avgLatency = Math.round(
      stepResults.reduce((s, r) => s + r.latency, 0) / stepResults.length
    );

    // Summary sentence
    let summary;
    if (allCorrect && avgLatency < SLOW_THRESHOLD) {
      summary = 'Excellent work — you identified the correct interventions efficiently. Review the teaching points below to reinforce your understanding.';
    } else if (allCorrect) {
      summary = 'You chose correctly at every step, but took longer than expected on some decisions. Under time pressure in the OR, faster pattern recognition matters.';
    } else if (allWrong) {
      summary = 'This scenario revealed several knowledge gaps. Review the teaching points carefully — these concepts come up repeatedly in clinical practice.';
    } else {
      summary = 'You demonstrated solid reasoning on some steps but struggled on others. Focus on the gap areas identified below.';
    }

    // Strengths
    const strengths = analysis.strongDomains
      .slice(0, 3)
      .map(d => formatDomainName(d));

    // Gaps
    const gaps = analysis.weakDomains
      .slice(0, 3)
      .map(d => formatDomainName(d));

    // Teaching points — prioritize weak domains, then add from strong
    const teachingPoints = [];
    const usedDomains = new Set();

    analysis.weakDomains.forEach(domain => {
      const pts = scenData.teachingPoints[domain];
      if (pts && !usedDomains.has(domain)) {
        teachingPoints.push(pts[0]);
        usedDomains.add(domain);
      }
    });
    analysis.strongDomains.forEach(domain => {
      if (teachingPoints.length >= 4) return;
      const pts = scenData.teachingPoints[domain];
      if (pts && !usedDomains.has(domain)) {
        teachingPoints.push(pts[0]);
        usedDomains.add(domain);
      }
    });

    // Micro-drill — pick from weakest domain if available
    let nextDrill = null;
    for (const domain of analysis.weakDomains) {
      const drills = scenData.drills[domain];
      if (drills && drills.length > 0) {
        const drill = drills[Math.floor(Math.random() * drills.length)];
        nextDrill = {
          domain: formatDomainName(domain),
          prompt: drill.prompt,
          choices: drill.choices,
          correct_index: drill.correct_index,
          explanation: drill.explanation,
        };
        break;
      }
    }
    // Fallback: pick from any domain with drills
    if (!nextDrill) {
      for (const domain of Object.keys(scenData.drills)) {
        const drills = scenData.drills[domain];
        if (drills && drills.length > 0) {
          const drill = drills[0];
          nextDrill = {
            domain: formatDomainName(domain),
            prompt: drill.prompt,
            choices: drill.choices,
            correct_index: drill.correct_index,
            explanation: drill.explanation,
          };
          break;
        }
      }
    }

    return {
      scenario_id:       scenarioId,
      summary,
      strengths,
      gaps,
      teaching_points:   teachingPoints,
      next_drill:        nextDrill,
      step_details:      stepResults.map((s, i) => ({
        step:    i + 1,
        correct: s.correct,
        latency: s.latency,
        domains: (scenData.stepDomains[i] || []).map(formatDomainName),
      })),
      avg_latency:       avgLatency,
      weak_domains_raw:  analysis.weakDomains,
    };
  }

  function formatDomainName(domain) {
    return domain
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── Expose globally ────────────────────────────────────────────────────

  window.DebriefEngine = { generateDebrief };

})();
